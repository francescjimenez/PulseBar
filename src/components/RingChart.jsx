export default function RingChart({ pct, label, color, size = 86 }) {
  const r = size * 0.36;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ;
  const cx = size / 2;
  return (
    <div className="ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text x={cx} y={cx - 5} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">{pct.toFixed(0)}%</text>
        <text x={cx} y={cx + 10} textAnchor="middle" fill="#8e8e9a" fontSize="8.5" fontWeight="500" letterSpacing="0.04em">{label}</text>
      </svg>
    </div>
  );
}
