export default function Chip({ name, value, checked, onChange, children }) {
  return (
    <label className="chip">
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} />
      <span>{children ?? value}</span>
    </label>
  );
}
