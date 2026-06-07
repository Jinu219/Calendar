use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;

#[cfg(target_os = "windows")]
use windows::{
    core::{w, PCWSTR},
    Win32::Foundation::{HWND, LPARAM, WPARAM},
    Win32::UI::WindowsAndMessaging::{
        FindWindowExW, FindWindowW, GetClassNameW, GetForegroundWindow, GetWindowLongW,
        IsIconic, IsWindowVisible, SendMessageTimeoutW, SetParent, SetWindowLongW,
        SetWindowPos, ShowWindow, GWL_EXSTYLE, GWL_STYLE, HWND_BOTTOM, HWND_NOTOPMOST,
        HWND_TOPMOST, SMTO_NORMAL, SW_RESTORE, SW_SHOWNOACTIVATE, SWP_FRAMECHANGED,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_CHILD,
        WS_EX_NOACTIVATE, WS_MAXIMIZEBOX, WS_POPUP, WS_THICKFRAME,
    },
};

struct AutostartItem(Mutex<tauri::menu::MenuItem<tauri::Wry>>);

#[cfg(target_os = "windows")]
static DESKTOP_WIDGET_MODE: AtomicBool = AtomicBool::new(true);

#[cfg(target_os = "windows")]
static DESKTOP_WIDGET_WATCHDOG_STARTED: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
fn get_window_class_name(hwnd: HWND) -> String {
    let mut buffer = [0u16; 256];

    unsafe {
        let len = GetClassNameW(hwnd, &mut buffer);

        if len <= 0 {
            return String::new();
        }#[cfg(target_os = "windows")]
fn start_desktop_widget_watchdog(win: &tauri::WebviewWindow) {
    if DESKTOP_WIDGET_WATCHDOG_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    let Ok(raw_hwnd) = win.hwnd() else {
        return;
    };

    let hwnd_value = raw_hwnd.0 as isize;

    thread::spawn(move || loop {
        if DESKTOP_WIDGET_MODE.load(Ordering::SeqCst) {
            let hwnd = HWND(hwnd_value as *mut std::ffi::c_void);

            unsafe {
                let is_visible = IsWindowVisible(hwnd).as_bool();
                let is_minimized = IsIconic(hwnd).as_bool();
                let desktop_foreground = is_desktop_foreground();

                if is_minimized {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                }

                if !is_visible {
                    let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                }

                if desktop_foreground {
                    // Win + D 이후 바탕화면이 foreground일 때:
                    // CWA를 바탕화면 위에 보이게 잠깐 topmost로 올림
                    let _ = SetWindowPos(
                        hwnd,
                        HWND_TOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                } else {
                    // 일반 앱을 보고 있을 때:
                    // topmost를 해제하고 다시 가장 아래로 내림
                    let _ = SetWindowPos(
                        hwnd,
                        HWND_NOTOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );

                    let _ = SetWindowPos(
                        hwnd,
                        HWND_BOTTOM,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                }
            }
        }

        thread::sleep(Duration::from_millis(300));
    });
}

        String::from_utf16_lossy(&buffer[..len as usize])
    }
}

#[cfg(target_os = "windows")]
fn is_desktop_foreground() -> bool {
    unsafe {
        let foreground = GetForegroundWindow();

        if !is_valid_hwnd(foreground) {
            return false;
        }

        let class_name = get_window_class_name(foreground);

        class_name == "Progman"
            || class_name == "WorkerW"
            || class_name == "SHELLDLL_DefView"
    }
}

#[cfg(target_os = "windows")]
fn null_hwnd() -> HWND {
    HWND(std::ptr::null_mut())
}

#[cfg(target_os = "windows")]
fn is_valid_hwnd(hwnd: HWND) -> bool {
    !hwnd.0.is_null()
}

#[cfg(target_os = "windows")]
fn find_desktop_workerw() -> Option<HWND> {
    unsafe {
        let progman = FindWindowW(w!("Progman"), PCWSTR::null()).ok()?;

        if !is_valid_hwnd(progman) {
            return None;
        }

        // WorkerW 생성 유도
        let mut result: usize = 0;
        let _ = SendMessageTimeoutW(
            progman,
            0x052C,
            WPARAM(0),
            LPARAM(0),
            SMTO_NORMAL,
            1000,
            Some(&mut result as *mut usize),
        );

        // 이번에는 "다음 WorkerW"가 아니라
        // SHELLDLL_DefView를 포함한 WorkerW를 우선 사용한다.
        let mut worker = null_hwnd();

        loop {
            let found_worker =
                FindWindowExW(null_hwnd(), worker, w!("WorkerW"), PCWSTR::null()).ok();

            let Some(found_worker) = found_worker else {
                break;
            };

            if !is_valid_hwnd(found_worker) {
                break;
            }

            worker = found_worker;

            let shell_view =
                FindWindowExW(worker, null_hwnd(), w!("SHELLDLL_DefView"), PCWSTR::null()).ok();

            if let Some(shell_view) = shell_view {
                if is_valid_hwnd(shell_view) {
                    return Some(worker);
                }
            }
        }

        // WorkerW를 못 찾으면 Progman에 붙인다.
        Some(progman)
    }
}

#[cfg(target_os = "windows")]
fn attach_window_to_desktop(win: &tauri::WebviewWindow) -> bool {
    let Ok(raw_hwnd) = win.hwnd() else {
        return false;
    };

    let hwnd = HWND(raw_hwnd.0);

    let Some(desktop_parent) = find_desktop_workerw() else {
        return false;
    };

    // SetParent 이후 좌표가 꼬이지 않도록 현재 위치/크기를 미리 저장
    let position = win.outer_position().ok();
    let size = win.outer_size().ok();

    let x = position.map(|p| p.x).unwrap_or(80);
    let y = position.map(|p| p.y).unwrap_or(80);
    let width = size.map(|s| s.width as i32).unwrap_or(900);
    let height = size.map(|s| s.height as i32).unwrap_or(650);

    unsafe {
        // 일반 top-level popup 창을 desktop child 창으로 전환
        let style = GetWindowLongW(hwnd, GWL_STYLE);
        let new_style = (style & !(WS_POPUP.0 as i32)) | WS_CHILD.0 as i32;

        let _ = SetWindowLongW(hwnd, GWL_STYLE, new_style);

        // 바탕화면 계층에 붙이기
        let _ = SetParent(hwnd, desktop_parent);

        // 포커스를 빼앗지 않도록 설정
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        let _ = SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_NOACTIVATE.0 as i32);

        // 핵심:
        // SetParent 후 위치/크기를 다시 강제로 잡아준다.
        let _ = SetWindowPos(
            hwnd,
            null_hwnd(),
            x,
            y,
            width,
            height,
            SWP_NOZORDER | SWP_FRAMECHANGED,
        );
    }

    let _ = win.show();

    true
}

#[cfg(target_os = "windows")]
fn detach_window_from_desktop(win: &tauri::WebviewWindow) -> bool {
    let Ok(raw_hwnd) = win.hwnd() else {
        return false;
    };

    let hwnd = HWND(raw_hwnd.0);

    let position = win.outer_position().ok();
    let size = win.outer_size().ok();

    let x = position.map(|p| p.x).unwrap_or(80);
    let y = position.map(|p| p.y).unwrap_or(80);
    let width = size.map(|s| s.width as i32).unwrap_or(900);
    let height = size.map(|s| s.height as i32).unwrap_or(650);

    unsafe {
        // 다시 일반 top-level popup 창으로 복구
        let style = GetWindowLongW(hwnd, GWL_STYLE);
        let new_style = (style & !(WS_CHILD.0 as i32)) | WS_POPUP.0 as i32;

        let _ = SetWindowLongW(hwnd, GWL_STYLE, new_style);

        let _ = SetParent(hwnd, null_hwnd());

        let _ = SetWindowPos(
            hwnd,
            null_hwnd(),
            x,
            y,
            width,
            height,
            SWP_NOZORDER | SWP_FRAMECHANGED,
        );
    }

    let _ = win.show();

    true
}

#[cfg(target_os = "windows")]
fn start_desktop_widget_watchdog(win: &tauri::WebviewWindow) {
    if DESKTOP_WIDGET_WATCHDOG_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    let Ok(raw_hwnd) = win.hwnd() else {
        return;
    };

    let hwnd_value = raw_hwnd.0 as isize;

    thread::spawn(move || loop {
        if DESKTOP_WIDGET_MODE.load(Ordering::SeqCst) {
            let hwnd = HWND(hwnd_value as *mut std::ffi::c_void);

            unsafe {
                let is_visible = IsWindowVisible(hwnd).as_bool();
                let is_minimized = IsIconic(hwnd).as_bool();
                let desktop_foreground = is_desktop_foreground();

                if is_minimized {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                }

                if !is_visible {
                    let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                }

                if desktop_foreground {
                    // Win + D 이후 바탕화면이 foreground일 때:
                    // CWA를 바탕화면 위에 보이게 잠깐 topmost로 올림
                    let _ = SetWindowPos(
                        hwnd,
                        HWND_TOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                } else {
                    // 일반 앱을 보고 있을 때:
                    // topmost를 해제하고 다시 가장 아래로 내림
                    let _ = SetWindowPos(
                        hwnd,
                        HWND_NOTOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );

                    let _ = SetWindowPos(
                        hwnd,
                        HWND_BOTTOM,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                }
            }
        }

        thread::sleep(Duration::from_millis(300));
    });
}

pub fn run() {
    tauri::Builder::default()
        // ── 단일 인스턴스: 두 번째 실행 시 기존 창을 열고 포커스 ──
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();

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
                #[cfg(target_os = "windows")]
                start_desktop_widget_watchdog(&win);    

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
                #[cfg(target_os = "windows")]
                {
                    DESKTOP_WIDGET_MODE.store(false, Ordering::SeqCst);
                    let _ = detach_window_from_desktop(&win);
                }

                let _ = win.set_always_on_bottom(false);
                let _ = win.set_always_on_top(true);
                let _ = win.show();
            }

            // 항상 아래
            "bottom" => {
                #[cfg(target_os = "windows")]
                {
                    DESKTOP_WIDGET_MODE.store(true, Ordering::SeqCst);
                    let _ = detach_window_from_desktop(&win);
                }

                let _ = win.set_always_on_top(false);
                let _ = win.set_always_on_bottom(true);
                let _ = win.show();
            }

            // 잘못된 값 또는 예전 normal 값도 bottom으로 처리
            _ => {
                #[cfg(target_os = "windows")]
                {
                    DESKTOP_WIDGET_MODE.store(true, Ordering::SeqCst);
                    let _ = detach_window_from_desktop(&win);
                }

                let _ = win.set_always_on_top(false);
                let _ = win.set_always_on_bottom(true);
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
        set_window_level(app, "bottom".to_string())
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