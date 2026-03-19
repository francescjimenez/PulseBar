import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

import CPUPanel  from "./panels/CPUPanel";
import MemPanel  from "./panels/MemPanel";
import NetPanel  from "./panels/NetPanel";
import DiskPanel from "./panels/DiskPanel";
import { HIST_LEN, initHist } from "./utils";

function initHistState() {
  return {
    cpu:    initHist(),
    ramPct: initHist(),
    netRx:  initHist(),
    netTx:  initHist(),
  };
}

export default function App() {
  const [stats, setStats]       = useState(null);
  const [category, setCategory] = useState("cpu");
  const [hist, setHist]         = useState(initHistState);

  useEffect(() => {
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
          <div className="loading" role="status" aria-live="polite">Loading…</div>
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
