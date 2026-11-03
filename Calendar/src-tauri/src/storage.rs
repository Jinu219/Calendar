//! Data that must survive the WebView's own storage being cleared: a file mirror
//! of the localStorage keys (todos/settings/memos), rotating daily backups, and
//! downloading subscribed calendar feeds.
//!
//! Only fixed file names inside the app data directory are ever written here;
//! paths chosen by the user go through `write_text_file`/`read_text_file`.

use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager};

const STORE_NAMES: [&str; 3] = ["todos", "settings", "memos"];
const BACKUP_DIR: &str = "backups";
const BACKUP_PREFIX: &str = "calendar-backup-";
const BACKUPS_TO_KEEP: usize = 7;
const MAX_FEED_BYTES: usize = 5 * 1024 * 1024;

pub(crate) fn app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir)
}

fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_dir(app)?.join(BACKUP_DIR);
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir)
}

/// Write through a temporary file and rename it into place, so a crash or power
/// loss mid-write can never leave a truncated data file behind.
fn write_atomic(path: &Path, contents: &str) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, contents)?;
    fs::rename(&tmp, path)
}

fn is_store_name(name: &str) -> bool {
    STORE_NAMES.contains(&name)
}

/// `YYYY-MM-DD` and nothing else, since it becomes part of a file name.
fn is_date(date: &str) -> bool {
    date.len() == 10
        && date.bytes().enumerate().all(|(i, b)| {
            if i == 4 || i == 7 {
                b == b'-'
            } else {
                b.is_ascii_digit()
            }
        })
}

fn backup_names(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter_map(|entry| entry.file_name().into_string().ok())
                .filter(|name| name.starts_with(BACKUP_PREFIX) && name.ends_with(".json"))
                .collect()
        })
        .unwrap_or_default();

    // Names embed the date, so newest first is reverse lexical order.
    names.sort_unstable_by(|a, b| b.cmp(a));
    names
}

/// Backups to delete so that only the newest `keep` remain (input newest first).
fn backups_beyond(names: &[String], keep: usize) -> &[String] {
    names.get(keep..).unwrap_or(&[])
}

/// Contents of every mirrored store file that exists.
#[tauri::command]
pub fn read_store(app: AppHandle) -> Result<HashMap<String, String>, String> {
    let dir = app_dir(&app)?;

    Ok(STORE_NAMES
        .iter()
        .filter_map(|name| {
            fs::read_to_string(dir.join(format!("{name}.json")))
                .ok()
                .map(|contents| (name.to_string(), contents))
        })
        .collect())
}

#[tauri::command]
pub fn write_store(app: AppHandle, name: String, contents: String) -> Result<(), String> {
    if !is_store_name(&name) {
        return Err(format!("unknown store: {name}"));
    }

    write_atomic(&app_dir(&app)?.join(format!("{name}.json")), &contents)
        .map_err(|err| err.to_string())
}

/// Save today's automatic backup and drop all but the newest few.
#[tauri::command]
pub fn write_auto_backup(app: AppHandle, date: String, contents: String) -> Result<String, String> {
    if !is_date(&date) {
        return Err(format!("invalid date: {date}"));
    }

    let dir = backup_dir(&app)?;
    let path = dir.join(format!("{BACKUP_PREFIX}{date}.json"));
    write_atomic(&path, &contents).map_err(|err| err.to_string())?;

    for name in backups_beyond(&backup_names(&dir), BACKUPS_TO_KEEP) {
        let _ = fs::remove_file(dir.join(name));
    }

    Ok(path.to_string_lossy().into_owned())
}

/// Automatic backup file names, newest first.
#[tauri::command]
pub fn list_auto_backups(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(backup_names(&backup_dir(&app)?))
}

#[tauri::command]
pub fn get_backup_dir(app: AppHandle) -> Result<String, String> {
    Ok(backup_dir(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn open_backup_dir(app: AppHandle) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(backup_dir(&app)?)
        .spawn()
        .map(|_| ())
        .map_err(|err| err.to_string())
}

/// Download an ICS feed (Google Calendar, school calendars…). Done here rather
/// than with `fetch` in the WebView because those servers don't send CORS headers.
#[tauri::command]
pub async fn fetch_calendar_feed(url: String) -> Result<String, String> {
    let url = url.trim();
    let url = match url.strip_prefix("webcal://") {
        Some(rest) => format!("https://{rest}"),
        None => url.to_string(),
    };

    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("http(s) 또는 webcal 주소만 구독할 수 있습니다".into());
    }

    let response = reqwest::get(&url).await.map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        return Err(format!("서버 응답 {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|err| err.to_string())?;

    if bytes.len() > MAX_FEED_BYTES {
        return Err("캘린더 파일이 너무 큽니다 (5MB 초과)".into());
    }

    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_stores_can_be_written() {
        assert!(is_store_name("todos"));
        assert!(is_store_name("memos"));
        assert!(!is_store_name("../todos"));
        assert!(!is_store_name("backups"));
    }

    #[test]
    fn backup_dates_are_strictly_formatted() {
        assert!(is_date("2026-11-03"));
        assert!(!is_date("2026-11-3"));
        assert!(!is_date("2026/11/03"));
        assert!(!is_date("../../etc/x"));
    }

    #[test]
    fn only_the_newest_backups_are_kept() {
        let names: Vec<String> = (1..=9)
            .rev()
            .map(|day| format!("{BACKUP_PREFIX}2026-11-0{day}.json"))
            .collect();

        let pruned = backups_beyond(&names, 7);
        assert_eq!(pruned.len(), 2);
        assert_eq!(pruned[0], format!("{BACKUP_PREFIX}2026-11-02.json"));
        assert!(backups_beyond(&names[..3], 7).is_empty());
    }
}
