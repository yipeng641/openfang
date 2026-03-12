//! Model catalog - registry of user-defined models and providers.
//!
//! OpenFang no longer ships a builtin provider/model directory in Settings.
//! The catalog starts empty and is populated from user configuration and
//! runtime discovery only.

use openfang_types::model_catalog::{AuthStatus, ModelCatalogEntry, ModelTier, ProviderInfo};
use std::collections::{HashMap, HashSet};

/// The model catalog - registry of configured models and providers.
pub struct ModelCatalog {
    models: Vec<ModelCatalogEntry>,
    aliases: HashMap<String, String>,
    providers: Vec<ProviderInfo>,
}

impl ModelCatalog {
    /// Create a new empty catalog.
    pub fn new() -> Self {
        Self {
            models: Vec::new(),
            aliases: HashMap::new(),
            providers: Vec::new(),
        }
    }

    /// Detect which providers have API keys configured.
    pub fn detect_auth(&mut self) {
        for provider in &mut self.providers {
            if !provider.key_required {
                provider.auth_status = AuthStatus::NotRequired;
                continue;
            }

            let has_key = std::env::var(&provider.api_key_env)
                .ok()
                .filter(|value| !value.trim().is_empty())
                .is_some();

            let has_fallback = match provider.id.as_str() {
                "gemini" => std::env::var("GOOGLE_API_KEY").is_ok(),
                "codex" => {
                    std::env::var("OPENAI_API_KEY").is_ok() || read_codex_credential().is_some()
                }
                _ => false,
            };

            provider.auth_status = if has_key || has_fallback {
                AuthStatus::Configured
            } else {
                AuthStatus::Missing
            };
        }
    }

    /// List all models in the catalog.
    pub fn list_models(&self) -> &[ModelCatalogEntry] {
        &self.models
    }

    /// Find a model by canonical ID or alias.
    pub fn find_model(&self, id_or_alias: &str) -> Option<&ModelCatalogEntry> {
        let lower = id_or_alias.to_lowercase();
        if let Some(entry) = self
            .models
            .iter()
            .find(|model| model.id.to_lowercase() == lower)
        {
            return Some(entry);
        }
        if let Some(canonical) = self.aliases.get(&lower) {
            return self.models.iter().find(|model| model.id == *canonical);
        }
        None
    }

    /// Resolve an alias to a canonical model ID.
    pub fn resolve_alias(&self, alias: &str) -> Option<&str> {
        self.aliases
            .get(&alias.to_lowercase())
            .map(|value| value.as_str())
    }

    /// List all providers.
    pub fn list_providers(&self) -> &[ProviderInfo] {
        &self.providers
    }

    /// Get a provider by ID.
    pub fn get_provider(&self, provider_id: &str) -> Option<&ProviderInfo> {
        self.providers
            .iter()
            .find(|provider| provider.id == provider_id)
    }

    /// List models for a provider.
    pub fn models_by_provider(&self, provider: &str) -> Vec<&ModelCatalogEntry> {
        self.models
            .iter()
            .filter(|model| model.provider == provider)
            .collect()
    }

    /// Return the default model ID for a provider (first model in catalog order).
    pub fn default_model_for_provider(&self, provider: &str) -> Option<String> {
        if let Some(model_id) = self.aliases.get(&provider.to_lowercase()) {
            return Some(model_id.clone());
        }
        self.models
            .iter()
            .find(|model| model.provider == provider)
            .map(|model| model.id.clone())
    }

    /// List models that are available (from configured providers only).
    pub fn available_models(&self) -> Vec<&ModelCatalogEntry> {
        let configured: HashSet<&str> = self
            .providers
            .iter()
            .filter(|provider| provider.auth_status != AuthStatus::Missing)
            .map(|provider| provider.id.as_str())
            .collect();

        self.models
            .iter()
            .filter(|model| configured.contains(model.provider.as_str()))
            .collect()
    }

    /// Get pricing for a model: (input_cost_per_million, output_cost_per_million).
    pub fn pricing(&self, model_id: &str) -> Option<(f64, f64)> {
        self.find_model(model_id)
            .map(|model| (model.input_cost_per_m, model.output_cost_per_m))
    }

    /// List all alias mappings.
    pub fn list_aliases(&self) -> &HashMap<String, String> {
        &self.aliases
    }

    /// Set or create a provider URL.
    pub fn set_provider_url(&mut self, provider: &str, url: &str) -> bool {
        let key_required = !is_local_url(url);
        let auth_status = if key_required {
            AuthStatus::Missing
        } else {
            AuthStatus::NotRequired
        };

        if let Some(existing) = self.providers.iter_mut().find(|item| item.id == provider) {
            existing.base_url = url.to_string();
            existing.key_required = key_required;
            existing.auth_status = auth_status;
            self.detect_auth();
            return true;
        }

        self.providers.push(ProviderInfo {
            id: provider.to_string(),
            display_name: provider.to_string(),
            api_key_env: provider_api_env(provider),
            base_url: url.to_string(),
            protocol_type: "openai".to_string(),
            key_required,
            auth_status,
            model_count: self
                .models
                .iter()
                .filter(|model| model.provider == provider)
                .count(),
        });
        self.detect_auth();
        true
    }

    /// Set or create a provider protocol type.
    pub fn set_provider_protocol(&mut self, provider: &str, protocol_type: &str) -> bool {
        let protocol_type = normalize_protocol_type(protocol_type);

        if let Some(existing) = self.providers.iter_mut().find(|item| item.id == provider) {
            existing.protocol_type = protocol_type;
            return true;
        }

        self.providers.push(ProviderInfo {
            id: provider.to_string(),
            display_name: provider.to_string(),
            api_key_env: provider_api_env(provider),
            base_url: String::new(),
            protocol_type,
            key_required: true,
            auth_status: AuthStatus::Missing,
            model_count: self
                .models
                .iter()
                .filter(|model| model.provider == provider)
                .count(),
        });
        true
    }

    /// Apply a batch of provider URL overrides from config.
    pub fn apply_url_overrides(&mut self, overrides: &HashMap<String, String>) {
        for (provider, url) in overrides {
            self.set_provider_url(provider, url);
        }
    }

    /// Apply a batch of provider protocol overrides from config.
    pub fn apply_protocol_overrides(&mut self, overrides: &HashMap<String, String>) {
        for (provider, protocol_type) in overrides {
            self.set_provider_protocol(provider, protocol_type);
        }
    }

    /// List models filtered by tier.
    pub fn models_by_tier(&self, tier: ModelTier) -> Vec<&ModelCatalogEntry> {
        self.models
            .iter()
            .filter(|model| model.tier == tier)
            .collect()
    }

    /// Merge dynamically discovered models from a provider.
    pub fn merge_discovered_models(&mut self, provider: &str, model_ids: &[String]) {
        let existing_ids: HashSet<String> = self
            .models
            .iter()
            .filter(|model| model.provider == provider)
            .map(|model| model.id.to_lowercase())
            .collect();

        let mut added = 0usize;
        for id in model_ids {
            if existing_ids.contains(&id.to_lowercase()) {
                continue;
            }
            self.models.push(ModelCatalogEntry {
                id: id.clone(),
                display_name: id.clone(),
                provider: provider.to_string(),
                tier: ModelTier::Local,
                context_window: 32_768,
                max_output_tokens: 4_096,
                input_cost_per_m: 0.0,
                output_cost_per_m: 0.0,
                supports_tools: true,
                supports_vision: false,
                supports_streaming: true,
                aliases: Vec::new(),
            });
            added += 1;
        }

        if added > 0 {
            self.refresh_provider_model_counts();
        }
    }

    /// Add a custom model at runtime.
    pub fn add_custom_model(&mut self, entry: ModelCatalogEntry) -> bool {
        let lower_id = entry.id.to_lowercase();
        let lower_provider = entry.provider.to_lowercase();
        if self.models.iter().any(|model| {
            model.id.to_lowercase() == lower_id && model.provider.to_lowercase() == lower_provider
        }) {
            return false;
        }

        if self
            .providers
            .iter()
            .all(|provider| provider.id != entry.provider)
        {
            self.providers.push(ProviderInfo {
                id: entry.provider.clone(),
                display_name: entry.provider.clone(),
                api_key_env: provider_api_env(&entry.provider),
                base_url: String::new(),
                protocol_type: "openai".to_string(),
                key_required: true,
                auth_status: AuthStatus::Missing,
                model_count: 0,
            });
        }

        for alias in &entry.aliases {
            self.aliases.insert(alias.to_lowercase(), entry.id.clone());
        }

        self.models.push(entry);
        self.refresh_provider_model_counts();
        true
    }

    /// Remove a custom model by ID.
    pub fn remove_custom_model(&mut self, model_id: &str) -> bool {
        let lower = model_id.to_lowercase();
        let before = self.models.len();
        self.models
            .retain(|model| !(model.id.to_lowercase() == lower && model.tier == ModelTier::Custom));
        self.aliases
            .retain(|_, canonical| canonical.to_lowercase() != lower);
        self.refresh_provider_model_counts();
        self.models.len() < before
    }

    /// Load custom models from a JSON file.
    pub fn load_custom_models(&mut self, path: &std::path::Path) {
        if !path.exists() {
            return;
        }
        let Ok(data) = std::fs::read_to_string(path) else {
            return;
        };
        let Ok(entries) = serde_json::from_str::<Vec<ModelCatalogEntry>>(&data) else {
            return;
        };
        for entry in entries {
            let _ = self.add_custom_model(entry);
        }
    }

    /// Save all custom-tier models to a JSON file.
    pub fn save_custom_models(&self, path: &std::path::Path) -> Result<(), String> {
        let custom: Vec<&ModelCatalogEntry> = self
            .models
            .iter()
            .filter(|model| model.tier == ModelTier::Custom)
            .collect();
        let json = serde_json::to_string_pretty(&custom)
            .map_err(|error| format!("Failed to serialize custom models: {error}"))?;
        std::fs::write(path, json)
            .map_err(|error| format!("Failed to write custom models file: {error}"))?;
        Ok(())
    }

    fn refresh_provider_model_counts(&mut self) {
        for provider in &mut self.providers {
            provider.model_count = self
                .models
                .iter()
                .filter(|model| model.provider == provider.id)
                .count();
        }
    }
}

impl Default for ModelCatalog {
    fn default() -> Self {
        Self::new()
    }
}

fn provider_api_env(provider: &str) -> String {
    format!("{}_API_KEY", provider.to_uppercase().replace('-', "_"))
}

fn normalize_protocol_type(protocol_type: &str) -> String {
    match protocol_type.trim().to_lowercase().as_str() {
        "anthropic" => "anthropic".to_string(),
        "gemini" => "gemini".to_string(),
        _ => "openai".to_string(),
    }
}

fn is_local_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.contains("localhost")
        || lower.contains("127.0.0.1")
        || lower.contains("0.0.0.0")
        || lower.contains("192.168.")
        || lower.contains("10.")
        || lower.contains("172.16.")
        || lower.contains("172.17.")
        || lower.contains("172.18.")
        || lower.contains("172.19.")
        || lower.contains("172.20.")
        || lower.contains("172.21.")
        || lower.contains("172.22.")
        || lower.contains("172.23.")
        || lower.contains("172.24.")
        || lower.contains("172.25.")
        || lower.contains("172.26.")
        || lower.contains("172.27.")
        || lower.contains("172.28.")
        || lower.contains("172.29.")
        || lower.contains("172.30.")
        || lower.contains("172.31.")
}

/// Read an OpenAI API key from the Codex CLI credential file.
pub fn read_codex_credential() -> Option<String> {
    let codex_home = std::env::var("CODEX_HOME")
        .map(std::path::PathBuf::from)
        .ok()
        .or_else(|| {
            #[cfg(target_os = "windows")]
            {
                std::env::var("USERPROFILE")
                    .ok()
                    .map(|home| std::path::PathBuf::from(home).join(".codex"))
            }
            #[cfg(not(target_os = "windows"))]
            {
                std::env::var("HOME")
                    .ok()
                    .map(|home| std::path::PathBuf::from(home).join(".codex"))
            }
        })?;

    let auth_path = codex_home.join("auth.json");
    let content = std::fs::read_to_string(&auth_path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&content).ok()?;

    if let Some(expires_at) = parsed.get("expires_at").and_then(|value| value.as_i64()) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        if now >= expires_at {
            return None;
        }
    }

    parsed
        .get("api_key")
        .or_else(|| parsed.get("token"))
        .and_then(|value| value.as_str())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_starts_empty() {
        let catalog = ModelCatalog::new();
        assert!(catalog.list_models().is_empty());
        assert!(catalog.list_providers().is_empty());
    }

    #[test]
    fn adding_custom_provider_sets_protocol() {
        let mut catalog = ModelCatalog::new();
        catalog.set_provider_url("my-provider", "http://localhost:11434/v1");
        catalog.set_provider_protocol("my-provider", "anthropic");
        let provider = catalog.get_provider("my-provider").unwrap();
        assert_eq!(provider.protocol_type, "anthropic");
        assert!(!provider.key_required);
    }

    #[test]
    fn adding_custom_model_creates_provider() {
        let mut catalog = ModelCatalog::new();
        let added = catalog.add_custom_model(ModelCatalogEntry {
            id: "my-model".into(),
            display_name: "My Model".into(),
            provider: "my-provider".into(),
            tier: ModelTier::Custom,
            context_window: 128_000,
            max_output_tokens: 8192,
            input_cost_per_m: 0.0,
            output_cost_per_m: 0.0,
            supports_tools: true,
            supports_vision: false,
            supports_streaming: true,
            aliases: Vec::new(),
        });
        assert!(added);
        assert!(catalog.get_provider("my-provider").is_some());
        assert_eq!(
            catalog.default_model_for_provider("my-provider").as_deref(),
            Some("my-model")
        );
    }
}
