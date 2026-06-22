use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};

use super::secrets::get_stored_key;

#[derive(Debug, Serialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenRouterChatRequest {
    pub body: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenRouterVisionRequest {
    pub model: Option<String>,
    pub image_base64: String,
    pub prompt: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GroqTranscribeRequest {
    pub body: Vec<u8>,
    pub content_type: String,
}

fn openrouter_headers(api_key: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {api_key}"))
            .map_err(|error| format!("Invalid API key header: {error}"))?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        "HTTP-Referer",
        HeaderValue::from_static("https://trimy.app"),
    );
    headers.insert("X-Title", HeaderValue::from_static("Trimy"));
    Ok(headers)
}

async fn send_proxy_response(response: reqwest::Response) -> Result<ProxyResponse, String> {
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read upstream response: {error}"))?;
    Ok(ProxyResponse { status, body })
}

#[tauri::command]
pub async fn proxy_openrouter_chat(request: OpenRouterChatRequest) -> Result<ProxyResponse, String> {
    let api_key = get_stored_key("openrouter")?;
    let client = reqwest::Client::new();
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .headers(openrouter_headers(&api_key)?)
        .body(request.body)
        .send()
        .await
        .map_err(|error| format!("OpenRouter request failed: {error}"))?;

    send_proxy_response(response).await
}

#[tauri::command]
pub async fn proxy_openrouter_vision(
    request: OpenRouterVisionRequest,
) -> Result<ProxyResponse, String> {
    let api_key = get_stored_key("openrouter")?;
    let model = request
        .model
        .unwrap_or_else(|| "google/gemini-3.5-flash".to_string());
    let prompt = request
        .prompt
        .unwrap_or_else(|| "Describe this frame.".to_string());

    let payload = serde_json::json!({
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                { "type": "text", "text": prompt },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:image/png;base64,{}", request.image_base64)
                    }
                }
            ]
        }]
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .headers(openrouter_headers(&api_key)?)
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Vision request failed: {error}"))?;

    let proxy = send_proxy_response(response).await?;

    if proxy.status >= 400 {
        return Ok(proxy);
    }

    let parsed: serde_json::Value = serde_json::from_str(&proxy.body)
        .map_err(|error| format!("Invalid vision response JSON: {error}"))?;
    let content = parsed["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(ProxyResponse {
        status: 200,
        body: serde_json::json!({ "content": content }).to_string(),
    })
}

#[tauri::command]
pub async fn proxy_groq_transcribe(request: GroqTranscribeRequest) -> Result<ProxyResponse, String> {
    let api_key = get_stored_key("groq")?;
    let content_type = HeaderValue::from_str(&request.content_type)
        .map_err(|error| format!("Invalid content type: {error}"))?;

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {api_key}"))
            .map_err(|error| format!("Invalid Groq API key header: {error}"))?,
    );
    headers.insert(CONTENT_TYPE, content_type);

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .headers(headers)
        .body(request.body)
        .send()
        .await
        .map_err(|error| format!("Groq request failed: {error}"))?;

    send_proxy_response(response).await
}
