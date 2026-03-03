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
            // ── 일반 모드로 시작: 창이 화면에 표시됨 ──
            if let Some(win) = app.get_webview_window("main") {
                // 창을 표시하고前台으로 유지
                let _ = win.show();
                let _ = win.set_focus();
                
                // 데스크톱 위젯 모드로 변경하려면 트레이 아이콘을 더블클릭하세요
                // 또는 '항상 뒤로' 옵션을 사용하세요
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
                            else { let _ = win.show(); let _ = win.set_focus(); }
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
            
            // 데스크톱 위젯 모드 관련 설정은 사용자가 직접 트레이 아이콘을 통해 전환
            // 여기서는 자동 뒤로 이동 기능을 비활성화
        })
        .invoke_handler(tauri::generate_handler![
            get_autostart_status,
            set_autostart_status,
            set_always_on_top,
            set_show_on_taskbar,
            get_window_visible,
            set_always_on_bottom,
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

// ── 항상 위에 표시 설정 ──
#[tauri::command]
fn set_always_on_top(app: tauri::AppHandle, enabled: bool) -> bool {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_always_on_top(enabled);
        // Win+D 방지: 창을 항상 위에 표시하면 Winn+D시 숨겨지지 않음
        if enabled {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
    enabled
}

// ── 항상 아래로 설정 (데스크톱 위젯 모드) ──
#[tauri::command]
fn set_always_on_bottom(_app: tauri::AppHandle) -> bool {
    // 이 기능은 단일 인스턴스 플러그인에서 처리됨
    true
}

// ── 작업 표시줄 표시 설정 ──
#[tauri::command]
fn set_show_on_taskbar(app: tauri::AppHandle, show: bool) -> bool {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_skip_taskbar(!show);
    }
    show
}

// ── 창 표시 상태 가져오기 ──
#[tauri::command]
fn get_window_visible(app: tauri::AppHandle) -> bool {
    if let Some(win) = app.get_webview_window("main") {
        win.is_visible().unwrap_or(false)
    } else {
        false
    }
}
