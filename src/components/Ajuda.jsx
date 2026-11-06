import { useState } from "react";
import Chip from "./Chip.jsx";
import { QUIZ, DESC } from "../data.js";

export default function Ajuda({ onUsar }) {
  const [resp, setResp] = useState({});
  const [res, setRes] = useState(null);

  function sugerir() {
    if (QUIZ.some((q) => !resp[q.id])) return setRes({ erro: true });
    const primeira = resp.q4 === "1";
    // Primeira tattoo: evita regiões mais sensíveis
    const local = primeira && resp.q2 === "Costas" ? "Panturrilha" : resp.q2;
    setRes({ estilo: resp.q1, local, tam: resp.q3, primeira });
  }

  function usar() {
    onUsar({ estilo: res.estilo, local: res.local, tam: res.tam });
    document.getElementById("form-tattoo")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <details className="card help">
      <summary>🤔 Não sabe o que fazer? Te ajudo a decidir</summary>
      <div className="in">
        {QUIZ.map((q) => (
          <div key={q.id}>
            <p className="q">{q.t}</p>
            <div className="chips">
              {q.o.map(([rotulo, valor]) => (
                <Chip key={valor} name={q.id} value={valor} checked={resp[q.id] === valor} onChange={(v) => setResp({ ...resp, [q.id]: v })}>
                  {rotulo}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className="btn2" onClick={sugerir}>Ver minha sugestão</button>

        {res?.erro && <div className="res">Responda todas as perguntas para eu sugerir algo.</div>}
        {res && !res.erro && (
          <div className="res">
            Minha sugestão: <b>{res.estilo}</b> ({DESC[res.estilo]}) no <b>{res.local}</b>, tamanho <b>{res.tam}</b>.
            {res.primeira && " Como é sua primeira tattoo, indico regiões com menos sensibilidade, como braço, antebraço ou panturrilha."}
            {" "}Dica: junte 2 ou 3 imagens que você goste e anexe abaixo.
            <button type="button" onClick={usar}>Usar na minha solicitação</button>
          </div>
        )}
      </div>
    </details>
  );
}
