import { useState } from "react";
import { comprimirImagem } from "../imagem.js";

export const GALERIA = [];

export default function Galeria({ value, onChange }) {
  const [error, setError] = useState("");

  async function enviar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const src = await comprimirImagem(file);
      onChange({ type: "upload", src, name: file.name.slice(0, 100) });
      setError("");
    } catch (uploadError) {
      console.error("Erro ao preparar imagem de referência:", uploadError);
      setError(uploadError.message || "Não foi possível ler essa imagem.");
    }
  }

  return (
    <div className="tattoo-gallery">
      {GALERIA.length > 0 ? (
        <div className="gallery-grid">
          {GALERIA.map((image) => (
            <button
              type="button"
              key={image.id}
              className={`gallery-item${value?.src === image.src ? " selected" : ""}`}
              aria-pressed={value?.src === image.src}
              onClick={() => {
                onChange({ type: "gallery", src: image.src, name: image.name });
                setError("");
              }}
            >
              <img src={image.src} alt={image.name} />
              <span>{image.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">A galeria ainda não tem imagens. O estúdio pode adicioná-las em public/galeria.</p>
      )}

      <label htmlFor="tattoo-reference">Ou envie sua própria referência</label>
      <input id="tattoo-reference" type="file" accept="image/*" onChange={enviar} />

      {value && (
        <div className="reference-preview">
          <img src={value.src} alt={`Referência selecionada: ${value.name}`} />
          <div>
            <p>{value.name}</p>
            <button type="button" className="nav-secondary compact" onClick={() => onChange(null)}>
              Remover imagem
            </button>
          </div>
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
