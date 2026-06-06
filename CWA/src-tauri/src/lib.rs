use std::sync::Mutex;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;

struct AutostartItem(Mutex<tauri::menu::MenuItem<tauri::Wry>>);

pub fn run() {
    tauri::Builder::default()
        // ── 단일 인스턴스: 두 번째 실행 시 기존 창을 열고 포커스 ──
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();

                // 중요:
                // 예전처럼 여기서 set_always_on_bottom(true)를 강제로 호출하지 않는다.
                // 창 레벨은 프론트 설정(windowLevel: bottom / normal / top)이 제어한다.
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            // ── 앱 시작 시 메인 창 표시 ──
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();

                // ── Windows Aero Snap / Snap Layout 일부 비활성화 ──
                #[cfg(target_os = "windows")]
                {
                    use windows::Win32::Foundation::HWND;
                    use windows::Win32::UI::WindowsAndMessaging::{
                        GetWindowLongW, SetWindowLongW, GWL_EXSTYLE, GWL_STYLE,
                        WS_EX_NOACTIVATE, WS_MAXIMIZEBOX, WS_THICKFRAME,
                    };

                    if let Ok(raw_hwnd) = win.hwnd() {
                        let hwnd = HWND(raw_hwnd.0);

                        unsafe {
                            // WS_MAXIMIZEBOX 제거 → 최대화 버튼/스냅 제한
                            // WS_THICKFRAME 제거 → 가장자리 크기 조절 스냅 제한
                            let style = GetWindowLongW(hwnd, GWL_STYLE);
                            let _ = SetWindowLongW(
                                hwnd,
                                GWL_STYLE,
                                style
                                    & !(WS_MAXIMIZEBOX.0 as i32)
                                    & !(WS_THICKFRAME.0 as i32),
                            );

                            // WS_EX_NOACTIVATE → Windows 11 Snap Layout 팝업 완화
                            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
                            let _ = SetWindowLongW(
                                hwnd,
                                GWL_EXSTYLE,
                                ex_style | WS_EX_NOACTIVATE.0 as i32,
                            );
                        }
                    }
                }
            }

            // ── 트레이 메뉴 구성 ──
            let enabled = app.autolaunch().is_enabled().unwrap_or(false);

            let autostart_label = if enabled {
                "시작프로그램: ON"
            } else {
                "시작프로그램: OFF"
            };

            let show_item =
                MenuItemBuilder::with_id("show", "열기 / 숨기기").build(app)?;
            let autostart_item =
                MenuItemBuilder::with_id("toggle_autostart", autostart_label).build(app)?;
            let sep =
                PredefinedMenuItem::separator(app)?;
            let quit_item =
                MenuItemBuilder::with_id("quit", "완전 종료").build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &autostart_item, &sep, &quit_item])
                .build()?;

            app.manage(AutostartItem(Mutex::new(autostart_item)));

            let icon = app
                .default_window_icon()
                .expect("기본 트레이 아이콘을 찾을 수 없습니다")
                .clone();

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

                                // 중요:
                                // 여기서도 항상 아래로 강제하지 않는다.
                                // 사용자가 설정한 windowLevel을 프론트에서 다시 적용한다.
                            }
                        }
                    }

                    "toggle_autostart" => {
                        let autolaunch = app.autolaunch();

                        if autolaunch.is_enabled().unwrap_or(false) {
                            let _ = autolaunch.disable();
                        } else {
                            let _ = autolaunch.enable();
                        }

                        let new_label = if autolaunch.is_enabled().unwrap_or(false) {
                            "시작프로그램: ON"
                        } else {
                            "시작프로그램: OFF"
                        };

                        if let Some(state) = app.try_state::<AutostartItem>() {
                            if let Ok(item) = state.0.lock() {
                                let _ = item.set_text(new_label);
                            }
                        }
                    }

                    "quit" => {
                        std::process::exit(0);
                    }

                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();

                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();

                                // 중요:
                                // 더블클릭으로 열 때도 항상 아래 강제 적용하지 않는다.
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // 창 닫기 버튼을 누르면 완전히 종료하지 않고 숨김 처리
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }

            // 중요:
            // 예전 코드처럼 Focused / Moved / Resized 이벤트에서
            // set_always_on_bottom(true)를 강제로 호출하지 않는다.
            // 창 레벨은 프론트 설정에서 invoke("set_window_level")로 제어한다.
        })
        .invoke_handler(tauri::generate_handler![
            get_autostart_status,
            set_autostart_status,
            set_window_level,
            set_show_on_taskbar,
            set_always_on_top,
            set_always_on_bottom,
            get_window_visible,
            disable_snap,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 앱 실행 실패");
}

// ═══════════════════════════════════════════════════════════
// Autostart Commands
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn get_autostart_status(app: tauri::AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart_status(app: tauri::AppHandle, enabled: bool) -> bool {
    let autolaunch = app.autolaunch();

    if enabled {
        let _ = autolaunch.enable();
    } else {
        let _ = autolaunch.disable();
    }

    let new_label = if autolaunch.is_enabled().unwrap_or(false) {
        "시작프로그램: ON"
    } else {
        "시작프로그램: OFF"
    };

    if let Some(state) = app.try_state::<AutostartItem>() {
        if let Ok(item) = state.0.lock() {
            let _ = item.set_text(new_label);
        }
    }

    autolaunch.is_enabled().unwrap_or(false)
}

// ═══════════════════════════════════════════════════════════
// Window Level Commands
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn set_window_level(app: tauri::AppHandle, level: String) -> bool {
    if let Some(win) = app.get_webview_window("main") {
        match level.as_str() {
            // 항상 위
            "top" => {
                let _ = win.set_always_on_bottom(false);
                let _ = win.set_always_on_top(true);
                let _ = win.show();
            }

            // 항상 아래
            "bottom" => {
                let _ = win.set_always_on_top(false);
                let _ = win.set_always_on_bottom(true);
                let _ = win.show();
            }

            // 일반 창
            "normal" => {
                let _ = win.set_always_on_top(false);
                let _ = win.set_always_on_bottom(false);
                let _ = win.show();
            }

            // 잘못된 값이 들어오면 일반 창으로 처리
            _ => {
                let _ = win.set_always_on_top(false);
                let _ = win.set_always_on_bottom(false);
                let _ = win.show();
            }
        }

        return true;
    }

    false
}

// 이전 프론트 코드와의 호환용.
// 새 코드는 set_window_level("top" | "bottom" | "normal") 사용을 권장.
#[tauri::command]
fn set_always_on_top(app: tauri::AppHandle, enabled: bool) -> bool {
    if enabled {
        set_window_level(app, "top".to_string())
    } else {
        set_window_level(app, "normal".to_string())
    }
}

// 이전 프론트 코드와의 호환용.
// 새 코드는 set_window_level("bottom") 사용을 권장.
#[tauri::command]
fn set_always_on_bottom(app: tauri::AppHandle) -> bool {
    set_window_level(app, "bottom".to_string())
}

// ═══════════════════════════════════════════════════════════
// Taskbar / Visibility Commands
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn set_show_on_taskbar(app: tauri::AppHandle, show: bool) -> bool {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_skip_taskbar(!show);
        return true;
    }

    false
}

#[tauri::command]
fn get_window_visible(app: tauri::AppHandle) -> bool {
    if let Some(win) = app.get_webview_window("main") {
        win.is_visible().unwrap_or(false)
    } else {
        false
    }
}

// ═══════════════════════════════════════════════════════════
// Windows Snap Disable Command
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn disable_snap(app: tauri::AppHandle) -> bool {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongW, SetWindowLongW, GWL_EXSTYLE, GWL_STYLE,
            WS_EX_NOACTIVATE, WS_MAXIMIZEBOX, WS_THICKFRAME,
        };

        if let Some(win) = app.get_webview_window("main") {
            if let Ok(raw_hwnd) = win.hwnd() {
                let hwnd = HWND(raw_hwnd.0);

                unsafe {
                    let style = GetWindowLongW(hwnd, GWL_STYLE);
                    let _ = SetWindowLongW(
                        hwnd,
                        GWL_STYLE,
                        style
                            & !(WS_MAXIMIZEBOX.0 as i32)
                            & !(WS_THICKFRAME.0 as i32),
                    );

                    let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
                    let _ = SetWindowLongW(
                        hwnd,
                        GWL_EXSTYLE,
                        ex_style | WS_EX_NOACTIVATE.0 as i32,
                    );
                }

                return true;
            }
        }

        false
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        false
    }
}