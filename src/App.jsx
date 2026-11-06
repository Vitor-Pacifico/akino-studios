import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import {
  addManualAppointment,
  addAvailabilitySlot,
  cancelAppointment,
  getSlotsForDate,
  getStudioData,
  rejectBookingRequest,
  submitAppointmentRequest,
} from "./agenda.js";
import Ajuda from "./components/Ajuda.jsx";
import Formulario from "./components/Formulario.jsx";
import { ESTILOS, LOCAIS, TAMANHOS } from "./data.js";

const hoje = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const inicial = {
  nome: "",
  tel: "",
  estilo: ESTILOS[0],
  local: LOCAIS[0],
  tam: TAMANHOS[0],
  desc: "",
  data: "",
  hora: "",
};

const mensagemErro = (error) => {
  if (error.code === "permission-denied" || error.code === "failed-precondition") {
    return "O Firebase ainda não está liberando esta operação. Confira e publique as regras do Firestore descritas no README.";
  }
  return error.message || "Não foi possível concluir a operação. Tente novamente.";
};

export default function App() {
  const [form, setForm] = useState(inicial);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState("cliente");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [requests, setRequests] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [studioDate, setStudioDate] = useState(hoje());
  const [newSlotTime, setNewSlotTime] = useState("");
  const [appointmentForm, setAppointmentForm] = useState({ name: "", phone: "", date: hoje(), start: "", end: "", description: "" });
  const [durations, setDurations] = useState({});
  const [studioTab, setStudioTab] = useState("agenda");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setAuthReady(true);
  }), []);

  useEffect(() => {
    if (!user) {
      setRequests([]);
      setAppointments([]);
      return;
    }
    let active = true;
    getStudioData()
      .then((data) => {
        if (!active) return;
        setRequests(data.requests);
        setAppointments(data.appointments);
        setError("");
      })
      .catch((loadError) => { if (active) setError(mensagemErro(loadError)); });
    return () => { active = false; };
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getSlotsForDate(studioDate)
      .then((result) => { if (active) setSlots(result); })
      .catch((loadError) => { if (active) setError(mensagemErro(loadError)); });
    return () => { active = false; };
  }, [user, studioDate, refresh]);

  const confirmedAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === "confirmed"),
    [appointments],
  );

  function setFormField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function login(event) {
    event.preventDefault();
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
      setTab("estudio");
    } catch (loginFailure) {
      console.error("Erro ao entrar na área do estúdio:", loginFailure);
      setLoginError("Não foi possível entrar. Confira o e-mail e a senha cadastrados no Firebase Authentication.");
    }
  }

  async function runStudioAction(action, successMessage) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      setRefresh((value) => value + 1);
    } catch (actionError) {
      console.error("Erro na operação da agenda:", actionError);
      setError(mensagemErro(actionError));
    } finally {
      setBusy(false);
    }
  }

  async function saveAvailability(event) {
    event.preventDefault();
    if (!newSlotTime || newSlotTime < "08:00" || newSlotTime >= "20:00") {
      setError("Escolha um início entre 08:00 e 19:59.");
      return;
    }
    await runStudioAction(
      () => addAvailabilitySlot(studioDate, newSlotTime),
      `Horário ${newSlotTime} adicionado à disponibilidade.`,
    );
    setNewSlotTime("");
  }

  async function approve(request) {
    const end = durations[request.id];
    if (!end) {
      setError("Informe o horário de término antes de confirmar.");
      return;
    }
    await runStudioAction(
      () => submitAppointmentRequest(request.id, end),
      `Agendamento de ${request.name} confirmado.`,
    );
  }

  async function saveManualAppointment(event) {
    event.preventDefault();
    const { name, phone, date, start, end, description } = appointmentForm;
    if (!name.trim() || !date || !start || !end) {
      setError("Preencha nome, data, início e término do atendimento.");
      return;
    }
    if (start < "08:00" || end > "20:00" || end <= start) {
      setError("O atendimento deve começar a partir das 08:00 e terminar depois do início, até as 20:00.");
      return;
    }
    await runStudioAction(() => addManualAppointment({
      name: name.trim(),
      phone: phone.trim(),
      date,
      start,
      end,
      description: description.trim(),
    }), "Agendamento cadastrado na agenda.");
    setAppointmentForm({ name: "", phone: "", date: hoje(), start: "", end: "", description: "" });
  }

  const todaysAppointments = confirmedAppointments
    .filter((appointment) => appointment.date === studioDate)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="wrap">
      <header>
        <h1 className="logo">Akino <span>Studios</span></h1>
        <p className="tag">Old School · Anime · Lettering</p>
      </header>

      <nav className="main-nav" aria-label="Navegação principal">
        <button type="button" className={tab === "cliente" ? "nav-active" : "nav-secondary"} onClick={() => setTab("cliente")}>Agendar</button>
        <button type="button" className={tab === "estudio" ? "nav-active" : "nav-secondary"} onClick={() => setTab("estudio")}>Área do estúdio</button>
      </nav>

      {tab === "cliente" && (
        <main>
          <h2>Solicite seu agendamento</h2>
          <Ajuda onUsar={(suggestion) => setForm((current) => ({ ...current, ...suggestion }))} />
          <Formulario form={form} set={setFormField} />
        </main>
      )}

      {tab === "estudio" && !authReady && <div className="card">Carregando…</div>}

      {tab === "estudio" && authReady && !user && (
        <main className="card">
          <h2>Entrar na área do estúdio</h2>
          <form onSubmit={login}>
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <label htmlFor="login-password">Senha</label>
            <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <p className="err" role="alert">{loginError}</p>
            <button type="submit">Entrar</button>
          </form>
        </main>
      )}

      {tab === "estudio" && authReady && user && (
        <main>
          <section className="studio-heading">
            <div>
              <h2>Agenda do estúdio</h2>
              <p>Conectado como {user.email}</p>
            </div>
            <button type="button" className="nav-secondary signout" onClick={() => signOut(auth)}>Sair</button>
          </section>

          <nav className="studio-nav" aria-label="Seções da agenda">
            <button type="button" className={studioTab === "agenda" ? "nav-active" : "nav-secondary"} onClick={() => setStudioTab("agenda")}>Agendados</button>
            <button type="button" className={studioTab === "disponibilidade" ? "nav-active" : "nav-secondary"} onClick={() => setStudioTab("disponibilidade")}>Horários livres</button>
            <button type="button" className={studioTab === "manual" ? "nav-active" : "nav-secondary"} onClick={() => setStudioTab("manual")}>Cadastrar cliente</button>
          </nav>

          {error && <p className="err card" role="alert">{error}</p>}
          {notice && <p className="ok card" role="status">{notice}</p>}

          {studioTab === "agenda" && (
            <>
              <section className="card">
                <h2>Pedidos aguardando aprovação ({requests.length})</h2>
                {requests.length === 0 && <p className="muted">Nenhum pedido pendente.</p>}
                {requests.map((request) => (
                  <article className="agenda-item" key={request.id}>
                    <div>
                      <strong>{request.name}</strong>
                      <p>{request.date} às {request.start} · {request.phone}</p>
                      <p>{request.style} · {request.location} · {request.size}</p>
                      {request.description && <p>{request.description}</p>}
                    </div>
                    <div className="request-actions">
                      <label htmlFor={`end-${request.id}`}>Término estimado</label>
                      <input id={`end-${request.id}`} type="time" min={request.start} max="20:00" value={durations[request.id] || ""} onChange={(event) => setDurations((current) => ({ ...current, [request.id]: event.target.value }))} />
                      <button type="button" disabled={busy} onClick={() => approve(request)}>Aprovar</button>
                      <button type="button" className="btn-danger" disabled={busy} onClick={() => runStudioAction(() => rejectBookingRequest(request.id), "Pedido recusado.")}>Recusar</button>
                    </div>
                  </article>
                ))}
              </section>

              <section className="card">
                <label htmlFor="agenda-date">Ver agenda do dia</label>
                <input id="agenda-date" type="date" value={studioDate} onChange={(event) => setStudioDate(event.target.value)} />
                <h2 className="section-title">Agendamentos de {studioDate}</h2>
                {todaysAppointments.length === 0 && <p className="muted">Nenhum atendimento confirmado neste dia.</p>}
                {todaysAppointments.map((appointment) => (
                  <article className="agenda-item" key={appointment.id}>
                    <div>
                      <strong>{appointment.start}–{appointment.end} · {appointment.name}</strong>
                      {appointment.phone && <p>{appointment.phone}</p>}
                      {appointment.style && <p>{appointment.style} · {appointment.location} · {appointment.size}</p>}
                      {appointment.description && <p>{appointment.description}</p>}
                      <span className="badge">{appointment.source === "online" ? "Pedido do site" : "Cadastro manual"}</span>
                    </div>
                    <button type="button" className="btn-danger compact" disabled={busy} onClick={() => {
                      if (window.confirm(`Cancelar o atendimento de ${appointment.name}?`)) {
                        runStudioAction(() => cancelAppointment(appointment.id), "Agendamento cancelado.");
                      }
                    }}>Cancelar</button>
                  </article>
                ))}
              </section>
            </>
          )}

          {studioTab === "disponibilidade" && (
            <section className="card">
              <h2>Definir horários para agendamento</h2>
              <p className="muted">Cadastre os inícios livres do dia. Horários entre 08:00 e 20:00; a duração é definida ao aprovar o pedido.</p>
              <label htmlFor="availability-date">Data</label>
              <input id="availability-date" type="date" min={hoje()} value={studioDate} onChange={(event) => setStudioDate(event.target.value)} />
              <form className="inline-form" onSubmit={saveAvailability}>
                <div>
                  <label htmlFor="slot-time">Horário de início</label>
                  <input id="slot-time" type="time" min="08:00" max="19:59" required value={newSlotTime} onChange={(event) => setNewSlotTime(event.target.value)} />
                </div>
                <button type="submit" disabled={busy}>Adicionar horário</button>
              </form>
              <h3>Horários de {studioDate}</h3>
              {slots.length === 0 && <p className="muted">Nenhum horário cadastrado para esta data.</p>}
              <ul className="slot-list">
                {slots.map((slot) => <li key={slot.id}><span>{slot.start}</span><span className={slot.available ? "badge available" : "badge"}>{slot.available ? "Livre" : "Indisponível"}</span></li>)}
              </ul>
            </section>
          )}

          {studioTab === "manual" && (
            <section className="card">
              <h2>Cadastrar agendamento feito por fora</h2>
              <form onSubmit={saveManualAppointment}>
                <label htmlFor="manual-name">Nome do cliente</label>
                <input id="manual-name" required maxLength={100} value={appointmentForm.name} onChange={(event) => setAppointmentForm((current) => ({ ...current, name: event.target.value }))} />
                <label htmlFor="manual-phone">Telefone ou WhatsApp (opcional)</label>
                <input id="manual-phone" type="tel" maxLength={30} value={appointmentForm.phone} onChange={(event) => setAppointmentForm((current) => ({ ...current, phone: event.target.value }))} />
                <label htmlFor="manual-date">Data</label>
                <input id="manual-date" type="date" min={hoje()} required value={appointmentForm.date} onChange={(event) => setAppointmentForm((current) => ({ ...current, date: event.target.value }))} />
                <div className="time-fields">
                  <div>
                    <label htmlFor="manual-start">Início</label>
                    <input id="manual-start" type="time" min="08:00" max="19:59" required value={appointmentForm.start} onChange={(event) => setAppointmentForm((current) => ({ ...current, start: event.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="manual-end">Término</label>
                    <input id="manual-end" type="time" min="08:01" max="20:00" required value={appointmentForm.end} onChange={(event) => setAppointmentForm((current) => ({ ...current, end: event.target.value }))} />
                  </div>
                </div>
                <label htmlFor="manual-description">Observações (opcional)</label>
                <textarea id="manual-description" maxLength={2000} value={appointmentForm.description} onChange={(event) => setAppointmentForm((current) => ({ ...current, description: event.target.value }))} />
                <button type="submit" disabled={busy}>Salvar na agenda</button>
              </form>
            </section>
          )}

          <button type="button" className="btn2 refresh-button" onClick={() => setRefresh((value) => value + 1)}>Atualizar agenda</button>
        </main>
      )}

      <footer>© Akino Studios</footer>
    </div>
  );
}
