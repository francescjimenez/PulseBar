use serde::Serialize;
use sysinfo::{Components, Disks, Networks, System};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Serialize, Clone, Debug, Default)]
pub struct Stats {
    pub cpu_usage: f32,
    pub cpu_temp: Option<f32>,
    pub cpu_cores: Vec<f32>,
    pub gpu_usage_pct: f32,
    pub gpu_temp: Option<f32>,
    pub vram_used_mb: f64,
    pub vram_total_mb: f64,
    pub ram_used_gb: f64,
    pub ram_total_gb: f64,
    pub ram_percent: f64,
    pub swap_used_gb: f64,
    pub swap_total_gb: f64,
    pub net_rx_kbps: f64,
    pub net_tx_kbps: f64,
    pub net_peak_rx_kbps: f64,
    pub net_peak_tx_kbps: f64,
    pub net_interface: String,
    pub net_ip: String,
    pub net_total_rx_gb: f64,
    pub net_total_tx_gb: f64,
    pub wifi_ssid: String,
    pub ext_ip: String,
    pub ext_country_code: String,
    pub disks: Vec<DiskInfo>,
    pub top_cpu_procs: Vec<ProcInfo>,
    pub top_mem_procs: Vec<ProcInfo>,
    pub sensors: Vec<SensorInfo>,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct DiskInfo {
    pub name: String,
    pub mount: String,
    pub available_gb: f64,
    pub total_gb: f64,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct ProcInfo {
    pub name: String,
    pub cpu_pct: f32,
    pub mem_mb: f64,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct SensorInfo {
    pub label: String,
    pub temp: f32,
}

pub struct AppState {
    pub sys: Mutex<System>,
    pub networks: Mutex<Networks>,
    pub disks: Mutex<Disks>,
    pub stats: Mutex<Stats>,
    pub net_peak_rx: Mutex<f64>,
    pub net_peak_tx: Mutex<f64>,
    /// true while the panel window is visible (we showed it)
    pub window_visible: Mutex<bool>,
    /// when we last hid the window (for toggle-close debounce)
    pub last_hidden_at: Mutex<Option<Instant>>,
    /// cached WiFi SSID and when it was last fetched
    pub wifi_cache: Mutex<(String, Option<Instant>)>,
    /// cached external IP + country code (ip, country_code, fetched_at)
    pub ext_ip_cache: Mutex<(String, String, Option<Instant>)>,
}

fn format_net_short(kbps: f64) -> String {
    if kbps >= 1024.0 {
        format!("{:.1}MB/s", kbps / 1024.0)
    } else {
        format!("{:.0}KB/s", kbps)
    }
}

#[tauri::command]
fn get_stats(state: tauri::State<Arc<AppState>>) -> Stats {
    state.stats.lock().unwrap().clone()
}

/// Handle a tray left-click entirely in Rust:
/// show/position the window (or skip if we just closed it via blur).
fn panel_height(category: &str) -> f64 {
    match category {
        "cpu"  => 530.0,
        "mem"  => 530.0,
        "net"  => 450.0,
        "disk" => 220.0,
        _      => 480.0,
    }
}

fn handle_tray_click(
    tray: &tauri::tray::TrayIcon<tauri::Wry>,
    event: TrayIconEvent,
    category: &'static str,
) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        position,
        ..
    } = event
    {
        let app = tray.app_handle();
        let state = app.state::<Arc<AppState>>();

        // Debounce: if we hid the window < 400 ms ago, this click closed it — don't reopen.
        {
            let last = state.last_hidden_at.lock().unwrap();
            if let Some(t) = *last {
                if t.elapsed() < Duration::from_millis(400) {
                    return;
                }
            }
        }

        let window = match app.get_webview_window("main") {
            Some(w) => w,
            None => return,
        };

        // Find the monitor where the tray icon was clicked so the panel
        // opens on the correct screen in multi-monitor setups.
        let monitors = app.available_monitors().unwrap_or_default();
        let clicked_monitor = monitors.iter().find(|m| {
            let pos  = m.position();
            let size = m.size();
            position.x >= pos.x as f64
                && position.x < (pos.x as f64 + size.width as f64)
                && position.y >= pos.y as f64
                && position.y < (pos.y as f64 + size.height as f64)
        });

        let (scale, monitor_logical_x, monitor_logical_y) = match clicked_monitor {
            Some(m) => {
                let s = m.scale_factor();
                (s, m.position().x as f64 / s, m.position().y as f64 / s)
            }
            None => (window.scale_factor().unwrap_or(1.0), 0.0, 0.0),
        };

        let logical_x = position.x / scale;
        let win_width = 360.0_f64;
        let height = panel_height(category);
        let x = (logical_x - win_width / 2.0).max(monitor_logical_x);
        let y = monitor_logical_y + 28.0;

        *state.window_visible.lock().unwrap() = true;
        let _ = window.set_size(tauri::LogicalSize::new(win_width, height));
        let _ = window.set_position(tauri::LogicalPosition::new(x, y));
        let _ = app.emit("category-selected", category);
        let _ = window.show();
        let _ = window.set_focus();
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![get_stats])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Register autostart on first launch
            use tauri_plugin_autostart::ManagerExt;
            let autostart = app.autolaunch();
            if !autostart.is_enabled().unwrap_or(false) {
                let _ = autostart.enable();
            }

            let state = Arc::new(AppState {
                sys: Mutex::new(System::new_all()),
                networks: Mutex::new(Networks::new_with_refreshed_list()),
                disks: Mutex::new(Disks::new_with_refreshed_list()),
                stats: Mutex::new(Stats::default()),
                net_peak_rx: Mutex::new(0.0),
                net_peak_tx: Mutex::new(0.0),
                window_visible: Mutex::new(false),
                last_hidden_at: Mutex::new(None),
                wifi_cache: Mutex::new((String::new(), None)),
                ext_ip_cache: Mutex::new((String::new(), String::new(), None)),
            });
            app.manage(state.clone());

            // ── Quit menu items (IDs must be globally unique) ──
            let q_net  = MenuItem::with_id(app, "quit-net",  "Quit", true, None::<&str>)?;
            let q_mem  = MenuItem::with_id(app, "quit-mem",  "Quit", true, None::<&str>)?;
            let q_cpu  = MenuItem::with_id(app, "quit-cpu",  "Quit", true, None::<&str>)?;
            let q_disk = MenuItem::with_id(app, "quit-disk", "Quit", true, None::<&str>)?;
            let m_net  = Menu::with_items(app, &[&q_net])?;
            let m_mem  = Menu::with_items(app, &[&q_mem])?;
            let m_cpu  = Menu::with_items(app, &[&q_cpu])?;
            let m_disk = Menu::with_items(app, &[&q_disk])?;

            // macOS stacks tray items right-to-left, so create in reverse
            // visual order to get: Network | RAM | CPU | SSD (left → right)
            TrayIconBuilder::with_id("disk")
                .menu(&m_disk).show_menu_on_left_click(false)
                .title("SSD --")
                .on_menu_event(|app, e| { if e.id.as_ref() == "quit-disk" { app.exit(0); } })
                .on_tray_icon_event(|t, e| handle_tray_click(t, e, "disk"))
                .build(app)?;

            TrayIconBuilder::with_id("cpu")
                .menu(&m_cpu).show_menu_on_left_click(false)
                .title("CPU --")
                .on_menu_event(|app, e| { if e.id.as_ref() == "quit-cpu"  { app.exit(0); } })
                .on_tray_icon_event(|t, e| handle_tray_click(t, e, "cpu"))
                .build(app)?;

            TrayIconBuilder::with_id("mem")
                .menu(&m_mem).show_menu_on_left_click(false)
                .title("RAM --")
                .on_menu_event(|app, e| { if e.id.as_ref() == "quit-mem"  { app.exit(0); } })
                .on_tray_icon_event(|t, e| handle_tray_click(t, e, "mem"))
                .build(app)?;

            TrayIconBuilder::with_id("net")
                .menu(&m_net).show_menu_on_left_click(false)
                .title("↑-- ↓--")
                .on_menu_event(|app, e| { if e.id.as_ref() == "quit-net"  { app.exit(0); } })
                .on_tray_icon_event(|t, e| handle_tray_click(t, e, "net"))
                .build(app)?;

            // ── Native frosted-glass via NSVisualEffectView (macOS only) ──
            // NSVisualEffectView renders in the system compositor, completely
            // outside the WebView paint cycle — no flickering on React updates.
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.with_webview(|wv| {
                    use objc::{class, msg_send, sel, sel_impl};
                    use objc::runtime::{Object, YES, NO};

                    // NSRect / NSPoint / NSSize matching the macOS C ABI
                    #[repr(C)] struct NSPoint { x: f64, y: f64 }
                    #[repr(C)] struct NSSize  { width: f64, height: f64 }
                    #[repr(C)] struct NSRect  { origin: NSPoint, size: NSSize }

                    unsafe {
                        let wv_ptr: *mut Object = wv.inner() as *mut Object;

                        // Make the webview layer transparent
                        let _: () = msg_send![wv_ptr, setOpaque: NO];
                        let clear: *mut Object = msg_send![class!(NSColor), clearColor];
                        let _: () = msg_send![wv_ptr, setBackgroundColor: clear];

                        // Make the NSWindow itself transparent
                        let ns_win: *mut Object = msg_send![wv_ptr, window];
                        if ns_win.is_null() { return; }
                        let _: () = msg_send![ns_win, setOpaque: NO];
                        let _: () = msg_send![ns_win, setBackgroundColor: clear];

                        // Insert NSVisualEffectView behind the webview
                        // Material 13 = NSVisualEffectMaterialHUDWindow (dark frosted)
                        // BlendingMode 0 = BehindWindow, State 1 = Active
                        let parent: *mut Object = msg_send![wv_ptr, superview];
                        if parent.is_null() { return; }
                        let frame = NSRect {
                            origin: NSPoint { x: 0.0, y: 0.0 },
                            size:   NSSize  { width: 360.0, height: 540.0 },
                        };
                        let vev: *mut Object = msg_send![class!(NSVisualEffectView), alloc];
                        let vev: *mut Object = msg_send![vev, initWithFrame: frame];
                        let _: () = msg_send![vev, setMaterial:      2_usize]; // Dark — darker frosted base
                        let _: () = msg_send![vev, setBlendingMode:  0_usize];
                        let _: () = msg_send![vev, setState:         1_usize];
                        let _: () = msg_send![vev, setWantsLayer: YES];
                        // NSViewWidthSizable(2) | NSViewHeightSizable(16) = 18
                        let _: () = msg_send![vev, setAutoresizingMask: 18_usize];

                        // Round the NSVisualEffectView layer to match CSS border-radius: 14px
                        let vev_layer: *mut Object = msg_send![vev, layer];
                        let _: () = msg_send![vev_layer, setCornerRadius: 14.0_f64];
                        let _: () = msg_send![vev_layer, setMasksToBounds: YES];

                        // Also round the WKWebView layer so the square webview
                        // doesn't overdraw the rounded corners
                        let _: () = msg_send![wv_ptr, setWantsLayer: YES];
                        let wv_layer: *mut Object = msg_send![wv_ptr, layer];
                        let _: () = msg_send![wv_layer, setCornerRadius: 14.0_f64];
                        let _: () = msg_send![wv_layer, setMasksToBounds: YES];

                        // NSWindowBelow = -1: insert below the webview
                        let _: () = msg_send![parent, addSubview: vev
                                                       positioned: -1_isize
                                                       relativeTo: wv_ptr];
                    }
                });
            }

            // ── Hide window on focus loss (blur) ──
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();

                let state_clone = state.clone();
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let mut vis = state_clone.window_visible.lock().unwrap();
                        if *vis {
                            *vis = false;
                            *state_clone.last_hidden_at.lock().unwrap() = Some(Instant::now());
                            let _ = window_clone.hide();
                        }
                    }
                });
            }

            // ── Background stats thread ──
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(2));
                loop {
                    let state = app_handle.state::<Arc<AppState>>();

                    let stats = {
                        let mut sys      = state.sys.lock().unwrap();
                        let mut networks = state.networks.lock().unwrap();
                        let mut disks    = state.disks.lock().unwrap();

                        sys.refresh_all();
                        networks.refresh(true);
                        disks.refresh(false);

                        let num_cpus  = sys.cpus().len().max(1) as f32;
                        let cpu_usage = sys.global_cpu_usage();
                        let cpu_cores: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();

                        let components = Components::new_with_refreshed_list();
                        let cpu_temp = components.iter()
                            .find(|c| {
                                let l = c.label().to_lowercase();
                                l.contains("cpu") || l.contains("package") || l.contains("tcpu")
                            })
                            .and_then(|c| c.temperature());
                        let gpu_temp = components.iter()
                            .find(|c| c.label().to_lowercase().contains("gpu"))
                            .and_then(|c| c.temperature());

                        // GPU usage % and VRAM via ioreg (Apple Silicon + Intel)
                        let (gpu_usage_pct, vram_used_mb, vram_total_mb) = {
                            use std::process::Command;
                            // All values live inside the PerformanceStatistics dict on one line
                            let out = Command::new("sh")
                                .args(["-c",
                                    "ioreg -r -d 1 -c AGXAccelerator -w 0 2>/dev/null | grep PerformanceStatistics"])
                                .output()
                                .ok()
                                .and_then(|o| String::from_utf8(o.stdout).ok())
                                .unwrap_or_default();
                            // Extract a numeric value by key name from the dict string
                            let get = |key: &str| -> Option<f64> {
                                let search = format!("\"{}\"=", key);
                                out.find(&search).and_then(|pos| {
                                    let after = &out[pos + search.len()..];
                                    after.split(|c: char| !c.is_ascii_digit())
                                        .next()
                                        .and_then(|v| v.parse::<f64>().ok())
                                })
                            };
                            let usage = get("Device Utilization %").unwrap_or(0.0) as f32;
                            // "In use system memory" appears twice (plain + "(driver)"); match plain only
                            let used  = out.find("\"In use system memory\"=")
                                .and_then(|pos| {
                                    let after = &out[pos + "\"In use system memory\"=".len()..];
                                    after.split(|c: char| !c.is_ascii_digit()).next()
                                        .and_then(|v| v.parse::<f64>().ok())
                                })
                                .unwrap_or(0.0) / 1_048_576.0;
                            let total = get("Alloc system memory").unwrap_or(0.0) / 1_048_576.0;
                            (usage, used, total)
                        };

                        let sensors: Vec<SensorInfo> = {
                            let mut v: Vec<SensorInfo> = components.iter()
                                .filter_map(|c| c.temperature().map(|t| SensorInfo {
                                    label: c.label().to_string(),
                                    temp: t,
                                }))
                                .collect();
                            v.sort_by(|a, b| b.temp.partial_cmp(&a.temp).unwrap_or(std::cmp::Ordering::Equal));
                            v
                        };

                        let ram_used   = sys.used_memory();
                        let ram_total  = sys.total_memory();
                        let swap_used  = sys.used_swap();
                        let swap_total = sys.total_swap();

                        let rx_bytes: u64 = networks.iter().map(|(_, n)| n.received()).sum();
                        let tx_bytes: u64 = networks.iter().map(|(_, n)| n.transmitted()).sum();
                        let net_rx_kbps = rx_bytes as f64 / 2.0 / 1024.0;
                        let net_tx_kbps = tx_bytes as f64 / 2.0 / 1024.0;

                        {
                            let mut pr = state.net_peak_rx.lock().unwrap();
                            let mut pt = state.net_peak_tx.lock().unwrap();
                            if net_rx_kbps > *pr { *pr = net_rx_kbps; }
                            if net_tx_kbps > *pt { *pt = net_tx_kbps; }
                        }
                        let net_peak_rx_kbps = *state.net_peak_rx.lock().unwrap();
                        let net_peak_tx_kbps = *state.net_peak_tx.lock().unwrap();

                        // Active interface: non-loopback with highest total received
                        let active = networks.iter()
                            .filter(|(name, _)| *name != "lo0")
                            .max_by_key(|(_, n)| n.total_received());
                        let (net_interface, net_ip) = match active {
                            Some((name, data)) => {
                                let ip = data.ip_networks().iter()
                                    .find(|ip| ip.addr.is_ipv4() && !ip.addr.is_loopback())
                                    .map(|ip| ip.addr.to_string())
                                    .unwrap_or_default();
                                (name.clone(), ip)
                            }
                            None => (String::new(), String::new()),
                        };
                        let net_total_rx_gb = networks.iter()
                            .filter(|(name, _)| *name != "lo0")
                            .map(|(_, n)| n.total_received())
                            .sum::<u64>() as f64 / 1_073_741_824.0;
                        let net_total_tx_gb = networks.iter()
                            .filter(|(name, _)| *name != "lo0")
                            .map(|(_, n)| n.total_transmitted())
                            .sum::<u64>() as f64 / 1_073_741_824.0;

                        // Deduplicate: macOS exposes the same APFS volume under
                        // multiple mount points (/System/Volumes/Data, etc.).
                        // Keep one entry per unique total_space; skip system sub-volumes.
                        let mut seen_sizes = std::collections::HashSet::<u64>::new();
                        let disks_info: Vec<DiskInfo> = disks.iter()
                            .filter(|d| d.total_space() > 0)
                            .filter(|d| {
                                let m = d.mount_point().to_string_lossy();
                                !m.starts_with("/System/Volumes/")
                                    && !m.starts_with("/private/")
                                    && m != "/dev"
                            })
                            .filter_map(|d| {
                                let sz = d.total_space();
                                if seen_sizes.contains(&sz) { return None; }
                                seen_sizes.insert(sz);
                                Some(DiskInfo {
                                    name: d.name().to_string_lossy().to_string(),
                                    mount: d.mount_point().to_string_lossy().to_string(),
                                    available_gb: d.available_space() as f64 / 1_073_741_824.0,
                                    total_gb: sz as f64 / 1_073_741_824.0,
                                })
                            })
                            .collect();

                        let mut procs: Vec<ProcInfo> = sys.processes().values()
                            .map(|p| ProcInfo {
                                name: p.name().to_string_lossy().to_string(),
                                cpu_pct: p.cpu_usage() / num_cpus,
                                mem_mb:  p.memory() as f64 / 1_048_576.0,
                            })
                            .collect();

                        procs.sort_by(|a, b| b.cpu_pct.partial_cmp(&a.cpu_pct).unwrap_or(std::cmp::Ordering::Equal));
                        let top_cpu_procs: Vec<ProcInfo> = procs.iter().take(5).cloned().collect();

                        procs.sort_by(|a, b| b.mem_mb.partial_cmp(&a.mem_mb).unwrap_or(std::cmp::Ordering::Equal));
                        let top_mem_procs: Vec<ProcInfo> = procs.iter().take(5).cloned().collect();

                        // WiFi SSID — cached, re-fetched every 10 s
                        let wifi_ssid = {
                            let mut cache = state.wifi_cache.lock().unwrap();
                            let needs_refresh = cache.1
                                .map(|t| t.elapsed() > Duration::from_secs(10))
                                .unwrap_or(true);
                            if needs_refresh {
                                #[cfg(target_os = "macos")]
                                let ssid = {
                                    use std::process::Command;
                                    // Find the Wi-Fi device name dynamically (could be en0, en1, etc.)
                                    let iface = Command::new("sh")
                                        .args(["-c", "networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}'"])
                                        .output()
                                        .ok()
                                        .and_then(|o| String::from_utf8(o.stdout).ok())
                                        .map(|s| s.trim().to_string())
                                        .unwrap_or_else(|| "en0".to_string());
                                    let out = Command::new("networksetup")
                                        .args(["-getairportnetwork", &iface])
                                        .output()
                                        .ok()
                                        .and_then(|o| String::from_utf8(o.stdout).ok())
                                        .unwrap_or_default();
                                    if out.contains("Wi-Fi Power Off") || out.contains("disabled") {
                                        "WiFi Off".to_string()
                                    } else if let Some(rest) = out.strip_prefix("Current Wi-Fi Network: ") {
                                        rest.trim().to_string()
                                    } else {
                                        "Not connected".to_string()
                                    }
                                };
                                #[cfg(not(target_os = "macos"))]
                                let ssid = String::new();
                                cache.0 = ssid;
                                cache.1 = Some(Instant::now());
                            }
                            cache.0.clone()
                        };

                        // External IP + country — cached for 5 minutes, fetched via curl
                        let (ext_ip, ext_country_code) = {
                            let mut cache = state.ext_ip_cache.lock().unwrap();
                            let needs_refresh = cache.2
                                .map(|t| t.elapsed() > Duration::from_secs(300))
                                .unwrap_or(true);
                            if needs_refresh {
                                use std::process::Command;
                                let out = Command::new("curl")
                                    .args(["-s", "--max-time", "5", "https://ipwho.is/"])
                                    .output()
                                    .ok()
                                    .and_then(|o| String::from_utf8(o.stdout).ok())
                                    .unwrap_or_default();
                                let ip = serde_json::from_str::<serde_json::Value>(&out)
                                    .ok()
                                    .map(|v| (
                                        v["ip"].as_str().unwrap_or("").to_string(),
                                        v["country_code"].as_str().unwrap_or("").to_string(),
                                    ))
                                    .unwrap_or_default();
                                cache.0 = ip.0;
                                cache.1 = ip.1;
                                cache.2 = Some(Instant::now());
                            }
                            (cache.0.clone(), cache.1.clone())
                        };

                        Stats {
                            cpu_usage, cpu_temp, cpu_cores,
                            gpu_usage_pct, gpu_temp, vram_used_mb, vram_total_mb,
                            ram_used_gb:  ram_used  as f64 / 1_073_741_824.0,
                            ram_total_gb: ram_total as f64 / 1_073_741_824.0,
                            ram_percent: if ram_total > 0 {
                                ram_used as f64 / ram_total as f64 * 100.0
                            } else { 0.0 },
                            swap_used_gb:  swap_used  as f64 / 1_073_741_824.0,
                            swap_total_gb: swap_total as f64 / 1_073_741_824.0,
                            net_rx_kbps, net_tx_kbps,
                            net_peak_rx_kbps, net_peak_tx_kbps,
                            net_interface, net_ip,
                            net_total_rx_gb, net_total_tx_gb,
                            wifi_ssid,
                            ext_ip, ext_country_code,
                            disks: disks_info,
                            top_cpu_procs, top_mem_procs,
                            sensors,
                        }
                    };

                    // ── Update tray titles ──────────────────────────────────
                    if let Some(t) = app_handle.tray_by_id("net") {
                        let _ = t.set_title(Some(
                            format!("↑{} ↓{}",
                                format_net_short(stats.net_tx_kbps),
                                format_net_short(stats.net_rx_kbps),
                            ).as_str()
                        ));
                    }
                    if let Some(t) = app_handle.tray_by_id("mem") {
                        let _ = t.set_title(Some(format!("RAM {:.0}%", stats.ram_percent).as_str()));
                    }
                    if let Some(t) = app_handle.tray_by_id("cpu") {
                        let s = match stats.cpu_temp {
                            Some(tmp) => format!("CPU {:.0}°", tmp),
                            None      => format!("CPU {:.0}%", stats.cpu_usage),
                        };
                        let _ = t.set_title(Some(s.as_str()));
                    }
                    if let Some(t) = app_handle.tray_by_id("disk") {
                        let main = stats.disks.iter()
                            .find(|d| d.mount == "/")
                            .or_else(|| stats.disks.first());
                        if let Some(d) = main {
                            let used_pct = if d.total_gb > 0.0 {
                                (d.total_gb - d.available_gb) / d.total_gb * 100.0
                            } else { 0.0 };
                            let _ = t.set_title(Some(format!("SSD {:.0}%", used_pct).as_str()));
                        }
                    }

                    *state.stats.lock().unwrap() = stats;
                    std::thread::sleep(Duration::from_secs(2));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
