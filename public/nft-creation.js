(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const status = $("#nft-status");
  const projectIdInput = $("#nft-project-id");
  const mainStudio = $("#nft-main-studio");
  const state = {
    projectId: new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "",
    collections: [],
    current: null,
    pendingArtwork: new Map(),
    launchPackage: null,
  };

  function setStatus(message) { status.textContent = message || ""; }
  function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char])); }
  function lines(value) { return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
  function safeName(value) { return String(value || "forge-nft").trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "forge-nft"; }
  function requireProjectId() { const id = projectIdInput.value.trim() || state.projectId; if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Project ID may contain only letters, numbers, hyphens, and underscores."); return id; }
  function requireCollection() { if (!state.current) throw new Error("Open an NFT collection first."); return state.current; }
  function officeBase() { return `/api/projects/${encodeURIComponent(requireProjectId())}/nft`; }
  function collectionBase() { return `${officeBase()}/${encodeURIComponent(requireCollection().id)}`; }
  function studioUrl(projectId) { const port = location.port === "4573" ? "4173" : (location.port || "4173"); return `${location.protocol}//${location.hostname}:${port}/?project=${encodeURIComponent(projectId)}#dashboard`; }

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { throw new Error(`Invalid NFT Office server response (${response.status}).`); }
    if (!response.ok) throw new Error(payload.error || `NFT Office request failed (${response.status}).`);
    return payload;
  }

  function selectView(name) {
    $$('[data-nft-view]').forEach((view) => view.hidden = view.id !== `nft-view-${name}`);
    $$('#nft-tabs [data-view]').forEach((button) => button.classList.toggle("active", button.dataset.view === name));
    if (name === "metadata" && state.current) runPreflight().catch((error) => setStatus(error.message));
  }

  function renderAll() {
    renderCollections();
    renderCurrent();
    renderStrategy();
    renderTraits();
    renderRarity();
    renderGallery();
    renderLaunch();
    renderProposals();
    renderMetrics();
  }

  function renderCollections() {
    const host = $("#nft-collection-list");
    host.innerHTML = state.collections.length ? state.collections.map((collection) => `<div class="nft-list-item"><button type="button" data-open-nft="${esc(collection.id)}"><strong>${esc(collection.title)}</strong><br><span class="nft-muted">${esc(collection.tokenStandard)} · ${esc(collection.chain)} · ${collection.supply} item${collection.supply === 1 ? "" : "s"}</span></button></div>`).join("") : '<p class="nft-muted">No NFT collections in this Forge project yet.</p>';
    $$('[data-open-nft]').forEach((button) => button.addEventListener("click", () => openCollection(button.dataset.openNft).catch((error) => setStatus(error.message))));
  }

  function renderCurrent() {
    const current = state.current;
    $("#nft-current-title").textContent = current?.title || "No collection selected";
    $("#nft-current-meta").textContent = current ? `${current.symbol} · ${current.collectionType} · ${current.tokenStandard} · ${current.chain} · supply ${current.supply} · ${current.storageMode}` : "Create or open a collection to begin.";
  }

  function renderMetrics(report) {
    const current = state.current;
    const approved = current?.items?.filter((item) => item.artworkStatus === "approved").length || 0;
    const values = [current?.title || "—", report ? `${report.collectorReadiness}%` : "—", String(current?.items?.length || 0), String(approved)];
    $$("#nft-metrics .nft-metric strong").forEach((node, index) => { node.textContent = values[index] || "—"; });
  }

  function renderStrategy() {
    const current = state.current;
    $("#nft-strategy-summary").textContent = current ? JSON.stringify({
      audience: current.audience,
      artisticThesis: current.artisticThesis,
      styleGuide: current.styleGuide,
      lore: current.lore,
      rightsNote: current.rightsNote,
      externalUrl: current.externalUrl || "",
      royaltyBps: current.royaltyBps,
      storageMode: current.storageMode,
    }, null, 2) : "No collection selected.";
  }

  function renderTraits() {
    if (!state.current) return;
    if (state.current.traits?.length) $("#nft-traits-json").value = JSON.stringify(state.current.traits, null, 2);
  }

  function renderRarity() {
    const current = state.current;
    if (!current?.items?.length) { $("#nft-rarity-output").textContent = "Generate a manifest to calculate actual frequencies and rarity ranks."; return; }
    const frequencies = {};
    for (const item of current.items) for (const attribute of item.attributes || []) {
      const key = `${attribute.traitType}: ${attribute.value}`;
      frequencies[key] = (frequencies[key] || 0) + 1;
    }
    const rarest = [...current.items].sort((a, b) => a.rarityRank - b.rarityRank).slice(0, 20).map((item) => ({ tokenId: item.tokenId, rank: item.rarityRank, rarityScore: item.rarityScore, attributes: Object.fromEntries((item.attributes || []).map((a) => [a.traitType, a.value])) }));
    $("#nft-rarity-output").textContent = JSON.stringify({ supply: current.supply, frequencies, rarest }, null, 2);
  }

  function filteredItems() {
    const current = state.current;
    if (!current?.items) return [];
    const filter = $("#nft-gallery-filter").value;
    const items = current.items.filter((item) => filter === "all" || (filter === "missing" ? item.artworkStatus !== "approved" : item.artworkStatus === "approved"));
    return items.slice(0, 200);
  }

  function renderGallery() {
    const host = $("#nft-gallery");
    const current = state.current;
    if (!current?.items?.length) { host.innerHTML = '<p class="nft-muted">Generate the trait manifest first. Each manifest item becomes an art direction target.</p>'; return; }
    const items = filteredItems();
    host.innerHTML = items.map((item) => {
      const candidate = state.pendingArtwork.get(item.tokenId);
      const art = candidate?.url || item.imageUri;
      const traits = (item.attributes || []).map((attribute) => `${attribute.traitType}: ${attribute.value}`).join(" · ") || "One-of-one";
      return `<article class="nft-token" data-token-card="${esc(item.tokenId)}"><div class="nft-token-art">${art ? `<img src="${esc(art)}" alt="${esc(item.name)} artwork">` : `<span>#${esc(item.tokenId)}</span>`}</div><div class="nft-token-body"><h4>${esc(item.name)}</h4><p class="nft-muted">Rarity #${item.rarityRank} · ${esc(traits)}</p><p>${candidate ? `<span class="nft-pill">AI candidate · ${esc(candidate.provider)}/${esc(candidate.model)}</span>` : item.artworkStatus === "approved" ? '<span class="nft-pill nft-good">Approved artwork</span>' : '<span class="nft-pill nft-warn">Artwork needed</span>'}</p>${candidate ? `<div class="nft-row"><button type="button" class="primary" data-approve-art="${esc(item.tokenId)}">Approve art</button><button type="button" data-reject-art="${esc(item.tokenId)}">Reject</button></div>` : item.artworkStatus === "approved" ? "" : `<div class="nft-row"><button type="button" class="primary" data-generate-art="${esc(item.tokenId)}">Generate AI candidate</button></div>`}</div></article>`;
    }).join("") + (current.items.length > 200 ? `<p class="nft-muted">Showing first 200 matching tokens of ${current.items.length}. Use metadata export for the complete manifest.</p>` : "");
    $$('[data-generate-art]').forEach((button) => button.addEventListener("click", () => generateArtwork(button.dataset.generateArt).catch((error) => setStatus(error.message))));
    $$('[data-approve-art]').forEach((button) => button.addEventListener("click", () => reviewArtwork(button.dataset.approveArt, "approve").catch((error) => setStatus(error.message))));
    $$('[data-reject-art]').forEach((button) => button.addEventListener("click", () => reviewArtwork(button.dataset.rejectArt, "reject").catch((error) => setStatus(error.message))));
  }

  function renderLaunch() {
    const current = state.current;
    const form = $("#nft-launch-form");
    if (!current?.launchPlan) return;
    form.elements.mintType.value = current.launchPlan.mintType;
    form.elements.reveal.value = current.launchPlan.reveal;
    form.elements.story.value = current.launchPlan.story;
    form.elements.phases.value = JSON.stringify(current.launchPlan.phases || [], null, 2);
    form.elements.roadmap.value = (current.launchPlan.roadmap || []).join("\n");
    form.elements.communityPlan.value = (current.launchPlan.communityPlan || []).join("\n");
  }

  function renderProposals() {
    const host = $("#nft-proposals");
    const proposals = state.current?.proposals || [];
    host.innerHTML = proposals.length ? [...proposals].reverse().map((proposal) => `<article class="nft-list-item nft-proposal"><div class="nft-row"><strong class="grow">${esc(proposal.kind)} · ${esc(proposal.status)}</strong><span class="nft-pill">${esc(proposal.provider)}/${esc(proposal.model)}</span></div><p>${esc(proposal.summary)}</p><details><summary>Payload</summary><pre class="nft-code">${esc(JSON.stringify(proposal.payload, null, 2))}</pre></details>${proposal.status === "proposed" ? `<div class="nft-row"><button type="button" class="primary" data-proposal-approve-apply="${esc(proposal.id)}">Approve + apply</button><button type="button" data-proposal-approve="${esc(proposal.id)}">Approve only</button><button type="button" class="danger" data-proposal-reject="${esc(proposal.id)}">Reject</button></div>` : ""}</article>`).join("") : '<p class="nft-muted">No proposals yet. AI work stays reviewable until you approve it.</p>';
    $$('[data-proposal-approve-apply]').forEach((button) => button.addEventListener("click", () => reviewProposal(button.dataset.proposalApproveApply, "approve", true).catch((error) => setStatus(error.message))));
    $$('[data-proposal-approve]').forEach((button) => button.addEventListener("click", () => reviewProposal(button.dataset.proposalApprove, "approve", false).catch((error) => setStatus(error.message))));
    $$('[data-proposal-reject]').forEach((button) => button.addEventListener("click", () => reviewProposal(button.dataset.proposalReject, "reject", false).catch((error) => setStatus(error.message))));
  }

  function setProject(id) {
    state.projectId = id;
    projectIdInput.value = id;
    localStorage.setItem("forge-project", id);
    history.replaceState(null, "", `?project=${encodeURIComponent(id)}`);
    mainStudio.href = studioUrl(id);
  }

  async function loadProject(id = requireProjectId()) {
    setStatus(`Loading Forge project ${id} and NFT collections…`);
    setProject(id);
    const payload = await api(`/api/projects/${encodeURIComponent(id)}/nft`);
    state.collections = payload.collections || [];
    if (state.current) state.current = state.collections.find((collection) => collection.id === state.current.id) || null;
    if (!state.current && state.collections.length) await openCollection(state.collections[0].id, false);
    else renderAll();
    setStatus(`NFT Creation Office connected to ${payload.project?.title || id}. ${state.collections.length} collection(s).`);
  }

  async function openCollection(id, announce = true) {
    state.current = await api(`${officeBase()}/${encodeURIComponent(id)}`);
    state.launchPackage = null;
    state.pendingArtwork.clear();
    renderAll();
    if (announce) setStatus(`Opened ${state.current.title}.`);
  }

  async function saveTraits() {
    requireCollection();
    let traits;
    try { traits = JSON.parse($("#nft-traits-json").value); } catch { throw new Error("Trait Lab JSON is invalid."); }
    if (!Array.isArray(traits)) throw new Error("Trait Lab JSON must be an array.");
    state.current = await api(`${collectionBase()}/traits`, { method: "PUT", body: JSON.stringify({ traits }) });
    syncCurrentInList();
    renderAll();
    setStatus("Trait system validated and saved. Existing generated items were intentionally invalidated; regenerate the manifest next.");
  }

  async function generateManifest() {
    requireCollection();
    setStatus("Generating deterministic unique trait manifest and rarity ranks…");
    state.current = await api(`${collectionBase()}/manifest`, { method: "POST", body: "{}" });
    syncCurrentInList();
    renderAll();
    setStatus(`Generated ${state.current.items.length} unique NFT manifest item(s) from seed "${state.current.seed}".`);
  }

  async function generateArtwork(tokenId) {
    requireCollection();
    const instruction = prompt("Optional art direction for this token. Leave blank to use the collection bible and traits.", "") ?? null;
    if (instruction === null) return;
    setStatus(`Generating a real Image Lab candidate for token ${tokenId}…`);
    const candidate = await api(`${collectionBase()}/art/${encodeURIComponent(tokenId)}/generate`, { method: "POST", body: JSON.stringify({ instruction, size: "2048x2048", quality: "high" }) });
    state.pendingArtwork.set(String(tokenId), candidate);
    renderGallery();
    setStatus(`AI artwork candidate ready for token ${tokenId} via ${candidate.provider}/${candidate.model}. It is not attached until you approve it.`);
  }

  async function reviewArtwork(tokenId, action) {
    const candidate = state.pendingArtwork.get(String(tokenId));
    if (!candidate) throw new Error("No pending artwork candidate exists for this token.");
    setStatus(`${action === "approve" ? "Approving" : "Rejecting"} artwork candidate for token ${tokenId}…`);
    state.current = await api(`${collectionBase()}/art/${encodeURIComponent(tokenId)}/${encodeURIComponent(candidate.assetId)}/${action}`, { method: "POST", body: "{}" });
    state.pendingArtwork.delete(String(tokenId));
    syncCurrentInList();
    renderAll();
    setStatus(action === "approve" ? `Artwork approved and attached to token ${tokenId}.` : `Artwork candidate rejected for token ${tokenId}.`);
  }

  async function saveLaunchPlan(event) {
    event.preventDefault();
    requireCollection();
    const form = event.currentTarget;
    let phases = [];
    if (form.elements.phases.value.trim()) { try { phases = JSON.parse(form.elements.phases.value); } catch { throw new Error("Mint phases JSON is invalid."); } }
    if (!Array.isArray(phases)) throw new Error("Mint phases must be a JSON array.");
    const launchPlan = { mintType: form.elements.mintType.value, reveal: form.elements.reveal.value, phases, story: form.elements.story.value, roadmap: lines(form.elements.roadmap.value), communityPlan: lines(form.elements.communityPlan.value) };
    state.current = await api(`${collectionBase()}/launch-plan`, { method: "PUT", body: JSON.stringify({ launchPlan }) });
    syncCurrentInList(); renderAll(); setStatus("Mint/reveal/community launch plan saved.");
  }

  async function createAiProposal(event) {
    event.preventDefault();
    requireCollection();
    const form = event.currentTarget;
    setStatus("Running the NFT request through Forge Brain and the shared AI model broker…");
    const result = await api(`${collectionBase()}/ai/propose`, { method: "POST", body: JSON.stringify({ kind: form.elements.kind.value, instruction: form.elements.instruction.value }) });
    state.current = result.collection;
    syncCurrentInList(); renderAll();
    setStatus(`AI proposal created with ${result.ai.provider}/${result.ai.model}. Nothing was auto-approved.`);
  }

  async function reviewProposal(id, action, apply) {
    requireCollection();
    const suffix = action === "approve" ? "approve" : "reject";
    state.current = await api(`${collectionBase()}/ai/proposals/${encodeURIComponent(id)}/${suffix}`, { method: "POST", body: JSON.stringify({ apply }) });
    syncCurrentInList(); renderAll(); setStatus(`AI proposal ${action === "approve" ? "approved" : "rejected"}${action === "approve" && apply ? " and validated fields applied" : ""}.`);
  }

  async function runPreflight() {
    if (!state.current) return;
    const report = await api(`${collectionBase()}/preflight`);
    renderMetrics(report);
    $("#nft-readiness-score").textContent = `${report.collectorReadiness}%`;
    const host = $("#nft-preflight");
    host.innerHTML = `<div class="nft-row"><span class="nft-pill ${report.errors ? "nft-bad" : "nft-good"}">${report.errors} error(s)</span><span class="nft-pill ${report.warnings ? "nft-warn" : "nft-good"}">${report.warnings} warning(s)</span><span class="nft-pill">metadata ${report.readyForMetadata ? "ready" : "blocked"}</span><span class="nft-pill">launch package ${report.readyForLaunchPackage ? "ready" : "blocked"}</span></div>${report.issues.length ? report.issues.map((issue) => `<div class="nft-issue"><code class="${issue.severity === "error" ? "nft-bad" : issue.severity === "warning" ? "nft-warn" : "nft-muted"}">${esc(issue.code)}</code><span>${esc(issue.message)}${issue.tokenId ? ` · token ${esc(issue.tokenId)}` : ""}</span></div>`).join("") : '<p class="nft-good">No blocking NFT production issues detected.</p>'}<p class="nft-muted">Readiness signals: ${esc((report.readinessSignals || []).join(" · ") || "none yet")}</p>`;
    return report;
  }

  async function buildLaunchPackage() {
    requireCollection();
    setStatus("Building standards-aware metadata and launch package…");
    state.launchPackage = await api(`${collectionBase()}/launch-package`, { method: "POST", body: "{}" });
    $("#nft-package-preview").textContent = JSON.stringify({ collection: state.launchPackage.collection, preflight: state.launchPackage.preflight, storage: state.launchPackage.storage, contractGuidance: state.launchPackage.contractGuidance, metadataFileCount: state.launchPackage.metadataFiles?.length, launchPlan: state.launchPackage.launchPlan, notes: state.launchPackage.notes }, null, 2);
    $("#nft-download-package").disabled = false;
    $("#nft-download-csv").disabled = false;
    setStatus(`Launch package built with ${state.launchPackage.metadataFiles.length} metadata record(s). No mint or upload was claimed.`);
  }

  function downloadBlob(blob, fileName) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = fileName; a.hidden = true; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200); }
  function downloadPackage() { if (!state.launchPackage) return; downloadBlob(new Blob([`${JSON.stringify(state.launchPackage, null, 2)}\n`], { type: "application/json" }), `${safeName(state.current?.title)}-nft-launch-package.json`); }
  function downloadCsv() { if (!state.launchPackage) return; downloadBlob(new Blob([state.launchPackage.marketplaceCsv], { type: "text/csv" }), `${safeName(state.current?.title)}-metadata.csv`); }

  function syncCurrentInList() {
    if (!state.current) return;
    const index = state.collections.findIndex((collection) => collection.id === state.current.id);
    if (index >= 0) state.collections[index] = state.current; else state.collections.push(state.current);
  }

  async function createProject(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.id.value.trim();
    setStatus(`Creating Forge project ${id}…`);
    await api("/api/projects", { method: "POST", body: JSON.stringify({ id, title: form.elements.title.value }) });
    setProject(id); state.collections = []; state.current = null; renderAll(); setStatus(`Forge project ${id} created. Create the NFT collection next.`);
  }

  async function createCollection(event) {
    event.preventDefault();
    const id = requireProjectId();
    const form = event.currentTarget;
    setStatus("Creating durable NFT collection workspace…");
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.supply = Number(payload.supply);
    payload.royaltyBps = Number(payload.royaltyBps);
    const created = await api(`/api/projects/${encodeURIComponent(id)}/nft`, { method: "POST", body: JSON.stringify(payload) });
    state.collections.push(created); state.current = created; state.launchPackage = null; state.pendingArtwork.clear(); renderAll(); setStatus(`Created NFT collection ${created.title}.`);
  }

  function bind() {
    $$('#nft-tabs [data-view]').forEach((button) => button.addEventListener("click", () => selectView(button.dataset.view)));
    $("#nft-project-form").addEventListener("submit", (event) => createProject(event).catch((error) => setStatus(error.message)));
    $("#nft-open-project").addEventListener("click", () => loadProject().catch((error) => setStatus(error.message)));
    $("#nft-collection-form").addEventListener("submit", (event) => createCollection(event).catch((error) => setStatus(error.message)));
    $("#nft-refresh").addEventListener("click", () => loadProject().catch((error) => setStatus(error.message)));
    $("#nft-save-traits").addEventListener("click", () => saveTraits().catch((error) => setStatus(error.message)));
    $("#nft-generate-manifest").addEventListener("click", () => generateManifest().catch((error) => setStatus(error.message)));
    $("#nft-gallery-filter").addEventListener("change", renderGallery);
    $("#nft-launch-form").addEventListener("submit", (event) => saveLaunchPlan(event).catch((error) => setStatus(error.message)));
    $("#nft-ai-form").addEventListener("submit", (event) => createAiProposal(event).catch((error) => setStatus(error.message)));
    $("#nft-preflight-top").addEventListener("click", () => { selectView("metadata"); runPreflight().catch((error) => setStatus(error.message)); });
    $("#nft-build-package").addEventListener("click", () => buildLaunchPackage().catch((error) => setStatus(error.message)));
    $("#nft-download-package").addEventListener("click", downloadPackage);
    $("#nft-download-csv").addEventListener("click", downloadCsv);
    projectIdInput.value = state.projectId;
    if (state.projectId) { setProject(state.projectId); loadProject(state.projectId).catch((error) => setStatus(`NFT Office ready. ${error.message}`)); }
    else { mainStudio.href = studioUrl("forge-studio"); renderAll(); setStatus("Open or create a Forge project to begin the NFT Creation Office."); }
  }

  bind();
})();
