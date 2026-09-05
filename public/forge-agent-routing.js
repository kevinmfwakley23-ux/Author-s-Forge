/* Agent Workbench AI routing controls over the existing Forge owner AI-control boundary. */
(() => {
  "use strict";

  const PROVIDERS = ["omniroute", "9router", "kings", "ollama", "groq", "mistral", "gemini", "anthropic", "openrouter", "openai"];
  const $ = (selector, root = document) => root.querySelector(selector);

  function projectId() {
    const field = $("#agent-project");
    const value = field?.value?.trim() || new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Project ID may contain only letters, numbers, hyphens, and underscores.");
    return value;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Forge request failed (${response.status}).`);
    return payload;
  }

  function addOption(select, value, label = value) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }

  function node(tag, text, className = "") {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function buildPanel() {
    if ($("#agent-ai-routing")) return $("#agent-ai-routing");
    const aside = document.querySelector(".agent-grid > aside.agent-card");
    if (!aside) return null;

    const section = node("section");
    section.id = "agent-ai-routing";
    section.style.marginTop = "24px";

    const heading = node("h3", "AI resources & routing");
    const intro = node("p", "See the real providers/models Forge can use and explicitly control the owner routing policy. Nothing changes until you press an apply button.", "muted");

    const summary = node("div", "Loading AI routing truth…", "agent-snapshot");
    summary.id = "agent-routing-summary";

    const form = node("div", undefined, "agent-form");
    form.style.marginTop = "14px";

    const policyRow = node("div", undefined, "agent-row");
    const spendLabel = node("label", "Spend policy");
    const spend = document.createElement("select"); spend.id = "agent-spend-policy";
    addOption(spend, "no-paid-tokens", "No paid tokens");
    addOption(spend, "budgeted", "Budgeted");
    addOption(spend, "unrestricted", "Unrestricted");
    spendLabel.append(spend);
    const modeLabel = node("label", "Routing mode");
    const routing = document.createElement("select"); routing.id = "agent-routing-mode";
    addOption(routing, "economy", "Economy");
    addOption(routing, "balanced", "Balanced");
    addOption(routing, "quality", "Quality");
    modeLabel.append(routing);
    policyRow.append(spendLabel, modeLabel);

    const capLabel = node("label", "Maximum estimated request cost (USD, budgeted mode only)");
    const cap = document.createElement("input"); cap.id = "agent-routing-cap"; cap.type = "number"; cap.min = "0"; cap.step = "0.001"; cap.inputMode = "decimal";
    capLabel.append(cap);

    const policyActions = node("div", undefined, "agent-actions");
    const applyPolicy = node("button", "Apply routing policy", "agent-secondary");
    applyPolicy.id = "agent-apply-routing-policy"; applyPolicy.type = "button";
    policyActions.append(applyPolicy);

    const providerRow = node("div", undefined, "agent-row");
    const providerLabel = node("label", "Provider");
    const provider = document.createElement("select"); provider.id = "agent-provider";
    for (const item of PROVIDERS) addOption(provider, item, item === "9router" ? "9Router" : item === "kings" ? "K.I.N.G.S." : item);
    providerLabel.append(provider);
    const modelLabel = node("label", "Model");
    const model = document.createElement("select"); model.id = "agent-model";
    addOption(model, "", "Load provider catalog first");
    modelLabel.append(model);
    providerRow.append(providerLabel, modelLabel);

    const modelActions = node("div", undefined, "agent-actions");
    const loadCatalog = node("button", "Load live model catalog", "agent-secondary"); loadCatalog.id = "agent-load-catalog"; loadCatalog.type = "button";
    const pin = node("button", "Pin selected model", "agent-primary"); pin.id = "agent-pin-model"; pin.type = "button"; pin.disabled = true;
    const clear = node("button", "Clear model pin", "agent-secondary"); clear.id = "agent-clear-model-pin"; clear.type = "button";
    modelActions.append(loadCatalog, pin, clear);

    const status = node("div", "", "agent-status"); status.id = "agent-routing-status"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const resources = node("div"); resources.id = "agent-routing-resources";

    form.append(policyRow, capLabel, policyActions, providerRow, modelActions, status, resources);
    section.append(heading, intro, summary, form);
    aside.append(section);

    return section;
  }

  let snapshot = null;

  function setStatus(message) {
    const target = $("#agent-routing-status");
    if (target) target.textContent = message;
  }

  function renderTruth(value) {
    snapshot = value;
    const host = $("#agent-routing-summary");
    if (!host) return;
    host.replaceChildren();
    const control = value.control || {};
    const resources = Array.isArray(value.resources) ? value.resources : [];
    const providers = new Set(resources.map((resource) => resource.provider).filter(Boolean));
    const rows = [
      ["Configured AI resources", String(resources.length)],
      ["Configured providers", String(providers.size)],
      ["Spend policy", String(control.spendPolicy || "unknown")],
      ["Routing mode", String(control.routingMode || "unknown")],
      ["Pinned route", control.pinnedProvider && control.pinnedModel ? `${control.pinnedProvider} / ${control.pinnedModel}` : "Automatic"],
    ];
    for (const [label, valueText] of rows) {
      const row = node("div", undefined, "agent-stat");
      row.append(node("strong", label), node("span", valueText));
      host.append(row);
    }
    const spend = $("#agent-spend-policy"), routing = $("#agent-routing-mode"), cap = $("#agent-routing-cap"), provider = $("#agent-provider");
    if (spend && control.spendPolicy) spend.value = control.spendPolicy;
    if (routing && control.routingMode) routing.value = control.routingMode;
    if (cap) cap.value = control.maxEstimatedRequestCostUsd === undefined ? "" : String(control.maxEstimatedRequestCostUsd);
    if (provider && control.pinnedProvider && PROVIDERS.includes(control.pinnedProvider)) provider.value = control.pinnedProvider;
    renderResources(resources, value.policyExplanation || "");
  }

  function renderResources(resources, explanation) {
    const host = $("#agent-routing-resources");
    if (!host) return;
    host.replaceChildren();
    const title = node("h4", "Configured resource inventory"); title.style.marginBottom = "8px";
    host.append(title);
    if (explanation) host.append(node("p", explanation, "muted"));
    if (!resources.length) {
      host.append(node("p", "No AI generation resource is currently configured. Provider-backed steps will fail honestly until an owner configures one.", "agent-note"));
      return;
    }
    const list = node("ul", undefined, "agent-truth");
    for (const resource of resources) {
      const provider = String(resource.provider || "unknown");
      const model = String(resource.model || "unknown model");
      const billing = String(resource.billingClass || "billing unknown");
      const capabilities = Array.isArray(resource.capabilities) ? resource.capabilities.join(", ") : "";
      const item = node("li");
      const strong = node("strong", `${provider} · ${model}`);
      item.append(strong, document.createTextNode(` — ${billing}${capabilities ? ` · ${capabilities}` : ""}`));
      list.append(item);
    }
    host.append(list);
  }

  async function refresh() {
    const id = projectId();
    setStatus("Reading real Forge AI routing state…");
    const value = await api(`/api/projects/${encodeURIComponent(id)}/ai/control`);
    renderTruth(value);
    setStatus("AI routing truth loaded.");
    return value;
  }

  async function loadCatalog() {
    const provider = $("#agent-provider")?.value;
    if (!PROVIDERS.includes(provider)) throw new Error("Choose a valid provider.");
    setStatus(`Loading ${provider} model catalog from its real configured endpoint…`);
    const value = await api(`/api/projects/${encodeURIComponent(projectId())}/ai/catalog?provider=${encodeURIComponent(provider)}`);
    const models = Array.isArray(value.models) ? value.models : [];
    const select = $("#agent-model");
    select.replaceChildren();
    if (!models.length) addOption(select, "", "No models returned");
    for (const item of models.slice(0, 1000)) {
      const id = typeof item?.id === "string" ? item.id.trim() : "";
      if (!id) continue;
      const detail = item.displayName || item.name;
      addOption(select, id, detail && detail !== id ? `${id} — ${detail}` : id);
    }
    const pinned = snapshot?.control?.pinnedProvider === provider ? snapshot.control.pinnedModel : "";
    if (pinned && [...select.options].some((option) => option.value === pinned)) select.value = pinned;
    $("#agent-pin-model").disabled = !select.value;
    setStatus(`${select.options.length} model option${select.options.length === 1 ? "" : "s"} loaded from ${value.source || provider}.`);
  }

  async function applyPolicy() {
    const spendPolicy = $("#agent-spend-policy")?.value;
    const routingMode = $("#agent-routing-mode")?.value;
    const rawCap = $("#agent-routing-cap")?.value?.trim();
    if (!spendPolicy || !routingMode) throw new Error("Spend policy and routing mode are required.");
    if (spendPolicy === "budgeted" && !rawCap) throw new Error("Budgeted routing requires a maximum estimated request cost.");
    const payload = {
      spendPolicy,
      routingMode,
      ...(rawCap ? { maxEstimatedRequestCostUsd: Number(rawCap) } : { maxEstimatedRequestCostUsd: null }),
      ...(snapshot?.control?.pinnedProvider && snapshot?.control?.pinnedModel ? {
        pinnedProvider: snapshot.control.pinnedProvider,
        pinnedModel: snapshot.control.pinnedModel,
      } : {}),
    };
    setStatus("Applying explicit owner AI routing policy…");
    const value = await api(`/api/projects/${encodeURIComponent(projectId())}/ai/control`, { method: "POST", body: JSON.stringify(payload) });
    renderTruth(value);
    setStatus("Routing policy applied. Future provider-backed Forge work will use the updated policy.");
  }

  async function pinModel() {
    const provider = $("#agent-provider")?.value;
    const model = $("#agent-model")?.value?.trim();
    if (!PROVIDERS.includes(provider) || !model) throw new Error("Load a catalog and choose a model first.");
    setStatus(`Pinning Forge AI routing to ${provider} / ${model}…`);
    const value = await api(`/api/projects/${encodeURIComponent(projectId())}/ai/control`, {
      method: "POST",
      body: JSON.stringify({ pinnedProvider: provider, pinnedModel: model }),
    });
    renderTruth(value);
    setStatus(`Model pin applied: ${provider} / ${model}.`);
  }

  async function clearPin() {
    setStatus("Clearing explicit model pin…");
    const value = await api(`/api/projects/${encodeURIComponent(projectId())}/ai/control`, {
      method: "POST",
      body: JSON.stringify({ pinnedProvider: null, pinnedModel: null }),
    });
    renderTruth(value);
    const select = $("#agent-model"); if (select) select.replaceChildren(new Option("Load provider catalog first", ""));
    const button = $("#agent-pin-model"); if (button) button.disabled = true;
    setStatus("Model pin cleared. Forge returned to policy-driven provider/model selection.");
  }

  function guarded(fn) {
    return async () => {
      try { await fn(); }
      catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    };
  }

  function wire() {
    if (!buildPanel()) return;
    $("#agent-load-catalog")?.addEventListener("click", guarded(loadCatalog));
    $("#agent-apply-routing-policy")?.addEventListener("click", guarded(applyPolicy));
    $("#agent-pin-model")?.addEventListener("click", guarded(pinModel));
    $("#agent-clear-model-pin")?.addEventListener("click", guarded(clearPin));
    $("#agent-model")?.addEventListener("change", (event) => { const button = $("#agent-pin-model"); if (button) button.disabled = !event.currentTarget.value; });
    $("#agent-provider")?.addEventListener("change", () => {
      const select = $("#agent-model"); if (select) select.replaceChildren(new Option("Load provider catalog first", ""));
      const button = $("#agent-pin-model"); if (button) button.disabled = true;
    });
    $("#agent-project")?.addEventListener("change", guarded(refresh));
    refresh().catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire, { once: true });
  else wire();
})();
