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
                // 데스크톱 위젯처럼 항상 맨 뒤에 배치
                let _ = win.set_always_on_bottom(true);
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            // ── 시작 시 항상 맨 뒤 (데스크톱 위젯 모드) ──
            if let Some(win) = app.get_webview_window("main") {
                // 데스크톱 위젯처럼 맨 뒤에 배치
                let _ = win.set_always_on_bottom(true);
                let _ = win.set_skip_taskbar(true);
                // 작업표시줄에 표시하지 않음
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
            // 창이 닫히면 완전히 종료하지 않고 숨기기
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
            
            // 다른 앱 사용 시 창을 계속前台로 유지 (데스크톱 위젯 모드)
            // 단, 불필요한 연쇄 호출 방지
            match event {
                WindowEvent::Focused(false) => {
                    // 창이 포커스를 잃어도 데스크톱 위젯처럼 맨 뒤에 유지
                    // 하지만 사용자가 창을 클릭하면 다시 포커스를 받을 수 있음
                    let _ = window.set_always_on_bottom(true);
                }
                WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
                    // 크기/위치 변경 후 항상 맨 뒤로
                    let _ = window.set_always_on_bottom(true);
                }
                _ => {}
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
