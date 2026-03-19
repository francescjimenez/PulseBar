import BarChart from "../components/BarChart";
import BigStat from "../components/BigStat";
import MetricRow from "../components/MetricRow";
import { fmtNet, fmtGB, countryFlag } from "../utils";

export default function NetPanel({ stats, hist }) {
  const wifiIcon = stats.wifi_ssid === "WiFi Off" ? "📵"
    : stats.wifi_ssid === "Not connected" ? "⚠️" : "📶";
  const wifiIconLabel = stats.wifi_ssid === "WiFi Off" ? "WiFi Off"
    : stats.wifi_ssid === "Not connected" ? "Not connected" : "Connected";
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
      <BarChart primary={hist.netRx} colorP="#0a84ff" secondary={hist.netTx} colorS="#ff375f" label="Network upload and download history chart" />

      <div className="metrics-list" style={{ marginTop: 10 }}>
        <MetricRow label="Peak ↑" value={fmtNet(stats.net_peak_tx_kbps)} />
        <MetricRow label="Peak ↓" value={fmtNet(stats.net_peak_rx_kbps)} />
      </div>

      <div className="metrics-list" style={{ marginTop: 8 }}>
        <div className="section-title" style={{ marginBottom: 6 }}>INTERFACE</div>
        {stats.wifi_ssid && (
          <MetricRow label="WiFi" value={<><span aria-hidden="true">{wifiIcon} </span><span aria-label={wifiIconLabel}>{stats.wifi_ssid}</span></>} />
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
