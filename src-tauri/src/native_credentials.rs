use crate::native_provider::{
    forge_native_configure_provider, forge_native_remove_provider, NativeProviderConfiguration,
    NativeProviderManager,
};
use crate::office_runtime::{OfficeBrainState, OfficeRuntimeManager, OFFICE_IDS, PROVIDERS};
use serde::{Deserialize, Serialize};
use std::fs::create_dir_all;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_store::StoreExt;
use tauri_plugin_stronghold::{
    kdf::KeyDerivation,
    stronghold::Stronghold,
};

const VAULT_FILE: &str = "forge-provider-credentials.hold";
const VAULT_SALT_FILE: &str = "forge-stronghold.salt";
const METADATA_STORE_FILE: &str = "forge-native-provider-metadata.json";
const METADATA_PREFIX: &str = "provider/";
const MIN_VAULT_PASSWORD_CHARS: usize = 12;
const MAX_VAULT_PASSWORD_CHARS: usize = 1024;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeProviderMetadata {
    format_version: u32,
    office_id: String,
    provider: String,
    base_url: Option<String>,
    models: Vec<String>,
    billing_class: String,
    quota_limit: Option<u64>,
    remaining_tokens: Option<u64>,
    has_api_key: bool,
}

#[tauri::command]
pub fn forge_native_secure_configure_provider(
    app: AppHandle,
    provider_manager: State<'_, NativeProviderManager>,
    office_runtime: State<'_, OfficeRuntimeManager>,
    configuration: NativeProviderConfiguration,
    vault_password: String,
) -> Result<OfficeBrainState, String> {
    validate_vault_password(&vault_password)?;
    let metadata = metadata_from_configuration(&configuration)?;

    persist_secret(
        &app,
        &vault_password,
        &metadata.office_id,
        &metadata.provider,
        configuration.api_key.as_deref(),
    )?;
    persist_metadata(&app, &metadata)?;

    forge_native_configure_provider(provider_manager, office_runtime, configuration)
}

#[tauri::command]
pub fn forge_native_secure_restore_providers(
    app: AppHandle,
    provider_manager: State<'_, NativeProviderManager>,
    office_runtime: State<'_, OfficeRuntimeManager>,
    vault_password: String,
) -> Result<Vec<OfficeBrainState>, String> {
    validate_vault_password(&vault_password)?;
    let metadata = load_all_metadata(&app)?;
    if metadata.is_empty() {
        return Ok(office_runtime.snapshot());
    }
    let vault = open_vault(&app, &vault_password)?;
    let secure_store = vault.store();

    for item in metadata {
        let api_key = if item.has_api_key {
            let key = credential_key(&item.office_id, &item.provider);
            let secret = secure_store
                .get(key.as_bytes())
                .map_err(|error| format!("Stronghold could not read {key}: {error}"))?
                .ok_or_else(|| format!("Stronghold is missing the encrypted credential {key}."))?;
            Some(
                String::from_utf8(secret)
                    .map_err(|_| format!("Encrypted credential {key} is not valid UTF-8."))?,
            )
        } else {
            None
        };

        let configuration = NativeProviderConfiguration {
            office_id: item.office_id.clone(),
            provider: item.provider.clone(),
            base_url: item.base_url.clone(),
            api_key,
            models: item.models.clone(),
            billing_class: item.billing_class.clone(),
            quota_limit: item.quota_limit,
            remaining_tokens: item.remaining_tokens,
        };
        forge_native_configure_provider(
            provider_manager.clone(),
            office_runtime.clone(),
            configuration,
        )
        .map_err(|error| {
            format!(
                "Could not restore native provider {}/{} from encrypted configuration: {error}",
                item.office_id, item.provider
            )
        })?;
    }

    Ok(office_runtime.snapshot())
}

#[tauri::command]
pub fn forge_native_secure_remove_provider(
    app: AppHandle,
    provider_manager: State<'_, NativeProviderManager>,
    office_runtime: State<'_, OfficeRuntimeManager>,
    office_id: String,
    provider: String,
    vault_password: String,
) -> Result<OfficeBrainState, String> {
    validate_vault_password(&vault_password)?;
    let office_id = normalize_office(&office_id)?;
    let provider = normalize_provider(&provider)?;

    let vault = open_vault(&app, &vault_password)?;
    let key = credential_key(&office_id, &provider);
    vault
        .store()
        .delete(key.as_bytes())
        .map_err(|error| format!("Stronghold could not remove {key}: {error}"))?;
    vault
        .save()
        .map_err(|error| format!("Stronghold credential removal could not be persisted: {error}"))?;

    let metadata_store = app
        .store(METADATA_STORE_FILE)
        .map_err(|error| format!("Native provider metadata store could not be opened: {error}"))?;
    metadata_store.delete(metadata_key(&office_id, &provider));
    metadata_store
        .save()
        .map_err(|error| format!("Native provider metadata removal could not be persisted: {error}"))?;

    forge_native_remove_provider(provider_manager, office_runtime, office_id, provider)
}

fn metadata_from_configuration(
    configuration: &NativeProviderConfiguration,
) -> Result<NativeProviderMetadata, String> {
    let office_id = normalize_office(&configuration.office_id)?;
    let provider = normalize_provider(&configuration.provider)?;
    let models = normalize_models(&configuration.models)?;
    let billing_class = normalize_billing(&configuration.billing_class)?;
    let base_url = normalize_base_url(configuration.base_url.as_deref())?;
    let api_key = configuration
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    validate_provider_requirements(&provider, base_url.as_deref(), api_key)?;
    if let (Some(limit), Some(remaining)) = (configuration.quota_limit, configuration.remaining_tokens) {
        if remaining > limit {
            return Err("Provider remaining token quota cannot exceed its quota limit.".to_string());
        }
    }

    Ok(NativeProviderMetadata {
        format_version: 1,
        office_id,
        provider,
        base_url,
        models,
        billing_class,
        quota_limit: configuration.quota_limit,
        remaining_tokens: configuration.remaining_tokens,
        has_api_key: api_key.is_some(),
    })
}

fn persist_metadata(app: &AppHandle, metadata: &NativeProviderMetadata) -> Result<(), String> {
    let store = app
        .store(METADATA_STORE_FILE)
        .map_err(|error| format!("Native provider metadata store could not be opened: {error}"))?;
    let value = serde_json::to_value(metadata)
        .map_err(|error| format!("Native provider metadata could not be serialized: {error}"))?;
    store.set(metadata_key(&metadata.office_id, &metadata.provider), value);
    store
        .save()
        .map_err(|error| format!("Native provider metadata could not be persisted: {error}"))
}

fn load_all_metadata(app: &AppHandle) -> Result<Vec<NativeProviderMetadata>, String> {
    let store = app
        .store(METADATA_STORE_FILE)
        .map_err(|error| format!("Native provider metadata store could not be opened: {error}"))?;
    let mut records = Vec::new();
    for (key, value) in store.entries() {
        if !key.starts_with(METADATA_PREFIX) {
            continue;
        }
        let record: NativeProviderMetadata = serde_json::from_value(value)
            .map_err(|error| format!("Native provider metadata {key} is corrupt: {error}"))?;
        if record.format_version != 1 {
            return Err(format!(
                "Native provider metadata {key} uses unsupported format version {}.",
                record.format_version
            ));
        }
        records.push(record);
    }
    records.sort_by(|left, right| {
        left.office_id
            .cmp(&right.office_id)
            .then_with(|| left.provider.cmp(&right.provider))
    });
    Ok(records)
}

fn persist_secret(
    app: &AppHandle,
    vault_password: &str,
    office_id: &str,
    provider: &str,
    api_key: Option<&str>,
) -> Result<(), String> {
    let vault = open_vault(app, vault_password)?;
    let store = vault.store();
    let key = credential_key(office_id, provider);
    match api_key.map(str::trim).filter(|value| !value.is_empty()) {
        Some(secret) => {
            store
                .insert(key.as_bytes().to_vec(), secret.as_bytes().to_vec(), None)
                .map_err(|error| format!("Stronghold could not store {key}: {error}"))?;
        }
        None => {
            store
                .delete(key.as_bytes())
                .map_err(|error| format!("Stronghold could not clear {key}: {error}"))?;
        }
    }
    vault
        .save()
        .map_err(|error| format!("Stronghold credential update could not be persisted: {error}"))
}

fn open_vault(app: &AppHandle, password: &str) -> Result<Stronghold, String> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Native Forge app data directory is unavailable: {error}"))?;
    create_dir_all(&data_dir)
        .map_err(|error| format!("Native Forge app data directory could not be created: {error}"))?;
    let salt_path = data_dir.join(VAULT_SALT_FILE);
    let vault_path = data_dir.join(VAULT_FILE);
    let key = std::panic::catch_unwind(|| KeyDerivation::argon2(password, &salt_path))
        .map_err(|_| "Stronghold key derivation failed.".to_string())?;
    Stronghold::new(vault_path, key)
        .map_err(|error| format!("Stronghold vault could not be unlocked: {error}"))
}

fn validate_vault_password(value: &str) -> Result<(), String> {
    let count = value.chars().count();
    if !(MIN_VAULT_PASSWORD_CHARS..=MAX_VAULT_PASSWORD_CHARS).contains(&count) {
        return Err(format!(
            "Forge credential-vault password must contain {MIN_VAULT_PASSWORD_CHARS}-{MAX_VAULT_PASSWORD_CHARS} characters."
        ));
    }
    if value.chars().any(|character| character == '\0') {
        return Err("Forge credential-vault password cannot contain NUL characters.".to_string());
    }
    Ok(())
}

fn normalize_office(value: &str) -> Result<String, String> {
    let value = value.trim().to_lowercase();
    if OFFICE_IDS.iter().any(|candidate| *candidate == value) {
        Ok(value)
    } else {
        Err(format!("Unknown Forge office: {value}."))
    }
}

fn normalize_provider(value: &str) -> Result<String, String> {
    let value = value.trim().to_lowercase();
    if PROVIDERS.iter().any(|candidate| *candidate == value) {
        Ok(value)
    } else {
        Err(format!("Unsupported Forge AI provider: {value}."))
    }
}

fn normalize_models(values: &[String]) -> Result<Vec<String>, String> {
    let mut models = values
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    models.sort();
    models.dedup();
    if models.is_empty() {
        return Err("A native Forge provider requires at least one real model id.".to_string());
    }
    if models.len() > 256 || models.iter().any(|model| model.len() > 512) {
        return Err("Native Forge provider model collection exceeds the safe boundary.".to_string());
    }
    Ok(models)
}

fn normalize_billing(value: &str) -> Result<String, String> {
    let value = value.trim().to_lowercase();
    if matches!(
        value.as_str(),
        "local" | "subscription" | "free" | "metered" | "gateway-managed" | "unknown"
    ) {
        Ok(value)
    } else {
        Err(format!("Unsupported native Forge billing class: {value}."))
    }
}

fn normalize_base_url(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if !(value.starts_with("https://") || value.starts_with("http://")) {
        return Err("Native provider base URL must use http:// or https://.".to_string());
    }
    if value.contains('@') || value.chars().any(char::is_control) {
        return Err("Native provider base URL must not embed credentials or control characters.".to_string());
    }
    Ok(Some(value.trim_end_matches('/').to_string()))
}

fn validate_provider_requirements(
    provider: &str,
    base_url: Option<&str>,
    api_key: Option<&str>,
) -> Result<(), String> {
    let has_key = api_key.is_some_and(|value| !value.trim().is_empty());
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

fn metadata_key(office_id: &str, provider: &str) -> String {
    format!("{METADATA_PREFIX}{office_id}/{provider}")
}

fn credential_key(office_id: &str, provider: &str) -> String {
    format!("office/{office_id}/provider/{provider}/api_key")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_keys_are_office_and_provider_scoped() {
        assert_eq!(
            credential_key("journal", "openai"),
            "office/journal/provider/openai/api_key"
        );
        assert_ne!(
            credential_key("studio", "openai"),
            credential_key("journal", "openai")
        );
    }

    #[test]
    fn vault_password_has_a_real_minimum_boundary() {
        assert!(validate_vault_password("short").is_err());
        assert!(validate_vault_password("correct-horse-battery").is_ok());
    }

    #[test]
    fn remote_keyed_providers_require_a_key() {
        assert!(validate_provider_requirements("openai", None, None).is_err());
        assert!(validate_provider_requirements("openai", None, Some("real-key")).is_ok());
        assert!(validate_provider_requirements("ollama", Some("http://127.0.0.1:11434"), None).is_ok());
    }

    #[test]
    fn provider_metadata_never_contains_an_api_key_field() {
        let serialized = serde_json::to_string(&NativeProviderMetadata {
            format_version: 1,
            office_id: "studio".to_string(),
            provider: "openai".to_string(),
            base_url: None,
            models: vec!["gpt-test".to_string()],
            billing_class: "subscription".to_string(),
            quota_limit: None,
            remaining_tokens: None,
            has_api_key: true,
        })
        .unwrap();
        assert!(!serialized.contains("apiKey"));
        assert!(!serialized.contains("api_key"));
    }
}
