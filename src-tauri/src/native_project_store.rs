use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const PROJECT_STORE_FILE: &str = "forge-native-projects.json";
const PROJECT_KEY_PREFIX: &str = "project/";
const PROJECT_SCHEMA_VERSION: u32 = 1;
const MAX_PROJECT_STATE_BYTES: usize = 20 * 1024 * 1024;
const MAX_PROJECT_ID_LENGTH: usize = 96;
const MAX_PROJECT_TITLE_LENGTH: usize = 300;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeProjectInput {
    pub id: String,
    pub title: String,
    pub state: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeProjectRecord {
    pub schema_version: u32,
    pub id: String,
    pub title: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
    pub state: Value,
}

#[tauri::command]
pub fn forge_native_project_put(
    app: AppHandle,
    project: NativeProjectInput,
) -> Result<NativeProjectRecord, String> {
    let id = normalize_project_id(&project.id)?;
    let title = normalize_project_title(&project.title)?;
    validate_project_state(&project.state)?;

    let store = app
        .store(PROJECT_STORE_FILE)
        .map_err(|error| format!("Native Forge project store could not be opened: {error}"))?;
    let key = project_key(&id);
    let existing = store
        .get(&key)
        .and_then(|value| serde_json::from_value::<NativeProjectRecord>(value).ok());
    let now = now_ms()?;
    let record = NativeProjectRecord {
        schema_version: PROJECT_SCHEMA_VERSION,
        id,
        title,
        created_at_ms: existing
            .as_ref()
            .map(|record| record.created_at_ms)
            .unwrap_or(now),
        updated_at_ms: now,
        state: project.state,
    };

    let value = serde_json::to_value(&record)
        .map_err(|error| format!("Native Forge project could not be serialized: {error}"))?;
    store.set(key, value);
    store
        .save()
        .map_err(|error| format!("Native Forge project could not be persisted: {error}"))?;
    Ok(record)
}

#[tauri::command]
pub fn forge_native_project_get(
    app: AppHandle,
    project_id: String,
) -> Result<Option<NativeProjectRecord>, String> {
    let id = normalize_project_id(&project_id)?;
    let store = app
        .store(PROJECT_STORE_FILE)
        .map_err(|error| format!("Native Forge project store could not be opened: {error}"))?;
    let Some(value) = store.get(project_key(&id)) else {
        return Ok(None);
    };
    decode_record(value).map(Some)
}

#[tauri::command]
pub fn forge_native_project_list(app: AppHandle) -> Result<Vec<NativeProjectRecord>, String> {
    let store = app
        .store(PROJECT_STORE_FILE)
        .map_err(|error| format!("Native Forge project store could not be opened: {error}"))?;
    let mut projects = Vec::new();
    for (key, value) in store.entries() {
        if !key.starts_with(PROJECT_KEY_PREFIX) {
            continue;
        }
        projects.push(decode_record(value)?);
    }
    projects.sort_by(|left, right| {
        right
            .updated_at_ms
            .cmp(&left.updated_at_ms)
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(projects)
}

#[tauri::command]
pub fn forge_native_project_delete(app: AppHandle, project_id: String) -> Result<bool, String> {
    let id = normalize_project_id(&project_id)?;
    let store = app
        .store(PROJECT_STORE_FILE)
        .map_err(|error| format!("Native Forge project store could not be opened: {error}"))?;
    let deleted = store.delete(project_key(&id));
    if deleted {
        store
            .save()
            .map_err(|error| format!("Native Forge project deletion could not be persisted: {error}"))?;
    }
    Ok(deleted)
}

fn decode_record(value: Value) -> Result<NativeProjectRecord, String> {
    let record: NativeProjectRecord = serde_json::from_value(value)
        .map_err(|error| format!("Native Forge project record is corrupt: {error}"))?;
    if record.schema_version != PROJECT_SCHEMA_VERSION {
        return Err(format!(
            "Native Forge project {} uses unsupported schema version {}.",
            record.id, record.schema_version
        ));
    }
    normalize_project_id(&record.id)?;
    normalize_project_title(&record.title)?;
    validate_project_state(&record.state)?;
    Ok(record)
}

fn project_key(project_id: &str) -> String {
    format!("{PROJECT_KEY_PREFIX}{project_id}")
}

fn normalize_project_id(value: &str) -> Result<String, String> {
    let id = value.trim();
    if id.is_empty() || id.len() > MAX_PROJECT_ID_LENGTH {
        return Err(format!(
            "Native Forge project id must contain 1-{MAX_PROJECT_ID_LENGTH} characters."
        ));
    }
    if !id
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    {
        return Err("Native Forge project id may use only letters, numbers, underscores, and hyphens.".to_string());
    }
    Ok(id.to_string())
}

fn normalize_project_title(value: &str) -> Result<String, String> {
    let title = value.trim();
    if title.is_empty() || title.len() > MAX_PROJECT_TITLE_LENGTH {
        return Err(format!(
            "Native Forge project title must contain 1-{MAX_PROJECT_TITLE_LENGTH} characters."
        ));
    }
    if title.chars().any(|character| character == '\r' || character == '\n') {
        return Err("Native Forge project title cannot contain line breaks.".to_string());
    }
    Ok(title.to_string())
}

fn validate_project_state(value: &Value) -> Result<(), String> {
    if !value.is_object() {
        return Err("Native Forge project state must be a JSON object.".to_string());
    }
    let bytes = serde_json::to_vec(value)
        .map_err(|error| format!("Native Forge project state could not be serialized: {error}"))?;
    if bytes.len() > MAX_PROJECT_STATE_BYTES {
        return Err(format!(
            "Native Forge project state exceeds the {} MiB durable-state boundary.",
            MAX_PROJECT_STATE_BYTES / (1024 * 1024)
        ));
    }
    Ok(())
}

fn now_ms() -> Result<u64, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "Native Forge system clock is before the Unix epoch.".to_string())?
        .as_millis();
    u64::try_from(millis).map_err(|_| "Native Forge system clock value is out of range.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn project_ids_are_stable_and_path_safe() {
        assert_eq!(normalize_project_id(" Heartwood_01 ").unwrap(), "Heartwood_01");
        assert!(normalize_project_id("../escape").is_err());
        assert!(normalize_project_id("contains space").is_err());
        assert!(normalize_project_id("").is_err());
    }

    #[test]
    fn project_titles_are_bounded_single_line_values() {
        assert_eq!(normalize_project_title(" My Novel ").unwrap(), "My Novel");
        assert!(normalize_project_title("line one\nline two").is_err());
        assert!(normalize_project_title("").is_err());
    }

    #[test]
    fn project_state_requires_an_object() {
        assert!(validate_project_state(&json!({"manuscript": {"chapters": []}})).is_ok());
        assert!(validate_project_state(&json!(["not", "a", "project"])).is_err());
    }

    #[test]
    fn project_keys_are_namespaced() {
        assert_eq!(project_key("heartwood"), "project/heartwood");
    }
}
