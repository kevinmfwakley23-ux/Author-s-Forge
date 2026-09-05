(() => {
  "use strict";
  const shell = document.querySelector(".nft-shell");
  const projectInput = document.querySelector("#nft-project-id");
  const status = document.querySelector("#nft-status");
  if (!shell || !projectInput || !status) return;
  if (!document.querySelector('link[data-nft-production-director]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/nft-production-director.css";
    link.dataset.nftProductionDirector = "true";
    document.head.append(link);
  }

  const root = document.createElement("section");
  root.id = "nft-production-director";
  root.innerHTML = `
    <article class="nft-panel">
      <div class="nft-director-head">
        <div><div class="eyebrow">SERIES · MARKET · PROVENANCE · PERMANENT STORAGE</div><h2>NFT Production Director</h2><p class="nft-muted">Coordinate multiple collections as one artistic program, test market positioning with source-backed evidence, audit provenance/visual drift, and publish verified IPFS files only when a real provider is configured.</p></div>
        <div class="nft-director-tabs" role="tablist"><button type="button" class="active" data-director-view="series">Series & Sets</button><button type="button" data-director-view="market">Market Signals</button><button type="button" data-director-view="storage">Storage & Provenance</button></div>
      </div>
    </article>
    <section data-director-panel="series">
      <div class="nft-director-grid">
        <article class="nft-panel">
          <div class="nft-row"><h3 class="grow">Series / Set Director</h3><select id="nft-series-select"><option value="">New series</option></select><button id="nft-series-new" type="button">New</button></div>
          <form id="nft-series-form" class="nft-form">
            <div class="nft-two"><label>Series ID<input name="id" pattern="[A-Za-z0-9_-]+" placeholder="royal-beasts-series"></label><label>Series title<input name="title" required placeholder="Royal Beasts"></label></div>
            <label>Cross-collection artistic thesis<textarea name="thesis" placeholder="What remains true across every collection and set?"></textarea></label>
            <label>Series audience hypothesis<textarea name="audience" placeholder="Who should recognize this as one collectible world, and why?"></textarea></label>
            <fieldset><legend>Collections in this series</legend><div id="nft-series-collections" class="nft-director-collections"></div></fieldset>
            <label>Sets JSON<textarea name="sets" class="nft-code" placeholder='[{"id":"genesis","title":"Genesis Set","collectionIds":["collection-a","collection-b"],"releaseOrder":["collection-a","collection-b"],"positioningNote":"Distinct roles inside one world."}]'></textarea></label>
            <div class="nft-two"><label>Shared style principles — one per line<textarea name="sharedStylePrinciples" placeholder="Restrained metallic accents\nStrong silhouette language"></textarea></label><label>Shared lore rules — one per line<textarea name="sharedLoreRules" placeholder="No contradictory origin stories\nRecurring symbols retain meaning"></textarea></label></div>
            <label>Provenance requirements — one per line<textarea name="provenanceRequirements" placeholder="Every approved artwork has author or Image Lab provenance\nNo unresolved publication-clearance flags"></textarea></label>
            <div class="nft-two"><label>Minimum days between drops<input name="minimumDaysBetweenDrops" type="number" min="0" max="3650" value="14"></label><label>Max concurrent launches<input name="maxConcurrentLaunches" type="number" min="1" max="50" value="1"></label></div>
            <div class="nft-row"><button id="nft-series-create" class="primary" type="submit">Create series</button><button id="nft-series-update" type="button" disabled>Update selected series</button></div>
          </form>
        </article>
        <article class="nft-panel">
          <h3>Cross-collection QA</h3><p class="nft-muted">Checks missing/duplicate art, provenance evidence, Image Lab size/style drift, storage and royalty consistency, release spacing, trait language, and set configuration.</p>
          <div class="nft-row"><button id="nft-series-qa" class="primary" type="button" disabled>Run series QA</button><button id="nft-series-provenance" type="button" disabled>Download provenance bundle</button></div>
          <pre id="nft-series-output" class="nft-code nft-director-output">Create or select a series.</pre>
        </article>
      </div>
    </section>
    <section data-director-panel="market" class="nft-director-hidden">
      <div class="nft-director-grid">
        <article class="nft-panel"><h3>Source-backed Market Signal Lab</h3><p class="nft-muted">Research comparable categories, marketplace mechanics, launch patterns, audience language and observable demand signals. Forge stores sourced evidence in Project Brain and never turns it into a guaranteed price/demand forecast.</p><form id="nft-market-form" class="nft-form"><label>Collection<select id="nft-market-collection"></select></label><label>Research focus<textarea name="focus" placeholder="Example: current collector language around original fantasy art, reveal mechanics, allowlist patterns, and signals that a 250-piece supply may be too large or too small."></textarea></label><button class="primary" type="submit">Run live source-backed research</button></form><p class="nft-muted">Hosted research obeys Forge owner spend controls. If paid hosted research is blocked, this tool fails with the exact policy reason.</p></article>
        <article class="nft-panel"><h3>Evidence</h3><div id="nft-market-output" class="nft-list"><p class="nft-muted">No market research run yet.</p></div></article>
      </div>
    </section>
    <section data-director-panel="storage" class="nft-director-hidden">
      <div class="nft-director-grid">
        <article class="nft-panel"><h3>Permanent-storage publisher</h3><p id="nft-storage-provider" class="nft-muted">Checking provider configuration…</p><form id="nft-storage-form" class="nft-form"><label>Collection<select id="nft-storage-collection"></select></label><label>Max items for this operation<input name="maxItems" type="number" min="1" placeholder="Blank = complete collection"></label><div class="nft-row"><button id="nft-storage-plan" class="primary" type="button">Preview IPFS publish plan</button></div><label class="nft-director-check"><input name="confirmExternalPublish" type="checkbox"><span>I explicitly authorize Forge to upload the selected NFT files to the configured external permanent-storage provider.</span></label><label class="nft-director-check"><input name="confirmLargeBatch" type="checkbox"><span>I reviewed the upload count and authorize a batch above 250 items if required.</span></label><button id="nft-storage-publish" type="submit" disabled>Publish verified files to IPFS</button></form><p class="nft-director-publish-note nft-muted">This publishes files only. It does not deploy a contract, sign a wallet transaction, mint tokens, list on a marketplace, or promise demand.</p></article>
        <article class="nft-panel"><h3>Storage evidence</h3><div class="nft-row"><button id="nft-storage-download" type="button" disabled>Download publication receipt</button></div><pre id="nft-storage-output" class="nft-code nft-director-output">Preview a publish plan first.</pre></article>
      </div>
    </section>`;
  shell.append(root);

  const state = { collections: [], series: [], health: null, currentSeries: null, lastStorageReceipt: null };
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));
  const lines = (value) => String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const setStatus = (message) => { status.textContent = message || ""; };
  function projectId() { const id = projectInput.value.trim() || new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || ""; if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Open a valid Forge project first."); return id; }
  async function api(path, options = {}) { const response = await fetch(path, { ...options, headers: { "content-type":"application/json", ...(options.headers || {}) } }); const text = await response.text(); let payload = {}; try { payload = text ? JSON.parse(text) : {}; } catch { throw new Error(`Invalid NFT Production Director response (${response.status}).`); } if (!response.ok) throw new Error(payload.error || `NFT Production Director request failed (${response.status}).`); return payload; }
  function safeName(value) { return String(value || "forge-nft").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "forge-nft"; }
  function downloadJson(value, name) { const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type:"application/json" })); const link = document.createElement("a"); link.href = url; link.download = name; link.hidden = true; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200); }

  function selectPanel(name) { $$('[data-director-panel]').forEach((panel) => panel.classList.toggle("nft-director-hidden", panel.dataset.directorPanel !== name)); $$('[data-director-view]').forEach((button) => button.classList.toggle("active", button.dataset.directorView === name)); }
  $$('[data-director-view]').forEach((button) => button.addEventListener("click", () => selectPanel(button.dataset.directorView)));

  async function refresh() {
    const id = projectId();
    const [office, series, health] = await Promise.all([api(`/api/projects/${encodeURIComponent(id)}/nft`), api(`/api/projects/${encodeURIComponent(id)}/nft-series`), api('/api/health')]);
    state.collections = office.collections || [];
    state.series = series || [];
    state.health = health;
    renderCollectionInputs();
    renderSeriesOptions();
    renderStorageStatus();
  }

  function renderCollectionInputs() {
    const host = $("#nft-series-collections");
    const checked = new Set(state.currentSeries?.collectionIds || []);
    host.innerHTML = state.collections.length ? state.collections.map((collection) => `<label class="nft-director-check"><input type="checkbox" value="${esc(collection.id)}"${checked.has(collection.id) ? " checked" : ""}><span><strong>${esc(collection.title)}</strong><br><span class="nft-muted">${esc(collection.id)} · ${esc(collection.chain)} · ${esc(collection.tokenStandard)} · ${collection.supply}</span></span></label>`).join("") : '<p class="nft-muted">Create NFT collections first.</p>';
    const options = state.collections.map((collection) => `<option value="${esc(collection.id)}">${esc(collection.title)} · ${esc(collection.id)}</option>`).join("");
    $("#nft-market-collection").innerHTML = options || '<option value="">No collection</option>';
    $("#nft-storage-collection").innerHTML = options || '<option value="">No collection</option>';
  }

  function renderSeriesOptions() {
    const select = $("#nft-series-select");
    const current = state.currentSeries?.id || "";
    select.innerHTML = '<option value="">New series</option>' + state.series.map((series) => `<option value="${esc(series.id)}">${esc(series.title)} · ${esc(series.id)}</option>`).join("");
    select.value = state.series.some((series) => series.id === current) ? current : "";
    const has = Boolean(state.currentSeries);
    $("#nft-series-update").disabled = !has;
    $("#nft-series-qa").disabled = !has;
    $("#nft-series-provenance").disabled = !has;
  }

  function renderStorageStatus() {
    const configured = Boolean(state.health?.externalStorage?.pinataPublicIpfsConfigured);
    $("#nft-storage-provider").textContent = configured ? "Pinata public IPFS is configured. Preview the upload count before publishing." : "Pinata public IPFS is not configured. Dry-run planning is available; real publishing stays disabled until PINATA_JWT is configured on the Forge runtime.";
    $("#nft-storage-provider").classList.toggle("nft-director-good", configured);
    $("#nft-storage-publish").disabled = !configured;
  }

  function clearSeriesForm() {
    state.currentSeries = null;
    const form = $("#nft-series-form");
    form.reset();
    form.elements.minimumDaysBetweenDrops.value = "14";
    form.elements.maxConcurrentLaunches.value = "1";
    form.elements.id.disabled = false;
    $("#nft-series-output").textContent = "Create or select a series.";
    renderCollectionInputs();
    renderSeriesOptions();
  }

  function loadSeries(id) {
    const series = state.series.find((item) => item.id === id);
    if (!series) return clearSeriesForm();
    state.currentSeries = series;
    const form = $("#nft-series-form");
    form.elements.id.value = series.id;
    form.elements.id.disabled = true;
    form.elements.title.value = series.title;
    form.elements.thesis.value = series.thesis || "";
    form.elements.audience.value = series.audience || "";
    form.elements.sets.value = JSON.stringify(series.sets || [], null, 2);
    form.elements.sharedStylePrinciples.value = (series.rules?.sharedStylePrinciples || []).join("\n");
    form.elements.sharedLoreRules.value = (series.rules?.sharedLoreRules || []).join("\n");
    form.elements.provenanceRequirements.value = (series.rules?.provenanceRequirements || []).join("\n");
    form.elements.minimumDaysBetweenDrops.value = String(series.rules?.minimumDaysBetweenDrops ?? 14);
    form.elements.maxConcurrentLaunches.value = String(series.rules?.maxConcurrentLaunches ?? 1);
    renderCollectionInputs();
    renderSeriesOptions();
    $("#nft-series-output").textContent = JSON.stringify({ id: series.id, title: series.title, collectionIds: series.collectionIds, sets: series.sets, rules: series.rules }, null, 2);
  }

  function seriesPayload(includeId = true) {
    const form = $("#nft-series-form");
    let sets = [];
    if (form.elements.sets.value.trim()) { try { sets = JSON.parse(form.elements.sets.value); } catch { throw new Error("Sets JSON is invalid."); } if (!Array.isArray(sets)) throw new Error("Sets JSON must be an array."); }
    const collectionIds = [...$("#nft-series-collections").querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    return {
      ...(includeId ? { id: form.elements.id.value.trim() } : {}),
      title: form.elements.title.value.trim(), thesis: form.elements.thesis.value.trim(), audience: form.elements.audience.value.trim(), collectionIds, sets,
      rules: { sharedStylePrinciples: lines(form.elements.sharedStylePrinciples.value), sharedLoreRules: lines(form.elements.sharedLoreRules.value), provenanceRequirements: lines(form.elements.provenanceRequirements.value), minimumDaysBetweenDrops: Number(form.elements.minimumDaysBetweenDrops.value), maxConcurrentLaunches: Number(form.elements.maxConcurrentLaunches.value) },
    };
  }

  async function createSeries(event) {
    event.preventDefault();
    const id = projectId();
    const payload = seriesPayload(true);
    if (!payload.id) payload.id = `series-${Date.now()}`;
    setStatus(`Creating NFT series ${payload.title}…`);
    const created = await api(`/api/projects/${encodeURIComponent(id)}/nft-series`, { method:"POST", body:JSON.stringify(payload) });
    await refresh();
    loadSeries(created.id);
    setStatus(`NFT Series/Set Director created ${created.title}.`);
  }

  async function updateSeries() {
    if (!state.currentSeries) throw new Error("Select a series first.");
    const id = projectId();
    const saved = await api(`/api/projects/${encodeURIComponent(id)}/nft-series/${encodeURIComponent(state.currentSeries.id)}`, { method:"PUT", body:JSON.stringify(seriesPayload(false)) });
    await refresh(); loadSeries(saved.id); setStatus(`Updated NFT series ${saved.title}.`);
  }

  async function runQa() {
    if (!state.currentSeries) throw new Error("Select a series first.");
    setStatus(`Running cross-collection QA for ${state.currentSeries.title}…`);
    const report = await api(`/api/projects/${encodeURIComponent(projectId())}/nft-series/${encodeURIComponent(state.currentSeries.id)}/qa`, { method:"POST", body:"{}" });
    $("#nft-series-output").textContent = JSON.stringify({ score: report.score, readyForSeriesLaunch: report.readyForSeriesLaunch, errors: report.errors, warnings: report.warnings, collectionCount: report.collectionCount, itemCount: report.itemCount, approvedArtworkCount: report.approvedArtworkCount, sharedTraitLabels: report.sharedTraitLabels, duplicateArtworkGroups: report.duplicateArtworkGroups, issues: report.issues }, null, 2);
    setStatus(`Series QA complete: ${report.score}/100 · ${report.errors} error(s) · ${report.warnings} warning(s).`);
  }

  async function downloadProvenance() {
    if (!state.currentSeries) throw new Error("Select a series first.");
    setStatus(`Building provenance bundle for ${state.currentSeries.title}…`);
    const bundle = await api(`/api/projects/${encodeURIComponent(projectId())}/nft-series/${encodeURIComponent(state.currentSeries.id)}/provenance`, { method:"POST", body:"{}" });
    downloadJson(bundle, `${safeName(state.currentSeries.title)}-nft-series-provenance.json`);
    setStatus(`Downloaded provenance bundle for ${state.currentSeries.title}. No cryptographic signature or ownership claim was fabricated.`);
  }

  async function runMarket(event) {
    event.preventDefault();
    const collectionId = $("#nft-market-collection").value;
    if (!collectionId) throw new Error("Choose an NFT collection first.");
    const focus = new FormData(event.currentTarget).get("focus");
    setStatus("Running source-backed NFT market research through the governed Research Engine…");
    const report = await api(`/api/projects/${encodeURIComponent(projectId())}/nft/${encodeURIComponent(collectionId)}/market-research`, { method:"POST", body:JSON.stringify({ focus }) });
    const host = $("#nft-market-output");
    host.innerHTML = `<div class="nft-list-item"><strong>Research record ${esc(report.researchRecordId)}</strong><p>${esc(report.note)}</p><p class="nft-muted">Demand prediction: ${report.demandPrediction ? "yes" : "no"} · Investment advice: ${report.investmentAdvice ? "yes" : "no"}</p></div>` + (report.claims || []).map((claim) => `<article class="nft-director-signal"><strong>${esc(claim.source)}</strong><p>${esc(claim.claim)}</p><p class="nft-muted">${esc(claim.date)} · confidence ${esc(claim.confidence)} · relevance ${esc(claim.relevance)}</p><a href="${esc(claim.url)}" target="_blank" rel="noopener noreferrer">Source</a></article>`).join("") + `<article class="nft-director-signal"><strong>Questions to test before launch</strong><ul>${(report.positioningQuestions || []).map((question) => `<li>${esc(question)}</li>`).join("")}</ul></article>`;
    setStatus(`Market Signal Lab saved ${report.claims?.length || 0} source-backed claim(s) to Project Brain.`);
  }

  async function storagePlan() {
    const collectionId = $("#nft-storage-collection").value;
    if (!collectionId) throw new Error("Choose an NFT collection first.");
    const raw = $("#nft-storage-form").elements.maxItems.value.trim();
    const payload = raw ? { maxItems:Number(raw) } : {};
    const plan = await api(`/api/projects/${encodeURIComponent(projectId())}/nft/${encodeURIComponent(collectionId)}/storage/plan`, { method:"POST", body:JSON.stringify(payload) });
    $("#nft-storage-output").textContent = JSON.stringify(plan, null, 2);
    const configured = Boolean(state.health?.externalStorage?.pinataPublicIpfsConfigured);
    $("#nft-storage-publish").disabled = !configured || plan.blockedRemoteMedia > 0;
    setStatus(`IPFS publish plan: ${plan.estimatedUploads} provider upload(s), ${plan.mediaUploadsRequired} media upload(s), ${plan.existingIpfsMedia} existing IPFS media reference(s).`);
  }

  async function publishStorage(event) {
    event.preventDefault();
    const collectionId = $("#nft-storage-collection").value;
    if (!collectionId) throw new Error("Choose an NFT collection first.");
    const form = event.currentTarget;
    if (!form.elements.confirmExternalPublish.checked) throw new Error("Explicit external-publish authorization is required.");
    const raw = form.elements.maxItems.value.trim();
    const payload = { confirmExternalPublish:true, confirmLargeBatch:form.elements.confirmLargeBatch.checked, ...(raw ? { maxItems:Number(raw) } : {}) };
    setStatus("Publishing approved NFT media/metadata to configured public IPFS storage…");
    const receipt = await api(`/api/projects/${encodeURIComponent(projectId())}/nft/${encodeURIComponent(collectionId)}/storage/publish`, { method:"POST", body:JSON.stringify(payload) });
    state.lastStorageReceipt = receipt;
    $("#nft-storage-output").textContent = JSON.stringify(receipt, null, 2);
    $("#nft-storage-download").disabled = false;
    setStatus(`Verified IPFS publication complete. Manifest ${receipt.manifest?.uri || "returned"}. No blockchain mint was claimed.`);
  }

  $("#nft-series-form").addEventListener("submit", (event) => createSeries(event).catch((error) => setStatus(error.message)));
  $("#nft-series-update").addEventListener("click", () => updateSeries().catch((error) => setStatus(error.message)));
  $("#nft-series-new").addEventListener("click", clearSeriesForm);
  $("#nft-series-select").addEventListener("change", (event) => loadSeries(event.target.value));
  $("#nft-series-qa").addEventListener("click", () => runQa().catch((error) => setStatus(error.message)));
  $("#nft-series-provenance").addEventListener("click", () => downloadProvenance().catch((error) => setStatus(error.message)));
  $("#nft-market-form").addEventListener("submit", (event) => runMarket(event).catch((error) => setStatus(error.message)));
  $("#nft-storage-plan").addEventListener("click", () => storagePlan().catch((error) => setStatus(error.message)));
  $("#nft-storage-form").addEventListener("submit", (event) => publishStorage(event).catch((error) => setStatus(error.message)));
  $("#nft-storage-download").addEventListener("click", () => { if (state.lastStorageReceipt) downloadJson(state.lastStorageReceipt, `${safeName(state.lastStorageReceipt.collectionId)}-ipfs-publication-receipt.json`); });
  document.querySelector("#nft-refresh")?.addEventListener("click", () => setTimeout(() => refresh().catch((error) => setStatus(error.message)), 100));
  new MutationObserver(() => setTimeout(() => refresh().catch(() => {}), 60)).observe(document.querySelector("#nft-collection-list"), { childList:true, subtree:true });

  const initial = projectInput.value.trim() || new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "";
  if (initial) refresh().catch((error) => setStatus(`NFT Production Director ready. ${error.message}`));
})();
