import { useState } from "react";
import { comprimirImagem } from "../imagem.js";

export const GALERIA = [
  { id: "harpia-brasileira", src: "/galeria/harpia-brasileira.jpg", name: "Harpia brasileira" },
  { id: "adaga-flamejante", src: "/galeria/adaga-flamejante.jpg", name: "Adaga flamejante" },
];

export default function Galeria({ value, onChange }) {
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);

  async function enviar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const src = await comprimirImagem(file);
      setPreviewImage({ type: "upload", src, name: file.name.slice(0, 100) });
      setError("");
    } catch (uploadError) {
      console.error("Erro ao preparar imagem de referência:", uploadError);
      setError(uploadError.message || "Não foi possível ler essa imagem.");
    }
  }

  function confirmImage() {
    if (!previewImage) return;
    onChange(previewImage);
    setPreviewImage(null);
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
                setPreviewImage({ type: "gallery", src: image.src, name: image.name });
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

      {previewImage && (
        <section className="image-review" aria-live="polite">
          <h3>Prévia: {previewImage.name}</h3>
          <img src={previewImage.src} alt={`Prévia da referência: ${previewImage.name}`} />
          <div className="image-review-actions">
            <button type="button" onClick={confirmImage}>Confirmar</button>
            <button type="button" className="nav-secondary" onClick={() => setPreviewImage(null)}>Voltar</button>
          </div>
        </section>
      )}

      {value && !previewImage && (
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
