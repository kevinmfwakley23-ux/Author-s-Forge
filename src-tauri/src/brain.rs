use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::Mutex;

pub const SUPPORTED_NATIVE_PROVIDERS: [&str; 10] = [
    "omniroute",
    "9router",
    "openai",
    "groq",
    "mistral",
    "gemini",
    "anthropic",
    "openrouter",
    "ollama",
    "kings",
];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRuntimeSnapshot {
    pub provider: String,
    pub configured: bool,
    pub healthy: bool,
    pub accounted_tokens: u64,
    pub consecutive_failures: u32,
    pub cooldown_until: Option<String>,
}

#[derive(Default)]
struct ProviderRuntimeState {
    configured: bool,
    healthy: bool,
    accounted_tokens: u64,
    consecutive_failures: u32,
    cooldown_until: Option<String>,
}

pub struct NativeOfficeBrain {
    id: &'static str,
    provider_order: Vec<String>,
    spend_policy: Mutex<String>,
    providers: Mutex<BTreeMap<String, ProviderRuntimeState>>,
}

impl NativeOfficeBrain {
    fn new(id: &'static str) -> Self {
        let providers = SUPPORTED_NATIVE_PROVIDERS
            .iter()
            .map(|provider| {
                (
                    (*provider).to_string(),
                    ProviderRuntimeState {
                        healthy: true,
                        ..Default::default()
                    },
                )
            })
            .collect();

        Self {
            id,
            provider_order: SUPPORTED_NATIVE_PROVIDERS
                .iter()
                .map(|provider| (*provider).to_string())
                .collect(),
            spend_policy: Mutex::new("no-paid-tokens".to_string()),
            providers: Mutex::new(providers),
        }
    }

    fn snapshot(&self) -> NativeOfficeBrainSnapshot {
        let spend_policy = self
            .spend_policy
            .lock()
            .expect("native office spend-policy lock poisoned")
            .clone();
        let providers = self
            .providers
            .lock()
            .expect("native office provider-state lock poisoned")
            .iter()
            .map(|(provider, state)| ProviderRuntimeSnapshot {
                provider: provider.clone(),
                configured: state.configured,
                healthy: state.healthy,
                accounted_tokens: state.accounted_tokens,
                consecutive_failures: state.consecutive_failures,
                cooldown_until: state.cooldown_until.clone(),
            })
            .collect();

        NativeOfficeBrainSnapshot {
            office_id: self.id.to_string(),
            provider_order: self.provider_order.clone(),
            spend_policy,
            providers,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeOfficeBrainSnapshot {
    pub office_id: String,
    pub provider_order: Vec<String>,
    pub spend_policy: String,
    pub providers: Vec<ProviderRuntimeSnapshot>,
}

pub struct NativeBrainRegistry {
    brains: BTreeMap<&'static str, NativeOfficeBrain>,
}

impl NativeBrainRegistry {
    pub fn new() -> Self {
        let brains = ["studio", "journal", "workbooks", "specialized", "nft"]
            .into_iter()
            .map(|office_id| (office_id, NativeOfficeBrain::new(office_id)))
            .collect();
        Self { brains }
    }

    pub fn snapshot(&self, office_id: &str) -> Option<NativeOfficeBrainSnapshot> {
        self.brains.get(office_id).map(NativeOfficeBrain::snapshot)
    }

    pub fn snapshots(&self) -> Vec<NativeOfficeBrainSnapshot> {
        self.brains.values().map(NativeOfficeBrain::snapshot).collect()
    }
}

impl Default for NativeBrainRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub fn native_office_brain_status(
    office_id: String,
    brains: tauri::State<'_, NativeBrainRegistry>,
) -> Result<NativeOfficeBrainSnapshot, String> {
    brains
        .snapshot(office_id.trim())
        .ok_or_else(|| format!("Unknown Forge office {office_id:?}."))
}

#[tauri::command]
pub fn native_all_office_brains(
    brains: tauri::State<'_, NativeBrainRegistry>,
) -> Vec<NativeOfficeBrainSnapshot> {
    brains.snapshots()
}
