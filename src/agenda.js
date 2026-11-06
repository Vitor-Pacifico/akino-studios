import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js";

const minutes = (time) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};

const overlaps = (startA, endA, startB, endB) =>
  minutes(startA) < minutes(endB) && minutes(endA) > minutes(startB);

export async function getAvailableSlots(date) {
  const result = await getDocs(
    query(collection(db, "availability"), where("date", "==", date), where("available", "==", true)),
  );
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function createBookingRequest(booking) {
  return addDoc(collection(db, "requests"), {
    ...booking,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getStudioData() {
  const [requests, appointments] = await Promise.all([
    getDocs(query(collection(db, "requests"), where("status", "==", "pending"))),
    getDocs(collection(db, "appointments")),
  ]);

  return {
    requests: requests.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)),
    appointments: appointments.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)),
  };
}

export async function getSlotsForDate(date) {
  const result = await getDocs(query(collection(db, "availability"), where("date", "==", date)));
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function addAvailabilitySlot(date, start) {
  const slotId = `${date}_${start}`;
  const slotRef = doc(db, "availability", slotId);

  await runTransaction(db, async (transaction) => {
    const [existing, dayAppointments] = await Promise.all([
      transaction.get(slotRef),
      transaction.get(query(collection(db, "appointments"), where("date", "==", date))),
    ]);
    if (existing.exists() && existing.data().available) {
      throw new Error("Esse horário já está na lista de disponíveis.");
    }

    const alreadyBooked = dayAppointments.docs.some((snapshot) => {
      const appointment = snapshot.data();
      return appointment.status === "confirmed" &&
        minutes(start) >= minutes(appointment.start) && minutes(start) < minutes(appointment.end);
    });
    if (alreadyBooked) throw new Error("Esse início está dentro do período de um agendamento confirmado.");

    transaction.set(slotRef, { date, start, available: true, createdAt: serverTimestamp() });
  });
}

export async function submitAppointmentRequest(requestId, end) {
  const requestRef = doc(db, "requests", requestId);
  const appointmentRef = doc(collection(db, "appointments"));
  const availability = collection(db, "availability");
  const appointments = collection(db, "appointments");

  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists() || requestSnapshot.data().status !== "pending") {
      throw new Error("Esse pedido já foi tratado ou não existe.");
    }

    const request = requestSnapshot.data();
    const slotRef = doc(db, "availability", request.slotId);
    const [slotSnapshot, dayAppointments, daySlots] = await Promise.all([
      transaction.get(slotRef),
      transaction.get(query(appointments, where("date", "==", request.date))),
      transaction.get(query(availability, where("date", "==", request.date))),
    ]);

    if (!slotSnapshot.exists() || !slotSnapshot.data().available) {
      throw new Error("Esse horário já não está livre. Atualize os horários disponíveis.");
    }
    if (minutes(end) <= minutes(request.start) || minutes(end) > 20 * 60) {
      throw new Error("Escolha um término depois do início e até as 20:00.");
    }

    const conflicts = dayAppointments.docs.some((snapshot) => {
      const appointment = snapshot.data();
      return appointment.status === "confirmed" &&
        overlaps(request.start, end, appointment.start, appointment.end);
    });
    if (conflicts) {
      throw new Error("Já existe um agendamento confirmado nesse intervalo.");
    }

    transaction.set(appointmentRef, {
      name: request.name,
      phone: request.phone,
      style: request.style,
      location: request.location,
      size: request.size,
      description: request.description,
      date: request.date,
      start: request.start,
      end,
      status: "confirmed",
      source: "online",
      createdAt: serverTimestamp(),
    });
    transaction.update(requestRef, { status: "approved", appointmentId: appointmentRef.id });

    for (const snapshot of daySlots.docs) {
      const slot = snapshot.data();
      if (slot.available && minutes(slot.start) >= minutes(request.start) && minutes(slot.start) < minutes(end)) {
        transaction.update(snapshot.ref, { available: false });
      }
    }
  });
}

export async function rejectBookingRequest(requestId) {
  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, "requests", requestId);
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists() || snapshot.data().status !== "pending") {
      throw new Error("Esse pedido já foi tratado ou não existe.");
    }
    transaction.update(requestRef, { status: "rejected" });
  });
}

export async function addManualAppointment(appointment) {
  const appointmentRef = doc(collection(db, "appointments"));
  const availability = collection(db, "availability");
  const appointments = collection(db, "appointments");

  await runTransaction(db, async (transaction) => {
    const [dayAppointments, daySlots] = await Promise.all([
      transaction.get(query(appointments, where("date", "==", appointment.date))),
      transaction.get(query(availability, where("date", "==", appointment.date))),
    ]);

    const conflicts = dayAppointments.docs.some((snapshot) => {
      const existing = snapshot.data();
      return existing.status === "confirmed" &&
        overlaps(appointment.start, appointment.end, existing.start, existing.end);
    });
    if (conflicts) throw new Error("Esse período conflita com outro agendamento confirmado.");

    transaction.set(appointmentRef, {
      ...appointment,
      status: "confirmed",
      source: "manual",
      createdAt: serverTimestamp(),
    });

    for (const snapshot of daySlots.docs) {
      const slot = snapshot.data();
      if (slot.available && minutes(slot.start) >= minutes(appointment.start) && minutes(slot.start) < minutes(appointment.end)) {
        transaction.update(snapshot.ref, { available: false });
      }
    }
  });
}

export async function cancelAppointment(appointmentId) {
  const appointmentRef = doc(db, "appointments", appointmentId);
  const appointments = collection(db, "appointments");
  const availability = collection(db, "availability");

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(appointmentRef);
    if (!snapshot.exists() || snapshot.data().status !== "confirmed") {
      throw new Error("Esse agendamento já foi cancelado ou não existe.");
    }

    const appointment = snapshot.data();
    const [dayAppointments, daySlots] = await Promise.all([
      transaction.get(query(appointments, where("date", "==", appointment.date))),
      transaction.get(query(availability, where("date", "==", appointment.date))),
    ]);

    transaction.update(appointmentRef, { status: "cancelled" });

    for (const slotSnapshot of daySlots.docs) {
      const slot = slotSnapshot.data();
      if (slot.available || minutes(slot.start) < minutes(appointment.start) || minutes(slot.start) >= minutes(appointment.end)) {
        continue;
      }

      const stillBooked = dayAppointments.docs.some((otherSnapshot) => {
        if (otherSnapshot.id === appointmentId) return false;
        const other = otherSnapshot.data();
        return other.status === "confirmed" &&
          minutes(slot.start) >= minutes(other.start) && minutes(slot.start) < minutes(other.end);
      });

      if (!stillBooked) transaction.update(slotSnapshot.ref, { available: true });
    }
  });
}
