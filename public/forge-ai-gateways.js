/* Author's Forge generic OpenAI-compatible gateway UI. Secrets remain environment-owned. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const root = `/api/projects/${encodeURIComponent(projectId)}/ai`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const BILLING = ["unknown", "free", "local", "subscription", "metered", "gateway-managed"];
  let gateways = [];

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type":"application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Gateway request failed (${response.status}).`);
    return payload;
  }
  function notify(message, ok = false) {
    const error = $("#error-banner"), success = $("#success-banner"), target = ok ? success : error;
    if (error) error.hidden = ok;
    if (success) success.hidden = !ok;
    if (target) { target.textContent = message; target.hidden = false; }
  }
  function lines(value) { return String(value || "").split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean); }

  function ensureUi() {
    const settings = $("#settings");
    if (!settings || $("#forge-ai-gateways")) return;
    const card = document.createElement("article");
    card.id = "forge-ai-gateways";
    card.className = "card";
    card.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">OPENAI-COMPATIBLE GATEWAYS</div><h3>Connect more AI without another Forge adapter</h3><p>Attach LiteLLM or another OpenAI-compatible <code>/v1/chat/completions</code> gateway. Forge still owns routing, spend limits, quality checks, anti-drift, provenance, and author approval.</p></div><button id="gateway-refresh" type="button">Refresh</button></div>
      <div class="grid">
        <section>
          <h4>Add or update gateway</h4>
          <label>Gateway id <input id="gateway-id" placeholder="litellm-home" pattern="[a-z0-9][a-z0-9_-]*"></label>
          <label>Display name <input id="gateway-label" placeholder="Home LiteLLM"></label>
          <label>Base URL <input id="gateway-base-url" placeholder="https://ai.example.com or http://127.0.0.1:4000"></label>
          <label>API-key environment variable <input id="gateway-api-key-env" placeholder="LITELLM_API_KEY (blank for no-auth local gateway)"></label>
          <label><input id="gateway-enabled" type="checkbox" checked> Enabled</label>
          <label>Manual model ids <textarea id="gateway-models" placeholder="model-a\nprovider/model-b"></textarea></label>
          <label>Billing class for manually entered models <select id="gateway-billing">${BILLING.map((item) => `<option value="${item}">${item}</option>`).join("")}</select></label>
          <button id="gateway-save" class="primary" type="button">Save gateway</button>
          <p class="muted">Raw API keys are intentionally rejected here. Put the key in the named environment variable on the Forge runtime. HTTPS is required for remote/LAN gateways; plain HTTP is accepted only on loopback.</p>
        </section>
        <section>
          <h4>Registered gateways</h4>
          <div id="gateway-list" class="list"><p class="muted">No gateways loaded yet.</p></div>
        </section>
      </div>`;
    settings.appendChild(card);
    $("#gateway-refresh")?.addEventListener("click", load);
    $("#gateway-save")?.addEventListener("click", save);
    $("#gateway-list")?.addEventListener("click", handleAction);
    void load();
  }

  async function load() {
    const host = $("#gateway-list");
    try {
      const result = await api(`${root}/gateways`);
      gateways = Array.isArray(result.gateways) ? result.gateways : [];
      render();
    } catch (error) {
      if (host) host.innerHTML = `<p class="muted">Gateway registry unavailable: ${esc(error instanceof Error ? error.message : String(error))}</p>`;
    }
  }

  function render() {
    const host = $("#gateway-list");
    if (!host) return;
    if (!gateways.length) {
      host.innerHTML = '<p class="muted">No generic gateways configured. Built-in Forge providers continue to work normally.</p>';
      return;
    }
    host.innerHTML = gateways.map((gateway) => {
      const credential = gateway.apiKeyEnv
        ? `${gateway.credentialConfigured ? "credential ready" : `missing ${esc(gateway.apiKeyEnv)}`}`
        : "no API key required";
      const models = Array.isArray(gateway.models) ? gateway.models : [];
      return `<article class="memory" data-gateway-card="${esc(gateway.id)}"><strong>${esc(gateway.label)} <small>(${esc(gateway.id)})</small></strong><p>${esc(gateway.baseUrl)}</p><small>${gateway.enabled ? "enabled" : "disabled"} • ${credential} • ${models.length} registered model${models.length === 1 ? "" : "s"}</small><details><summary>Models</summary>${models.length ? `<ul>${models.map((model) => `<li>${esc(model.id)} • ${esc(model.billingClass || "unknown billing")} <button type="button" data-gateway-trust="${esc(gateway.id)}::${esc(model.id)}">Toggle no-spend trust</button></li>`).join("")}</ul>` : '<p class="muted">No models registered yet.</p>'}</details><div class="row"><button type="button" data-gateway-edit="${esc(gateway.id)}">Edit</button><button type="button" data-gateway-discover="${esc(gateway.id)}">Discover & register models</button><button type="button" data-gateway-remove="${esc(gateway.id)}">Remove</button></div></article>`;
    }).join("");
  }

  async function save() {
    const id = $("#gateway-id")?.value?.trim();
    const label = $("#gateway-label")?.value?.trim();
    const baseUrl = $("#gateway-base-url")?.value?.trim();
    if (!id || !label || !baseUrl) return notify("Gateway id, display name, and base URL are required.");
    const billing = $("#gateway-billing")?.value || "unknown";
    const models = lines($("#gateway-models")?.value).map((model) => ({ id:model, ...(billing === "unknown" ? {} : { billingClass:billing }) }));
    const payload = {
      id,
      label,
      baseUrl,
      apiKeyEnv: $("#gateway-api-key-env")?.value?.trim() || null,
      enabled: Boolean($("#gateway-enabled")?.checked),
      models,
    };
    try {
      await api(`${root}/gateways`, { method:"POST", body:JSON.stringify(payload) });
      await load();
      notify(`Gateway ${id} saved. No raw credential was stored by Forge.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function handleAction(event) {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button) return;
    const editId = button.dataset.gatewayEdit;
    const discoverId = button.dataset.gatewayDiscover;
    const removeId = button.dataset.gatewayRemove;
    const trustModel = button.dataset.gatewayTrust;
    if (editId) return populateEdit(editId);
    if (discoverId) return discover(discoverId);
    if (removeId) return remove(removeId);
    if (trustModel) return toggleTrust(trustModel);
  }

  function populateEdit(id) {
    const gateway = gateways.find((item) => item.id === id);
    if (!gateway) return;
    $("#gateway-id").value = gateway.id;
    $("#gateway-label").value = gateway.label;
    $("#gateway-base-url").value = gateway.baseUrl;
    $("#gateway-api-key-env").value = gateway.apiKeyEnv || "";
    $("#gateway-enabled").checked = gateway.enabled !== false;
    $("#gateway-models").value = (gateway.models || []).map((model) => model.id).join("\n");
    $("#gateway-billing").value = "unknown";
    $("#gateway-id")?.scrollIntoView({ behavior:"smooth", block:"center" });
  }

  async function discover(id) {
    try {
      const result = await api(`${root}/gateways/${encodeURIComponent(id)}/discover`, { method:"POST", body:JSON.stringify({ persist:true }) });
      await load();
      notify(`Gateway ${id} responded with ${result.discoveredModels?.length || 0} model${result.discoveredModels?.length === 1 ? "" : "s"}. Newly discovered models were registered with unknown billing.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function remove(id) {
    try {
      await api(`${root}/gateways/${encodeURIComponent(id)}`, { method:"DELETE" });
      await load();
      notify(`Gateway ${id} removed.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function toggleTrust(encodedModel) {
    const trustKey = `gateway/${encodedModel}`.toLowerCase();
    try {
      const current = await api(`${root}/model-options`);
      const options = current.options || {};
      const set = new Set(options.trustedNoSpendModels || []);
      if (set.has(trustKey)) set.delete(trustKey); else set.add(trustKey);
      await api(`${root}/model-options`, { method:"POST", body:JSON.stringify({ ...options, trustedNoSpendModels:[...set] }) });
      notify(`${trustKey} ${set.has(trustKey) ? "trusted as no-spend" : "removed from no-spend trust"}.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  window.addEventListener("forge:workspace-ready", ensureUi);
  window.addEventListener("load", ensureUi);
  if (document.readyState !== "loading") ensureUi();
})();