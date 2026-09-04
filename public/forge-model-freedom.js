/* Author's Forge Model Freedom + governed multi-model writing UI. Model cost preference never bypasses quality gates. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const root = `/api/projects/${encodeURIComponent(projectId)}/ai`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const PROVIDERS = ["omniroute", "9router", "kings", "ollama", "groq", "mistral", "gemini", "anthropic", "openrouter", "openai"];
  const BILLING = ["unknown", "free", "local", "subscription", "metered", "gateway-managed"];
  let snapshot = null;
  let catalog = [];

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type":"application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Model Freedom request failed (${response.status}).`);
    return payload;
  }
  function notify(message, ok = false) {
    const error = $("#error-banner"), success = $("#success-banner"), target = ok ? success : error;
    if (error) error.hidden = ok;
    if (success) success.hidden = !ok;
    if (target) { target.textContent = message; target.hidden = false; }
  }
  function currentTarget() {
    const workspace = window.forgeWorkspaceState;
    const books = workspace?.books || [];
    const bookId = $("#editor-book")?.value;
    const chapterId = $("#editor-chapter")?.value;
    const sceneId = $("#editor-scene")?.value;
    const book = books.find((item) => item.id === bookId) || books.find((item) => item.id === workspace?.activeBookId) || books[0];
    const chapter = book?.chapters?.find((item) => item.id === chapterId) || book?.chapters?.[0];
    const scene = chapter?.scenes?.find((item) => item.id === sceneId) || chapter?.scenes?.[0];
    return { book, chapter, scene };
  }

  function ensureWritingControls() {
    const run = $("#ai-draft");
    if (!run || $("#ai-ensemble-run")) return;
    const button = document.createElement("button");
    button.id = "ai-ensemble-run";
    button.type = "button";
    button.textContent = "Run Multi-Model Forge";
    button.title = "Use the configured model team, then continuity/voice anti-drift judges and the Editing Office.";
    run.insertAdjacentElement("afterend", button);
    const panel = document.createElement("div");
    panel.id = "ai-ensemble-status";
    panel.className = "list";
    panel.innerHTML = '<p class="muted">Multi-model mode uses only models allowed by your current spend policy. Quality gates remain mandatory.</p>';
    const meta = $("#ai-meta");
    (meta?.parentElement || run.parentElement)?.appendChild(panel);
    button.addEventListener("click", runEnsemble);
  }

  function ensureSettingsControls() {
    const settings = $("#settings");
    if (!settings || $("#forge-model-freedom")) return;
    const card = document.createElement("article");
    card.id = "forge-model-freedom";
    card.className = "card";
    card.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">MODEL FREEDOM</div><h3>Choose the AI economy that fits you</h3><p>Use local, free, subscription, affordable, premium, router-managed, or mixed model pools. Model price never bypasses Forge's quality, anti-drift, continuity, voice, or Editing Office gates.</p></div><button id="model-options-refresh" type="button">Refresh</button></div>
      <div class="grid">
        <section>
          <h4>Multi-model team</h4>
          <label><input id="ensemble-enabled" type="checkbox"> Enable coordinated model team</label>
          <label>Maximum parallel workers <input id="ensemble-workers" type="number" min="1" max="8" step="1"></label>
          <label>Minimum model/judge quality score <input id="ensemble-quality" type="number" min="70" max="100" step="1"></label>
          <label>Optional total ensemble budget (USD) <input id="ensemble-total-budget" type="number" min="0" step="0.001" placeholder="blank = use normal spend policy"></label>
          <p class="muted">More workers can improve breadth and speed through parallelism, but may consume more quota/tokens. If you set a total budget, Forge conservatively divides it across workers, synthesis, and both judges. Free/local/no-spend models remain available under the same quality rules.</p>
          <button id="model-options-save" class="primary" type="button">Save Model Freedom settings</button>
        </section>
        <section>
          <h4>Add a model</h4>
          <label>Provider<select id="model-option-provider">${PROVIDERS.map((provider) => `<option value="${provider}">${provider}</option>`).join("")}</select></label>
          <label>Model ID<input id="model-option-id" list="model-catalog-options" placeholder="model-id or router model path"></label>
          <datalist id="model-catalog-options"></datalist>
          <label>Billing classification<select id="model-option-billing">${BILLING.map((billing) => `<option value="${billing}">${billing}</option>`).join("")}</select></label>
          <label><input id="model-option-trusted-free" type="checkbox"> Trust this provider/model as no-paid-token</label>
          <div class="row"><button id="model-catalog-load" type="button">Load provider catalog</button><button id="model-option-add" type="button">Add model</button></div>
          <p class="muted"><strong>No-spend trust is your explicit declaration.</strong> Use it only when your provider account confirms that exact route is free/subscription-covered/local. Forge will not guess router billing.</p>
        </section>
      </div>
      <hr><h4>Available model pool</h4><div id="model-option-list" class="list"><p class="muted">Loading model options…</p></div>
      <details><summary>Configured runtime resources</summary><div id="model-resource-list" class="list"></div></details>
      <details><summary>Quality protection</summary><p>Parallel workers → synthesis when multiple real models survive → continuity anti-drift judge + voice anti-drift judge in parallel → all 10 Editing Office roles → pending proposal → author review → separate Apply with stale-scene protection.</p></details>`;
    settings.appendChild(card);
    $("#model-options-refresh")?.addEventListener("click", loadOptions);
    $("#model-options-save")?.addEventListener("click", saveOptions);
    $("#model-catalog-load")?.addEventListener("click", loadCatalog);
    $("#model-option-add")?.addEventListener("click", addModel);
    $("#model-option-list")?.addEventListener("click", handleModelListAction);
    void loadOptions();
  }

  async function loadOptions() {
    try {
      snapshot = await api(`${root}/model-options`);
      const options = snapshot.options || {};
      $("#ensemble-enabled").checked = options.ensembleEnabled !== false;
      $("#ensemble-workers").value = String(options.ensembleMaxWorkers ?? 3);
      $("#ensemble-quality").value = String(options.ensembleMinQualityScore ?? 80);
      $("#ensemble-total-budget").value = options.ensembleMaxTotalEstimatedCostUsd === undefined ? "" : String(options.ensembleMaxTotalEstimatedCostUsd);
      renderModelOptions();
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }
  function renderModelOptions() {
    if (!snapshot) return;
    const options = snapshot.options || {};
    const trusted = new Set(options.trustedNoSpendModels || []);
    const host = $("#model-option-list");
    const models = options.additionalModels || [];
    if (host) host.innerHTML = models.length ? models.map((item) => {
      const key = `${item.provider}/${item.model}`.toLowerCase();
      const trustedMark = trusted.has(key) ? " • trusted no-spend" : "";
      return `<article class="memory"><strong>${esc(item.provider)} / ${esc(item.model)}</strong><small>${esc(item.billingClass || "provider default")}${esc(trustedMark)}</small><div class="row"><button type="button" data-model-trust="${esc(key)}">${trusted.has(key) ? "Remove no-spend trust" : "Trust as no-spend"}</button><button type="button" data-model-remove="${esc(key)}">Remove model</button></div></article>`;
    }).join("") : '<p class="muted">No extra models added. Forge still uses every model already configured by the owner/provider runtime.</p>';

    const resourceHost = $("#model-resource-list");
    const resources = snapshot.resources || [];
    if (resourceHost) resourceHost.innerHTML = resources.length ? resources.map((resource) => `<article class="memory"><strong>${esc(resource.provider)} / ${esc(resource.model)}</strong><small>${esc(resource.billingClass || "unknown billing")} • ${resource.healthy === false ? "unhealthy" : "eligible when policy/capabilities allow"}</small></article>`).join("") : '<p class="muted">No configured AI resources detected.</p>';
  }

  async function saveOptions() {
    if (!snapshot) await loadOptions();
    try {
      const rawBudget = $("#ensemble-total-budget")?.value?.trim() || "";
      const payload = {
        ...(snapshot?.options || {}),
        ensembleEnabled: Boolean($("#ensemble-enabled")?.checked),
        ensembleMaxWorkers: Number($("#ensemble-workers")?.value || 3),
        ensembleMinQualityScore: Number($("#ensemble-quality")?.value || 80),
        ensembleMaxTotalEstimatedCostUsd: rawBudget === "" ? null : Number(rawBudget),
      };
      snapshot = await api(`${root}/model-options`, { method:"POST", body:JSON.stringify(payload) });
      renderModelOptions();
      notify("Model Freedom settings saved. Existing spend policy and model pins remain authoritative.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function loadCatalog() {
    const provider = $("#model-option-provider")?.value;
    if (!provider) return;
    const button = $("#model-catalog-load");
    if (button) button.disabled = true;
    try {
      const result = await api(`${root}/catalog?provider=${encodeURIComponent(provider)}`);
      catalog = Array.isArray(result.models) ? result.models : [];
      const datalist = $("#model-catalog-options");
      if (datalist) datalist.innerHTML = catalog.map((model) => `<option value="${esc(model.id || model.name || "")}"></option>`).join("");
      notify(`Loaded ${catalog.length} model option${catalog.length === 1 ? "" : "s"} from ${provider}.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
    finally { if (button) button.disabled = false; }
  }

  async function addModel() {
    if (!snapshot) await loadOptions();
    const provider = $("#model-option-provider")?.value;
    const model = $("#model-option-id")?.value?.trim();
    const billingClass = $("#model-option-billing")?.value;
    const trust = Boolean($("#model-option-trusted-free")?.checked);
    if (!provider || !model) return notify("Choose a provider and enter a model ID.");
    const key = `${provider}/${model}`.toLowerCase();
    const current = snapshot.options || {};
    const additionalModels = [...(current.additionalModels || []).filter((item) => `${item.provider}/${item.model}`.toLowerCase() !== key), { provider, model, ...(billingClass && billingClass !== "unknown" ? { billingClass } : {}) }];
    const trustedNoSpendModels = [...new Set([...(current.trustedNoSpendModels || []).filter((item) => item !== key), ...(trust ? [key] : [])])];
    try {
      snapshot = await api(`${root}/model-options`, { method:"POST", body:JSON.stringify({ ...current, additionalModels, trustedNoSpendModels }) });
      $("#model-option-id").value = "";
      $("#model-option-trusted-free").checked = false;
      renderModelOptions();
      notify(`${provider}/${model} added to the Forge model pool.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function handleModelListAction(event) {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (!target || !snapshot) return;
    const current = snapshot.options || {};
    const remove = target.dataset.modelRemove;
    const trust = target.dataset.modelTrust;
    try {
      if (remove) {
        const additionalModels = (current.additionalModels || []).filter((item) => `${item.provider}/${item.model}`.toLowerCase() !== remove);
        const trustedNoSpendModels = (current.trustedNoSpendModels || []).filter((item) => item !== remove);
        snapshot = await api(`${root}/model-options`, { method:"POST", body:JSON.stringify({ ...current, additionalModels, trustedNoSpendModels }) });
      } else if (trust) {
        const set = new Set(current.trustedNoSpendModels || []);
        if (set.has(trust)) set.delete(trust); else set.add(trust);
        snapshot = await api(`${root}/model-options`, { method:"POST", body:JSON.stringify({ ...current, trustedNoSpendModels:[...set] }) });
      }
      renderModelOptions();
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function runEnsemble() {
    const { book, chapter, scene } = currentTarget();
    const instruction = $("#ai-instruction")?.value?.trim();
    if (!book || !chapter || !scene) return notify("Select a book, chapter, and scene before running the model team.");
    if (!instruction) return notify("Give the AI writing engine a direction first.");
    const button = $("#ai-ensemble-run");
    if (button) button.disabled = true;
    try {
      const result = await api(`${root}/ensemble-writing`, { method:"POST", body:JSON.stringify({
        bookId: book.id,
        chapterId: chapter.id,
        sceneId: scene.id,
        task: $("#ai-task")?.value || "draft",
        instruction,
      }) });
      if ($("#ai-result")) $("#ai-result").value = result.proposal?.proposedContent || result.ensemble?.finalText || "";
      renderEnsembleResult(result);
      if ($("#refresh")) $("#refresh").click();
      notify("Multi-model candidate passed Forge anti-drift and Editing Office gates and is now a pending proposal. Nothing was applied automatically.", true);
    } catch (error) {
      renderEnsembleFailure(error instanceof Error ? error.message : String(error));
      notify(error instanceof Error ? error.message : String(error));
    } finally { if (button) button.disabled = false; }
  }

  function renderEnsembleResult(result) {
    const ensemble = result.ensemble || {};
    const host = $("#ai-ensemble-status");
    if (!host) return;
    const workers = ensemble.workers || [];
    const judges = ensemble.judges || [];
    const editor = ensemble.editorial || {};
    const budget = ensemble.budget || {};
    const budgetText = budget.maxTotalEstimatedCostUsd === undefined
      ? `${esc(budget.spendPolicy || "owner policy")}`
      : `${esc(budget.spendPolicy)} • total cap $${esc(Number(budget.maxTotalEstimatedCostUsd).toFixed(4))} • per-call ceiling $${esc(Number(budget.perCallEstimatedCostCeilingUsd || 0).toFixed(4))}`;
    host.innerHTML = `<article class="memory"><strong>${esc(ensemble.mode === "parallel" ? "Parallel model team" : "Single eligible model")} • ${esc(ensemble.uniqueModelsUsed?.length || 0)} real model${ensemble.uniqueModelsUsed?.length === 1 ? "" : "s"}</strong><p>${workers.map((worker) => `${esc(worker.actualProvider)}/${esc(worker.actualModel)} — quality ${esc(worker.qualityScore)}${worker.billingClass ? ` — ${esc(worker.billingClass)}` : ""}${worker.fallbackUsed ? " — fallback" : ""}`).join("<br>")}</p>${ensemble.synthesis ? `<p><b>Synthesis:</b> ${esc(ensemble.synthesis.provider)}/${esc(ensemble.synthesis.model)} • quality ${esc(ensemble.synthesis.qualityScore)}</p>` : ""}<p><b>Anti-drift:</b> ${judges.map((judge) => `${esc(judge.kind)} ${esc(judge.score)} ${judge.accepted ? "✓" : "✗"}`).join(" • ")}</p><p><b>Editing Office:</b> ${esc(editor.report?.findings?.length || 0)} findings • ${esc(editor.blockingFindings?.length || 0)} blocking</p><p><b>Spend guard:</b> ${budgetText}</p><small>Pending proposal ${esc(result.proposal?.id || "")} • author approval and separate Apply required</small></article>`;
    if ($("#ai-meta")) $("#ai-meta").textContent = `${ensemble.mode || "ensemble"} • ${ensemble.uniqueModelsUsed?.join(", ") || "model provenance recorded"} • anti-drift passed • candidate only`;
  }
  function renderEnsembleFailure(message) {
    const host = $("#ai-ensemble-status");
    if (host) host.innerHTML = `<article class="memory"><strong>Multi-model candidate blocked</strong><p>${esc(message)}</p><small>Forge did not create or apply a manuscript proposal from a candidate that failed its quality or spend gates.</small></article>`;
  }

  function ensureUi() {
    ensureWritingControls();
    ensureSettingsControls();
  }
  window.addEventListener("forge:workspace-ready", ensureUi);
  window.addEventListener("load", ensureUi);
  if (document.readyState !== "loading") ensureUi();
})();
