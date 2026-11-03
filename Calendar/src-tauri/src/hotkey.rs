//! System-wide shortcut that shows/hides the widget from anywhere.

use std::sync::Mutex;

use tauri::AppHandle;

/// Which combination was actually registered (another app may own the first choice).
static REGISTERED: Mutex<Option<&'static str>> = Mutex::new(None);

#[cfg(target_os = "windows")]
pub fn start(app: AppHandle, on_trigger: fn(&AppHandle)) {
    use windows::Win32::{
        Foundation::HWND,
        UI::{
            Input::KeyboardAndMouse::{
                RegisterHotKey, HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_WIN,
            },
            WindowsAndMessaging::{GetMessageW, MSG, WM_HOTKEY},
        },
    };

    const HOTKEY_ID: i32 = 0x0CA1;
    const VK_C: u32 = 0x43;

    std::thread::spawn(move || {
        let candidates: [(HOT_KEY_MODIFIERS, &'static str); 2] = [
            (MOD_WIN | MOD_ALT | MOD_NOREPEAT, "Win+Alt+C"),
            (MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, "Ctrl+Alt+C"),
        ];

        // Registered without a window, the hotkey belongs to this thread and its
        // WM_HOTKEY arrives in this thread's message loop below.
        let Some(label) = candidates.into_iter().find_map(|(modifiers, label)| {
            unsafe { RegisterHotKey(HWND::default(), HOTKEY_ID, modifiers, VK_C) }
                .ok()
                .map(|_| label)
        }) else {
            return;
        };

        if let Ok(mut registered) = REGISTERED.lock() {
            *registered = Some(label);
        }

        let mut msg = MSG::default();

        while unsafe { GetMessageW(&mut msg, HWND::default(), 0, 0) }.as_bool() {
            if msg.message == WM_HOTKEY {
                let handle = app.clone();
                let _ = app.run_on_main_thread(move || on_trigger(&handle));
            }
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn start(_app: AppHandle, _on_trigger: fn(&AppHandle)) {}

#[tauri::command]
pub fn get_global_shortcut() -> Option<String> {
    REGISTERED
        .lock()
        .ok()
        .and_then(|registered| registered.map(str::to_string))
}
