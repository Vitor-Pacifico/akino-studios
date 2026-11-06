import { useEffect, useState } from "react";
import { createBookingRequest, getAvailableSlots } from "../agenda.js";
import { ESTILOS, LOCAIS, TAMANHOS } from "../data.js";

const hoje = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function Formulario({ form, set }) {
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let active = true;
    setSlots([]);
    setError("");

    if (!form.data) return () => { active = false; };

    setLoadingSlots(true);
    getAvailableSlots(form.data)
      .then((available) => { if (active) setSlots(available); })
      .catch(() => { if (active) setError("Não foi possível carregar os horários. Tente novamente."); })
      .finally(() => { if (active) setLoadingSlots(false); });

    return () => { active = false; };
  }, [form.data]);

  async function enviar(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.nome.trim() || form.tel.replace(/\D/g, "").length < 10) {
      setError("Informe seu nome e um telefone/WhatsApp válido.");
      return;
    }
    if (!form.data || !form.hora) {
      setError("Escolha a data e um horário disponível.");
      return;
    }
    if (!consent) {
      setError("Confirme que concorda com o uso dos dados para analisar e responder ao pedido.");
      return;
    }

    const slot = slots.find((item) => item.start === form.hora);
    if (!slot) {
      setError("Esse horário não está mais disponível. Atualize a data e escolha outro.");
      return;
    }

    setSending(true);
    try {
      await createBookingRequest({
        name: form.nome.trim(),
        phone: form.tel.trim(),
        style: form.estilo,
        location: form.local,
        size: form.tam,
        description: form.desc.trim(),
        date: form.data,
        start: slot.start,
        slotId: slot.id,
      });
      setSuccess("Pedido enviado! O estúdio precisa confirmar para o horário ficar reservado.");
      set("nome", "");
      set("tel", "");
      set("desc", "");
      set("hora", "");
    } catch (requestError) {
      console.error("Erro ao enviar pedido de agendamento:", requestError);
      setError("Não foi possível enviar o pedido. O horário pode ter mudado; atualize a página e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form id="form-tattoo" onSubmit={enviar} noValidate>
      <div className="card">
        <h2>Seus dados</h2>
        <label htmlFor="nome">Nome completo</label>
        <input id="nome" autoComplete="name" maxLength={100} required value={form.nome} onChange={(event) => set("nome", event.target.value)} />
        <label htmlFor="tel">Telefone ou WhatsApp</label>
        <input id="tel" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="(15) 99824-1963" required value={form.tel} onChange={(event) => set("tel", event.target.value)} />
      </div>

      <div className="card">
        <h2>Sua tattoo</h2>
        <label htmlFor="estilo">Estilo</label>
        <select id="estilo" value={form.estilo} onChange={(event) => set("estilo", event.target.value)}>
          {ESTILOS.map((style) => <option key={style}>{style}</option>)}
        </select>
        <label htmlFor="local">Local do corpo</label>
        <select id="local" value={form.local} onChange={(event) => set("local", event.target.value)}>
          {LOCAIS.map((location) => <option key={location}>{location}</option>)}
        </select>
        <label htmlFor="tam">Tamanho aproximado</label>
        <select id="tam" value={form.tam} onChange={(event) => set("tam", event.target.value)}>
          {TAMANHOS.map((size) => <option key={size}>{size}</option>)}
        </select>
        <label htmlFor="desc">Descreva sua ideia</label>
        <textarea id="desc" maxLength={2000} placeholder="Referências, cores, detalhes…" value={form.desc} onChange={(event) => set("desc", event.target.value)} />
      </div>

      <div className="card">
        <h2>Data e horário</h2>
        <label htmlFor="data">Escolha o dia</label>
        <input id="data" type="date" min={hoje()} required value={form.data} onChange={(event) => { set("data", event.target.value); set("hora", ""); }} />
        <label htmlFor="hora">Horário disponível</label>
        <select id="hora" required value={form.hora} disabled={!form.data || loadingSlots || slots.length === 0} onChange={(event) => set("hora", event.target.value)}>
          <option value="">{loadingSlots ? "Carregando horários…" : slots.length ? "Selecione um horário" : "Sem horários disponíveis nesta data"}</option>
          {slots.map((slot) => <option key={slot.id} value={slot.start}>{slot.start}</option>)}
        </select>
        <label className="consent-label">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          Concordo que meus dados sejam armazenados para analisar e responder a este pedido de agendamento.
        </label>
        <p className="err" role="alert">{error}</p>
        <p className="ok" role="status">{success}</p>
      </div>

      <button type="submit" disabled={sending}>{sending ? "Enviando…" : "Solicitar agendamento"}</button>
      <p className="note">Seu nome, contato e detalhes serão usados pelo Akino Studios para analisar e responder a este pedido. O pedido só fica confirmado depois da aprovação do estúdio; a duração é definida pelo estúdio.</p>
    </form>
  );
}
