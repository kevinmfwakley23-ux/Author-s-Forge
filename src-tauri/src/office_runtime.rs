use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::Mutex;
use tauri::State;

pub(crate) const OFFICE_IDS: [&str; 5] = ["studio", "journal", "workbooks", "specialized", "nft"];
pub(crate) const PROVIDERS: [&str; 10] = [
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

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRuntimeState {
    pub provider: String,
    pub configured: bool,
    pub healthy: bool,
    pub consecutive_failures: u32,
    pub cooldown_until: Option<String>,
    pub used_tokens: u64,
    pub quota_limit: Option<u64>,
    pub remaining_tokens: Option<u64>,
}

impl ProviderRuntimeState {
    fn new(provider: &str) -> Self {
        Self {
            provider: provider.to_string(),
            configured: false,
            healthy: true,
            consecutive_failures: 0,
            cooldown_until: None,
            used_tokens: 0,
            quota_limit: None,
            remaining_tokens: None,
        }
    }
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OfficeBrainState {
    pub office_id: String,
    pub enabled: bool,
    pub runtime_instance_id: String,
    pub broker_instance_id: String,
    pub credential_namespace: String,
    pub model_collection: Vec<String>,
    pub provider_order: Vec<String>,
    pub spend_policy: String,
    pub routing_health_generation: u64,
    pub total_accounted_tokens: u64,
    pub providers: BTreeMap<String, ProviderRuntimeState>,
}

impl OfficeBrainState {
    fn new(office_id: &str, process_nonce: &str) -> Self {
        let providers = PROVIDERS
            .into_iter()
            .map(|provider| (provider.to_string(), ProviderRuntimeState::new(provider)))
            .collect();
        Self {
            office_id: office_id.to_string(),
            // Author's Forge ships as one complete product. Every current
            // office is attached and live by default; per-office isolation is
            // an AI/runtime boundary, not an add-on enablement boundary.
            enabled: true,
            runtime_instance_id: format!("{office_id}-{process_nonce}"),
            broker_instance_id: format!("broker-{office_id}-{process_nonce}"),
            credential_namespace: format!("office/{office_id}/provider"),
            model_collection: Vec::new(),
            provider_order: PROVIDERS.into_iter().map(str::to_string).collect(),
            spend_policy: "no-paid-tokens".to_string(),
            routing_health_generation: 0,
            total_accounted_tokens: 0,
            providers,
        }
    }
}

#[derive(Debug)]
pub struct OfficeRuntimeManager {
    offices: Mutex<BTreeMap<String, OfficeBrainState>>,
}

impl OfficeRuntimeManager {
    pub fn new() -> Self {
        let process_nonce = format!("{}", std::process::id());
        let offices = OFFICE_IDS
            .into_iter()
            .map(|office_id| {
                (
                    office_id.to_string(),
                    OfficeBrainState::new(office_id, &process_nonce),
                )
            })
            .collect();
        Self {
            offices: Mutex::new(offices),
        }
    }

    pub(crate) fn snapshot(&self) -> Vec<OfficeBrainState> {
        self.offices
            .lock()
            .expect("office runtime lock poisoned")
            .values()
            .cloned()
            .collect()
    }

    pub(crate) fn office(&self, office_id: &str) -> Result<OfficeBrainState, String> {
        self.offices
            .lock()
            .map_err(|_| "Office runtime lock is unavailable.".to_string())?
            .get(office_id)
            .cloned()
            .ok_or_else(|| format!("Unknown Forge office: {office_id}."))
    }

    fn set_enabled(&self, office_id: &str, enabled: bool) -> Result<OfficeBrainState, String> {
        let mut offices = self
            .offices
            .lock()
            .map_err(|_| "Office runtime lock is unavailable.".to_string())?;
        let office = offices
            .get_mut(office_id)
            .ok_or_else(|| format!("Unknown Forge office: {office_id}."))?;
        if !enabled {
            return Err(
                "All current Forge offices are attached to the complete product and cannot be disabled."
                    .to_string(),
            );
        }
        // Keep the command idempotent for diagnostics/native callers without
        // permitting the shipped product to drift back to optional offices.
        office.enabled = true;
        Ok(office.clone())
    }

    pub(crate) fn set_spend_policy(
        &self,
        office_id: &str,
        spend_policy: &str,
    ) -> Result<OfficeBrainState, String> {
        let normalized = spend_policy.trim().to_lowercase();
        if !matches!(normalized.as_str(), "no-paid-tokens" | "budgeted" | "unrestricted") {
            return Err(format!("Unsupported Forge spend policy: {spend_policy}."));
        }
        let mut offices = self
            .offices
            .lock()
            .map_err(|_| "Office runtime lock is unavailable.".to_string())?;
        let office = offices
            .get_mut(office_id)
            .ok_or_else(|| format!("Unknown Forge office: {office_id}."))?;
        office.spend_policy = normalized;
        office.routing_health_generation += 1;
        Ok(office.clone())
    }

    pub(crate) fn register_model(
        &self,
        office_id: &str,
        provider: &str,
        model: &str,
    ) -> Result<OfficeBrainState, String> {
        let provider = provider.trim().to_lowercase();
        let model = model.trim();
        if model.is_empty() {
            return Err("Forge provider model cannot be empty.".to_string());
        }
        let mut offices = self
            .offices
            .lock()
            .map_err(|_| "Office runtime lock is unavailable.".to_string())?;
        let office = offices
            .get_mut(office_id)
            .ok_or_else(|| format!("Unknown Forge office: {office_id}."))?;
        if !office.providers.contains_key(&provider) {
            return Err(format!("Unsupported Forge AI provider: {provider}."));
        }
        let model_key = format!("{provider}/{model}");
        if !office.model_collection.iter().any(|candidate| candidate == &model_key) {
            office.model_collection.push(model_key);
            office.model_collection.sort();
            office.routing_health_generation += 1;
        }
        Ok(office.clone())
    }

    pub(crate) fn configure_provider_metadata(
        &self,
        office_id: &str,
        provider: &str,
        configured: bool,
        quota_limit: Option<u64>,
        remaining_tokens: Option<u64>,
    ) -> Result<OfficeBrainState, String> {
        let mut offices = self
            .offices
            .lock()
            .map_err(|_| "Office runtime lock is unavailable.".to_string())?;
        let office = offices
            .get_mut(office_id)
            .ok_or_else(|| format!("Unknown Forge office: {office_id}."))?;
        let provider_state = office
            .providers
            .get_mut(provider)
            .ok_or_else(|| format!("Unsupported Forge AI provider: {provider}."))?;
        if let (Some(limit), Some(remaining)) = (quota_limit, remaining_tokens) {
            if remaining > limit {
                return Err("Provider remaining token quota cannot exceed its quota limit.".to_string());
            }
        }
        provider_state.configured = configured;
        provider_state.quota_limit = quota_limit;
        provider_state.remaining_tokens = remaining_tokens;
        if configured {
            provider_state.healthy = true;
            provider_state.consecutive_failures = 0;
            provider_state.cooldown_until = None;
        }
        office.routing_health_generation += 1;
        Ok(office.clone())
    }

    pub(crate) fn record_provider_observation(
        &self,
        office_id: &str,
        provider: &str,
        accounted_tokens: u64,
        healthy: bool,
        cooldown_until: Option<String>,
    ) -> Result<OfficeBrainState, String> {
        let mut offices = self
            .offices
            .lock()
            .map_err(|_| "Office runtime lock is unavailable.".to_string())?;
        let office = offices
            .get_mut(office_id)
            .ok_or_else(|| format!("Unknown Forge office: {office_id}."))?;
        let provider_state = office
            .providers
            .get_mut(provider)
            .ok_or_else(|| format!("Unsupported Forge AI provider: {provider}."))?;

        provider_state.healthy = healthy;
        provider_state.consecutive_failures = if healthy {
            0
        } else {
            provider_state.consecutive_failures.saturating_add(1)
        };
        provider_state.cooldown_until = cooldown_until;
        provider_state.used_tokens = provider_state.used_tokens.saturating_add(accounted_tokens);
        if let Some(remaining) = provider_state.remaining_tokens {
            provider_state.remaining_tokens = Some(remaining.saturating_sub(accounted_tokens));
        }
        office.total_accounted_tokens = office
            .total_accounted_tokens
            .saturating_add(accounted_tokens);
        office.routing_health_generation += 1;
        Ok(office.clone())
    }
}

#[tauri::command]
pub fn forge_native_runtime_snapshot(state: State<'_, OfficeRuntimeManager>) -> Vec<OfficeBrainState> {
    state.snapshot()
}

#[tauri::command]
pub fn forge_native_set_office_enabled(
    state: State<'_, OfficeRuntimeManager>,
    office_id: String,
    enabled: bool,
) -> Result<OfficeBrainState, String> {
    state.set_enabled(office_id.trim().to_lowercase().as_str(), enabled)
}

#[tauri::command]
pub fn forge_native_set_spend_policy(
    state: State<'_, OfficeRuntimeManager>,
    office_id: String,
    spend_policy: String,
) -> Result<OfficeBrainState, String> {
    state.set_spend_policy(
        office_id.trim().to_lowercase().as_str(),
        spend_policy.trim(),
    )
}

#[tauri::command]
pub fn forge_native_configure_provider_metadata(
    state: State<'_, OfficeRuntimeManager>,
    office_id: String,
    provider: String,
    configured: bool,
    quota_limit: Option<u64>,
    remaining_tokens: Option<u64>,
) -> Result<OfficeBrainState, String> {
    state.configure_provider_metadata(
        office_id.trim().to_lowercase().as_str(),
        provider.trim().to_lowercase().as_str(),
        configured,
        quota_limit,
        remaining_tokens,
    )
}

#[tauri::command]
pub fn forge_native_record_provider_observation(
    state: State<'_, OfficeRuntimeManager>,
    office_id: String,
    provider: String,
    accounted_tokens: u64,
    healthy: bool,
    cooldown_until: Option<String>,
) -> Result<OfficeBrainState, String> {
    state.record_provider_observation(
        office_id.trim().to_lowercase().as_str(),
        provider.trim().to_lowercase().as_str(),
        accounted_tokens,
        healthy,
        cooldown_until,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_office_owns_a_distinct_live_brain_and_credential_namespace() {
        let manager = OfficeRuntimeManager::new();
        let snapshot = manager.snapshot();
        assert_eq!(snapshot.len(), 5);
        let broker_ids = snapshot
            .iter()
            .map(|office| office.broker_instance_id.clone())
            .collect::<std::collections::BTreeSet<_>>();
        let credential_namespaces = snapshot
            .iter()
            .map(|office| office.credential_namespace.clone())
            .collect::<std::collections::BTreeSet<_>>();
        assert_eq!(broker_ids.len(), 5);
        assert_eq!(credential_namespaces.len(), 5);
        for office in snapshot {
            assert!(office.enabled, "{} must ship attached and enabled", office.office_id);
            assert_eq!(office.providers.len(), PROVIDERS.len());
        }
    }

    #[test]
    fn provider_usage_and_health_do_not_leak_between_offices() {
        let manager = OfficeRuntimeManager::new();
        manager
            .configure_provider_metadata("studio", "openai", true, Some(10_000), Some(9_000))
            .unwrap();
        manager
            .configure_provider_metadata("journal", "openai", true, Some(50_000), Some(50_000))
            .unwrap();
        manager
            .record_provider_observation("studio", "openai", 1_500, false, Some("2026-09-06T12:00:00Z".to_string()))
            .unwrap();

        let snapshot = manager.snapshot();
        let studio = snapshot.iter().find(|office| office.office_id == "studio").unwrap();
        let journal = snapshot.iter().find(|office| office.office_id == "journal").unwrap();
        let studio_openai = studio.providers.get("openai").unwrap();
        let journal_openai = journal.providers.get("openai").unwrap();

        assert_eq!(studio.total_accounted_tokens, 1_500);
        assert_eq!(journal.total_accounted_tokens, 0);
        assert_eq!(studio_openai.used_tokens, 1_500);
        assert_eq!(studio_openai.remaining_tokens, Some(7_500));
        assert_eq!(studio_openai.consecutive_failures, 1);
        assert_eq!(journal_openai.used_tokens, 0);
        assert_eq!(journal_openai.remaining_tokens, Some(50_000));
        assert_eq!(journal_openai.consecutive_failures, 0);
    }

    #[test]
    fn model_collection_and_spend_policy_are_office_local() {
        let manager = OfficeRuntimeManager::new();
        manager.register_model("studio", "openai", "gpt-test").unwrap();
        manager.register_model("journal", "openai", "gpt-journal").unwrap();
        manager.set_spend_policy("journal", "unrestricted").unwrap();

        let studio = manager.office("studio").unwrap();
        let journal = manager.office("journal").unwrap();
        assert_eq!(studio.model_collection, vec!["openai/gpt-test"]);
        assert_eq!(journal.model_collection, vec!["openai/gpt-journal"]);
        assert_eq!(studio.spend_policy, "no-paid-tokens");
        assert_eq!(journal.spend_policy, "unrestricted");
    }

    #[test]
    fn complete_forge_attaches_every_office_and_rejects_runtime_disable() {
        let manager = OfficeRuntimeManager::new();
        assert!(manager.snapshot().iter().all(|office| office.enabled));
        assert!(manager.set_enabled("studio", false).is_err());
        assert!(manager.set_enabled("journal", false).is_err());
        assert!(manager.set_enabled("journal", true).unwrap().enabled);
        assert!(manager.office("workbooks").unwrap().enabled);
        assert!(manager.office("specialized").unwrap().enabled);
        assert!(manager.office("nft").unwrap().enabled);
    }
}
