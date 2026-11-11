import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import {
  addScheduleBlock,
  addManualAppointment,
  cancelAppointment,
  getBlocksForMonth,
  getScheduleForDate,
  getStudioData,
  removeScheduleBlock,
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

const mesDaData = (date) => {
  const [year, month] = date.split("-").map(Number);
  return new Date(year, month - 1, 1);
};

const chaveData = (year, month, day) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
  const [daySchedule, setDaySchedule] = useState({ slots: [], blocks: [] });
  const [monthBlocks, setMonthBlocks] = useState([]);
  const [studioDate, setStudioDate] = useState(hoje());
  const [calendarMonth, setCalendarMonth] = useState(() => mesDaData(hoje()));
  const [blockForm, setBlockForm] = useState({ start: "08:00", end: "12:00" });
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
      setDaySchedule({ slots: [], blocks: [] });
      setMonthBlocks([]);
      return;
    }
    let active = true;
    getStudioData()
      .then((data) => {
        if (!active) return;
        setRequests(data.requests);
        setAppointments(data.appointments);
        if (data.migratedAppointmentBlocks) {
          setRefresh((value) => value + 1);
        }
        setError("");
      })
      .catch((loadError) => { if (active) setError(mensagemErro(loadError)); });
    return () => { active = false; };
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getScheduleForDate(studioDate)
      .then((result) => { if (active) setDaySchedule(result); })
      .catch((loadError) => { if (active) setError(mensagemErro(loadError)); });
    return () => { active = false; };
  }, [user, studioDate, refresh]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getBlocksForMonth(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1)
      .then((result) => { if (active) setMonthBlocks(result); })
      .catch((loadError) => { if (active) setError(mensagemErro(loadError)); });
    return () => { active = false; };
  }, [user, calendarMonth, refresh]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const leadingDays = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array(leadingDays).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => chaveData(year, month + 1, index + 1)),
    ];
  }, [calendarMonth]);

  const daysWithBlocks = useMemo(
    () => new Set(monthBlocks.map((block) => block.date)),
    [monthBlocks],
  );

  const confirmedAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === "confirmed"),
    [appointments],
  );

  function setFormField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeStudioDate(date) {
    setStudioDate(date);
    if (date) setCalendarMonth(mesDaData(date));
  }

  function changeCalendarMonth(amount) {
    const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + amount, 1);
    setCalendarMonth(next);
    setStudioDate(chaveData(next.getFullYear(), next.getMonth() + 1, 1));
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

  async function saveBlock(event) {
    event.preventDefault();
    if (studioDate < hoje()) {
      setError("Escolha uma data de hoje em diante para criar um bloqueio.");
      return;
    }
    if (blockForm.start < "08:00" || blockForm.end > "22:00" || blockForm.end <= blockForm.start) {
      setError("Escolha um intervalo entre 08:00 e 22:00, com término depois do início.");
      return;
    }
    await runStudioAction(
      () => addScheduleBlock(studioDate, blockForm.start, blockForm.end),
      `Bloqueio de ${blockForm.start} a ${blockForm.end} adicionado.`,
    );
  }

  async function blockWholeDay() {
    if (studioDate < hoje()) {
      setError("Escolha uma data de hoje em diante para criar um bloqueio.");
      return;
    }
    await runStudioAction(
      () => addScheduleBlock(studioDate, "08:00", "22:00"),
      "Dia inteiro bloqueado.",
    );
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
    if (start < "08:00" || end > "22:00" || end <= start) {
      setError("O atendimento deve começar a partir das 08:00 e terminar depois do início, até as 22:00.");
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
                      <input id={`end-${request.id}`} type="time" min={request.start} max="22:00" value={durations[request.id] || ""} onChange={(event) => setDurations((current) => ({ ...current, [request.id]: event.target.value }))} />
                      <button type="button" disabled={busy} onClick={() => approve(request)}>Aprovar</button>
                      <button type="button" className="btn-danger" disabled={busy} onClick={() => runStudioAction(() => rejectBookingRequest(request.id), "Pedido recusado.")}>Recusar</button>
                    </div>
                  </article>
                ))}
              </section>

              <section className="card">
                <label htmlFor="agenda-date">Ver agenda do dia</label>
                <input id="agenda-date" type="date" value={studioDate} onChange={(event) => changeStudioDate(event.target.value)} />
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
              <h2>Agenda e bloqueios</h2>
              <p className="muted">Os inícios são gerados automaticamente de hora em hora, das 08:00 às 21:00. Agendamentos e bloqueios deixam os intervalos correspondentes indisponíveis.</p>
              <div className="calendar-heading">
                <button type="button" className="nav-secondary calendar-arrow" aria-label="Mês anterior" onClick={() => changeCalendarMonth(-1)}>‹</button>
                <h3>{calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>
                <button type="button" className="nav-secondary calendar-arrow" aria-label="Próximo mês" onClick={() => changeCalendarMonth(1)}>›</button>
              </div>
              <div className="calendar-grid" role="group" aria-label="Calendário do mês">
                {diasSemana.map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
                {calendarDays.map((date, index) => date ? (
                  <button
                    type="button"
                    key={date}
                    className={`calendar-day${studioDate === date ? " selected" : ""}${daysWithBlocks.has(date) ? " has-blocks" : ""}`}
                    aria-pressed={studioDate === date}
                    aria-label={`${date}${daysWithBlocks.has(date) ? ", com horários ocupados ou bloqueados" : ""}`}
                    onClick={() => setStudioDate(date)}
                  >
                    {Number(date.slice(-2))}
                    {daysWithBlocks.has(date) && <span aria-hidden="true">•</span>}
                  </button>
                ) : <span className="calendar-empty" key={`empty-${index}`} />)}
              </div>

              <h3 className="section-title">Horários de {studioDate}</h3>
              <ul className="slot-list">
                {daySchedule.slots.map((slot) => (
                  <li key={slot.id}>
                    <span>{slot.start}</span>
                    <span className={`badge ${slot.status === "available" ? "available" : ""}`}>
                      {slot.status === "available" ? "Livre" : slot.status === "appointment" ? "Agendado" : "Bloqueado"}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="block-actions">
                <button type="button" className="nav-secondary" disabled={busy || studioDate < hoje()} onClick={blockWholeDay}>Bloquear dia inteiro</button>
                <form className="inline-form" onSubmit={saveBlock}>
                  <div>
                    <label htmlFor="block-start">Início do bloqueio</label>
                    <input id="block-start" type="time" min="08:00" max="21:59" required value={blockForm.start} onChange={(event) => setBlockForm((current) => ({ ...current, start: event.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="block-end">Término do bloqueio</label>
                    <input id="block-end" type="time" min="08:01" max="22:00" required value={blockForm.end} onChange={(event) => setBlockForm((current) => ({ ...current, end: event.target.value }))} />
                  </div>
                  <button type="submit" disabled={busy || studioDate < hoje()}>Bloquear horário</button>
                </form>
              </div>

              <h3 className="section-title">Bloqueios manuais deste dia</h3>
              {daySchedule.blocks.filter((block) => block.type === "manual").length === 0
                ? <p className="muted">Nenhum bloqueio manual neste dia.</p>
                : daySchedule.blocks.filter((block) => block.type === "manual").map((block) => (
                  <div className="agenda-item block-item" key={block.id}>
                    <strong>{block.start}–{block.end}{block.start === "08:00" && block.end === "22:00" ? " · Dia inteiro" : ""}</strong>
                    <button type="button" className="btn-danger compact" disabled={busy} onClick={() => runStudioAction(() => removeScheduleBlock(block.id), "Bloqueio removido.")}>Remover</button>
                  </div>
                ))}
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
                    <input id="manual-start" type="time" min="08:00" max="21:59" required value={appointmentForm.start} onChange={(event) => setAppointmentForm((current) => ({ ...current, start: event.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="manual-end">Término</label>
                    <input id="manual-end" type="time" min="08:01" max="22:00" required value={appointmentForm.end} onChange={(event) => setAppointmentForm((current) => ({ ...current, end: event.target.value }))} />
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
