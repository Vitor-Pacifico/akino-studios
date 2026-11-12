const TAMANHO_MAXIMO = 700_000;
const TAMANHO_MAXIMO_ORIGINAL = 20 * 1024 * 1024;

export function comprimirImagem(file) {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Escolha um arquivo de imagem."));
  }
  if (file.size > TAMANHO_MAXIMO_ORIGINAL) {
    return Promise.reject(new Error("A imagem original deve ter no máximo 20 MB."));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      try {
        let scale = Math.min(1, 1000 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Não foi possível preparar essa imagem neste navegador.");
        }

        for (let attempt = 0; attempt < 8; attempt += 1) {
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const quality = Math.max(0.35, 0.75 - attempt * 0.08);
          const result = canvas.toDataURL("image/jpeg", quality);
          if (result.length <= TAMANHO_MAXIMO) {
            URL.revokeObjectURL(url);
            resolve(result);
            return;
          }
          scale *= 0.8;
        }

        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível reduzir a imagem o suficiente. Escolha outra imagem."));
      } catch (imageError) {
        URL.revokeObjectURL(url);
        reject(imageError);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler essa imagem."));
    };
    image.src = url;
  });
}
