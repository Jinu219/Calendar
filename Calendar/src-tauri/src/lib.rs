use std::{
    sync::{
        atomic::{AtomicBool, AtomicIsize, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewWindow, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;

#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{
        CallWindowProcW, DefWindowProcW, GetClassNameW, GetForegroundWindow, GetWindowLongW,
        IsIconic, SetWindowLongPtrW, SetWindowLongW, SetWindowPos, ShowWindow, GWLP_WNDPROC,
        GWL_EXSTYLE, GWL_STYLE, HWND_BOTTOM, HWND_NOTOPMOST, HWND_TOPMOST, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOSIZE, SW_RESTORE, WINDOWPOS, WM_WINDOWPOSCHANGING, WNDPROC,
        WS_EX_NOACTIVATE, WS_MAXIMIZEBOX, WS_THICKFRAME,
    },
};

const MAIN_WINDOW_LABEL: &str = "main";
const AUTOSTART_ON_LABEL: &str = "시작프로그램: ON";
const AUTOSTART_OFF_LABEL: &str = "시작프로그램: OFF";

struct AutostartItem(Mutex<tauri::menu::MenuItem<tauri::Wry>>);

#[cfg(target_os = "windows")]
static DESKTOP_WIDGET_MODE: AtomicBool = AtomicBool::new(true);

#[cfg(target_os = "windows")]
static DESKTOP_WIDGET_WATCHDOG_STARTED: AtomicBool = AtomicBool::new(false);

/// The window's intended (width, height); anything else is a Windows Snap resize.
#[cfg(target_os = "windows")]
static FIXED_WINDOW_SIZE: Mutex<(i32, i32)> = Mutex::new((0, 0));

#[cfg(target_os = "windows")]
static ORIGINAL_WNDPROC: AtomicIsize = AtomicIsize::new(0);

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
}

fn autostart_label(enabled: bool) -> &'static str {
    if enabled {
        AUTOSTART_ON_LABEL
    } else {
        AUTOSTART_OFF_LABEL
    }
}

fn should_hide_on_close(window_label: &str) -> bool {
    window_label == MAIN_WINDOW_LABEL
}

fn update_autostart_menu(app: &AppHandle, enabled: bool) {
    if let Some(state) = app.try_state::<AutostartItem>() {
        if let Ok(item) = state.0.lock() {
            let _ = item.set_text(autostart_label(enabled));
        }
    }
}

fn toggle_main_window(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };

    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
    }
}

#[cfg(target_os = "windows")]
fn get_window_class_name(hwnd: HWND) -> String {
    let mut buffer = [0u16; 256];
    let length = unsafe { GetClassNameW(hwnd, &mut buffer) };

    if length <= 0 {
        return String::new();
    }

    String::from_utf16_lossy(&buffer[..length as usize])
}

#[cfg(target_os = "windows")]
fn is_desktop_foreground() -> bool {
    let foreground = unsafe { GetForegroundWindow() };

    if foreground.0.is_null() {
        return false;
    }

    matches!(
        get_window_class_name(foreground).as_str(),
        "Progman" | "WorkerW" | "SHELLDLL_DefView"
    )
}

/// Vetoes any Windows Snap resize attempt (dragging to a screen edge, Win+Arrow, the
/// Snap Layouts flyout) by forcing the window back to its fixed size on every
/// WM_WINDOWPOSCHANGING. Position changes (ordinary dragging) are left untouched.
#[cfg(target_os = "windows")]
unsafe extern "system" fn snap_lock_wndproc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_WINDOWPOSCHANGING {
        let pos = lparam.0 as *mut WINDOWPOS;

        if !pos.is_null() {
            if let Ok(size) = FIXED_WINDOW_SIZE.lock() {
                let (width, height) = *size;

                if width > 0 && height > 0 {
                    (*pos).cx = width;
                    (*pos).cy = height;
                }
            }
        }
    }

    let original = ORIGINAL_WNDPROC.load(Ordering::SeqCst);

    if original != 0 {
        let original_proc: WNDPROC = std::mem::transmute(original);
        CallWindowProcW(original_proc, hwnd, msg, wparam, lparam)
    } else {
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }
}

#[cfg(target_os = "windows")]
fn configure_main_window(window: &WebviewWindow) -> bool {
    let Ok(raw_hwnd) = window.hwnd() else {
        return false;
    };

    let hwnd = HWND(raw_hwnd.0);

    unsafe {
        let style = GetWindowLongW(hwnd, GWL_STYLE);
        let _ = SetWindowLongW(
            hwnd,
            GWL_STYLE,
            style & !(WS_MAXIMIZEBOX.0 as i32) & !(WS_THICKFRAME.0 as i32),
        );

        let extended_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        let _ = SetWindowLongW(
            hwnd,
            GWL_EXSTYLE,
            extended_style | WS_EX_NOACTIVATE.0 as i32,
        );
    }

    if let Ok(size) = window.outer_size() {
        if let Ok(mut fixed) = FIXED_WINDOW_SIZE.lock() {
            *fixed = (size.width as i32, size.height as i32);
        }

        unsafe {
            let previous =
                SetWindowLongPtrW(hwnd, GWLP_WNDPROC, snap_lock_wndproc as *const () as isize);
            ORIGINAL_WNDPROC.store(previous, Ordering::SeqCst);
        }
    }

    true
}

#[cfg(target_os = "windows")]
fn start_desktop_widget_watchdog(window: &WebviewWindow) {
    if DESKTOP_WIDGET_WATCHDOG_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    let Ok(raw_hwnd) = window.hwnd() else {
        return;
    };

    let hwnd_value = raw_hwnd.0 as isize;

    thread::spawn(move || loop {
        if DESKTOP_WIDGET_MODE.load(Ordering::SeqCst) {
            let hwnd = HWND(hwnd_value as *mut std::ffi::c_void);

            unsafe {
                if IsIconic(hwnd).as_bool() {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                }

                let target_level = if is_desktop_foreground() {
                    HWND_TOPMOST
                } else {
                    let _ = SetWindowPos(
                        hwnd,
                        HWND_NOTOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                    HWND_BOTTOM
                };

                let _ = SetWindowPos(
                    hwnd,
                    target_level,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                );
            }
        }

        thread::sleep(Duration::from_millis(300));
    });
}

fn configure_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let show_item = MenuItemBuilder::with_id("show", "열기 / 숨기기").build(app)?;
    let autostart_item =
        MenuItemBuilder::with_id("toggle_autostart", autostart_label(autostart_enabled))
            .build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "완전 종료").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show_item, &autostart_item, &separator, &quit_item])
        .build()?;

    app.manage(AutostartItem(Mutex::new(autostart_item)));

    let icon = app
        .default_window_icon()
        .expect("기본 트레이 아이콘을 찾을 수 없습니다")
        .clone();

    TrayIconBuilder::with_id("main_tray")
        .icon(icon)
        .tooltip("Calendar")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => toggle_main_window(app),
            "toggle_autostart" => {
                let autolaunch = app.autolaunch();
                let next = !autolaunch.is_enabled().unwrap_or(false);

                if next {
                    let _ = autolaunch.enable();
                } else {
                    let _ = autolaunch.disable();
                }

                update_autostart_menu(app, autolaunch.is_enabled().unwrap_or(false));
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = main_window(app) {
                let _ = window.show();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let _ = window.show();

                #[cfg(target_os = "windows")]
                {
                    configure_main_window(&window);
                    start_desktop_widget_watchdog(&window);
                }
            }

            configure_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if should_hide_on_close(window.label()) {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }

            // Moving the window to a monitor with a different DPI scale legitimately
            // needs a resize; re-sync the snap-lock's fixed size so that isn't vetoed.
            #[cfg(target_os = "windows")]
            if window.label() == MAIN_WINDOW_LABEL {
                if let WindowEvent::ScaleFactorChanged { .. } = event {
                    if let Ok(size) = window.outer_size() {
                        if let Ok(mut fixed) = FIXED_WINDOW_SIZE.lock() {
                            *fixed = (size.width as i32, size.height as i32);
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_autostart_status,
            set_autostart_status,
            set_window_level,
            set_show_on_taskbar,
            write_text_file,
            read_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 앱 실행 실패");
}

#[tauri::command]
fn get_autostart_status(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart_status(app: AppHandle, enabled: bool) -> bool {
    let autolaunch = app.autolaunch();

    if enabled {
        let _ = autolaunch.enable();
    } else {
        let _ = autolaunch.disable();
    }

    let actual = autolaunch.is_enabled().unwrap_or(false);
    update_autostart_menu(&app, actual);
    actual
}

#[tauri::command]
fn set_window_level(app: AppHandle, level: String) -> bool {
    let Some(window) = main_window(&app) else {
        return false;
    };

    let always_on_top = level == "top";

    #[cfg(target_os = "windows")]
    DESKTOP_WIDGET_MODE.store(!always_on_top, Ordering::SeqCst);

    let _ = window.set_always_on_bottom(false);
    let _ = window.set_always_on_top(false);

    if always_on_top {
        let _ = window.set_always_on_top(true);
    } else {
        let _ = window.set_always_on_bottom(true);
    }

    let _ = window.show();
    true
}

#[tauri::command]
fn set_show_on_taskbar(app: AppHandle, show: bool) -> bool {
    let Some(window) = main_window(&app) else {
        return false;
    };

    window.set_skip_taskbar(!show).is_ok()
}

/// Write text to a path the user chose via a native save dialog.
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|err| err.to_string())
}

/// Read text from a path the user chose via a native open dialog.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_main_window_is_hidden_on_close() {
        assert!(should_hide_on_close("main"));
        assert!(!should_hide_on_close("memo"));
        assert!(!should_hide_on_close("memo-detached-1"));
    }

    #[test]
    fn autostart_menu_label_matches_the_state() {
        assert_eq!(autostart_label(true), AUTOSTART_ON_LABEL);
        assert_eq!(autostart_label(false), AUTOSTART_OFF_LABEL);
    }
}
