export default function BigStat({ value, label, color }) {
  return (
    <div className="big-stat">
      <div className="big-val" style={{ color }}>{value}</div>
      <div className="big-label">{label}</div>
    </div>
  );
}
