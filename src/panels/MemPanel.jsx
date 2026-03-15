import RingChart from "../components/RingChart";
import BarChart from "../components/BarChart";
import ProcessList from "../components/ProcessList";
import MetricRow from "../components/MetricRow";
import { fmtMem } from "../utils";

export default function MemPanel({ stats, hist }) {
  const swapPct = stats.swap_total_gb > 0 ? (stats.swap_used_gb / stats.swap_total_gb) * 100 : 0;
  return (
    <div className="panel">
      <div className="panel-title">Memory</div>

      <div className="panel-rings">
        <RingChart pct={stats.ram_percent} label="MEMORY" color="#bf5af2" />
        {stats.swap_total_gb > 0
          ? <RingChart pct={swapPct} label="SWAP" color="#ff9500" />
          : <div style={{ width: 86 }} />}
      </div>

      <div className="chart-legend">
        <span className="legend-dot" style={{ background: "#bf5af2" }} />
        <span className="legend-label">RAM</span>
        <span className="legend-val">{stats.ram_used_gb.toFixed(1)} / {stats.ram_total_gb.toFixed(1)} GB</span>
      </div>
      <BarChart primary={hist.ramPct} colorP="#bf5af2" />

      <div className="metrics-list">
        <MetricRow label="Used" value={`${stats.ram_used_gb.toFixed(1)} GB`} />
        <MetricRow label="Free" value={`${(stats.ram_total_gb - stats.ram_used_gb).toFixed(1)} GB`} />
        {stats.swap_total_gb > 0 && (
          <MetricRow label="Swap" value={`${stats.swap_used_gb.toFixed(1)} / ${stats.swap_total_gb.toFixed(1)} GB`} />
        )}
      </div>

      <ProcessList procs={stats.top_mem_procs} colLabel="RAM" colValue={p => fmtMem(p.mem_mb)} />
    </div>
  );
}
