//! Notion API access with the user's internal integration token.
//!
//! The token lives in Windows Credential Manager and never goes back to the
//! WebView. Requests can only reach `https://api.notion.com/v1/…` with the
//! methods the export needs.

use std::time::Duration;

use serde::Serialize;

use crate::vault;

const API_BASE: &str = "https://api.notion.com";
/// Data-source based API: keeps working when a database gains a second source.
const NOTION_VERSION: &str = "2025-09-03";
const CREDENTIAL_TARGET: &str = "Calendar/NotionToken";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Serialize)]
pub struct NotionResponse {
    status: u16,
    body: String,
    /// Seconds to wait after a 429, from the Retry-After header.
    retry_after: Option<u64>,
}

/// Internal integration secrets start with `ntn_` (older ones with `secret_`).
fn looks_like_token(token: &str) -> bool {
    (token.starts_with("ntn_") || token.starts_with("secret_"))
        && token.len() > 20
        && !token.chars().any(char::is_whitespace)
}

/// `/v1/…` made only of path characters, so the host can never change.
fn is_safe_path(path: &str) -> bool {
    path.starts_with("/v1/")
        && !path.contains("..")
        && path
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '-' | '_'))
}

#[tauri::command]
pub fn set_notion_token(token: String) -> Result<(), String> {
    let token = token.trim();

    if !looks_like_token(token) {
        return Err(
            "Notion 통합 토큰은 ntn_ (또는 secret_)으로 시작해요. 다시 확인해 주세요.".into(),
        );
    }

    vault::write(CREDENTIAL_TARGET, token)
}

#[tauri::command]
pub fn has_notion_token() -> bool {
    vault::read(CREDENTIAL_TARGET).is_some()
}

#[tauri::command]
pub fn delete_notion_token() -> Result<(), String> {
    vault::delete(CREDENTIAL_TARGET)
}

#[tauri::command]
pub async fn notion_request(
    method: String,
    path: String,
    body: Option<String>,
) -> Result<NotionResponse, String> {
    if !is_safe_path(&path) {
        return Err(format!("invalid Notion path: {path}"));
    }

    let method = match method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PATCH" => reqwest::Method::PATCH,
        _ => return Err(format!("unsupported method: {method}")),
    };

    let token = vault::read(CREDENTIAL_TARGET).ok_or("Notion 토큰이 저장되어 있지 않아요")?;

    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|err| err.to_string())?;

    let mut request = client
        .request(method, format!("{API_BASE}{path}"))
        .header("authorization", format!("Bearer {token}"))
        .header("notion-version", NOTION_VERSION)
        .header("content-type", "application/json");

    if let Some(body) = body {
        request = request.body(body);
    }

    let response = request
        .send()
        .await
        .map_err(|err| format!("network: {err}"))?;

    let status = response.status().as_u16();
    let retry_after = response
        .headers()
        .get("retry-after")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok());
    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("network: {err}"))?;

    Ok(NotionResponse {
        status,
        body: String::from_utf8_lossy(&bytes).into_owned(),
        retry_after,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_token_shape() {
        assert!(looks_like_token("ntn_1234567890abcdefghijklmn"));
        assert!(looks_like_token("secret_1234567890abcdefghijklmn"));
        assert!(!looks_like_token("sk-ant-1234567890abcdefghijklmn"));
        assert!(!looks_like_token("ntn_short"));
    }

    #[test]
    fn only_api_paths_are_allowed() {
        assert!(is_safe_path(
            "/v1/databases/1a2b3c4d-5e6f-7081-a2b3-c4d5e6f70812"
        ));
        assert!(is_safe_path("/v1/pages"));
        assert!(!is_safe_path("/v2/pages"));
        assert!(!is_safe_path("/v1/../oauth/token"));
        assert!(!is_safe_path("/v1/pages?x=@evil.com"));
        assert!(!is_safe_path("//evil.com/v1/pages"));
    }
}
