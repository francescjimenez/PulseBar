# CPU Widget

A macOS menu bar system monitor inspired by iStat Menus. Live CPU, RAM, Network, and Disk stats visible at a glance from the menu bar — no dock icon, no window chrome.

Built with **Tauri v2**, **React 19**, and **Rust** (`sysinfo`).

---

## What it looks like

Four compact tray items sit in your menu bar and update every 2 seconds:

```
↑1KB/s ↓13KB/s   RAM 42%   CPU 72°   SSD 61%
```

Click any one to open a panel directly focused on that category. Click elsewhere (or the same icon again) to close it.

---

## Features

| Panel       | What you see |
|-------------|--------------|
| **CPU**     | Usage % ring, temperature ring, 60-sample bar history, per-core usage bars, top 5 processes by CPU |
| **Memory**  | RAM % ring, Swap ring, bar history, used/free/swap breakdown, top 5 processes by RAM |
| **Network** | Upload & download speed, dual bar history, session peak speeds |
| **Disk**    | Per-disk usage ring + progress bar, used / free / total GB |

---

## Requirements

- macOS (menu bar tray is macOS-only)
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- Xcode Command Line Tools (`xcode-select --install`)

---

## Getting Started

```bash
# 1. Install JS dependencies
npm install

# 2. Run in development mode
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri dev
```

The app will compile the Rust backend and start Vite. Once ready, a set of tray icons will appear in your menu bar. There is no dock icon — this is intentional.

### Build for distribution

```bash
npm run tauri build
```

The `.app` bundle will be output to `src-tauri/target/release/bundle/macos/`.

---

## Project Structure

```
CPU widget/
├── src/
│   ├── App.jsx        # React UI — all four panels + polling loop
│   ├── App.css        # Dark widget styles
│   └── main.jsx       # React entry point
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs     # Rust core: stats, tray icons, window logic
│   │   └── main.rs    # Tauri entry point
│   ├── tauri.conf.json        # Window + bundle configuration
│   └── capabilities/
│       └── default.json       # Tauri permission grants
├── index.html
├── vite.config.js
└── package.json
```

---

## How It Works

### Menu Bar Tray Icons

The app creates **4 tray icons** (right-to-left creation order, so they appear left-to-right on macOS):

| Icon  | Label format         | Opens panel |
|-------|----------------------|-------------|
| Net   | `↑1KB/s ↓13KB/s`    | Network     |
| RAM   | `RAM 42%`            | Memory      |
| CPU   | `CPU 72°` or `CPU 45%` | CPU       |
| SSD   | `SSD 61%`            | Disk        |

- **Left-click**: opens the panel window, centered under the clicked icon
- **Right-click**: shows a Quit menu item

### Window Behavior

The panel window is **360 × 540 px**, frameless, transparent, and always on top. It starts hidden.

- Clicking a tray icon positions the window just below the menu bar and shows it
- The window hides automatically when it loses focus (blur)
- A 400 ms debounce prevents the window from immediately reopening when you click the same tray icon to close it

All show/hide logic lives in Rust — React only listens for a `category-selected` event to know which panel to render.

### Stats Collection (Rust)

A background thread runs every 2 seconds and:

1. Refreshes CPU, memory, network, disk, and temperature data via `sysinfo`
2. Calculates KB/s from raw bytes-since-last-refresh
3. Tracks session peak upload/download speeds
4. Updates each tray icon's text title
5. Stores the full `Stats` struct in a shared `Arc<Mutex<AppState>>`

The React frontend calls `invoke("get_stats")` every 2 seconds to read the latest snapshot.

### Data Flow

```
sysinfo (Rust, every 2s)
    └─▶ AppState.stats (Mutex)
            └─▶ get_stats() Tauri command
                    └─▶ React: invoke("get_stats")
                            └─▶ Panel renders + history arrays updated
```

---

## Configuration

Window size, transparency, and always-on-top are set in `src-tauri/tauri.conf.json`:

```json
{
  "width": 360,
  "height": 540,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "visible": false
}
```

The stats refresh interval is hardcoded to **2 seconds** in `src-tauri/src/lib.rs` (both the background thread sleep and the network byte calculation divisor).

---

## Tech Stack

| Component        | Technology                   |
|-----------------|------------------------------|
| App framework   | Tauri v2                     |
| Frontend        | React 19 + Vite 7            |
| Styling         | Plain CSS (no framework)     |
| System stats    | Rust `sysinfo 0.33`          |
| JS ↔ Rust IPC  | Tauri `invoke` + `emit`/`listen` |

---

## IDE Setup

Recommended extensions:
- [VS Code](https://code.visualstudio.com/)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
