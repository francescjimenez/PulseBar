export default function ProcessList({ procs, colLabel, colValue }) {
  if (!procs || procs.length === 0) return null;
  return (
    <div className="proc-section">
      <div className="proc-header">
        <span className="proc-title">PROCESSES</span>
        <span className="proc-col-label">{colLabel}</span>
      </div>
      {procs.map((p, i) => (
        <div key={i} className="proc-row">
          <span className="proc-name">{p.name}</span>
          <span className="proc-val">{colValue(p)}</span>
        </div>
      ))}
    </div>
  );
}
