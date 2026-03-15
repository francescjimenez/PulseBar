export default function BarChart({ primary, secondary, colorP, colorS, height = 52 }) {
  const N = primary.length;
  if (N === 0) return null;
  const max = Math.max(...primary, ...(secondary || []), 0.001);
  const W = N * 4;
  return (
    <svg className="bar-chart" width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      <line x1="0" y1={height / 2} x2={W} y2={height / 2} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      {secondary && secondary.map((v, i) => {
        const h = Math.max((v / max) * height, 0.5);
        return <rect key={`s${i}`} x={i * 4} y={height - h} width="3.5" height={h} fill={colorS} opacity="0.5" rx="0.5" />;
      })}
      {primary.map((v, i) => {
        const h = Math.max((v / max) * height, 0.5);
        return <rect key={`p${i}`} x={i * 4} y={height - h} width="3.5" height={h} fill={colorP} opacity="0.85" rx="0.5" />;
      })}
    </svg>
  );
}
