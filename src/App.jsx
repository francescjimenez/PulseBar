import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

// ─── Shared components ────────────────────────────────────────────────────────

function RingChart({ pct, label, color, size = 86 }) {
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

const HIST_LEN = 60;
function initHist() { return new Array(HIST_LEN).fill(0); }

function BarChart({ primary, secondary, colorP, colorS, height = 52 }) {
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

function ProcessList({ procs, colLabel, colValue }) {
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

function MetricRow({ label, value }) {
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

function BigStat({ value, label, color }) {
  return (
    <div className="big-stat">
      <div className="big-val" style={{ color }}>{value}</div>
      <div className="big-label">{label}</div>
    </div>
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtNet(kbps) {
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(2)} MB/s`;
  return `${kbps.toFixed(0)} KB/s`;
}
function fmtGB(gb) {
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(gb * 1024).toFixed(0)} MB`;
}
function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  return code.toUpperCase().split("").map(c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  ).join("");
}
function fmtMem(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

// ─── Panels ───────────────────────────────────────────────────────────────────

function TempBadge({ temp, label }) {
  if (temp == null) return null;
  const color = temp > 80 ? "#ff3b30" : temp > 60 ? "#ff9500" : "#30d158";
  return (
    <div className="cpu-temp" style={{ color }}>
      {temp.toFixed(0)}° {label}
    </div>
  );
}

function CPUPanel({ stats, hist }) {
  const hasGpu   = stats.gpu_usage_pct > 0 || stats.gpu_temp != null;
  const hasVram  = stats.vram_total_mb > 0;
  const vramPct  = hasVram ? (stats.vram_used_mb / stats.vram_total_mb) * 100 : 0;
  const vramColor = vramPct > 85 ? "#ff3b30" : vramPct > 65 ? "#ff9500" : "#30d158";

  return (
    <div className="panel">
      <div className="panel-title">CPU &amp; GPU</div>

      {/* Row 1: CPU ring (left) + Cores (right) */}
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

      {/* Row 2: GPU ring (left) + VRAM (right) */}
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
                    ? (stats.vram_used_mb/1024).toFixed(1)+" GB"
                    : stats.vram_used_mb.toFixed(0)+" MB"}
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Total</span>
                <span className="metric-value">{(stats.vram_total_mb/1024).toFixed(0)} GB</span>
              </div>
              <div className="disk-bar-bg" style={{ marginTop: 6 }}>
                <div className="disk-bar-fill" style={{ width: `${vramPct}%`, background: vramColor }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rolling history chart */}
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

function MemPanel({ stats, hist }) {
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

function NetPanel({ stats, hist }) {
  const wifiIcon = stats.wifi_ssid === "WiFi Off" ? "📵"
    : stats.wifi_ssid === "Not connected" ? "⚠️" : "📶";
  const extFlag = countryFlag(stats.ext_country_code);

  return (
    <div className="panel">
      <div className="panel-title">Network</div>

      <div className="big-stats-row">
        <BigStat value={fmtNet(stats.net_tx_kbps)} label="Upload"   color="#ff375f" />
        <BigStat value={fmtNet(stats.net_rx_kbps)} label="Download" color="#0a84ff" />
      </div>

      <div className="chart-legend">
        <span className="legend-dot" style={{ background: "#ff375f" }} />
        <span className="legend-label">Upload</span>
        <span className="legend-dot" style={{ background: "#0a84ff", marginLeft: 8 }} />
        <span className="legend-label">Download</span>
      </div>
      <BarChart primary={hist.netRx} colorP="#0a84ff" secondary={hist.netTx} colorS="#ff375f" />

      <div className="metrics-list" style={{ marginTop: 10 }}>
        <MetricRow label="Peak ↑" value={fmtNet(stats.net_peak_tx_kbps)} />
        <MetricRow label="Peak ↓" value={fmtNet(stats.net_peak_rx_kbps)} />
      </div>

      <div className="metrics-list" style={{ marginTop: 8 }}>
        <div className="section-title" style={{ marginBottom: 6 }}>INTERFACE</div>
        {stats.wifi_ssid && (
          <MetricRow label="WiFi" value={`${wifiIcon} ${stats.wifi_ssid}`} />
        )}
        {stats.net_interface && (
          <MetricRow label={stats.net_interface} value={stats.net_ip} />
        )}
        {stats.ext_ip && (
          <MetricRow label="External IP" value={`${extFlag} ${stats.ext_ip}`} />
        )}
        <MetricRow label="Total ↑" value={fmtGB(stats.net_total_tx_gb)} />
        <MetricRow label="Total ↓" value={fmtGB(stats.net_total_rx_gb)} />
      </div>
    </div>
  );
}

function DiskPanel({ stats }) {
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

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [stats, setStats]       = useState(null);
  const [category, setCategory] = useState("cpu");
  const [hist, setHist]         = useState({
    cpu:    initHist(),
    ramPct: initHist(),
    netRx:  initHist(),
    netTx:  initHist(),
  });
  useEffect(() => {
    // ── Poll stats every 2s ──
    const fetchStats = async () => {
      try {
        const s = await invoke("get_stats");
        setStats(s);
        setHist(prev => ({
          cpu:    [...prev.cpu.slice(-(HIST_LEN - 1)),    s.cpu_usage],
          ramPct: [...prev.ramPct.slice(-(HIST_LEN - 1)), s.ram_percent],
          netRx:  [...prev.netRx.slice(-(HIST_LEN - 1)),  s.net_rx_kbps],
          netTx:  [...prev.netTx.slice(-(HIST_LEN - 1)),  s.net_tx_kbps],
        }));
      } catch (e) { console.error(e); }
    };
    fetchStats();
    const timer = setInterval(fetchStats, 2000);

    // ── Rust handles window show/hide; we just update category ──
    const unlistenCategory = listen("category-selected", ({ payload }) => {
      setCategory(payload);
    });

    return () => {
      clearInterval(timer);
      unlistenCategory.then(fn => fn());
    };
  }, []);

  return (
    <div className="widget">
      <div className="panel-scroll">
        {!stats ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            {category === "cpu"  && <CPUPanel  stats={stats} hist={hist} />}
            {category === "mem"  && <MemPanel  stats={stats} hist={hist} />}
            {category === "net"  && <NetPanel  stats={stats} hist={hist} />}
            {category === "disk" && <DiskPanel stats={stats} />}
          </>
        )}
      </div>
    </div>
  );
}
