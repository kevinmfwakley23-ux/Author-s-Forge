(() => {
  "use strict";
  const projectId = "forge-studio";
  const state = { project: null, genome: null };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const showError = (message) => { const el = $("#error-banner"); if (el) { el.textContent = message; el.hidden = false; } };
  const clearError = () => { const el = $("#error-banner"); if (el) el.hidden = true; };

  async function api(path, options = {}) {
    const response = await fetch(path, { headers: { "content-type": "application/json", ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function navigate(route) {
    const requested = String(route || "dashboard").replace(/^#/, "");
    const target = document.getElementById(requested) || document.getElementById("dashboard");
    if (!target) return false;
    $$("[data-view]").forEach((view) => {
      const active = view === target;
      view.classList.toggle("active", active);
      view.hidden = !active;
      view.setAttribute("aria-hidden", String(!active));
    });
    $$("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === target.id));
    if (location.hash !== `#${target.id}`) history.pushState({ route: target.id }, "", `#${target.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  function bindNavigation() {
    document.addEventListener("click", (event) => {
      const element = event.target instanceof Element ? event.target : null;
      const control = element?.closest("[data-route]");
      if (!control) return;
      const route = control.dataset.route;
      if (!route || !document.getElementById(route)) return;
      event.preventDefault();
      navigate(route);
    });
    window.addEventListener("hashchange", () => navigate(location.hash.slice(1) || "dashboard"));
    window.addEventListener("popstate", () => navigate(location.hash.slice(1) || "dashboard"));
  }

  function renderGenome(graph) {
    state.genome = graph;
    $("#genome-list").innerHTML = graph?.nodes?.length ? graph.nodes.map((node) => `<div class="node"><strong>${esc(node.label)}</strong><small>${esc(node.component)}</small></div>`).join("") : "<p class='muted'>No Book Genome has been built yet.</p>";
    $("#impact-node").innerHTML = graph?.nodes?.length ? '<option value="">Select component</option>' + graph.nodes.map((node) => `<option value="${esc(node.id)}">${esc(node.label)}</option>`).join("") : "<option value=\"\">Build the genome first</option>";
  }

  function renderProject(project) {
    state.project = project;
    $("#project-title").textContent = project.metadata.title;
    $("#project-meta").textContent = `${project.metadata.id} • ${project.metadata.status} • ${project.memories.length} memories`;
    const metrics = [["Memories", project.memories.length], ["Characters", project.characters?.length || 0], ["Visual identities", project.visualIdentities?.length || 0], ["Illustrations", project.illustrationAssetLibrary?.assets?.length || 0], ["Series", project.series?.length || 0], ["Audits", project.deliveryAudits?.length || 0]];
    $("#metrics").innerHTML = metrics.map(([label, value]) => `<div class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join("");
    $("#memory-list").innerHTML = project.memories.length ? project.memories.map((m) => `<article class="memory"><strong>${esc(m.summary)}</strong><p>${esc(m.content)}</p><small>${esc(m.authority)} • ${esc(m.provenance[0]?.reference || "unknown")}</small></article>`).join("") : "<p class='muted'>No memories recorded yet.</p>";
    renderGenome(project.bookGenome);
    renderPipeline(project);
  }

  function renderPipeline(project) {
    const stages = ["Concept", "Architecture", "Canon", "Characters", "Manuscript", "Editing", "Research", "Illustrations", "Cover", "Production", "Positioning", "Marketing", "Publishing"];
    const routes = ["writing", "manuscript", "world", "characters", "manuscript", "publishing", "research", "art", "art", "publishing", "marketing", "marketing", "publishing"];
    $("#pipeline").innerHTML = stages.map((name, index) => `<button type="button" class="pipeline-step" data-pipeline="${index}" data-route="${routes[index]}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${name}</strong><small>${pipelineStatus(index, project)}</small></button>`).join("");
  }

  function pipelineStatus(index, project) {
    if (index === 2) return project.memories.some((m) => m.class === "story-canon") ? "Canon present" : "Author-controlled";
    if (index === 7) return project.illustrationAssetLibrary ? "Library connected" : "Ready to connect";
    if (index === 8) return project.bookCoverPlans?.length ? "Plan present" : "Ready to configure";
    if (index === 12) return project.deliveryAudits?.length ? "Audited" : "Awaiting audit";
    return "Workspace ready";
  }

  function renderContextPolicies() {
    const defaults = [["canon", "Full"], ["characters", "Extended"], ["relationships", "Extended"], ["timeline", "Brief"], ["research", "Brief"], ["voice", "Full"], ["unresolved-threads", "Full"]];
    $("#context-policies").innerHTML = defaults.map(([key, mode]) => `<label class="policy"><span>${esc(key)}</span><select data-context-key="${esc(key)}"><option ${mode === "Full" ? "selected" : ""}>Full</option><option ${mode === "Brief" ? "selected" : ""}>Brief</option><option ${mode === "Extended" ? "selected" : ""}>Extended</option><option>Custom</option><option>Off</option></select></label>`).join("");
  }

  async function assembleContext(event) {
    event.preventDefault(); clearError();
    try {
      const policies = $$('[data-context-key]').map((select) => ({ key: select.dataset.contextKey, mode: select.value.toLowerCase() }));
      const result = await api(`/api/projects/${projectId}/context`, { method: "POST", body: JSON.stringify({ query: $("#context-query").value, policies }) });
      $("#context-summary").textContent = `${result.sections.length} sections • ${result.totalWords} words • ${result.sourceIds.length} source records`;
      $("#context-results").innerHTML = result.sections.length ? result.sections.map((section) => `<article class="memory"><strong>${esc(section.title)} · ${esc(section.mode)}</strong><p>${esc(section.text)}</p><small>${esc(section.wordCount)} words • ${esc(section.sourceIds.length)} source records</small></article>`).join("") : "<p class='muted'>No matching context. Add canon, character, timeline, research, voice, or open-thread records first.</p>";
    } catch (error) { showError(error.message); }
  }

  async function refresh() {
    clearError();
    try {
      const [project, governance] = await Promise.all([api(`/api/projects/${projectId}`), api("/api/governance")]);
      renderProject(project);
      $("#ownership").innerHTML = Object.entries(governance.ownership).map(([k, v]) => `<div class="policy"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("");
      $("#accessibility").innerHTML = Object.entries(governance.accessibility).map(([k, v]) => `<div class="policy"><span>${esc(k)}</span><strong>${v ? "Enabled" : "Disabled"}</strong></div>`).join("");
    } catch (error) { showError(error.message); }
  }

  async function saveMemory(event) {
    event.preventDefault(); clearError(); const form = new FormData(event.currentTarget);
    try { await api(`/api/projects/${projectId}/memory`, { method: "POST", body: JSON.stringify({ summary: form.get("summary"), content: form.get("content"), reference: form.get("reference"), authority: form.get("authority") }) }); event.currentTarget.reset(); await refresh(); }
    catch (error) { showError(error.message); }
  }

  async function buildGenome() {
    clearError();
    const nodes = ["premise", "theme", "genre", "voice", "canon", "characters", "relationships", "locations", "timeline", "events", "scenes", "objects", "clues", "reveals", "conflicts", "motivations", "research", "visual-identities", "art", "cover", "metadata", "publishing-state"].map((component) => ({ id: `${component}-root`, component, label: component.replaceAll("-", " "), references: component === "characters" ? ["canon-root"] : component === "relationships" ? ["characters-root"] : component === "scenes" ? ["characters-root", "locations-root", "timeline-root"] : component === "art" ? ["visual-identities-root", "scenes-root"] : component === "cover" ? ["art-root", "metadata-root"] : component === "publishing-state" ? ["metadata-root", "cover-root"] : [], metadata: {} }));
    try { renderGenome(await api(`/api/projects/${projectId}/genome`, { method: "POST", body: JSON.stringify({ nodes }) })); await refresh(); navigate("genome"); }
    catch (error) { showError(error.message); }
  }

  async function analyzeImpact() {
    clearError(); const changedNodeId = $("#impact-node").value;
    if (!changedNodeId) { showError("Select a Book Genome node first."); return; }
    try { const result = await api(`/api/projects/${projectId}/genome/impact`, { method: "POST", body: JSON.stringify({ nodes: state.genome.nodes, changedNodeId })); $("#impact-result").textContent = JSON.stringify(result, null, 2); }
    catch (error) { showError(error.message); }
  }

  async function runAudit() {
    clearError(); const checks = ["canon", "continuity", "timeline", "characters", "pov", "style", "grammar", "formatting", "research", "artwork", "cover", "metadata", "publishing"].map((category) => ({ category, passed: category !== "publishing" || Boolean(state.project?.publishingReadinessReports?.length), message: category !== "publishing" ? "Category is represented in the project audit boundary." : "Publishing readiness evidence is required before delivery.", blocking: category === "publishing" && !Boolean(state.project?.publishingReadinessReports?.length) }));
    try { const result = await api(`/api/projects/${projectId}/delivery-audit`, { method: "POST", body: JSON.stringify({ checks }) }); $("#audit-status").textContent = `${result.passed} checks passed. ${result.attention} require attention. ${result.blocking} blocking.`; $("#audit-results").innerHTML = result.checks.map((c) => `<div class="audit-row ${c.passed ? "pass" : "fail"}"><span>${c.passed ? "✓" : "!"}</span><strong>${esc(c.category)}</strong><p>${esc(c.message)}</p></div>`).join(""); await refresh(); }
    catch (error) { showError(error.message); }
  }

  function initialize() {
    bindNavigation();
    renderContextPolicies();
    $("#refresh").addEventListener("click", refresh);
    $("#memory-form").addEventListener("submit", saveMemory);
    $("#context-form").addEventListener("submit", assembleContext);
    $("#build-genome").addEventListener("click", buildGenome);
    $("#analyze-impact").addEventListener("click", analyzeImpact);
    $("#run-audit").addEventListener("click", runAudit);
    navigate(location.hash.slice(1) || "dashboard");
    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
