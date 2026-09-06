use crate::office_runtime::{OfficeBrainState, OfficeRuntimeManager, PROVIDERS};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;
use tauri_plugin_http::reqwest::{Client, RequestBuilder};

const PROVIDER_TIMEOUT_SECONDS: u64 = 90;
const BASE_FAILURE_COOLDOWN_MS: u64 = 30_000;
const MAX_FAILURE_COOLDOWN_MS: u64 = 5 * 60_000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeProviderConfiguration {
    pub office_id: String,
    pub provider: String,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub models: Vec<String>,
    pub billing_class: String,
    pub quota_limit: Option<u64>,
    pub remaining_tokens: Option<u64>,
}

#[derive(Clone, Debug)]
struct ProviderAccount {
    provider: String,
    base_url: Option<String>,
    api_key: Option<String>,
    models: Vec<String>,
    billing_class: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGenerationRequest {
    pub office_id: String,
    pub system: String,
    pub user: String,
    pub temperature: Option<f64>,
    pub max_output_tokens: Option<u64>,
    pub prefer_provider: Option<String>,
    pub prefer_model: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub source: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeProviderAttempt {
    pub provider: String,
    pub model: String,
    pub success: bool,
    pub latency_ms: u128,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeGenerationResult {
    pub office_id: String,
    pub provider: String,
    pub model: String,
    pub text: String,
    pub usage: NativeTokenUsage,
    pub attempts: Vec<NativeProviderAttempt>,
    pub brain: OfficeBrainState,
}

#[derive(Debug)]
pub struct NativeProviderManager {
    accounts: Mutex<BTreeMap<String, BTreeMap<String, ProviderAccount>>>,
}

impl NativeProviderManager {
    pub fn new() -> Self {
        Self {
            accounts: Mutex::new(BTreeMap::new()),
        }
    }

    fn configure(&self, configuration: &NativeProviderConfiguration) -> Result<(), String> {
        let office_id = normalize_office_id(&configuration.office_id)?;
        let provider = normalize_provider(&configuration.provider)?;
        let models = normalize_models(&configuration.models)?;
        let billing_class = normalize_billing_class(&configuration.billing_class)?;
        let base_url = normalize_base_url(configuration.base_url.as_deref())?;
        validate_provider_configuration(
            &provider,
            base_url.as_deref(),
            configuration.api_key.as_deref(),
        )?;

        let account = ProviderAccount {
            provider: provider.clone(),
            base_url,
            api_key: configuration
                .api_key
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string),
            models,
            billing_class,
        };
        let mut accounts = self
            .accounts
            .lock()
            .map_err(|_| "Native provider configuration lock is unavailable.".to_string())?;
        accounts
            .entry(office_id)
            .or_default()
            .insert(provider, account);
        Ok(())
    }

    fn remove(&self, office_id: &str, provider: &str) -> Result<(), String> {
        let mut accounts = self
            .accounts
            .lock()
            .map_err(|_| "Native provider configuration lock is unavailable.".to_string())?;
        if let Some(office) = accounts.get_mut(office_id) {
            office.remove(provider);
        }
        Ok(())
    }

    fn office_accounts(&self, office_id: &str) -> Result<BTreeMap<String, ProviderAccount>, String> {
        Ok(self
            .accounts
            .lock()
            .map_err(|_| "Native provider configuration lock is unavailable.".to_string())?
            .get(office_id)
            .cloned()
            .unwrap_or_default())
    }
}

#[tauri::command]
pub fn forge_native_configure_provider(
    provider_manager: State<'_, NativeProviderManager>,
    office_runtime: State<'_, OfficeRuntimeManager>,
    configuration: NativeProviderConfiguration,
) -> Result<OfficeBrainState, String> {
    let office_id = normalize_office_id(&configuration.office_id)?;
    let provider = normalize_provider(&configuration.provider)?;
    let models = normalize_models(&configuration.models)?;
    if let (Some(limit), Some(remaining)) = (configuration.quota_limit, configuration.remaining_tokens) {
        if remaining > limit {
            return Err("Provider remaining token quota cannot exceed its quota limit.".to_string());
        }
    }

    // Store the credential only in Rust process memory in this migration slice.
    // Stronghold-backed persistence is a separate acceptance gate and the
    // standalone readiness flag remains false until that is implemented.
    provider_manager.configure(&configuration)?;
    office_runtime.configure_provider_metadata(
        &office_id,
        &provider,
        true,
        configuration.quota_limit,
        configuration.remaining_tokens,
    )?;
    for model in &models {
        office_runtime.register_model(&office_id, &provider, model)?;
    }
    office_runtime.office(&office_id)
}

#[tauri::command]
pub fn forge_native_remove_provider(
    provider_manager: State<'_, NativeProviderManager>,
    office_runtime: State<'_, OfficeRuntimeManager>,
    office_id: String,
    provider: String,
) -> Result<OfficeBrainState, String> {
    let office_id = normalize_office_id(&office_id)?;
    let provider = normalize_provider(&provider)?;
    provider_manager.remove(&office_id, &provider)?;
    office_runtime.configure_provider_metadata(&office_id, &provider, false, None, None)
}

#[tauri::command]
pub async fn forge_native_generate_text(
    provider_manager: State<'_, NativeProviderManager>,
    office_runtime: State<'_, OfficeRuntimeManager>,
    request: NativeGenerationRequest,
) -> Result<NativeGenerationResult, String> {
    let office_id = normalize_office_id(&request.office_id)?;
    let office = office_runtime.office(&office_id)?;
    if !office.enabled {
        return Err(format!("Forge office {office_id} is disabled."));
    }
    if request.user.trim().is_empty() {
        return Err("Native Forge AI request cannot have an empty user prompt.".to_string());
    }
    if request.system.len() > 1_000_000 || request.user.len() > 4_000_000 {
        return Err("Native Forge AI request exceeds the current safe payload boundary.".to_string());
    }
    let temperature = request.temperature.unwrap_or(0.7);
    if !temperature.is_finite() || !(0.0..=2.0).contains(&temperature) {
        return Err("Native Forge AI temperature must be between 0 and 2.".to_string());
    }
    let max_output_tokens = request.max_output_tokens.unwrap_or(4_000);
    if max_output_tokens == 0 || max_output_tokens > 128_000 {
        return Err("Native Forge max output tokens must be between 1 and 128000.".to_string());
    }

    let accounts = provider_manager.office_accounts(&office_id)?;
    if accounts.is_empty() {
        return Err(format!(
            "No native AI provider is configured for Forge office {office_id}. Forge will not fabricate output."
        ));
    }
    let candidates = build_candidates(&office, &accounts, &request)?;
    if candidates.is_empty() {
        return Err(format!(
            "No configured native provider/model is eligible for Forge office {office_id} under spend, quota, health and cooldown policy."
        ));
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(PROVIDER_TIMEOUT_SECONDS))
        .build()
        .map_err(|error| format!("Native Forge HTTP client initialization failed: {error}"))?;
    let mut attempts = Vec::new();
    let mut failed_providers = BTreeSet::new();
    let estimated_input_tokens = estimate_tokens(&format!("{}\n\n{}", request.system, request.user));

    for candidate in candidates {
        if failed_providers.contains(&candidate.account.provider) {
            continue;
        }
        let started = std::time::Instant::now();
        match execute_provider(
            &client,
            &candidate.account,
            &candidate.model,
            &request,
            max_output_tokens,
        )
        .await
        {
            Ok(mut generated) => {
                let latency_ms = started.elapsed().as_millis();
                if generated.text.trim().is_empty() {
                    let message = format!(
                        "{} returned an empty generation; Forge refused it.",
                        candidate.account.provider
                    );
                    let cooldown = failure_cooldown(&office, &candidate.account.provider);
                    let _ = office_runtime.record_provider_observation(
                        &office_id,
                        &candidate.account.provider,
                        0,
                        false,
                        Some(cooldown),
                    );
                    attempts.push(NativeProviderAttempt {
                        provider: candidate.account.provider.clone(),
                        model: candidate.model,
                        success: false,
                        latency_ms,
                        error: Some(message),
                    });
                    failed_providers.insert(candidate.account.provider);
                    continue;
                }

                if generated.usage.total_tokens == 0 {
                    generated.usage = estimated_usage(
                        estimated_input_tokens,
                        estimate_tokens(&generated.text),
                    );
                }
                let brain = office_runtime.record_provider_observation(
                    &office_id,
                    &candidate.account.provider,
                    generated.usage.total_tokens,
                    true,
                    None,
                )?;
                attempts.push(NativeProviderAttempt {
                    provider: candidate.account.provider.clone(),
                    model: candidate.model.clone(),
                    success: true,
                    latency_ms,
                    error: None,
                });
                return Ok(NativeGenerationResult {
                    office_id,
                    provider: candidate.account.provider,
                    model: candidate.model,
                    text: generated.text,
                    usage: generated.usage,
                    attempts,
                    brain,
                });
            }
            Err(error) => {
                let latency_ms = started.elapsed().as_millis();
                let cooldown = failure_cooldown(&office, &candidate.account.provider);
                let _ = office_runtime.record_provider_observation(
                    &office_id,
                    &candidate.account.provider,
                    0,
                    false,
                    Some(cooldown),
                );
                attempts.push(NativeProviderAttempt {
                    provider: candidate.account.provider.clone(),
                    model: candidate.model,
                    success: false,
                    latency_ms,
                    error: Some(error),
                });
                failed_providers.insert(candidate.account.provider);
            }
        }
    }

    let summary = attempts
        .iter()
        .map(|attempt| {
            format!(
                "{}/{}: {}",
                attempt.provider,
                attempt.model,
                attempt.error.as_deref().unwrap_or("failed")
            )
        })
        .collect::<Vec<_>>()
        .join(" | ");
    Err(format!(
        "Native Forge AI broker exhausted every eligible provider for office {office_id}. {summary}"
    ))
}

#[derive(Clone, Debug)]
struct Candidate {
    account: ProviderAccount,
    model: String,
}

fn build_candidates(
    office: &OfficeBrainState,
    accounts: &BTreeMap<String, ProviderAccount>,
    request: &NativeGenerationRequest,
) -> Result<Vec<Candidate>, String> {
    let prefer_provider = request
        .prefer_provider
        .as_deref()
        .map(normalize_provider)
        .transpose()?;
    let prefer_model = request
        .prefer_model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let estimated_request_tokens = estimate_tokens(&format!("{}\n\n{}", request.system, request.user))
        .saturating_add(request.max_output_tokens.unwrap_or(4_000));

    let mut provider_order = office.provider_order.clone();
    if let Some(preferred) = &prefer_provider {
        provider_order.retain(|provider| provider != preferred);
        provider_order.insert(0, preferred.clone());
    }

    let now = now_ms();
    let mut candidates = Vec::new();
    for provider in provider_order {
        let Some(account) = accounts.get(&provider) else {
            continue;
        };
        let Some(provider_state) = office.providers.get(&provider) else {
            continue;
        };
        if !provider_state.configured || cooldown_active(provider_state.cooldown_until.as_deref(), now) {
            continue;
        }
        if let Some(remaining) = provider_state.remaining_tokens {
            if remaining < estimated_request_tokens {
                continue;
            }
        }
        if !spend_allowed(&office.spend_policy, &account.billing_class) {
            continue;
        }

        let mut models = account.models.clone();
        if let Some(preferred) = &prefer_model {
            if models.iter().any(|model| model == preferred) {
                models.retain(|model| model != preferred);
                models.insert(0, preferred.clone());
            } else if prefer_provider.as_deref() == Some(provider.as_str()) {
                continue;
            }
        }
        for model in models {
            candidates.push(Candidate {
                account: account.clone(),
                model,
            });
        }
    }
    Ok(candidates)
}

struct Generated {
    text: String,
    usage: NativeTokenUsage,
}

async fn execute_provider(
    client: &Client,
    account: &ProviderAccount,
    model: &str,
    request: &NativeGenerationRequest,
    max_output_tokens: u64,
) -> Result<Generated, String> {
    match account.provider.as_str() {
        "omniroute" | "9router" | "groq" | "mistral" | "openrouter" => {
            execute_openai_compatible(client, account, model, request, max_output_tokens).await
        }
        "openai" => execute_openai_responses(client, account, model, request, max_output_tokens).await,
        "anthropic" => execute_anthropic(client, account, model, request, max_output_tokens).await,
        "gemini" => execute_gemini(client, account, model, request, max_output_tokens).await,
        "ollama" => execute_ollama(client, account, model, request, max_output_tokens).await,
        "kings" => execute_kings_responses(client, account, model, request, max_output_tokens).await,
        provider => Err(format!("Native provider adapter is not implemented for {provider}.")),
    }
}

async fn execute_openai_compatible(
    client: &Client,
    account: &ProviderAccount,
    model: &str,
    request: &NativeGenerationRequest,
    max_output_tokens: u64,
) -> Result<Generated, String> {
    let base = provider_base_url(account)?;
    let endpoint = openai_chat_endpoint(&base);
    let mut builder = client
        .post(endpoint)
        .header("content-type", "application/json")
        .body(
            json!({
                "model": model,
                "messages": [
                    {"role": "system", "content": request.system},
                    {"role": "user", "content": request.user}
                ],
                "temperature": request.temperature.unwrap_or(0.7),
                "max_tokens": max_output_tokens
            })
            .to_string(),
        );
    if let Some(api_key) = &account.api_key {
        builder = builder.header("authorization", format!("Bearer {api_key}"));
    }
    if account.provider == "openrouter" {
        builder = builder
            .header("HTTP-Referer", "https://authors-forge.local")
            .header("X-OpenRouter-Title", "K.I.N.G.S. Author's Forge");
    }
    let payload = send_json(builder, &account.provider).await?;
    let text = payload
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let usage = chat_usage(&payload);
    Ok(Generated { text, usage })
}

async fn execute_openai_responses(
    client: &Client,
    account: &ProviderAccount,
    model: &str,
    request: &NativeGenerationRequest,
    max_output_tokens: u64,
) -> Result<Generated, String> {
    let endpoint = account
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.openai.com/v1/responses".to_string());
    let api_key = account
        .api_key
        .as_deref()
        .ok_or_else(|| "OpenAI API key is missing from the native office provider configuration.".to_string())?;
    let payload = send_json(
        client
            .post(endpoint)
            .header("content-type", "application/json")
            .header("authorization", format!("Bearer {api_key}"))
            .body(
                json!({
                    "model": model,
                    "input": [
                        {"role": "system", "content": request.system},
                        {"role": "user", "content": request.user}
                    ],
                    "temperature": request.temperature.unwrap_or(0.7),
                    "max_output_tokens": max_output_tokens
                })
                .to_string(),
            ),
        "openai",
    )
    .await?;
    Ok(Generated {
        text: responses_text(&payload),
        usage: responses_usage(&payload),
    })
}

async fn execute_kings_responses(
    client: &Client,
    account: &ProviderAccount,
    model: &str,
    request: &NativeGenerationRequest,
    max_output_tokens: u64,
) -> Result<Generated, String> {
    let endpoint = kings_responses_endpoint(&provider_base_url(account)?);
    let mut builder = client
        .post(endpoint)
        .header("content-type", "application/json")
        .body(
            json!({
                "model": model,
                "input": [
                    {"role": "system", "content": request.system},
                    {"role": "user", "content": request.user}
                ],
                "temperature": request.temperature.unwrap_or(0.7),
                "max_output_tokens": max_output_tokens
            })
            .to_string(),
        );
    if let Some(api_key) = &account.api_key {
        builder = builder.header("authorization", format!("Bearer {api_key}"));
    }
    let payload = send_json(builder, "kings").await?;
    Ok(Generated {
        text: responses_text(&payload),
        usage: responses_usage(&payload),
    })
}

async fn execute_anthropic(
    client: &Client,
    account: &ProviderAccount,
    model: &str,
    request: &NativeGenerationRequest,
    max_output_tokens: u64,
) -> Result<Generated, String> {
    let api_key = account
        .api_key
        .as_deref()
        .ok_or_else(|| "Anthropic API key is missing from the native office provider configuration.".to_string())?;
    let base = account
        .base_url
        .as_deref()
        .unwrap_or("https://api.anthropic.com");
    let endpoint = format!("{}/v1/messages", base.trim_end_matches('/'));
    let payload = send_json(
        client
            .post(endpoint)
            .header("content-type", "application/json")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .body(
                json!({
                    "model": model,
                    "max_tokens": max_output_tokens,
                    "system": request.system,
                    "messages": [{"role": "user", "content": request.user}],
                    "temperature": request.temperature.unwrap_or(0.7)
                })
                .to_string(),
            ),
        "anthropic",
    )
    .await?;
    let text = payload
        .get("content")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let input = u64_at(&payload, "/usage/input_tokens");
    let output = u64_at(&payload, "/usage/output_tokens");
    Ok(Generated {
        text,
        usage: provider_usage(input, output, input.saturating_add(output)),
    })
}

async fn execute_gemini(
    client: &Client,
    account: &ProviderAccount,
    model: &str,
    request: &NativeGenerationRequest,
    max_output_tokens: u64,
) -> Result<Generated, String> {
    let api_key = account
        .api_key
        .as_deref()
        .ok_or_else(|| "Gemini API key is missing from the native office provider configuration.".to_string())?;
    let base = account
        .base_url
        .as_deref()
        .unwrap_or("https://generativelanguage.googleapis.com/v1beta");
    let endpoint = format!(
        "{}/models/{}:generateContent?key={}",
        base.trim_end_matches('/'),
        percent_encode_segment(model),
        percent_encode_query(api_key)
    );
    let payload = send_json(
        client
            .post(endpoint)
            .header("content-type", "application/json")
            .body(
                json!({
                    "systemInstruction": {"parts": [{"text": request.system}]},
                    "contents": [{"role": "user", "parts": [{"text": request.user}]}],
                    "generationConfig": {
                        "temperature": request.temperature.unwrap_or(0.7),
                        "maxOutputTokens": max_output_tokens
                    }
                })
                .to_string(),
            ),
        "gemini",
    )
    .await?;
    let text = payload
        .pointer("/candidates/0/content/parts")
        .and_then(Value::as_array)
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let input = u64_at(&payload, "/usageMetadata/promptTokenCount");
    let output = u64_at(&payload, "/usageMetadata/candidatesTokenCount");
    let total = u64_at(&payload, "/usageMetadata/totalTokenCount");
    Ok(Generated {
        text,
        usage: provider_usage(input, output, total),
    })
}

async fn execute_ollama(
    client: &Client,
    account: &ProviderAccount,
    model: &str,
    request: &NativeGenerationRequest,
    max_output_tokens: u64,
) -> Result<Generated, String> {
    let base = provider_base_url(account)?;
    let endpoint = format!("{}/api/chat", base.trim_end_matches('/'));
    let payload = send_json(
        client
            .post(endpoint)
            .header("content-type", "application/json")
            .body(
                json!({
                    "model": model,
                    "stream": false,
                    "messages": [
                        {"role": "system", "content": request.system},
                        {"role": "user", "content": request.user}
                    ],
                    "options": {
                        "temperature": request.temperature.unwrap_or(0.7),
                        "num_predict": max_output_tokens
                    }
                })
                .to_string(),
            ),
        "ollama",
    )
    .await?;
    let text = payload
        .pointer("/message/content")
        .and_then(Value::as_str)
        .or_else(|| payload.get("response").and_then(Value::as_str))
        .unwrap_or_default()
        .trim()
        .to_string();
    let input = u64_at(&payload, "/prompt_eval_count");
    let output = u64_at(&payload, "/eval_count");
    Ok(Generated {
        text,
        usage: provider_usage(input, output, input.saturating_add(output)),
    })
}

async fn send_json(builder: RequestBuilder, provider: &str) -> Result<Value, String> {
    let response = builder
        .send()
        .await
        .map_err(|error| format!("{provider} native request failed: {error}"))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("{provider} native response body failed: {error}"))?;
    let payload: Value = serde_json::from_str(&body).map_err(|error| {
        format!(
            "{provider} returned non-JSON or malformed JSON (HTTP {}): {error}",
            status.as_u16()
        )
    })?;
    if !status.is_success() {
        let detail = payload
            .pointer("/error/message")
            .and_then(Value::as_str)
            .or_else(|| payload.get("error").and_then(Value::as_str))
            .unwrap_or("provider request failed");
        return Err(format!(
            "{provider} native request failed with HTTP {}: {detail}",
            status.as_u16()
        ));
    }
    Ok(payload)
}

fn chat_usage(payload: &Value) -> NativeTokenUsage {
    provider_usage(
        u64_at(payload, "/usage/prompt_tokens"),
        u64_at(payload, "/usage/completion_tokens"),
        u64_at(payload, "/usage/total_tokens"),
    )
}

fn responses_usage(payload: &Value) -> NativeTokenUsage {
    provider_usage(
        u64_at(payload, "/usage/input_tokens"),
        u64_at(payload, "/usage/output_tokens"),
        u64_at(payload, "/usage/total_tokens"),
    )
}

fn responses_text(payload: &Value) -> String {
    if let Some(text) = payload.get("output_text").and_then(Value::as_str) {
        return text.trim().to_string();
    }
    payload
        .get("output")
        .and_then(Value::as_array)
        .map(|outputs| {
            outputs
                .iter()
                .flat_map(|output| {
                    output
                        .get("content")
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten()
                })
                .filter_map(|content| {
                    content
                        .get("text")
                        .and_then(Value::as_str)
                        .or_else(|| content.get("output_text").and_then(Value::as_str))
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn provider_usage(input: u64, output: u64, total: u64) -> NativeTokenUsage {
    NativeTokenUsage {
        input_tokens: input,
        output_tokens: output,
        total_tokens: if total > 0 {
            total
        } else {
            input.saturating_add(output)
        },
        source: "provider".to_string(),
    }
}

fn estimated_usage(input_tokens: u64, output_tokens: u64) -> NativeTokenUsage {
    NativeTokenUsage {
        input_tokens,
        output_tokens,
        total_tokens: input_tokens.saturating_add(output_tokens),
        source: "estimated".to_string(),
    }
}

fn u64_at(payload: &Value, pointer: &str) -> u64 {
    payload.pointer(pointer).and_then(Value::as_u64).unwrap_or(0)
}

fn estimate_tokens(text: &str) -> u64 {
    let chars = text.chars().count() as u64;
    chars.saturating_add(3) / 4
}

fn normalize_office_id(value: &str) -> Result<String, String> {
    let office = value.trim().to_lowercase();
    if !matches!(office.as_str(), "studio" | "journal" | "workbooks" | "specialized" | "nft") {
        return Err(format!("Unknown Forge office: {value}."));
    }
    Ok(office)
}

fn normalize_provider(value: &str) -> Result<String, String> {
    let provider = value.trim().to_lowercase();
    if !PROVIDERS.iter().any(|candidate| *candidate == provider) {
        return Err(format!("Unsupported Forge AI provider: {value}."));
    }
    Ok(provider)
}

fn normalize_models(models: &[String]) -> Result<Vec<String>, String> {
    let mut normalized = models
        .iter()
        .map(|model| model.trim())
        .filter(|model| !model.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    normalized.sort();
    normalized.dedup();
    if normalized.is_empty() {
        return Err("A native Forge provider requires at least one real model id.".to_string());
    }
    if normalized.len() > 256 || normalized.iter().any(|model| model.len() > 512) {
        return Err("Native Forge provider model collection exceeds the safe boundary.".to_string());
    }
    Ok(normalized)
}

fn normalize_billing_class(value: &str) -> Result<String, String> {
    let billing = value.trim().to_lowercase();
    if !matches!(
        billing.as_str(),
        "local" | "subscription" | "free" | "metered" | "gateway-managed" | "unknown"
    ) {
        return Err(format!("Unsupported native Forge billing class: {value}."));
    }
    Ok(billing)
}

fn normalize_base_url(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if !(value.starts_with("https://") || value.starts_with("http://")) {
        return Err("Native provider base URL must use http:// or https://.".to_string());
    }
    if value.contains('@') {
        return Err("Native provider base URL must not embed credentials.".to_string());
    }
    if value.chars().any(char::is_control) {
        return Err("Native provider base URL contains control characters.".to_string());
    }
    Ok(Some(value.trim_end_matches('/').to_string()))
}

fn validate_provider_configuration(
    provider: &str,
    base_url: Option<&str>,
    api_key: Option<&str>,
) -> Result<(), String> {
    let has_key = api_key.map(str::trim).is_some_and(|value| !value.is_empty());
    match provider {
        "openai" | "groq" | "mistral" | "gemini" | "anthropic" | "openrouter" if !has_key => {
            Err(format!("{provider} requires an API key for native Forge execution."))
        }
        "omniroute" | "9router" | "ollama" | "kings" if base_url.is_none() => {
            Err(format!("{provider} requires an explicit native provider endpoint."))
        }
        _ => Ok(()),
    }
}

fn provider_base_url(account: &ProviderAccount) -> Result<String, String> {
    if let Some(base) = &account.base_url {
        return Ok(base.clone());
    }
    match account.provider.as_str() {
        "groq" => Ok("https://api.groq.com/openai".to_string()),
        "mistral" => Ok("https://api.mistral.ai".to_string()),
        "openrouter" => Ok("https://openrouter.ai/api".to_string()),
        "anthropic" => Ok("https://api.anthropic.com".to_string()),
        "gemini" => Ok("https://generativelanguage.googleapis.com/v1beta".to_string()),
        provider => Err(format!("{provider} has no native provider endpoint configured.")),
    }
}

fn openai_chat_endpoint(base: &str) -> String {
    let base = base.trim_end_matches('/');
    if base.ends_with("/v1") {
        format!("{base}/chat/completions")
    } else if base.ends_with("/v1/chat/completions") {
        base.to_string()
    } else {
        format!("{base}/v1/chat/completions")
    }
}

fn kings_responses_endpoint(base: &str) -> String {
    let base = base.trim_end_matches('/');
    if base.ends_with("/responses") {
        base.to_string()
    } else if base.ends_with("/v1") {
        format!("{base}/responses")
    } else {
        format!("{base}/v1/responses")
    }
}

fn spend_allowed(policy: &str, billing_class: &str) -> bool {
    match policy {
        "unrestricted" => true,
        "no-paid-tokens" => matches!(billing_class, "local" | "subscription" | "free"),
        // Native budgeted mode intentionally refuses metered/gateway-managed/
        // unknown resources until native per-model pricing and a dollar ceiling
        // are implemented. This prevents a false budget guarantee.
        "budgeted" => matches!(billing_class, "local" | "subscription" | "free"),
        _ => false,
    }
}

fn cooldown_active(value: Option<&str>, now: u64) -> bool {
    value
        .and_then(|value| value.strip_prefix("unix-ms:"))
        .and_then(|value| value.parse::<u64>().ok())
        .is_some_and(|until| until > now)
}

fn failure_cooldown(office: &OfficeBrainState, provider: &str) -> String {
    let failures = office
        .providers
        .get(provider)
        .map(|state| state.consecutive_failures)
        .unwrap_or(0)
        .saturating_add(1);
    let exponent = failures.saturating_sub(1).min(4);
    let delay = BASE_FAILURE_COOLDOWN_MS
        .saturating_mul(1_u64 << exponent)
        .min(MAX_FAILURE_COOLDOWN_MS);
    format!("unix-ms:{}", now_ms().saturating_add(delay))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u64::MAX as u128) as u64
}

fn percent_encode_segment(value: &str) -> String {
    percent_encode(value, false)
}

fn percent_encode_query(value: &str) -> String {
    percent_encode(value, true)
}

fn percent_encode(value: &str, query: bool) -> String {
    let mut output = String::new();
    for byte in value.bytes() {
        let allowed = byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~');
        if allowed {
            output.push(byte as char);
        } else if query && byte == b' ' {
            output.push_str("%20");
        } else {
            output.push_str(&format!("%{byte:02X}"));
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openai_compatible_endpoint_accepts_root_or_v1_base_without_duplicate_v1() {
        assert_eq!(
            openai_chat_endpoint("https://router.example"),
            "https://router.example/v1/chat/completions"
        );
        assert_eq!(
            openai_chat_endpoint("https://router.example/v1"),
            "https://router.example/v1/chat/completions"
        );
        assert_eq!(
            openai_chat_endpoint("https://router.example/v1/chat/completions"),
            "https://router.example/v1/chat/completions"
        );
    }

    #[test]
    fn spend_policy_never_treats_unknown_or_metered_capacity_as_free() {
        assert!(spend_allowed("no-paid-tokens", "free"));
        assert!(spend_allowed("no-paid-tokens", "subscription"));
        assert!(!spend_allowed("no-paid-tokens", "metered"));
        assert!(!spend_allowed("budgeted", "metered"));
        assert!(spend_allowed("unrestricted", "metered"));
    }

    #[test]
    fn provider_configuration_requires_real_models_and_provider_specific_secrets_or_endpoints() {
        assert!(normalize_models(&[]).is_err());
        assert!(validate_provider_configuration("openai", None, None).is_err());
        assert!(validate_provider_configuration("ollama", None, None).is_err());
        assert!(validate_provider_configuration("ollama", Some("http://127.0.0.1:11434"), None).is_ok());
        assert!(normalize_base_url(Some("https://user:secret@example.com")).is_err());
    }

    #[test]
    fn cooldown_parser_only_blocks_an_unexpired_native_cooldown() {
        assert!(cooldown_active(Some("unix-ms:2000"), 1000));
        assert!(!cooldown_active(Some("unix-ms:1000"), 1000));
        assert!(!cooldown_active(Some("not-a-cooldown"), 1000));
    }

    #[test]
    fn token_estimator_is_deterministic_and_never_fractional() {
        assert_eq!(estimate_tokens(""), 0);
        assert_eq!(estimate_tokens("abcd"), 1);
        assert_eq!(estimate_tokens("abcde"), 2);
    }
}
