export const HORA_INICIO = 8;
export const HORA_FIM = 22;

export function gerarHorarios() {
  return Array.from({ length: HORA_FIM - HORA_INICIO }, (_, index) =>
    `${String(HORA_INICIO + index).padStart(2, "0")}:00`
  );
}

const minutos = (hora) => {
  const [horas, mins] = hora.split(":").map(Number);
  return horas * 60 + mins;
};

export function conflita(inicio, fim, intervalo) {
  return minutos(inicio) < minutos(intervalo.end) &&
    minutos(fim) > minutos(intervalo.start);
}

export function estaLivre(data, inicio, fim, intervalos) {
  return !intervalos.some((intervalo) =>
    intervalo.date === data && conflita(inicio, fim, intervalo)
  );
}
