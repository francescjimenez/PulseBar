export default function ProcessList({ procs, colLabel, colValue }) {
  if (!procs || procs.length === 0) return null;
  return (
    <div className="proc-section" role="table" aria-label={`Top processes by ${colLabel}`}>
      <div className="proc-header" role="row">
        <span className="proc-title" role="columnheader">PROCESSES</span>
        <span className="proc-col-label" role="columnheader">{colLabel}</span>
      </div>
      {procs.map((p, i) => (
        <div key={i} className="proc-row" role="row">
          <span className="proc-name" role="cell">{p.name}</span>
          <span className="proc-val" role="cell">{colValue(p)}</span>
        </div>
      ))}
    </div>
  );
}
