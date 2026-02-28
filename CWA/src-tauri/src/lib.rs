use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;
use std::sync::Mutex;

struct AutostartItem(Mutex<tauri::menu::MenuItem<tauri::Wry>>);

pub fn run() {
    tauri::Builder::default()
        // ── 단일 인스턴스: 두 번째 실행 시 기존 창을 포커스 ──
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
                let _ = win.set_always_on_bottom(true);
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            // ── 시작 시 항상 맨 뒤 ──
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_always_on_bottom(true);
                let _ = win.set_skip_taskbar(true);
                // 창이 최소화되거나 표시되지 않도록 방지
                let _ = win.set_visible_on_all_workspaces(true);
            }

            let enabled = app.autolaunch().is_enabled().unwrap_or(false);
            let label   = if enabled { "시작프로그램: ON" } else { "시작프로그램: OFF" };

            let show_item      = MenuItemBuilder::with_id("show",             "열기 / 숨기기").build(app)?;
            let autostart_item = MenuItemBuilder::with_id("toggle_autostart", label).build(app)?;
            let sep            = PredefinedMenuItem::separator(app)?;
            let quit_item      = MenuItemBuilder::with_id("quit",             "완전 종료").build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &autostart_item, &sep, &quit_item])
                .build()?;

            app.manage(AutostartItem(Mutex::new(autostart_item)));

            let icon = app.default_window_icon().unwrap().clone();
            TrayIconBuilder::with_id("main_tray")
                .icon(icon)
                .tooltip("CWA Calendar")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_always_on_bottom(true);
                                let _ = win.set_focus();
                            }
                        }
                    }
                    "toggle_autostart" => {
                        let al = app.autolaunch();
                        if al.is_enabled().unwrap_or(false) { let _ = al.disable(); }
                        else                                 { let _ = al.enable();  }
                        let new_label = if al.is_enabled().unwrap_or(false) {
                            "시작프로그램: ON"
                        } else {
                            "시작프로그램: OFF"
                        };
                        if let Some(state) = app.try_state::<AutostartItem>() {
                            if let Ok(item) = state.0.lock() { let _ = item.set_text(new_label); }
                        }
                    }
                    "quit" => std::process::exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) { let _ = win.hide(); }
                            else { let _ = win.show(); let _ = win.set_always_on_bottom(true); let _ = win.set_focus(); }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
            // Windows+D 방지: 최소화되지 않도록
            if let WindowEvent::Resized(_) | WindowEvent::Moved(_) = event {
                let _ = window.show();
                let _ = window.set_always_on_bottom(true);
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_autostart_status,
            set_autostart_status,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 앱 실행 실패");
}

// ── React에서 autostart 제어할 수 있게 커맨드 노출 ──
#[tauri::command]
fn get_autostart_status(app: tauri::AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart_status(app: tauri::AppHandle, enabled: bool) -> bool {
    let al = app.autolaunch();
    if enabled { let _ = al.enable(); } else { let _ = al.disable(); }
    // tray 라벨도 갱신
    let new_label = if al.is_enabled().unwrap_or(false) { "시작프로그램: ON" } else { "시작프로그램: OFF" };
    if let Some(state) = app.try_state::<AutostartItem>() {
        if let Ok(item) = state.0.lock() { let _ = item.set_text(new_label); }
    }
    al.is_enabled().unwrap_or(false)
}
