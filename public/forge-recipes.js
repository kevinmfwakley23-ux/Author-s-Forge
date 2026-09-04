/* Author-created, reusable, multi-stage AI tools. Every run is a durable proposal; nothing silently mutates project truth. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "content-type":"application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  };
  const projectUrl = (suffix = "") => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const providers = ["", "omniroute", "9router", "kings", "ollama", "groq", "mistral", "gemini", "anthropic", "openrouter", "openai"];
  const tasks = ["writing", "editing", "research", "marketing", "continuity", "voice-preservation", "cover", "tool-use"];
  const memoryClasses = ["author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory", "location-memory", "timeline-memory", "style-memory", "research-memory", "creative-note", "working-draft", "hypothesis", "open-thread", "visual-identity", "production-memory", "publishing-memory", "marketing-memory", "generated-alternative", "decision-memory"];
  let recipes = [];
  let workspace = { books: [] };
  let editingId = null;
  let currentProposal = null;

  function notify(message, ok = false) {
    const error = $("#error-banner"), success = $("#success-banner");
    if (error) error.hidden = ok;
    if (success) success.hidden = !ok;
    const target = ok ? success : error;
    if (target) { target.textContent = message; target.hidden = false; }
    if (ok && success) setTimeout(() => { success.hidden = true; }, 4500);
  }

  function ensureSurface() {
    if (!document.getElementById("dashboard") || document.getElementById("recipes")) return;
    const nav = document.querySelector(".sidebar nav");
    if (nav && !nav.querySelector('[data-route="recipes"]')) {
      const link = document.createElement("a");
      link.href = "#recipes";
      link.dataset.route = "recipes";
      link.textContent = "Forge Recipes";
      const architecture = nav.querySelector('[data-route="architecture"]');
      nav.insertBefore(link, architecture || null);
    }
    const architecture = document.getElementById("architecture");
    const section = document.createElement("section");
    section.id = "recipes";
    section.className = "view";
    section.dataset.view = "";
    section.hidden = true;
    section.setAttribute("aria-hidden", "true");
    section.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">FORGE RECIPES</div><h2>Build your own reusable AI tools</h2><p>Create one-step or multi-stage creative workflows with Project Brain context and model preferences. Every result becomes a pending author-review proposal instead of silently changing manuscript or canon.</p></div><button id="recipe-new" type="button">New recipe</button></div>
      <div class="grid">
        <article class="card">
          <h3 id="recipe-editor-title">Create recipe</h3>
          <form id="recipe-form">
            <label>Name<input id="recipe-name" required maxlength="160" placeholder="Example: Picture-book rhyme polish"></label>
            <label>Description<textarea id="recipe-description" maxlength="2000" placeholder="What this reusable tool should accomplish"></textarea></label>
            <div class="row">
              <label>Input label<input id="recipe-input-label" maxlength="160" value="Author input"></label>
              <label>Final output<select id="recipe-output-kind"><option value="creative-alternative">Creative alternative</option><option value="manuscript-edit">Manuscript edit</option><option value="research-note">Research note</option><option value="continuity-finding">Continuity finding</option></select></label>
            </div>
            <label>Project Brain memory classes<select id="recipe-memory-classes" multiple size="7"></select></label>
            <div class="row"><label>Relevance tags<input id="recipe-tags" placeholder="voice, heartwood, audience"></label><label>Context terms<input id="recipe-terms" placeholder="character names, topic, style"></label></div>
            <label class="row"><input id="recipe-working" type="checkbox"> Include working/proposed Project Brain context</label>
            <hr><div class="section-title"><div><h3>Stages</h3><p class="muted">Stages run in order. A stage can consume the previous stage output.</p></div><button id="recipe-add-stage" type="button">Add stage</button></div>
            <div id="recipe-stage-list"></div>
            <div class="row"><button class="primary" type="submit" id="recipe-save">Save recipe</button><button type="button" id="recipe-cancel">Clear</button></div>
          </form>
        </article>
        <article class="card"><h3>Saved recipes</h3><div id="recipe-list" class="list"><p class="muted">Loading recipes…</p></div></article>
      </div>
      <div class="grid">
        <article class="card">
          <h3>Run a recipe</h3>
          <label>Recipe<select id="recipe-run-select"><option value="">Choose a recipe</option></select></label>
          <label>Input<textarea id="recipe-run-input" class="editor" placeholder="Text, idea, brief, scene direction, campaign source, or other material for this recipe"></textarea></label>
          <details><summary>Optional manuscript target</summary><p class="muted">Required only for recipes whose final output is a manuscript edit. The current scene is read as source; the recipe cannot write to it until the author accepts and separately applies the proposal.</p><div class="row"><select id="recipe-book"><option value="">No target</option></select><select id="recipe-chapter"><option value="">Chapter</option></select><select id="recipe-scene"><option value="">Scene</option></select></div></details>
          <button id="recipe-run" class="primary" type="button">Run real AI workflow</button>
          <p id="recipe-run-status" class="muted">No recipe run yet.</p>
        </article>
        <article class="card"><h3>Latest result</h3><div id="recipe-result"><p class="muted">Run a recipe to create a durable proposal.</p></div></article>
      </div>
      <article class="card"><div class="section-title"><div><h3>Run history</h3><p class="muted">Provider/model provenance and failed stages remain durable instead of disappearing.</p></div><button id="recipe-refresh-history" type="button">Refresh</button></div><div id="recipe-run-history" class="list"><p class="muted">No runs loaded.</p></div></article>`;
    if (architecture) architecture.before(section); else document.querySelector("main")?.append(section);
    const classes = $("#recipe-memory-classes");
    if (classes) classes.innerHTML = memoryClasses.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join("");
    bind();
    resetEditor();
    refreshAll();
  }

  function stageTemplate(stage = {}, index = 0) {
    const id = stage.id || `stage-${index + 1}`;
    const task = stage.task || "writing";
    const provider = stage.preferProvider || "";
    return `<article class="memory recipe-stage" data-stage-id="${esc(id)}">
      <div class="section-title"><div><strong>Stage ${index + 1}</strong></div><button type="button" data-remove-stage>Remove</button></div>
      <div class="row"><label>Name<input data-stage-name required maxlength="160" value="${esc(stage.name || `Stage ${index + 1}`)}"></label><label>Task<select data-stage-task>${tasks.map((value) => `<option value="${esc(value)}"${value === task ? " selected" : ""}>${esc(value)}</option>`).join("")}</select></label></div>
      <label>Instruction<textarea data-stage-instruction required maxlength="12000" placeholder="Exact job for this stage">${esc(stage.instruction || "")}</textarea></label>
      <div class="row"><label>Provider preference<select data-stage-provider>${providers.map((value) => `<option value="${esc(value)}"${value === provider ? " selected" : ""}>${esc(value || "Auto route")}</option>`).join("")}</select></label><label>Model preference<input data-stage-model maxlength="240" value="${esc(stage.preferModel || "")}" placeholder="Optional exact configured model"></label></div>
      <div class="row"><label>Temperature<input data-stage-temp type="number" min="0" max="2" step="0.1" value="${stage.temperature ?? 0.7}"></label><label>Max output tokens<input data-stage-max type="number" min="128" max="32000" step="1" value="${stage.maxOutputTokens ?? 4000}"></label></div>
      <div class="row"><label><input data-stage-previous type="checkbox"${stage.usePreviousOutput ? " checked" : ""}> Use previous stage output</label><label><input data-stage-reasoning type="checkbox"${stage.requiresReasoning ? " checked" : ""}> Prefer reasoning-capable model</label><label><input data-stage-creative type="checkbox"${stage.requiresCreativeWriting ? " checked" : ""}> Require creative-writing capability</label></div>
    </article>`;
  }

  function addStage(stage = {}) {
    const list = $("#recipe-stage-list");
    if (!list) return;
    const count = list.querySelectorAll(".recipe-stage").length;
    if (count >= 8) return notify("Forge Recipes support up to 8 governed stages.");
    list.insertAdjacentHTML("beforeend", stageTemplate(stage, count));
    renumberStages();
  }

  function renumberStages() {
    document.querySelectorAll("#recipe-stage-list .recipe-stage").forEach((card, index) => {
      card.dataset.stageId ||= `stage-${index + 1}`;
      const strong = card.querySelector(".section-title strong");
      if (strong) strong.textContent = `Stage ${index + 1}`;
    });
  }

  function collectStages() {
    const cards = [...document.querySelectorAll("#recipe-stage-list .recipe-stage")];
    if (!cards.length) throw new Error("Add at least one recipe stage.");
    return cards.map((card, index) => {
      const provider = $("[data-stage-provider]", card).value;
      const model = $("[data-stage-model]", card).value.trim();
      const temperature = Number($("[data-stage-temp]", card).value);
      const maxOutputTokens = Number($("[data-stage-max]", card).value);
      return {
        id: card.dataset.stageId || `stage-${index + 1}`,
        name: $("[data-stage-name]", card).value.trim(),
        task: $("[data-stage-task]", card).value,
        instruction: $("[data-stage-instruction]", card).value.trim(),
        usePreviousOutput: $("[data-stage-previous]", card).checked,
        temperature,
        maxOutputTokens,
        ...(provider ? { preferProvider: provider } : {}),
        ...(model ? { preferModel: model } : {}),
        requiresReasoning: $("[data-stage-reasoning]", card).checked,
        requiresCreativeWriting: $("[data-stage-creative]", card).checked,
        requiresInstructionFollowing: true,
      };
    });
  }

  function csv(value) { return [...new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean))]; }
  function selectedValues(select) { return [...select.selectedOptions].map((option) => option.value); }

  async function saveRecipe(event) {
    event.preventDefault();
    try {
      const payload = {
        name: $("#recipe-name").value.trim(), description: $("#recipe-description").value.trim(), inputLabel: $("#recipe-input-label").value.trim() || "Input",
        outputKind: $("#recipe-output-kind").value, memoryClasses: selectedValues($("#recipe-memory-classes")), relevanceTags: csv($("#recipe-tags").value), contextQueryTerms: csv($("#recipe-terms").value),
        includeWorkingState: $("#recipe-working").checked, enabled: true, stages: collectStages(),
      };
      if (!payload.name) throw new Error("Recipe name is required.");
      if (editingId) await api(projectUrl(`/recipes/${encodeURIComponent(editingId)}`), { method:"PUT", body:JSON.stringify(payload) });
      else await api(projectUrl("/recipes"), { method:"POST", body:JSON.stringify(payload) });
      notify(editingId ? "Forge Recipe updated." : "Forge Recipe created.", true);
      resetEditor();
      await refreshAll();
    } catch (error) { notify(error.message); }
  }

  function resetEditor() {
    editingId = null;
    if ($("#recipe-editor-title")) $("#recipe-editor-title").textContent = "Create recipe";
    $("#recipe-form")?.reset();
    if ($("#recipe-input-label")) $("#recipe-input-label").value = "Author input";
    if ($("#recipe-stage-list")) $("#recipe-stage-list").innerHTML = "";
    addStage({ name:"Create", instruction:"Create the strongest useful result from the author's input while preserving supplied Project Brain truth.", task:"writing", usePreviousOutput:false, requiresCreativeWriting:true });
  }

  function editRecipe(recipe) {
    editingId = recipe.id;
    $("#recipe-editor-title").textContent = `Edit: ${recipe.name}`;
    $("#recipe-name").value = recipe.name;
    $("#recipe-description").value = recipe.description || "";
    $("#recipe-input-label").value = recipe.inputLabel || "Input";
    $("#recipe-output-kind").value = recipe.outputKind;
    $("#recipe-tags").value = (recipe.relevanceTags || []).join(", ");
    $("#recipe-terms").value = (recipe.contextQueryTerms || []).join(", ");
    $("#recipe-working").checked = recipe.includeWorkingState === true;
    [...$("#recipe-memory-classes").options].forEach((option) => { option.selected = recipe.memoryClasses?.includes(option.value); });
    $("#recipe-stage-list").innerHTML = "";
    recipe.stages.forEach(addStage);
    location.hash = "#recipes";
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  async function deleteRecipe(recipe) {
    if (!window.confirm(`Delete Forge Recipe "${recipe.name}"? Run history is retained as audit evidence.`)) return;
    try { await api(projectUrl(`/recipes/${encodeURIComponent(recipe.id)}`), { method:"DELETE" }); notify("Recipe deleted. Historical runs remain durable.", true); await refreshAll(); }
    catch (error) { notify(error.message); }
  }

  async function refreshAll() {
    try {
      const [recipeResult, workspaceResult] = await Promise.all([api(projectUrl("/recipes")), api(projectUrl("/workspace"))]);
      recipes = recipeResult.recipes || [];
      workspace = workspaceResult || { books:[] };
      renderRecipes(); renderTargets(); await refreshHistory();
    } catch (error) { notify(error.message); }
  }

  function renderRecipes() {
    const list = $("#recipe-list"), select = $("#recipe-run-select");
    if (list) list.innerHTML = recipes.length ? recipes.map((recipe) => `<article class="memory"><strong>${esc(recipe.name)}</strong><p>${esc(recipe.description || "No description")}</p><small>${recipe.stages.length} stage${recipe.stages.length === 1 ? "" : "s"} • ${esc(recipe.outputKind)} • ${recipe.enabled ? "enabled" : "disabled"}</small><div class="row"><button type="button" data-edit-recipe="${esc(recipe.id)}">Edit</button><button type="button" data-delete-recipe="${esc(recipe.id)}">Delete</button></div></article>`).join("") : '<p class="muted">No reusable tools yet. Create your first Forge Recipe.</p>';
    if (select) select.innerHTML = '<option value="">Choose a recipe</option>' + recipes.map((recipe) => `<option value="${esc(recipe.id)}">${esc(recipe.name)} — ${recipe.stages.length} stage${recipe.stages.length === 1 ? "" : "s"}</option>`).join("");
  }

  function renderTargets() {
    const bookSelect = $("#recipe-book");
    if (!bookSelect) return;
    const prior = bookSelect.value;
    bookSelect.innerHTML = '<option value="">No target</option>' + (workspace.books || []).map((book) => `<option value="${esc(book.id)}">${esc(book.title)}</option>`).join("");
    if ([...bookSelect.options].some((option) => option.value === prior)) bookSelect.value = prior;
    renderChapters();
  }
  function renderChapters() {
    const book = (workspace.books || []).find((item) => item.id === $("#recipe-book")?.value);
    const select = $("#recipe-chapter"); if (!select) return;
    const prior = select.value;
    select.innerHTML = '<option value="">Chapter</option>' + (book?.chapters || []).map((chapter) => `<option value="${esc(chapter.id)}">${chapter.number}. ${esc(chapter.title)}</option>`).join("");
    if ([...select.options].some((option) => option.value === prior)) select.value = prior;
    renderScenes();
  }
  function renderScenes() {
    const book = (workspace.books || []).find((item) => item.id === $("#recipe-book")?.value);
    const chapter = book?.chapters?.find((item) => item.id === $("#recipe-chapter")?.value);
    const select = $("#recipe-scene"); if (!select) return;
    select.innerHTML = '<option value="">Scene</option>' + (chapter?.scenes || []).map((scene) => `<option value="${esc(scene.id)}">${scene.number}. ${esc(scene.title)}</option>`).join("");
  }

  async function runRecipe() {
    const recipe = recipes.find((item) => item.id === $("#recipe-run-select")?.value);
    if (!recipe) return notify("Choose a Forge Recipe first.");
    if (!window.confirm(`Run "${recipe.name}"? This will make ${recipe.stages.length} real AI request${recipe.stages.length === 1 ? "" : "s"} under your current Forge spend/routing policy.`)) return;
    const button = $("#recipe-run"), status = $("#recipe-run-status");
    if (button) button.disabled = true;
    if (status) status.textContent = `Running ${recipe.stages.length} governed stage${recipe.stages.length === 1 ? "" : "s"}…`;
    try {
      const bookId = $("#recipe-book")?.value, chapterId = $("#recipe-chapter")?.value, sceneId = $("#recipe-scene")?.value;
      const target = bookId && chapterId && sceneId ? { bookId, chapterId, sceneId } : undefined;
      const result = await api(projectUrl(`/recipes/${encodeURIComponent(recipe.id)}/run`), { method:"POST", body:JSON.stringify({ input: $("#recipe-run-input")?.value || "", ...(target ? { target } : {}) }) });
      currentProposal = result.proposal;
      renderResult(result);
      if (status) status.textContent = `Completed ${result.run.stages.length} stage(s). Proposal ${result.proposal.id} is pending author review.`;
      notify("Forge Recipe completed. The result is pending; nothing was applied automatically.", true);
      await refreshHistory();
    } catch (error) {
      if (status) status.textContent = error.message;
      notify(error.message);
      await refreshHistory().catch(() => {});
    } finally { if (button) button.disabled = false; }
  }

  function renderResult(result) {
    const proposal = result.proposal, stages = result.run?.stages || [];
    const host = $("#recipe-result"); if (!host) return;
    host.innerHTML = `<div class="policy"><span>Status</span><strong>${esc(proposal.status)}</strong></div><div class="policy"><span>Recipe revision</span><strong>${esc(result.run.recipeRevisionSha256.slice(0, 12))}…</strong></div><div class="list">${stages.map((stage, index) => `<article class="memory"><strong>${index + 1}. ${esc(stage.stageName)}</strong><small>${esc(stage.provider)} • ${esc(stage.model)}${stage.totalTokens === undefined ? "" : ` • ${esc(stage.totalTokens)} tokens`}</small></article>`).join("")}</div><textarea class="editor candidate" readonly>${esc(proposal.proposedContent)}</textarea><div class="row"><button type="button" data-recipe-review="accepted" class="primary">Accept proposal</button><button type="button" data-recipe-review="rejected">Reject</button>${proposal.target ? '<button type="button" data-recipe-apply disabled>Apply accepted edit</button>' : ""}</div><p class="muted">Accepting reviews the candidate. Applying a manuscript-targeted proposal is a separate stale-checked action.</p>`;
  }

  async function reviewCurrent(decision) {
    if (!currentProposal) return;
    try {
      const reviewed = await api(projectUrl(`/ai/proposals/${encodeURIComponent(currentProposal.id)}/review`), { method:"POST", body:JSON.stringify({ decision, note:"Reviewed from Forge Recipes" }) });
      currentProposal = { ...currentProposal, status: reviewed.to || decision };
      const apply = $("[data-recipe-apply]"); if (apply) apply.disabled = decision !== "accepted";
      $("[data-recipe-review=accepted]")?.setAttribute("disabled", "");
      $("[data-recipe-review=rejected]")?.setAttribute("disabled", "");
      notify(`Recipe proposal ${decision}.`, true);
    } catch (error) { notify(error.message); }
  }

  async function applyCurrent() {
    if (!currentProposal?.target) return;
    try {
      await api(projectUrl(`/ai/proposals/${encodeURIComponent(currentProposal.id)}/apply`), { method:"POST", body:"{}" });
      notify("Accepted recipe edit applied through the stale-checked manuscript boundary.", true);
      window.dispatchEvent(new CustomEvent("forge:recipe-applied", { detail:{ proposalId:currentProposal.id } }));
    } catch (error) { notify(error.message); }
  }

  async function refreshHistory() {
    const host = $("#recipe-run-history"); if (!host) return;
    const recipeId = $("#recipe-run-select")?.value || "";
    const query = recipeId ? `?recipeId=${encodeURIComponent(recipeId)}` : "";
    const result = await api(projectUrl(`/recipe-runs${query}`));
    const runs = result.runs || [];
    host.innerHTML = runs.length ? runs.slice(0, 30).map((run) => `<article class="memory"><strong>${esc(recipes.find((recipe) => recipe.id === run.recipeId)?.name || run.recipeId)}</strong><p>${run.status === "failed" ? esc(run.error) : `Proposal ${esc(run.proposalId || "")}`}</p><small>${esc(run.status)} • ${run.stages.length} completed stage${run.stages.length === 1 ? "" : "s"} • ${esc(new Date(run.startedAt).toLocaleString())}</small><details><summary>Provider/model provenance</summary>${run.stages.map((stage) => `<div class="policy"><span>${esc(stage.stageName)}</span><strong>${esc(stage.provider)} / ${esc(stage.model)}</strong></div>`).join("")}</details></article>`).join("") : '<p class="muted">No recipe runs yet.</p>';
  }

  function bind() {
    $("#recipe-form")?.addEventListener("submit", saveRecipe);
    $("#recipe-new")?.addEventListener("click", resetEditor);
    $("#recipe-cancel")?.addEventListener("click", resetEditor);
    $("#recipe-add-stage")?.addEventListener("click", () => addStage({ instruction:"", task:"writing", usePreviousOutput:true }));
    $("#recipe-stage-list")?.addEventListener("click", (event) => {
      const remove = event.target.closest?.("[data-remove-stage]"); if (!remove) return;
      const cards = document.querySelectorAll("#recipe-stage-list .recipe-stage");
      if (cards.length <= 1) return notify("A Forge Recipe must keep at least one stage.");
      remove.closest(".recipe-stage")?.remove(); renumberStages();
    });
    $("#recipe-list")?.addEventListener("click", (event) => {
      const edit = event.target.closest?.("[data-edit-recipe]"), del = event.target.closest?.("[data-delete-recipe]");
      if (edit) { const recipe = recipes.find((item) => item.id === edit.dataset.editRecipe); if (recipe) editRecipe(recipe); }
      if (del) { const recipe = recipes.find((item) => item.id === del.dataset.deleteRecipe); if (recipe) deleteRecipe(recipe); }
    });
    $("#recipe-book")?.addEventListener("change", renderChapters);
    $("#recipe-chapter")?.addEventListener("change", renderScenes);
    $("#recipe-run-select")?.addEventListener("change", () => refreshHistory().catch((error) => notify(error.message)));
    $("#recipe-run")?.addEventListener("click", runRecipe);
    $("#recipe-refresh-history")?.addEventListener("click", () => refreshHistory().catch((error) => notify(error.message)));
    $("#recipe-result")?.addEventListener("click", (event) => {
      const review = event.target.closest?.("[data-recipe-review]"); if (review) reviewCurrent(review.dataset.recipeReview);
      if (event.target.closest?.("[data-recipe-apply]")) applyCurrent();
    });
    window.addEventListener("forge:workspace-ready", (event) => { workspace = event.detail || workspace; renderTargets(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureSurface, { once:true });
  else ensureSurface();
})();
