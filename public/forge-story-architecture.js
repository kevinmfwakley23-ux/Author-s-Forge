/* Durable Story Architecture: idea -> structured candidate -> exact author approval -> Chapter Card seed. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const projectUrl = (suffix = "") => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  const lines = (value) => [...new Set(String(value || "").split(/\r?\n/u).map((item) => item.trim()).filter(Boolean))];
  let snapshot = { candidates: [], approvedArchitectureId: null };
  let templates = { builtIn: [], installed: [] };
  let selectedId = null;
  let selectedTemplateId = "";
  let templateEditorMode = "selected";
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
      .story-architecture-workflow{margin-top:1rem}.story-architecture-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.story-architecture-grid label{display:grid;gap:.3rem}.story-architecture-grid textarea,.story-architecture-grid input,.story-architecture-grid select{width:100%}.story-architecture-wide{grid-column:1/-1}.story-architecture-actions{display:flex;gap:.55rem;flex-wrap:wrap}.story-architecture-actions button{min-height:44px}.story-architecture-status{padding:.65rem .75rem;border:1px solid rgba(127,127,127,.35);border-radius:10px;margin:.7rem 0}.story-architecture-candidates{display:grid;gap:.45rem;margin:.7rem 0}.story-architecture-candidates button{text-align:left;min-height:44px}.story-architecture-json{min-height:190px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85rem}.story-template-panel{margin:.8rem 0;padding:.8rem;border:1px solid rgba(127,127,127,.32);border-radius:12px}.story-template-panel select{width:100%;min-height:44px}.story-template-editor{margin-top:.7rem}.story-template-editor summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:700}.story-template-meta{margin:.45rem 0;white-space:pre-wrap}.story-template-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem}.story-template-actions button{min-height:44px}
      @media(max-width:800px){.story-architecture-grid{grid-template-columns:1fr}.story-architecture-wide{grid-column:1}.story-architecture-actions,.story-template-actions{display:grid;grid-template-columns:1fr}.story-architecture-actions button,.story-template-actions button{width:100%;min-height:44px}}
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
      <div class="section-title"><div><div class="eyebrow">DURABLE STORY ARCHITECTURE</div><h3>Review the plan before it governs the book</h3><p class="muted">Forge stores architecture as structured planning. Templates are optional guidance, never canon. Editing a generated plan changes its fingerprint; only the exact version you explicitly approve can feed Chapter Cards.</p></div></div>
      <section class="story-template-panel" aria-labelledby="story-template-heading">
        <h4 id="story-template-heading">Story structure template</h4>
        <p class="muted">Choose no template, an immutable Forge built-in, or a versioned project template. The exact template/version used is recorded on the generated architecture candidate.</p>
        <label>Template for the next generation<select id="story-template-select"><option value="">No template — derive structure from my idea</option></select></label>
        <p id="story-template-meta" class="story-template-meta muted">No template selected.</p>
        <div class="story-template-actions"><button id="story-template-install" type="button" disabled>Install editable project copy</button><button id="story-template-new" type="button">Create project template</button></div>
        <details id="story-template-editor" class="story-template-editor">
          <summary>Project template editor</summary>
          <form id="story-template-form">
            <div class="story-architecture-grid">
              <label>Title<input id="story-template-title" maxlength="160" required></label>
              <label>Book kinds <small>one per line</small><textarea id="story-template-kinds" maxlength="4000"></textarea></label>
              <label class="story-architecture-wide">Description<textarea id="story-template-description" maxlength="2000"></textarea></label>
              <label class="story-architecture-wide">Guidance <small>one rule per line</small><textarea id="story-template-guidance" maxlength="20000" required></textarea></label>
              <label class="story-architecture-wide">Structure beats JSON <small>array of {label,purpose,targetPosition?}</small><textarea id="story-template-beats" class="story-architecture-json" spellcheck="false" required></textarea></label>
            </div>
            <div class="story-template-actions"><button id="story-template-save" class="primary" type="submit">Save project template</button><button id="story-template-delete" type="button" disabled>Delete project template</button></div>
          </form>
        </details>
      </section>
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
    $("#story-template-select")?.addEventListener("change", templateSelected);
    $("#story-template-install")?.addEventListener("click", () => void installSelectedTemplate());
    $("#story-template-new")?.addEventListener("click", beginNewTemplate);
    $("#story-template-form")?.addEventListener("submit", saveTemplate);
    $("#story-template-delete")?.addEventListener("click", () => void deleteSelectedTemplate());
    return true;
  }
  function allTemplates() { return [...(templates.builtIn || []), ...(templates.installed || [])]; }
  function selectedTemplate() { return allTemplates().find((item) => item.id === selectedTemplateId) || null; }
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
  function renderTemplates() {
    const select = $("#story-template-select");
    if (!select) return;
    const builtInOptions = (templates.builtIn || []).map((item) => `<option value="${esc(item.id)}">${esc(item.title)} · built-in v${item.version}</option>`).join("");
    const installedOptions = (templates.installed || []).map((item) => `<option value="${esc(item.id)}">${esc(item.title)} · project v${item.version}</option>`).join("");
    select.innerHTML = `<option value="">No template — derive structure from my idea</option>${builtInOptions ? `<optgroup label="Forge built-ins">${builtInOptions}</optgroup>` : ""}${installedOptions ? `<optgroup label="My project templates">${installedOptions}</optgroup>` : ""}`;
    if (selectedTemplateId && allTemplates().some((item) => item.id === selectedTemplateId)) select.value = selectedTemplateId;
    else { selectedTemplateId = ""; select.value = ""; }
    renderTemplateDetails();
  }
  function renderTemplateDetails() {
    const item = selectedTemplate();
    const meta = $("#story-template-meta"), install = $("#story-template-install"), remove = $("#story-template-delete");
    if (!item) {
      if (meta) meta.textContent = "No template selected. Forge will derive structure from the author idea and Project Brain.";
      if (install) install.disabled = true;
      if (remove) remove.disabled = true;
      if (templateEditorMode !== "new") clearTemplateEditor();
      return;
    }
    if (meta) meta.textContent = `${item.title} · v${item.version} · ${item.source?.kind || "unknown source"}\n${item.description || ""}`;
    if (install) install.disabled = item.source?.kind !== "built-in";
    if (remove) remove.disabled = item.source?.kind === "built-in";
    if (templateEditorMode !== "new") fillTemplateEditor(item);
  }
  function fillTemplateEditor(item) {
    templateEditorMode = "selected";
    $("#story-template-title").value = item?.title || "";
    $("#story-template-description").value = item?.description || "";
    $("#story-template-kinds").value = (item?.bookKinds || []).join("\n");
    $("#story-template-guidance").value = (item?.guidance || []).join("\n");
    $("#story-template-beats").value = JSON.stringify(item?.beats || [], null, 2);
    const save = $("#story-template-save"), remove = $("#story-template-delete");
    if (save) { save.textContent = item?.source?.kind === "built-in" ? "Install a project copy to edit" : "Save new template version"; save.disabled = item?.source?.kind === "built-in"; }
    if (remove) remove.disabled = !item || item.source?.kind === "built-in";
  }
  function clearTemplateEditor() {
    $("#story-template-title").value = "";
    $("#story-template-description").value = "";
    $("#story-template-kinds").value = "";
    $("#story-template-guidance").value = "";
    $("#story-template-beats").value = "[]";
    const save = $("#story-template-save"), remove = $("#story-template-delete");
    if (save) { save.textContent = "Create project template"; save.disabled = false; }
    if (remove) remove.disabled = true;
  }
  function render() {
    ensureUi();
    renderTemplates();
    const host = $("#story-architecture-candidates");
    if (host) {
      host.innerHTML = (snapshot.candidates || []).slice(0, 8).map((item) => {
        const state = item.approved ? "APPROVED" : item.approvalStale ? "STALE APPROVAL" : "UNAPPROVED";
        const updated = Number.isNaN(Date.parse(item.updatedAt)) ? "unknown time" : new Date(item.updatedAt).toLocaleString();
        const template = item.template ? ` · ${item.template.title} v${item.template.version}` : " · no template";
        return `<button type="button" data-architecture-candidate="${esc(item.id)}"><strong>${esc(state)}</strong> · ${esc(item.kind)} · ${(item.plan?.chapterPlan || []).length} chapters${esc(template)}<br><small>${esc(item.provider)} · ${esc(item.model)} · ${esc(updated)}</small></button>`;
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
    $("#arch-result").textContent = `${item.template ? `Template guidance: ${item.template.title} (${item.template.id} v${item.template.version}, ${item.template.sourceKind})\n\n` : ""}${readable(plan)}`;
    const provenance = item.template ? ` Guided by ${item.template.title} v${item.template.version}; that template is planning guidance, not canon.` : "";
    const status = item.approved
      ? `Approved exact architecture ${String(item.planSha256 || "").slice(0, 12)}…${item.approvedAt ? ` · ${new Date(item.approvedAt).toLocaleString()}` : ""}.${provenance} It may seed Chapter Cards.`
      : item.approvalStale
        ? `Approval is stale because this architecture was edited after approval.${provenance} Review and approve the current version before downstream use, or revoke the old approval explicitly.`
        : `Durable candidate saved but not approved.${provenance} Review/edit it before downstream use.`;
    $("#story-architecture-status").textContent = status;
    $("#story-architecture-approve").disabled = Boolean(item.approved);
    $("#story-architecture-revoke").disabled = !(item.approved || item.approvalStale);
    $("#story-architecture-seed").disabled = !item.approved;
  }
  async function refresh(preferredId, preferredTemplateId) {
    if (!ensureUi()) return;
    const [nextSnapshot, nextTemplates] = await Promise.all([
      api(projectUrl("/story-architecture")),
      api(projectUrl("/story-architecture/templates")),
    ]);
    snapshot = nextSnapshot;
    templates = nextTemplates;
    if (preferredTemplateId && allTemplates().some((item) => item.id === preferredTemplateId)) selectedTemplateId = preferredTemplateId;
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
      const template = selectedTemplate();
      notify(template ? `Forge is building Story Architecture using ${template.title} v${template.version} as author-selected guidance…` : "Forge is building structured Story Architecture from the author idea and Project Brain…", true);
      const result = await api(projectUrl("/story-architecture/generate"), {
        method: "POST",
        body: JSON.stringify({ idea, kind: $("#arch-kind")?.value || "novel", ...(targetChapters === undefined ? {} : { targetChapters }), ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}) }),
      });
      await refresh(result.candidate.id, selectedTemplateId);
      notify(`Story Architecture saved as durable unapproved planning${result.templateGuidanceApplied ? ` using ${result.templateGuidanceApplied.title} v${result.templateGuidanceApplied.version}` : ""}. Nothing was added to manuscript or Project Brain canon.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
    finally { busy = false; if (button) button.disabled = false; }
  }
  function templateSelected() {
    selectedTemplateId = $("#story-template-select")?.value || "";
    templateEditorMode = "selected";
    renderTemplateDetails();
  }
  function beginNewTemplate() {
    selectedTemplateId = "";
    if ($("#story-template-select")) $("#story-template-select").value = "";
    templateEditorMode = "new";
    clearTemplateEditor();
    if ($("#story-template-editor")) $("#story-template-editor").open = true;
    $("#story-template-title")?.focus();
  }
  function templatePayload() {
    let beats;
    try { beats = JSON.parse($("#story-template-beats").value || "[]"); }
    catch { throw new Error("Template structure beats must be valid JSON."); }
    if (!Array.isArray(beats)) throw new Error("Template structure beats JSON must be an array.");
    return {
      title: $("#story-template-title").value,
      description: $("#story-template-description").value,
      bookKinds: lines($("#story-template-kinds").value),
      guidance: lines($("#story-template-guidance").value),
      beats,
    };
  }
  async function saveTemplate(event) {
    event.preventDefault();
    try {
      const current = selectedTemplate();
      if (current?.source?.kind === "built-in") throw new Error("Forge built-ins are immutable. Install an editable project copy first.");
      const creating = templateEditorMode === "new" || !current;
      const saved = await api(creating ? projectUrl("/story-architecture/templates") : projectUrl(`/story-architecture/templates/${encodeURIComponent(current.id)}`), {
        method: creating ? "POST" : "PUT",
        body: JSON.stringify(templatePayload()),
      });
      selectedTemplateId = saved.id;
      templateEditorMode = "selected";
      await refresh(undefined, saved.id);
      notify(`${creating ? "Project template created" : "Project template version saved"}: ${saved.title} v${saved.version}.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }
  async function installSelectedTemplate() {
    const current = selectedTemplate();
    if (!current || current.source?.kind !== "built-in") return notify("Choose a Forge built-in template to install an editable project copy.");
    try {
      const saved = await api(projectUrl("/story-architecture/templates/install"), { method: "POST", body: JSON.stringify({ builtInId: current.id }) });
      selectedTemplateId = saved.id;
      templateEditorMode = "selected";
      await refresh(undefined, saved.id);
      if ($("#story-template-editor")) $("#story-template-editor").open = true;
      notify(`Installed editable project copy: ${saved.title}. Future edits create versioned project-template records.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }
  async function deleteSelectedTemplate() {
    const current = selectedTemplate();
    if (!current || current.source?.kind === "built-in") return notify("Only project templates can be deleted. Forge built-ins are immutable.");
    if (!window.confirm(`Delete project template ${current.title}? Existing Story Architecture candidates keep their recorded template provenance.`)) return;
    try {
      await api(projectUrl(`/story-architecture/templates/${encodeURIComponent(current.id)}`), { method: "DELETE" });
      selectedTemplateId = "";
      templateEditorMode = "selected";
      await refresh();
      notify("Project template removed from the active library. Its version history remains preserved in project memory.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
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
      notify("Approved Story Architecture handed to Chapter Cards. Template provenance remains visible in the seeded brief; review it, then generate Chapter Cards when ready.", true);
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