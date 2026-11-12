const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const chaveData = (year, month, day) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export default function Calendario({
  month,
  selectedDate,
  daysWithBlocks,
  disabledDates = new Set(),
  minDate = "",
  onSelectDate,
  onChangeMonth,
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leadingDays = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const days = [
    ...Array(leadingDays).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => chaveData(year, monthIndex + 1, index + 1)),
  ];

  return (
    <>
      <div className="calendar-heading">
        <button type="button" className="nav-secondary calendar-arrow" aria-label="Mês anterior" onClick={() => onChangeMonth(-1)}>‹</button>
        <h3>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>
        <button type="button" className="nav-secondary calendar-arrow" aria-label="Próximo mês" onClick={() => onChangeMonth(1)}>›</button>
      </div>
      <div className="calendar-grid" role="group" aria-label="Calendário do mês">
        {diasSemana.map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
        {days.map((date, index) => date ? (
          <button
            type="button"
            key={date}
            className={`calendar-day${selectedDate === date ? " selected" : ""}${daysWithBlocks.has(date) ? " has-blocks" : ""}`}
            aria-pressed={selectedDate === date}
            aria-label={`${date}${daysWithBlocks.has(date) ? ", com horários ocupados ou bloqueados" : ""}${disabledDates.has(date) ? ", sem horários disponíveis" : ""}`}
            disabled={(minDate && date < minDate) || disabledDates.has(date)}
            onClick={() => onSelectDate(date)}
          >
            {Number(date.slice(-2))}
            {daysWithBlocks.has(date) && <span aria-hidden="true">•</span>}
          </button>
        ) : <span className="calendar-empty" key={`empty-${index}`} />)}
      </div>
    </>
  );
}
