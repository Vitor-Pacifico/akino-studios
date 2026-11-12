import { useState } from "react";
import { comprimirImagem } from "../imagem.js";

export const GALERIA = [
  { id: "harpia-brasileira", src: "/galeria/harpia-brasileira.jpg", name: "Harpia brasileira" },
  { id: "adaga-flamejante", src: "/galeria/adaga-flamejante.jpg", name: "Adaga flamejante" },
  { id: "Andorinha", src: "/galeria/Andorinha.jpg", name: "Andorinha"},
  { id: "Black and Grey-Virgem Maria", src: "/galeria/Black and Grey-Virgem Maria.jpg", name: "Black and Grey-Virgem Maria"},
  { id: "Geisha-Mulher", src: "/galeria/Geisha-Mulher.jpg", name: "Geisha-Mulher"},
  { id: "Malenia, Blade of Miquella", src: "/galeria/Malenia, Blade of Miquella.jpg", name: "Malenia, Blade of Miquella"},
  { id: "New School-Hannya", src: "/galeria/New School-Hannya.jpg", name: "New School-Hannya"},
  { id: "O Gato Lutador de Boxe", src: "/galeria/O Gato Lutador de Boxe.jpg", name: "O Gato Lutador de Boxe"},
  { id: "O Lobo Uivando com o Sol Vermelho", src: "/galeria/O Lobo Uivando com o Sol Vermelho.jpg", name: "O Lobo Uivando com o Sol Vermelho"},
  { id: "O Tigre Japonês", src: "/galeria/O Tigre Japonês.jpg", name: "O Tigre Japonês"},
  { id: "Sailor Girl", src: "/galeria/Sailor Girl.jpg", name: "Sailor Girl"},
  { id: "Smokign Pin-up", src: "/galeria/Smokign Pin-up.jpg", name: "Smokign Pin-up"},
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
