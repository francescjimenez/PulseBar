import RingChart from "../components/RingChart";
import BarChart from "../components/BarChart";
import ProcessList from "../components/ProcessList";
import MetricRow from "../components/MetricRow";

function TempBadge({ temp, label }) {
  if (temp == null) return null;
  const color = temp > 80 ? "#ff3b30" : temp > 60 ? "#ff9500" : "#30d158";
  return (
    <div className="cpu-temp" style={{ color }}>
      {temp.toFixed(0)}° {label}
    </div>
  );
}

export default function CPUPanel({ stats, hist }) {
  const hasGpu  = stats.gpu_usage_pct > 0 || stats.gpu_temp != null;
  const hasVram = stats.vram_total_mb > 0;
  const vramPct = hasVram ? (stats.vram_used_mb / stats.vram_total_mb) * 100 : 0;
  const vramColor = vramPct > 85 ? "#ff3b30" : vramPct > 65 ? "#ff9500" : "#30d158";

  return (
    <div className="panel">
      <div className="panel-title">CPU &amp; GPU</div>

      <div className="cpu-top">
        <div className="cpu-top-left">
          <RingChart pct={stats.cpu_usage} label="CPU" color="#0a84ff" />
          <TempBadge temp={stats.cpu_temp} label="CPU" />
        </div>
        {stats.cpu_cores && stats.cpu_cores.length > 0 && (
          <div className="cpu-top-right">
            <div className="section-title">CORES</div>
            <div className="cores-grid">
              {stats.cpu_cores.map((u, i) => (
                <div key={i} className="core-col">
                  <div className="core-bar-bg">
                    <div className="core-bar-fill" style={{ height: `${Math.min(u, 100)}%`, background: "#0a84ff" }} />
                  </div>
                  <div className="core-idx">{i}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasGpu && (
        <div className="cpu-top" style={{ marginTop: 8 }}>
          <div className="cpu-top-left">
            <RingChart pct={stats.gpu_usage_pct} label="GPU" color="#30d158" />
            <TempBadge temp={stats.gpu_temp} label="GPU" />
          </div>
          {hasVram && (
            <div className="cpu-top-right" style={{ justifyContent: "center" }}>
              <div className="section-title">VRAM</div>
              <div className="metric-row" style={{ marginTop: 4 }}>
                <span className="metric-label">Used</span>
                <span className="metric-value">
                  {stats.vram_used_mb >= 1024
                    ? `${(stats.vram_used_mb / 1024).toFixed(1)} GB`
                    : `${stats.vram_used_mb.toFixed(0)} MB`}
                </span>
              </div>
              <MetricRow label="Total" value={`${(stats.vram_total_mb / 1024).toFixed(0)} GB`} />
              <div className="disk-bar-bg" style={{ marginTop: 6 }}>
                <div className="disk-bar-fill" style={{ width: `${vramPct}%`, background: vramColor }} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="chart-legend">
        <span className="legend-dot" style={{ background: "#0a84ff" }} />
        <span className="legend-label">CPU Usage</span>
        <span className="legend-val">{stats.cpu_usage.toFixed(1)}%</span>
      </div>
      <BarChart primary={hist.cpu} colorP="#0a84ff" />

      <ProcessList procs={stats.top_cpu_procs} colLabel="CPU" colValue={p => `${p.cpu_pct.toFixed(1)}%`} />
    </div>
  );
}
