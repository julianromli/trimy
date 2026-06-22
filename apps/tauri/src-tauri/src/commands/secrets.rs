use serde::{Deserialize, Serialize};

const SERVICE_NAME: &str = "trimy";

#[derive(Debug, Serialize)]
pub struct ApiStatus {
    pub open_router: bool,
    pub groq: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetApiKeyRequest {
    pub provider: String,
    pub key: String,
}

fn entry_for_provider(provider: &str) -> Result<keyring::Entry, String> {
    match provider {
        "openrouter" => keyring::Entry::new(SERVICE_NAME, "openrouter")
            .map_err(|error| format!("Keyring error: {error}")),
        "groq" => keyring::Entry::new(SERVICE_NAME, "groq")
            .map_err(|error| format!("Keyring error: {error}")),
        _ => Err(format!("Unknown provider: {provider}")),
    }
}

fn has_key(provider: &str) -> bool {
    entry_for_provider(provider)
        .ok()
        .and_then(|entry| entry.get_password().ok())
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

#[tauri::command]
pub fn get_api_status() -> ApiStatus {
    ApiStatus {
        open_router: has_key("openrouter"),
        groq: has_key("groq"),
    }
}

#[tauri::command]
pub fn set_api_key(request: SetApiKeyRequest) -> Result<(), String> {
    let trimmed = request.key.trim();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let entry = entry_for_provider(&request.provider)?;
    entry
        .set_password(trimmed)
        .map_err(|error| format!("Failed to save API key: {error}"))
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    let entry = entry_for_provider(&provider)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Failed to delete API key: {error}")),
    }
}

pub fn get_stored_key(provider: &str) -> Result<String, String> {
    let entry = entry_for_provider(provider)?;
    entry
        .get_password()
        .map_err(|error| format!("Missing {provider} API key: {error}"))
}
