#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
  menu::{MenuBuilder},
  tray::{TrayIconBuilder, TrayIconEvent},
  Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // ----- Autostart plugin (Rust side) -----
      #[cfg(desktop)]
      {
        use tauri_plugin_autostart::MacosLauncher;

        // 플러그인 등록 (문서 방식)
        app.handle().plugin(tauri_plugin_autostart::init(
          MacosLauncher::LaunchAgent,
          None, // 필요하면 Some(vec!["--flag"]) 넣기
        ));
      }

      // ----- Tray Menu -----
      // 메뉴 핸들은 clone 가능해서 이벤트 클로저에서 재사용 가능
      let menu = MenuBuilder::new(app)
        .text("show", "열기/숨기기")
        .text("toggle_autostart", "시작프로그램: 확인 중...")
        .separator()
        .text("quit", "종료")
        .build()?;

      // ----- Tray Icon -----
      let tray_menu = menu.clone();
      let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("윈도우 캘린더")
        .on_menu_event(move |app, event| {
          match event.id().as_ref() {
            "show" => {
              if let Some(w) = app.get_webview_window("main") {
                let visible = w.is_visible().unwrap_or(true);
                if visible {
                  let _ = w.hide();
                } else {
                  let _ = w.show();
                  let _ = w.set_focus();
                }
              }
            }
            "toggle_autostart" => {
              #[cfg(desktop)]
              {
                use tauri_plugin_autostart::ManagerExt;

                let autolaunch = app.autolaunch();
                let currently = autolaunch.is_enabled().unwrap_or(false);
                let _ = if currently { autolaunch.disable() } else { autolaunch.enable() };

                let now = autolaunch.is_enabled().unwrap_or(false);
                if let Some(item) = tray_menu.get("toggle_autostart") {
                  // MenuItem로 캐스팅해서 텍스트 변경
                  let _ = item
                    .as_menuitem_unchecked()
                    .set_text(if now { "시작프로그램: ON" } else { "시작프로그램: OFF" });
                }
              }
            }
            "quit" => {
              std::process::exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          // 더블클릭: 열기/숨기기 토글
          if let TrayIconEvent::DoubleClick { .. } = event {
            let app = tray.app_handle();
            if let Some(w) = app.get_webview_window("main") {
              let visible = w.is_visible().unwrap_or(true);
              if visible {
                let _ = w.hide();
              } else {
                let _ = w.show();
                let _ = w.set_focus();
              }
            }
          }
        })
        .build(app)?;

      // 시작프로그램 상태를 메뉴에 반영
      #[cfg(desktop)]
      {
        use tauri_plugin_autostart::ManagerExt;

        let enabled = app.autolaunch().is_enabled().unwrap_or(false);
        if let Some(item) = menu.get("toggle_autostart") {
          item.as_menuitem_unchecked()
            .set_text(if enabled { "시작프로그램: ON" } else { "시작프로그램: OFF" })?;
        }
      }

      // tray 변수는 drop되면 사라질 수 있으니(플랫폼별) _tray로 잡아둠
      let _tray = tray;

      Ok(())
    })
    .on_window_event(|window, event| {
      // X 눌러도 종료가 아니라 숨김
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}