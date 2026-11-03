//! Items Claude adds from a conversation.
//!
//! The Calendar MCP server (`mcp/server.mjs`) writes one JSON file per request
//! into `<app data>/inbox/`. The app takes them here: each file is read and then
//! deleted, so a request is handed over exactly once. The WebView validates the
//! contents before adding anything.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use tauri::AppHandle;

use crate::storage;

const INBOX_DIR: &str = "inbox";
/// A request holds at most 20 short items; anything far bigger isn't ours.
const MAX_REQUEST_BYTES: u64 = 256 * 1024;

/// Two overlapping calls (e.g. a timer tick and a window focus) must not both
/// read a file before either deletes it.
static TAKE_LOCK: Mutex<()> = Mutex::new(());

/// Finished request files, oldest first. Names start with a millisecond
/// timestamp; `.tmp` files are still being written and are left alone.
fn request_files(dir: &Path) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
                .collect()
        })
        .unwrap_or_default();

    files.sort();
    files
}

/// Contents of every waiting request; the files are removed once read.
#[tauri::command]
pub fn take_inbox(app: AppHandle) -> Result<Vec<String>, String> {
    let _guard = TAKE_LOCK.lock().map_err(|err| err.to_string())?;
    let dir = storage::app_dir(&app)?.join(INBOX_DIR);
    let mut requests = Vec::new();

    for path in request_files(&dir) {
        let small_enough = fs::metadata(&path).is_ok_and(|meta| meta.len() <= MAX_REQUEST_BYTES);

        if small_enough {
            if let Ok(contents) = fs::read_to_string(&path) {
                requests.push(contents);
            }
        }

        // Taken (or unusable): either way it must not be handed over again.
        let _ = fs::remove_file(&path);
    }

    Ok(requests)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn takes_finished_requests_oldest_first() {
        let dir = std::env::temp_dir().join(format!("calendar-inbox-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("200-b.json"), "{}").unwrap();
        fs::write(dir.join("100-a.json"), "{}").unwrap();
        fs::write(dir.join("300-c.json.tmp"), "{}").unwrap();

        let names: Vec<String> = request_files(&dir)
            .iter()
            .map(|path| path.file_name().unwrap().to_string_lossy().into_owned())
            .collect();

        assert_eq!(names, ["100-a.json", "200-b.json"]);
        fs::remove_dir_all(&dir).unwrap();
    }
}
