/* Durable Story Architecture: idea -> structured candidate -> exact author approval -> Chapter Card seed. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const projectUrl = (suffix = "") => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  const lines = (value) => [...new Set(String(value || "").split(/\r?\n/u).map((item) => item.trim()).filter(Boolean))];
  let snapshot = { candidates: [], approvedArchitectureId: null };
  let selectedId = null;
  let busy = false;

  async function api(path, init = {}) {
    const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Story Architecture request failed (${response.status}).`);
    return payload;
  }
  function notify(message, ok = false) {
    const banner = ok ? $("#success-banner") : $("#error-banner");
    const other = ok ? $("#error-banner") : $("#success-banner");
    if (other) other.hidden = true;
    if (banner) { banner.textContent = message; banner.hidden = false; }
    const local = $("#story-architecture-status");
    if (local) { local.textContent = message; local.dataset.kind = ok ? "success" : "error"; }
  }
  function ensureStyles() {
    if ($("#story-architecture-workflow-styles")) return;
    const style = document.createElement("style");
    style.id = "story-architecture-workflow-styles";
    style.textContent = `
      .story-architecture-workflow{margin-top:1rem}.story-architecture-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.story-architecture-grid label{display:grid;gap:.3rem}.story-architecture-grid textarea,.story-architecture-grid input{width:100%}.story-architecture-wide{grid-column:1/-1}.story-architecture-actions{display:flex;gap:.55rem;flex-wrap:wrap}.story-architecture-actions button{min-height:44px}.story-architecture-status{padding:.65rem .75rem;border:1px solid rgba(127,127,127,.35);border-radius:10px;margin:.7rem 0}.story-architecture-candidates{display:grid;gap:.45rem;margin:.7rem 0}.story-architecture-candidates button{text-align:left;min-height:44px}.story-architecture-json{min-height:190px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85rem}
      @media(max-width:800px){.story-architecture-grid{grid-template-columns:1fr}.story-architecture-wide{grid-column:1}.story-architecture-actions{display:grid;grid-template-columns:1fr}.story-architecture-actions button{width:100%;min-height:44px}}
    `;
    document.head.appendChild(style);
  }
  function ensureUi() {
    const architecture = $("#architecture");
    if (!architecture) return false;
    ensureStyles();
    const oldButton = $("#arch-run");
    if (oldButton) {
      oldButton.textContent = "Build durable architecture with real AI";
      oldButton.title = "Creates structured, durable Story Architecture for review and exact author approval. It does not write manuscript prose or silently promote canon.";
    }
    if ($("#story-architecture-workflow")) return true;
    const article = document.createElement("article");
    article.id = "story-architecture-workflow";
    article.className = "card story-architecture-workflow";
    article.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">DURABLE STORY ARCHITECTURE</div><h3>Review the plan before it governs the book</h3><p class="muted">Forge stores the architecture as structured planning. Editing changes its fingerprint. Only the exact version you explicitly approve can feed Chapter Card generation. Approval can be revoked at any time, does not promote proposed canon into Project Brain, and never writes manuscript prose.</p></div></div>
      <div id="story-architecture-status" class="story-architecture-status" role="status">No durable architecture candidate selected.</div>
      <div id="story-architecture-candidates" class="story-architecture-candidates"></div>
      <form id="story-architecture-form">
        <div class="story-architecture-grid">
          <label class="story-architecture-wide">Premise<textarea id="story-architecture-premise" maxlength="8000"></textarea></label>
          <label>Themes <small>one per line</small><textarea id="story-architecture-themes" maxlength="30000"></textarea></label>
          <label>Audience<textarea id="story-architecture-audience" maxlength="4000"></textarea></label>
          <label>Genre expectations <small>one per line</small><textarea id="story-architecture-genre" maxlength="40000"></textarea></label>
          <label>Canon candidates <small>proposals only; one per line</small><textarea id="story-architecture-canon" maxlength="100000"></textarea></label>
          <label>Character candidates <small>one per line</small><textarea id="story-architecture-characters" maxlength="100000"></textarea></label>
          <label>Locations <small>one per line</small><textarea id="story-architecture-locations" maxlength="100000"></textarea></label>
          <label>Timeline considerations <small>one per line</small><textarea id="story-architecture-timeline" maxlength="100000"></textarea></label>
          <label>Assumptions <small>kept visible; one per line</small><textarea id="story-architecture-assumptions" maxlength="100000"></textarea></label>
          <label>Unresolved questions <small>one per line</small><textarea id="story-architecture-questions" maxlength="100000"></textarea></label>
          <label class="story-architecture-wide">Production risks <small>one per line</small><textarea id="story-architecture-risks" maxlength="100000"></textarea></label>
          <label class="story-architecture-wide">Chapter plan JSON<textarea id="story-architecture-chapters" class="story-architecture-json" spellcheck="false"></textarea></label>
          <label class="story-architecture-wide">Scene plan JSON<textarea id="story-architecture-scenes" class="story-architecture-json" spellcheck="false"></textarea></label>
        </div>
        <div class="story-architecture-actions"><button class="primary" type="submit">Save architecture edits</button><button id="story-architecture-approve" type="button">Approve exact architecture</button><button id="story-architecture-revoke" type="button">Revoke approval</button><button id="story-architecture-seed" class="primary" type="button">Use approved architecture for Chapter Cards</button><button id="story-architecture-refresh" type="button">Refresh</button></div>
      </form>`;
    architecture.appendChild(article);
    $("#story-architecture-form")?.addEventListener("submit", saveEdits);
    $("#story-architecture-approve")?.addEventListener("click", () => void approveSelected());
    $("#story-architecture-revoke")?.addEventListener("click", () => void revokeSelected());
    $("#story-architecture-seed")?.addEventListener("click", () => void seedChapterCards());
    $("#story-architecture-refresh")?.addEventListener("click", () => void refresh());
    return true;
  }
  function candidate() { return snapshot.candidates?.find((item) => item.id === selectedId) || snapshot.candidates?.[0] || null; }
  function readable(plan) {
    if (!plan) return "";
    const chapterLines = (plan.chapterPlan || []).map((chapter) => `Chapter ${chapter.number}: ${chapter.title} — ${chapter.summary}`);
    const sceneLines = (plan.scenePlan || []).map((scene) => `Ch ${scene.chapterNumber} · ${scene.title}: ${scene.summary}`);
    return [
      `Premise: ${plan.premise}`,
      `Themes: ${(plan.themes || []).join(", ")}`,
      `Audience: ${plan.audience}`,
      plan.genreExpectations?.length ? `Genre expectations:\n${plan.genreExpectations.map((item) => `- ${item}`).join("\n")}` : "",
      plan.canonCandidates?.length ? `Canon candidates (not Project Brain canon):\n${plan.canonCandidates.map((item) => `- ${item}`).join("\n")}` : "",
      plan.assumptions?.length ? `Assumptions:\n${plan.assumptions.map((item) => `- ${item}`).join("\n")}` : "",
      chapterLines.length ? `Chapter plan:\n${chapterLines.join("\n")}` : "",
      sceneLines.length ? `Scene plan:\n${sceneLines.join("\n")}` : "",
      plan.unresolvedQuestions?.length ? `Unresolved questions:\n${plan.unresolvedQuestions.map((item) => `- ${item}`).join("\n")}` : "",
      plan.productionRisks?.length ? `Production risks:\n${plan.productionRisks.map((item) => `- ${item}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");
  }
  function render() {
    ensureUi();
    const host = $("#story-architecture-candidates");
    if (host) {
      host.innerHTML = (snapshot.candidates || []).slice(0, 8).map((item) => {
        const state = item.approved ? "APPROVED" : item.approvalStale ? "STALE APPROVAL" : "UNAPPROVED";
        const updated = Number.isNaN(Date.parse(item.updatedAt)) ? "unknown time" : new Date(item.updatedAt).toLocaleString();
        return `<button type="button" data-architecture-candidate="${esc(item.id)}"><strong>${esc(state)}</strong> · ${esc(item.kind)} · ${(item.plan?.chapterPlan || []).length} chapters<br><small>${esc(item.provider)} · ${esc(item.model)} · ${esc(updated)}</small></button>`;
      }).join("") || '<p class="muted">Generate architecture from the idea box above.</p>';
    }
    const item = candidate();
    if (!item) {
      $("#story-architecture-form")?.reset();
      $("#story-architecture-status").textContent = "No durable architecture candidate selected.";
      if ($("#story-architecture-approve")) $("#story-architecture-approve").disabled = true;
      if ($("#story-architecture-revoke")) $("#story-architecture-revoke").disabled = true;
      if ($("#story-architecture-seed")) $("#story-architecture-seed").disabled = true;
      return;
    }
    selectedId = item.id;
    const plan = item.plan || {};
    $("#story-architecture-premise").value = plan.premise || "";
    $("#story-architecture-themes").value = (plan.themes || []).join("\n");
    $("#story-architecture-audience").value = plan.audience || "";
    $("#story-architecture-genre").value = (plan.genreExpectations || []).join("\n");
    $("#story-architecture-canon").value = (plan.canonCandidates || []).join("\n");
    $("#story-architecture-characters").value = (plan.characterCandidates || []).join("\n");
    $("#story-architecture-locations").value = (plan.locations || []).join("\n");
    $("#story-architecture-timeline").value = (plan.timelineConsiderations || []).join("\n");
    $("#story-architecture-assumptions").value = (plan.assumptions || []).join("\n");
    $("#story-architecture-questions").value = (plan.unresolvedQuestions || []).join("\n");
    $("#story-architecture-risks").value = (plan.productionRisks || []).join("\n");
    $("#story-architecture-chapters").value = JSON.stringify(plan.chapterPlan || [], null, 2);
    $("#story-architecture-scenes").value = JSON.stringify(plan.scenePlan || [], null, 2);
    $("#arch-result").textContent = readable(plan);
    const status = item.approved
      ? `Approved exact architecture ${String(item.planSha256 || "").slice(0, 12)}…${item.approvedAt ? ` · ${new Date(item.approvedAt).toLocaleString()}` : ""}. It may seed Chapter Cards.`
      : item.approvalStale
        ? "Approval is stale because this architecture was edited after approval. Review and approve the current version before downstream use, or revoke the old approval explicitly."
        : "Durable candidate saved but not approved. Review/edit it before downstream use.";
    $("#story-architecture-status").textContent = status;
    $("#story-architecture-approve").disabled = Boolean(item.approved);
    $("#story-architecture-revoke").disabled = !(item.approved || item.approvalStale);
    $("#story-architecture-seed").disabled = !item.approved;
  }
  async function refresh(preferredId) {
    if (!ensureUi()) return;
    snapshot = await api(projectUrl("/story-architecture"));
    if (preferredId && snapshot.candidates?.some((item) => item.id === preferredId)) selectedId = preferredId;
    else if (!selectedId || !snapshot.candidates?.some((item) => item.id === selectedId)) selectedId = snapshot.candidates?.[0]?.id || null;
    render();
  }
  async function generate() {
    if (busy) return;
    busy = true;
    const button = $("#arch-run");
    if (button) button.disabled = true;
    try {
      const idea = $("#arch-idea")?.value.trim();
      if (!idea) throw new Error("Describe the book idea before building Story Architecture.");
      const rawTarget = $("#arch-target")?.value || "";
      const targetChapters = rawTarget ? Number(rawTarget) : undefined;
      notify("Forge is building structured Story Architecture from the author idea and Project Brain…", true);
      const result = await api(projectUrl("/story-architecture/generate"), {
        method: "POST",
        body: JSON.stringify({ idea, kind: $("#arch-kind")?.value || "novel", ...(targetChapters === undefined ? {} : { targetChapters }) }),
      });
      await refresh(result.candidate.id);
      notify("Story Architecture saved as durable unapproved planning. Nothing was added to manuscript or Project Brain canon.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
    finally { busy = false; if (button) button.disabled = false; }
  }
  function editedPlan() {
    let chapterPlan, scenePlan;
    try { chapterPlan = JSON.parse($("#story-architecture-chapters").value || "[]"); }
    catch { throw new Error("Chapter plan must be valid JSON before Story Architecture can be saved."); }
    try { scenePlan = JSON.parse($("#story-architecture-scenes").value || "[]"); }
    catch { throw new Error("Scene plan must be valid JSON before Story Architecture can be saved."); }
    return {
      premise: $("#story-architecture-premise").value,
      themes: lines($("#story-architecture-themes").value),
      audience: $("#story-architecture-audience").value,
      genreExpectations: lines($("#story-architecture-genre").value),
      canonCandidates: lines($("#story-architecture-canon").value),
      characterCandidates: lines($("#story-architecture-characters").value),
      locations: lines($("#story-architecture-locations").value),
      timelineConsiderations: lines($("#story-architecture-timeline").value),
      assumptions: lines($("#story-architecture-assumptions").value),
      chapterPlan,
      scenePlan,
      unresolvedQuestions: lines($("#story-architecture-questions").value),
      productionRisks: lines($("#story-architecture-risks").value),
    };
  }
  async function saveEdits(event) {
    event.preventDefault();
    const item = candidate();
    if (!item) return notify("Generate or select Story Architecture first.");
    try {
      snapshot = await api(projectUrl(`/story-architecture/candidates/${encodeURIComponent(item.id)}`), { method: "PUT", body: JSON.stringify({ plan: editedPlan() }) });
      selectedId = item.id;
      render();
      notify("Story Architecture edits saved. Any prior approval is valid only if this exact fingerprint still matches.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }
  async function approveSelected() {
    const item = candidate();
    if (!item) return notify("Generate or select Story Architecture first.");
    if (!window.confirm("Approve this exact Story Architecture for downstream Chapter Card planning? This does not promote canon candidates into Project Brain and does not write manuscript prose.")) return;
    try {
      snapshot = await api(projectUrl(`/story-architecture/candidates/${encodeURIComponent(item.id)}/approve`), { method: "POST", body: JSON.stringify({ authorApproved: true }) });
      selectedId = item.id;
      render();
      notify("Exact Story Architecture approved by the author. It can now seed Chapter Cards.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }
  async function revokeSelected() {
    const item = candidate();
    if (!item || !(item.approved || item.approvalStale)) return notify("This Story Architecture has no approval to revoke.");
    if (!window.confirm("Revoke this Story Architecture approval? The plan will remain saved, but it will no longer be allowed to seed Chapter Cards until you approve it again.")) return;
    try {
      snapshot = await api(projectUrl(`/story-architecture/candidates/${encodeURIComponent(item.id)}/revoke`), { method: "POST", body: "{}" });
      selectedId = item.id;
      render();
      notify("Story Architecture approval revoked. The saved plan remains available for editing and later review.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }
  async function seedChapterCards() {
    const item = candidate();
    if (!item?.approved) return notify("Approve the exact current Story Architecture before handing it to Chapter Cards.");
    try {
      const seed = await api(projectUrl(`/story-architecture/candidates/${encodeURIComponent(item.id)}/chapter-card-seed`), { method: "POST", body: "{}" });
      window.dispatchEvent(new Event("forge:workspace-ready"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      const brief = $("#chapter-card-workflow-brief"), events = $("#chapter-card-workflow-events"), timeline = $("#chapter-card-workflow-timeline"), target = $("#chapter-card-workflow-target");
      if (!brief || !events || !timeline || !target) throw new Error("Chapter Card workflow is not available in the Story Architecture workplace.");
      brief.value = seed.description || "";
      events.value = (seed.events || []).join("\n");
      timeline.value = (seed.timelineDetails || []).join("\n");
      target.value = String(seed.targetChapters || "");
      $("#chapter-card-workflow")?.scrollIntoView({ behavior: "smooth", block: "start" });
      notify("Approved Story Architecture handed to Chapter Cards. Review the seeded brief/events/timeline, then generate Chapter Cards when ready.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  document.addEventListener("click", (event) => {
    const archRun = event.target instanceof Element ? event.target.closest("#arch-run") : null;
    if (archRun) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void generate();
      return;
    }
    const choice = event.target instanceof Element ? event.target.closest("[data-architecture-candidate]") : null;
    if (choice) { selectedId = choice.getAttribute("data-architecture-candidate"); render(); }
  }, true);
  window.addEventListener("forge:workspace-ready", () => { if ($("#story-architecture-workflow")) void refresh(); });
  window.addEventListener("hashchange", () => { if (location.hash === "#architecture") void refresh(); });
  async function boot() { if (ensureUi()) await refresh().catch((error) => notify(error.message)); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void boot(), { once: true }); else void boot();
})();
