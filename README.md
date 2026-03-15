# PulseBar

A macOS menu bar system monitor inspired by iStat Menus. Live CPU, RAM, Network, and Disk stats visible at a glance from the menu bar — no dock icon, no window chrome.

Built with **Tauri v2**, **React 19**, and **Rust** (`sysinfo 0.33`).

---

## What it looks like

Four compact tray items sit in your menu bar and update every 2 seconds:

```
↑1KB/s ↓13KB/s   RAM 42%   CPU 72°   SSD 61%
```

Click any one to open a panel focused on that category. Click elsewhere (or the same icon again) to close it.

---

## Features

| Panel       | What you see |
|-------------|--------------|
| **CPU**     | Usage % ring, temperature ring, 60-sample bar history, per-core usage bars, top 5 processes by CPU |
| **Memory**  | RAM % ring, Swap ring, bar history, used / free / swap breakdown, top 5 processes by RAM |
| **Network** | Upload & download speed, dual bar history, session peak speeds |
| **Disk**    | Per-disk usage ring + progress bar, used / free / total GB |

---

## Requirements

- macOS (menu bar tray is macOS-only)
- [Node.js](https://nodejs.org/) v18+
- [Rust](https://www.rust-lang.org/tools/install) stable toolchain
- Xcode Command Line Tools: `xcode-select --install`

---

## Getting Started

```bash
# 1. Install JS dependencies
npm install

# 2. Run in development mode
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri dev
```

### Clean build artifacts

The Rust `target/` directory can grow to several GB over time. To wipe it:

```bash
npm run clean
```

The Rust backend compiles and Vite starts. Once ready, four tray icons appear in your menu bar. There is no dock icon — this is intentional (`ActivationPolicy::Accessory`).

### Build for distribution

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/macos/PulseBar.app`

---

## Project Structure

```
PulseBar/
├── src/
│   ├── App.jsx             # Main app — polling loop, history state, panel routing
│   ├── App.css             # Dark widget styles (360×540, #14112a background)
│   ├── main.jsx            # React entry point
│   ├── utils.js            # Format helpers (fmtNet, fmtGB, fmtMem) + history constants
│   ├── components/
│   │   ├── RingChart.jsx   # SVG donut chart
│   │   ├── BarChart.jsx    # SVG bar history chart
│   │   ├── MetricRow.jsx   # Label / value row
│   │   ├── BigStat.jsx     # Large colored value + label
│   │   └── ProcessList.jsx # Ranked process table
│   └── panels/
│       ├── CPUPanel.jsx    # CPU & GPU panel
│       ├── MemPanel.jsx    # Memory panel
│       ├── NetPanel.jsx    # Network panel
│       └── DiskPanel.jsx   # Disk panel
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs          # Rust core: Stats structs, AppState, tray icons, background thread
│   │   └── main.rs         # Tauri entry point (calls lib::run())
│   ├── tauri.conf.json     # Window + bundle configuration
│   └── capabilities/
│       └── default.json    # Tauri permission grants
├── index.html
├── vite.config.js
└── package.json
```

---

## How It Works

### Menu Bar Tray Icons

Four tray icons are created in reverse order (macOS stacks them right-to-left), so they appear left-to-right as:

| Icon    | Live title format            | Opens panel |
|---------|------------------------------|-------------|
| Network | `↑1KB/s ↓13KB/s`            | Network     |
| RAM     | `RAM 42%`                    | Memory      |
| CPU     | `CPU 72°` or `CPU 45%`       | CPU         |
| SSD     | `SSD 61%`                    | Disk        |

- **Left-click**: positions the panel window just below the menu bar, centered on the clicked icon, and shows it
- **Right-click**: shows a Quit menu item

### Window Behavior

The panel window is **360 × 540 px**, frameless, and transparent. Rounded corners come from CSS. It starts hidden and is always on top.

- Clicking a tray icon shows the window
- The window hides automatically on blur (when it loses focus)
- A 400 ms debounce prevents the window from immediately reopening when clicking the same icon that dismissed it

All show/hide logic is handled in Rust. React only listens for a `category-selected` event to know which panel to render.

### Stats Collection (Rust)

A background thread runs every 2 seconds:

1. Refreshes CPU, memory, network, disk, and temperature data via `sysinfo`
2. Calculates KB/s from raw bytes-since-last-refresh (`bytes / 2 / 1024`)
3. Tracks session-high peak upload/download speeds
4. Updates each tray icon's text label
5. Stores the result in a shared `Arc<Mutex<AppState>>`

### Data the Widget Tracks

```
Stats
├── cpu_usage          — global CPU %
├── cpu_temp           — package temperature (None on Apple Silicon)
├── cpu_cores          — per-core usage %
├── ram_used_gb / ram_total_gb / ram_percent
├── swap_used_gb / swap_total_gb
├── net_rx_kbps / net_tx_kbps      — current speeds
├── net_peak_rx_kbps / net_peak_tx_kbps  — session highs
├── disks[]            — name, mount point, available GB, total GB
├── top_cpu_procs[]    — top 5 processes by CPU (normalized per core)
├── top_mem_procs[]    — top 5 processes by RAM
└── sensors[]          — all temperature sensors, sorted by temp desc
```

### Data Flow

```
sysinfo refresh (Rust, every 2s)
    └─▶ AppState.stats (Mutex<Stats>)
            └─▶ get_stats() Tauri command
                    └─▶ React invoke("get_stats") every 2s
                            ├─▶ setStats(s)          — updates current readings
                            └─▶ setHist(prev → …)    — appends to 60-sample history arrays
```

React also listens for the `category-selected` event emitted by Rust on each tray click to switch the active panel.

---

## Configuration

Window dimensions and behavior are set in `src-tauri/tauri.conf.json`:

```json
{
  "width": 360,
  "height": 540,
  "decorations": false,
  "transparent": true,
  "resizable": false,
  "alwaysOnTop": true,
  "visible": false
}
```

The refresh interval is **2 seconds**, hardcoded in `src-tauri/src/lib.rs` (both the thread sleep and the network byte divisor must match).

---

## Tech Stack

| Component        | Technology                        |
|-----------------|-----------------------------------|
| App framework   | Tauri v2                          |
| Frontend        | React 19 + Vite 7                 |
| Styling         | Plain CSS (no framework)          |
| System stats    | Rust `sysinfo 0.33`               |
| JS ↔ Rust IPC  | Tauri `invoke` + `emit` / `listen` |

---

## IDE Setup

Recommended:
- [VS Code](https://code.visualstudio.com/)
- [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
