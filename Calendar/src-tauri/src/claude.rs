//! Claude API access with the user's own API key.
//!
//! The key lives in Windows Credential Manager and is only ever read here: the
//! WebView can store, test for, or delete it, but never read it back. Requests
//! go to one fixed endpoint; the frontend supplies only the request body.

use std::time::Duration;

use serde::Serialize;

const MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2026-10-21";
/// Re-runs a request on another model when a safety classifier declines it.
const FALLBACK_BETA: &str = "server-side-fallback-2026-07-01";
const CREDENTIAL_TARGET: &str = "Calendar/ClaudeApiKey";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Serialize)]
pub struct ClaudeResponse {
    status: u16,
    body: String,
}

/// Rough shape check so an obviously wrong paste fails before any network call.
fn looks_like_api_key(key: &str) -> bool {
    key.starts_with("sk-ant-") && key.len() > 20 && !key.chars().any(char::is_whitespace)
}

#[cfg(target_os = "windows")]
mod vault {
    use windows::{
        core::{PCWSTR, PWSTR},
        Win32::{
            Foundation::FILETIME,
            Security::Credentials::{
                CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS,
                CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
            },
        },
    };

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn write(target: &str, secret: &str) -> Result<(), String> {
        let mut target_name = wide(target);
        let mut user_name = wide("Calendar");
        let blob = secret.as_bytes();

        let credential = CREDENTIALW {
            Flags: CRED_FLAGS(0),
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(target_name.as_mut_ptr()),
            Comment: PWSTR::null(),
            LastWritten: FILETIME::default(),
            CredentialBlobSize: blob.len() as u32,
            CredentialBlob: blob.as_ptr() as *mut u8,
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: std::ptr::null_mut(),
            TargetAlias: PWSTR::null(),
            UserName: PWSTR(user_name.as_mut_ptr()),
        };

        unsafe { CredWriteW(&credential, 0) }.map_err(|err| err.to_string())
    }

    pub fn read(target: &str) -> Option<String> {
        let target_name = wide(target);
        let mut credential: *mut CREDENTIALW = std::ptr::null_mut();

        unsafe {
            CredReadW(
                PCWSTR(target_name.as_ptr()),
                CRED_TYPE_GENERIC,
                0,
                &mut credential,
            )
            .ok()?;

            let bytes = std::slice::from_raw_parts(
                (*credential).CredentialBlob,
                (*credential).CredentialBlobSize as usize,
            );
            let secret = String::from_utf8(bytes.to_vec()).ok();
            CredFree(credential as *const _);
            secret
        }
    }

    pub fn delete(target: &str) -> Result<(), String> {
        let target_name = wide(target);
        unsafe { CredDeleteW(PCWSTR(target_name.as_ptr()), CRED_TYPE_GENERIC, 0) }
            .map_err(|err| err.to_string())
    }
}

#[cfg(not(target_os = "windows"))]
mod vault {
    pub fn write(_target: &str, _secret: &str) -> Result<(), String> {
        Err("API 키 저장은 Windows에서만 지원합니다".into())
    }

    pub fn read(_target: &str) -> Option<String> {
        None
    }

    pub fn delete(_target: &str) -> Result<(), String> {
        Ok(())
    }
}

#[tauri::command]
pub fn set_claude_api_key(key: String) -> Result<(), String> {
    let key = key.trim();

    if !looks_like_api_key(key) {
        return Err("Claude API 키는 sk-ant- 로 시작해요. 다시 확인해 주세요.".into());
    }

    vault::write(CREDENTIAL_TARGET, key)
}

#[tauri::command]
pub fn has_claude_api_key() -> bool {
    vault::read(CREDENTIAL_TARGET).is_some()
}

#[tauri::command]
pub fn delete_claude_api_key() -> Result<(), String> {
    vault::delete(CREDENTIAL_TARGET)
}

/// POST a Messages API request body; returns the HTTP status and response body
/// so the frontend can explain errors (bad key, rate limit…) in plain words.
#[tauri::command]
pub async fn claude_messages(body: String, use_fallback: bool) -> Result<ClaudeResponse, String> {
    let key = vault::read(CREDENTIAL_TARGET).ok_or("Claude API 키가 저장되어 있지 않아요")?;

    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|err| err.to_string())?;

    let mut request = client
        .post(MESSAGES_URL)
        .header("x-api-key", key)
        .header("anthropic-version", API_VERSION)
        .header("content-type", "application/json");

    if use_fallback {
        request = request.header("anthropic-beta", FALLBACK_BETA);
    }

    let response = request
        .body(body)
        .send()
        .await
        .map_err(|err| format!("network: {err}"))?;

    let status = response.status().as_u16();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("network: {err}"))?;

    Ok(ClaudeResponse {
        status,
        body: String::from_utf8_lossy(&bytes).into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_obviously_wrong_keys() {
        assert!(looks_like_api_key(
            "sk-ant-api03-abcdefghijklmnopqrstuvwxyz"
        ));
        assert!(!looks_like_api_key("sk-proj-abcdefghijklmnopqrstuvwxyz"));
        assert!(!looks_like_api_key("sk-ant-short"));
        assert!(!looks_like_api_key(
            "sk-ant-api03-abc def ghijklmnopqrstuvwxyz"
        ));
    }
}
