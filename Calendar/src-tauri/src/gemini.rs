//! Gemini API access (Google AI Studio, free tier) with the user's own key.
//!
//! The key lives in Windows Credential Manager and never goes back to the
//! WebView. Requests can only reach `generateContent` of the models listed
//! here; the frontend supplies the model name and the request body.

use std::time::Duration;

use serde::Serialize;

use crate::vault;

const API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";
const CREDENTIAL_TARGET: &str = "Calendar/GeminiApiKey";
/// Free-tier models the settings offer.
const MODELS: [&str; 2] = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Serialize)]
pub struct GeminiResponse {
    status: u16,
    body: String,
}

/// Rough shape check so an obviously wrong paste fails before any network call.
fn looks_like_api_key(key: &str) -> bool {
    (30..=200).contains(&key.len()) && key.chars().all(|c| c.is_ascii_graphic())
}

#[tauri::command]
pub fn set_gemini_api_key(key: String) -> Result<(), String> {
    let key = key.trim();

    if !looks_like_api_key(key) {
        return Err(
            "Gemini API 키 형식이 아니에요. AI Studio에서 복사한 키(AIza…)를 붙여 넣어 주세요."
                .into(),
        );
    }

    vault::write(CREDENTIAL_TARGET, key)
}

#[tauri::command]
pub fn has_gemini_api_key() -> bool {
    vault::read(CREDENTIAL_TARGET).is_some()
}

#[tauri::command]
pub fn delete_gemini_api_key() -> Result<(), String> {
    vault::delete(CREDENTIAL_TARGET)
}

/// POST a generateContent body; returns the HTTP status and response body so the
/// frontend can explain errors (bad key, free-tier limit…) in plain words.
#[tauri::command]
pub async fn gemini_generate(model: String, body: String) -> Result<GeminiResponse, String> {
    if !MODELS.contains(&model.as_str()) {
        return Err(format!("unsupported Gemini model: {model}"));
    }

    let key = vault::read(CREDENTIAL_TARGET).ok_or("Gemini API 키가 저장되어 있지 않아요")?;

    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|err| err.to_string())?;

    let response = client
        .post(format!("{API_BASE}/{model}:generateContent"))
        .header("x-goog-api-key", key)
        .header("content-type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|err| format!("network: {err}"))?;

    let status = response.status().as_u16();
    let bytes = response
        .bytes()
        .await
        .map_err(|err| format!("network: {err}"))?;

    Ok(GeminiResponse {
        status,
        body: String::from_utf8_lossy(&bytes).into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_key_shape() {
        assert!(looks_like_api_key("AIzaSyA1234567890abcdefghijklmnopqrstu"));
        assert!(!looks_like_api_key("AIza short"));
        assert!(!looks_like_api_key(
            "AIzaSyA1234567890 abcdefghijklmnopqrstu"
        ));
    }

    #[test]
    fn only_listed_models_are_allowed() {
        assert!(MODELS.contains(&"gemini-3.5-flash-lite"));
        assert!(!MODELS.contains(&"../../v1/files"));
    }
}
