import {
  addDoc,
  writeBatch,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { conflita, estaLivre, gerarHorarios, HORA_FIM, HORA_INICIO } from "./horarios.js";

const scheduleDayRef = (date) => doc(db, "scheduleDays", date);
const appointmentBlockId = (appointmentId) => `appointment_${appointmentId}`;

async function getDayRecords(transaction, date) {
  await transaction.get(scheduleDayRef(date));

  // Queries are read separately; the shared day document makes same-day writes retry together.
  const [appointments, blocks] = await Promise.all([
    getDocs(query(collection(db, "appointments"), where("date", "==", date))),
    getDocs(query(collection(db, "bloqueios"), where("date", "==", date))),
  ]);
  return { appointments, blocks };
}

function markDayChanged(transaction, date) {
  transaction.set(scheduleDayRef(date), { updatedAt: serverTimestamp() }, { merge: true });
}

export async function getAvailableSlots(date) {
  const result = await getDocs(query(collection(db, "bloqueios"), where("date", "==", date)));
  const blocks = result.docs.map((snapshot) => snapshot.data());
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return gerarHorarios()
    .filter((start) => date > today || (date === today && start > currentTime))
    .filter((start) => estaLivre(date, start, `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00`, blocks))
    .map((start) => ({ id: `${date}_${start}`, date, start }));
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

  const confirmedAppointments = appointments.docs
    .filter((snapshot) => snapshot.data().status === "confirmed")
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
  const existingAppointmentBlocks = await getDocs(
    query(collection(db, "bloqueios"), where("type", "==", "appointment")),
  );
  const knownBlockIds = new Set(existingAppointmentBlocks.docs.map((snapshot) => snapshot.id));
  const missingBlocks = confirmedAppointments.filter(
    (appointment) => !knownBlockIds.has(appointmentBlockId(appointment.id)),
  );

  for (let index = 0; index < missingBlocks.length; index += 450) {
    const batch = writeBatch(db);
    missingBlocks.slice(index, index + 450).forEach((appointment) => {
      batch.set(doc(db, "bloqueios", appointmentBlockId(appointment.id)), {
        date: appointment.date,
        start: appointment.start,
        end: appointment.end,
        type: "appointment",
      });
    });
    await batch.commit();
  }

  return {
    requests: requests.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)),
    appointments: appointments.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)),
    migratedAppointmentBlocks: missingBlocks.length > 0,
  };
}

export async function getScheduleForDate(date) {
  const result = await getDocs(query(collection(db, "bloqueios"), where("date", "==", date)));
  const blocks = result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
  const slots = gerarHorarios().map((start) => {
    const end = `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00`;
    const conflicts = blocks.filter((block) => conflita(start, end, block));
    const status = conflicts.some((block) => block.type === "appointment")
      ? "appointment"
      : conflicts.length
        ? "blocked"
        : "available";
    return { id: `${date}_${start}`, start, status };
  });
  return { slots, blocks };
}

export async function getBlocksForMonth(year, month) {
  const dateKey = (day) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const lastDay = new Date(year, month, 0).getDate();
  const result = await getDocs(query(
    collection(db, "bloqueios"),
    where("date", ">=", dateKey(1)),
    where("date", "<=", dateKey(lastDay)),
  ));
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}

export async function addScheduleBlock(date, start, end) {
  if (start < `${String(HORA_INICIO).padStart(2, "0")}:00` ||
      end > `${String(HORA_FIM).padStart(2, "0")}:00` ||
      end <= start) {
    throw new Error("O bloqueio deve ficar entre 08:00 e 22:00, com término depois do início.");
  }

  const blockRef = doc(collection(db, "bloqueios"));
  await runTransaction(db, async (transaction) => {
    const dayRecords = await getDayRecords(transaction, date);
    const appointmentConflict = dayRecords.appointments.docs.some((snapshot) => {
      const appointment = snapshot.data();
      return appointment.status === "confirmed" && conflita(start, end, appointment);
    });
    const blockConflict = dayRecords.blocks.docs.some((snapshot) =>
      conflita(start, end, snapshot.data())
    );
    if (appointmentConflict) throw new Error("Esse intervalo sobrepõe um agendamento confirmado.");
    if (blockConflict) throw new Error("Esse intervalo já está bloqueado ou ocupado.");

    markDayChanged(transaction, date);
    transaction.set(blockRef, {
      date,
      start,
      end,
      type: "manual",
      createdAt: serverTimestamp(),
    });
  });
}

export async function removeScheduleBlock(blockId) {
  const blockRef = doc(db, "bloqueios", blockId);
  await runTransaction(db, async (transaction) => {
    const blockSnapshot = await transaction.get(blockRef);
    if (!blockSnapshot.exists() || blockSnapshot.data().type !== "manual") {
      throw new Error("Esse bloqueio não existe ou não pode ser removido por aqui.");
    }

    const date = blockSnapshot.data().date;
    await getDayRecords(transaction, date);
    markDayChanged(transaction, date);
    transaction.delete(blockRef);
  });
}

export async function submitAppointmentRequest(requestId, end) {
  const requestRef = doc(db, "requests", requestId);
  const appointmentRef = doc(collection(db, "appointments"));

  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists() || requestSnapshot.data().status !== "pending") {
      throw new Error("Esse pedido já foi tratado ou não existe.");
    }

    const request = requestSnapshot.data();
    const dayRecords = await getDayRecords(transaction, request.date);
    if (request.start < `${String(HORA_INICIO).padStart(2, "0")}:00` ||
        request.start >= `${String(HORA_FIM).padStart(2, "0")}:00`) {
      throw new Error("O horário inicial precisa ficar entre 08:00 e 22:00.");
    }
    if (end <= request.start || end > `${String(HORA_FIM).padStart(2, "0")}:00`) {
      throw new Error("Escolha um término depois do início e até as 22:00.");
    }

    const appointmentConflict = dayRecords.appointments.docs.some((snapshot) => {
      const appointment = snapshot.data();
      return appointment.status === "confirmed" &&
        conflita(request.start, end, appointment);
    });
    const blockConflict = dayRecords.blocks.docs.some((snapshot) =>
      conflita(request.start, end, snapshot.data())
    );
    if (appointmentConflict || blockConflict) {
      throw new Error("Já existe um agendamento confirmado nesse intervalo.");
    }

    transaction.set(appointmentRef, {
      name: request.name,
      phone: request.phone,
      style: request.style,
      location: request.location,
      size: request.size,
      description: request.description,
      ...(request.image ? { image: request.image } : {}),
      date: request.date,
      start: request.start,
      end,
      status: "confirmed",
      source: "online",
      createdAt: serverTimestamp(),
    });
    transaction.set(doc(db, "bloqueios", appointmentBlockId(appointmentRef.id)), {
      date: request.date,
      start: request.start,
      end,
      type: "appointment",
    });
    transaction.update(requestRef, { status: "approved", appointmentId: appointmentRef.id });
    markDayChanged(transaction, request.date);
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

  await runTransaction(db, async (transaction) => {
    const dayRecords = await getDayRecords(transaction, appointment.date);

    const appointmentConflict = dayRecords.appointments.docs.some((snapshot) => {
      const existing = snapshot.data();
      return existing.status === "confirmed" &&
        conflita(appointment.start, appointment.end, existing);
    });
    const blockConflict = dayRecords.blocks.docs.some((snapshot) =>
      conflita(appointment.start, appointment.end, snapshot.data())
    );
    if (appointmentConflict || blockConflict) {
      throw new Error("Esse período conflita com outro agendamento ou bloqueio.");
    }

    markDayChanged(transaction, appointment.date);
    transaction.set(appointmentRef, {
      ...appointment,
      status: "confirmed",
      source: "manual",
      createdAt: serverTimestamp(),
    });
    transaction.set(doc(db, "bloqueios", appointmentBlockId(appointmentRef.id)), {
      date: appointment.date,
      start: appointment.start,
      end: appointment.end,
      type: "appointment",
    });
  });
}

export async function cancelAppointment(appointmentId) {
  const appointmentRef = doc(db, "appointments", appointmentId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(appointmentRef);
    if (!snapshot.exists() || snapshot.data().status !== "confirmed") {
      throw new Error("Esse agendamento já foi cancelado ou não existe.");
    }

    const appointment = snapshot.data();
    const dayRecords = await getDayRecords(transaction, appointment.date);
    const blockRef = doc(db, "bloqueios", appointmentBlockId(appointmentId));
    await transaction.get(blockRef);

    markDayChanged(transaction, appointment.date);
    transaction.update(appointmentRef, { status: "cancelled" });
    transaction.delete(blockRef);
  });
}
