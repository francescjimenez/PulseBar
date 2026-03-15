import RingChart from "../components/RingChart";
import MetricRow from "../components/MetricRow";

export default function DiskPanel({ stats }) {
  return (
    <div className="panel">
      <div className="panel-title">Disks</div>

      {stats.disks.length === 0 ? (
        <div className="empty-msg">No disks found</div>
      ) : (
        stats.disks.map((d, i) => {
          const usedGb  = d.total_gb - d.available_gb;
          const usedPct = d.total_gb > 0 ? (usedGb / d.total_gb) * 100 : 0;
          const color   = usedPct > 85 ? "#ff3b30" : usedPct > 65 ? "#ff9500" : "#30d158";
          return (
            <div key={i} className="disk-card">
              <div className="disk-header">
                <span className="disk-name">{d.name || d.mount || "Disk"}</span>
                <span className="disk-avail">{d.available_gb.toFixed(1)} GB free</span>
              </div>
              <div className="disk-rings">
                <RingChart pct={usedPct} label="USED" color={color} size={80} />
                <div className="disk-info">
                  <MetricRow label="Used"  value={`${usedGb.toFixed(1)} GB`} />
                  <MetricRow label="Free"  value={`${d.available_gb.toFixed(1)} GB`} />
                  <MetricRow label="Total" value={`${d.total_gb.toFixed(1)} GB`} />
                </div>
              </div>
              <div className="disk-bar-bg">
                <div className="disk-bar-fill" style={{ width: `${usedPct}%`, background: color }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
