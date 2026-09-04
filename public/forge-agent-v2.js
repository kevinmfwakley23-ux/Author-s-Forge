/* Forge Agent Workbench v2: server-discovered governed orchestration over real Forge APIs. */
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const projectInput = $("#agent-project");
  const modeInput = $("#agent-mode");
  const bookInput = $("#agent-book");
  const chapterInput = $("#agent-chapter");
  const sceneInput = $("#agent-scene");
  const authorInput = $("#agent-author");
  const goalInput = $("#agent-goal");
  const status = $("#agent-status");
  const snapshot = $("#agent-snapshot");
  const planHost = $("#agent-plan");
  const back = $("#agent-back");
  const toolsHost = $("#agent-tools");
  const recipeSelect = $("#agent-recipe-select");
  const recipeName = $("#agent-recipe-name");
  const recipeSave = $("#agent-recipe-save");
  const recipeCompile = $("#agent-recipe-compile");
  const recipeDelete = $("#agent-recipe-delete");
  const recipeStatus = $("#agent-recipe-status");

  const initialProjectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  projectInput.value = initialProjectId;
  back.href = `/?project=${encodeURIComponent(initialProjectId)}`;

  let truth = null;
  let plan = [];
  let registry = [];
  let recipes = [];
  const outcomes = new Map();
  const stepUi = new Map();

  function setStatus(message) { status.textContent = message; }
  function setRecipeStatus(message) { if (recipeStatus) recipeStatus.textContent = message; }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Forge request failed (${response.status}).`);
    return payload;
  }

  function projectId() {
    const value = projectInput.value.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Project ID may contain only letters, numbers, hyphens, and underscores.");
    return value;
  }

  function option(select, value, label) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    select.appendChild(node);
  }

  function selectedBook() { return truth?.workspace.books.find((book) => book.id === bookInput.value) || null; }
  function selectedChapter() { return selectedBook()?.chapters.find((chapter) => chapter.id === chapterInput.value) || null; }
  function selectedScene() { return selectedChapter()?.scenes.find((scene) => scene.id === sceneInput.value) || null; }

  function fillTargets(preferred = {}) {
    if (!truth) return;
    const books = truth.workspace.books || [];
    bookInput.replaceChildren();
    if (!books.length) option(bookInput, "", "No books yet");
    for (const book of books) option(bookInput, book.id, book.title || book.id);
    const wantedBook = preferred.bookId || truth.workspace.activeBookId || books[0]?.id || "";
    if (books.some((book) => book.id === wantedBook)) bookInput.value = wantedBook;
    fillChapters(preferred.chapterId, preferred.sceneId);
  }

  function fillChapters(preferredChapterId = "", preferredSceneId = "") {
    const book = selectedBook();
    chapterInput.replaceChildren();
    const chapters = book?.chapters || [];
    if (!chapters.length) option(chapterInput, "", "No chapters yet");
    for (const chapter of chapters) option(chapterInput, chapter.id, `${chapter.number}. ${chapter.title || chapter.id}`);
    chapterInput.value = chapters.some((chapter) => chapter.id === preferredChapterId) ? preferredChapterId : chapters[0]?.id || "";
    fillScenes(preferredSceneId);
  }

  function fillScenes(preferredSceneId = "") {
    const chapter = selectedChapter();
    sceneInput.replaceChildren();
    const scenes = chapter?.scenes || [];
    if (!scenes.length) option(sceneInput, "", "No scenes yet");
    for (const scene of scenes) option(sceneInput, scene.id, `${scene.number}. ${scene.title || scene.id}`);
    sceneInput.value = scenes.some((scene) => scene.id === preferredSceneId) ? preferredSceneId : scenes[0]?.id || "";
    renderSnapshot();
  }

  function renderSnapshot() {
    if (!truth) return;
    const book = selectedBook(), chapter = selectedChapter(), scene = selectedScene();
    const health = truth.health, research = truth.researchStatus;
    snapshot.replaceChildren();
    const values = [
      ["Project", truth.project.metadata?.title || truth.project.metadata?.id || projectInput.value],
      ["Book", book?.title || "Not created"],
      ["Chapter", chapter ? `${chapter.number}. ${chapter.title}` : "Not created"],
      ["Scene", scene ? `${scene.number}. ${scene.title}` : "Not created"],
      ["Words", String(health.metrics?.words ?? 0)],
      ["Canon memories", String(health.metrics?.canonRecords ?? 0)],
      ["Research memories", String(health.metrics?.researchRecords ?? 0)],
      ["Live research", research.available ? "Available" : "Unavailable"],
      ["Agent tools", String(registry.length)],
      ["Forge Recipes", String(recipes.length)],
      ["Mode", truth.collaboration.mode],
    ];
    for (const [label, value] of values) {
      const row = document.createElement("div"); row.className = "agent-stat";
      const strong = document.createElement("strong"); strong.textContent = label;
      const span = document.createElement("span"); span.textContent = value;
      row.append(strong, span); snapshot.append(row);
    }
    if (!research.available) {
      const note = document.createElement("p"); note.className = "muted";
      note.textContent = research.reason || "Live research is not currently available.";
      snapshot.append(note);
    }
  }

  function renderTools() {
    if (!toolsHost) return;
    toolsHost.replaceChildren();
    if (!registry.length) {
      const note = document.createElement("p"); note.className = "muted";
      note.textContent = "No governed Agent tools were returned by the server."; toolsHost.append(note); return;
    }
    const list = document.createElement("ul"); list.className = "agent-truth";
    for (const tool of registry) {
      const item = document.createElement("li");
      const strong = document.createElement("strong"); strong.textContent = tool.title;
      item.append(strong, document.createTextNode(` — ${tool.approvalClass} · ${tool.providerRequirement}`));
      list.append(item);
    }
    toolsHost.append(list);
  }

  function renderRecipes(preferredId = "") {
    if (!recipeSelect) return;
    const previous = preferredId || recipeSelect.value;
    recipeSelect.replaceChildren();
    option(recipeSelect, "", recipes.length ? "Choose a saved Forge Recipe" : "No Forge Recipes saved yet");
    for (const recipe of recipes) option(recipeSelect, recipe.id, `${recipe.title} · v${recipe.version}`);
    if (recipes.some((recipe) => recipe.id === previous)) recipeSelect.value = previous;
    if (recipeCompile) recipeCompile.disabled = !recipeSelect.value;
    if (recipeDelete) recipeDelete.disabled = !recipeSelect.value;
  }

  async function loadTruth() {
    const id = projectId();
    setStatus("Reading durable project truth and Agent discovery…");
    const base = `/api/projects/${encodeURIComponent(id)}`;
    const [project, workspace, collaboration, health, researchStatus, toolSnapshot, recipeSnapshot] = await Promise.all([
      api(base), api(`${base}/workspace`), api(`${base}/collaboration`), api(`${base}/health`),
      api(`${base}/research/live/status`).catch((error) => ({ available: false, reason: error.message, domains: [] })),
      api(`${base}/agent/tools`), api(`${base}/agent/recipes`),
    ]);
    const previous = { bookId: bookInput.value, chapterId: chapterInput.value, sceneId: sceneInput.value };
    registry = Array.isArray(toolSnapshot.tools) ? toolSnapshot.tools : [];
    recipes = Array.isArray(recipeSnapshot.recipes) ? recipeSnapshot.recipes : [];
    truth = { project, workspace, collaboration, health, researchStatus };
    modeInput.value = collaboration.mode;
    localStorage.setItem("forge-project", id);
    back.href = `/?project=${encodeURIComponent(id)}`;
    history.replaceState({}, "", `/forge-agent.html?project=${encodeURIComponent(id)}`);
    fillTargets(previous); renderTools(); renderRecipes(); renderSnapshot();
    setStatus(`Project truth loaded with ${registry.length} governed Agent tools and ${recipes.length} reusable Forge Recipes.`);
    return truth;
  }

  function descriptor(toolId) {
    const tool = registry.find((candidate) => candidate.id === toolId);
    if (!tool) throw new Error(`Server plan referenced undiscovered Forge tool "${toolId}".`);
    return tool;
  }
  function toolPath(tool) { return String(tool.pathTemplate).replace(":projectId", encodeURIComponent(projectId())); }
  function hasAny(text, words) { return words.some((word) => text.includes(word)); }

  function chooseResearchDomain(goal) {
    if (hasAny(goal, ["market", "niche", "sales", "selling", "keyword"])) return "market";
    if (hasAny(goal, ["genre trend", "trend", "popular genre"])) return "genre-trend";
    if (hasAny(goal, ["reader", "audience expectation"])) return "reader-expectation";
    if (hasAny(goal, ["comparable", "comp book", "similar book"])) return "comparable-book";
    if (hasAny(goal, ["publish", "kdp", "retailer"])) return "publishing";
    if (hasAny(goal, ["weather", "climate"])) return "weather";
    if (hasAny(goal, ["legal", "law", "regulation"])) return "legal-environmental";
    if (hasAny(goal, ["medical", "medicine", "science", "scientific"])) return "medical-scientific";
    if (hasAny(goal, ["historical event", "battle", "war", "election"])) return "historical-event";
    if (hasAny(goal, ["historical", "history", "period", "era"])) return "historical-period";
    if (hasAny(goal, ["travel", "distance", "route"])) return "travel-distance";
    if (hasAny(goal, ["setting", "location", "city", "town", "place", "geography"])) return "real-world-location";
    if (hasAny(goal, ["architecture", "building"])) return "architecture";
    return "terminology";
  }

  function chooseMarket(goal) {
    if (/\b(uk|united kingdom|britain|amazon\.co\.uk)\b/i.test(goal)) return "Amazon.co.uk";
    if (/\b(canada|amazon\.ca)\b/i.test(goal)) return "Amazon.ca";
    if (/\b(australia|amazon\.com\.au)\b/i.test(goal)) return "Amazon.com.au";
    return "Amazon.com";
  }

  function chooseExportFormat(goal) {
    if (goal.includes("kdp") && goal.includes("epub")) return "kdp-epub";
    if (goal.includes("kdp") && (goal.includes("docx") || goal.includes("word document"))) return "kdp-docx";
    if (goal.includes("kdp")) return "kdp-pdf";
    if (goal.includes("epub")) return "epub";
    if (goal.includes("docx") || goal.includes("word document")) return "docx";
    return "pdf";
  }

  function promotionAudience(book) {
    return `Readers who are a strong fit for this ${String(book?.kind || "book").replace(/-/g, " ")}`;
  }

  function makeExecutableStep(serverStep, goal) {
    const tool = descriptor(serverStep.toolId);
    const lower = goal.toLowerCase();
    const book = selectedBook(), chapter = selectedChapter(), scene = selectedScene();
    const path = toolPath(tool);
    const request = (body) => api(path, { method: tool.method || "POST", body: JSON.stringify(body) });
    const base = {
      id: serverStep.id, toolId: tool.id, title: serverStep.title || tool.title,
      authority: tool.approvalClass,
      description: `${tool.description} State effect: ${tool.stateEffect}.`,
      blocked: serverStep.blockedReason || "",
      eligibleForApprovedRunGroup: serverStep.eligibleForApprovedRunGroup === true,
      state: "ready", serverStep,
    };
    let run;
    switch (tool.id) {
      case "project.context": run = () => request({ query: goal }); break;
      case "research.live":
        run = () => {
          if (!truth.researchStatus.available) throw new Error(truth.researchStatus.reason || "Live research is unavailable under the current owner/provider policy.");
          return request({ question: goal, researchedBecause: "Author-approved Forge Agent Workbench mission", domain: chooseResearchDomain(lower), ...(book ? { bookId: book.id } : {}), ...(chapter ? { chapterId: chapter.id } : {}), ...(scene ? { sceneId: scene.id } : {}) });
        };
        break;
      case "market.kdp.research": run = () => request({ bookId: book?.id, question: goal, market: chooseMarket(goal) }); break;
      case "architecture.generate": run = () => request({ idea: goal, kind: book?.kind || "novel", targetChapters: book?.chapters?.length || 0 }); break;
      case "story.chapter-cards.propose": run = () => request({ bookId: book?.id, description: goal, targetChapters: Math.max(1, book?.chapters?.length || 1), replaceExistingCards: false }); break;
      case "writing.propose":
        run = () => {
          const currentBook = selectedBook(), currentChapter = selectedChapter(), currentScene = selectedScene();
          if (!currentBook || !currentChapter || !currentScene) throw new Error("Select a valid book, chapter, and scene.");
          const task = lower.includes("rewrite") || lower.includes("revise") ? "rewrite" : (currentScene.content?.trim() ? "continue" : "draft");
          return request({ bookId: currentBook.id, chapterId: currentChapter.id, sceneId: currentScene.id, task, instruction: goal, contextQuery: goal });
        };
        break;
      case "editing.analyze":
        run = () => {
          const current = selectedScene();
          if (!current?.content?.trim()) throw new Error("The selected scene has no manuscript text to edit.");
          return request({ manuscriptId: "studio-workspace", bookId: selectedBook()?.id, chapterId: selectedChapter()?.id, sceneId: current.id, title: current.title || "Agent editorial analysis", text: current.content, roles: ["developmental", "continuity", "line", "copy", "proofreading"] });
        };
        break;
      case "visual.image.generate": run = () => request({ prompt: goal, purpose: "illustration", size: "auto", quality: "auto" }); break;
      case "promotion.campaign.propose": run = () => request({ bookId: book?.id, objective: goal, audience: promotionAudience(book), readerPromise: book?.description?.trim() || goal, channels: ["social", "author-site"], marketplace: chooseMarket(goal) }); break;
      case "production.export":
        run = async () => {
          const currentBook = selectedBook();
          if (!currentBook) throw new Error("Select a book before production.");
          const artifact = await request({ bookId: currentBook.id, format: chooseExportFormat(lower), pageSize: "6x9", author: authorInput.value.trim() || "Author" });
          downloadArtifact(artifact); return artifactSummary(artifact);
        };
        break;
      case "memory.record-working":
        run = () => {
          const completed = [...outcomes.entries()].filter(([stepId]) => stepId !== serverStep.id);
          if (!completed.length) throw new Error("Run at least one workflow operation before recording its evidence.");
          const content = completed.map(([id, value]) => `${id.toUpperCase()}\n${summarize(value, 1400)}`).join("\n\n---\n\n");
          return request({ id: `agent-run-${safeUuid()}`, class: "creative-note", authority: "working", summary: `Forge Agent Workbench: ${goal.slice(0, 140)}`, content: `AUTHOR GOAL:\n${goal}\n\nMODE: ${modeInput.value}\n\nTARGET: ${book?.title || "project"}${chapter ? ` / ${chapter.title}` : ""}${scene ? ` / ${scene.title}` : ""}\n\nEXECUTION EVIDENCE:\n${content}`, reference: "forge-agent-workbench", relevanceTags: ["agent-workflow", "creative-workflow", modeInput.value] });
        };
        break;
      default: run = () => { throw new Error(`Forge Workbench has no execution adapter for discovered tool "${tool.id}".`); };
    }
    return { ...base, run };
  }

  async function serverPlan(goal, recipeId = "") {
    const id = projectId();
    const target = { ...(bookInput.value ? { bookId: bookInput.value } : {}), ...(chapterInput.value ? { chapterId: chapterInput.value } : {}), ...(sceneInput.value ? { sceneId: sceneInput.value } : {}) };
    const path = recipeId ? `/api/projects/${encodeURIComponent(id)}/agent/recipes/${encodeURIComponent(recipeId)}/plan` : `/api/projects/${encodeURIComponent(id)}/agent/plan`;
    const response = await api(path, { method: "POST", body: JSON.stringify({ goal, ...target }) });
    const steps = Array.isArray(response.plan?.steps) ? response.plan.steps : [];
    if (!steps.length) throw new Error("Forge server returned an empty governed Agent plan.");
    return { response, steps: steps.map((step) => makeExecutableStep(step, goal)) };
  }

  function safeUuid() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function artifactSummary(value) {
    if (!value || typeof value !== "object" || !("contentBase64" in value)) return value;
    const { contentBase64: _bytes, ...summaryValue } = value;
    return { ...summaryValue, contentBase64: `[${value.byteLength || 0} bytes returned and downloaded]` };
  }
  function summarize(value, max = 4000) {
    const clean = artifactSummary(value);
    const text = typeof clean === "string" ? clean : JSON.stringify(clean, null, 2);
    return text.length > max ? `${text.slice(0, max)}\n… clipped by Agent Workbench display …` : text;
  }
  function downloadArtifact(artifact) {
    if (!artifact?.contentBase64 || !artifact?.fileName || !artifact?.mimeType) throw new Error("Forge production returned no downloadable artifact bytes.");
    const raw = atob(artifact.contentBase64), bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    const url = URL.createObjectURL(new Blob([bytes], { type: artifact.mimeType }));
    const link = document.createElement("a"); link.href = url; link.download = artifact.fileName; link.hidden = true;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function executeStep(step) {
    const ui = stepUi.get(step.id);
    if (!ui || step.state === "running" || step.state === "done" || step.blocked) return step.state === "done";
    const { button, output } = ui;
    button.disabled = true; step.state = "running"; button.textContent = "Running real Forge operation…";
    setStatus(`Running: ${step.title}`);
    try {
      const value = await step.run(); outcomes.set(step.id, artifactSummary(value)); step.state = "done";
      output.textContent = summarize(value); output.classList.remove("agent-hidden"); button.textContent = "Completed";
      setStatus(`${step.title} completed. No unapproved state-changing step ran automatically.`);
      if (step.toolId !== "memory.record-working") await refreshAfterStep();
      return true;
    } catch (error) {
      step.state = "failed"; output.textContent = error instanceof Error ? error.message : String(error);
      output.classList.remove("agent-hidden"); button.disabled = false; button.textContent = "Retry approved step";
      setStatus(`${step.title} failed safely. No later step was run.`); return false;
    }
  }

  async function runSafeGroup(button) {
    const eligible = plan.filter((step) => step.eligibleForApprovedRunGroup && !step.blocked && step.state !== "done");
    if (!eligible.length) return;
    button.disabled = true; button.textContent = "Running approved read-only group…";
    setStatus(`Running ${eligible.length} author-approved read-only Agent steps in order…`);
    for (const step of eligible) {
      if (!await executeStep(step)) {
        button.disabled = false; button.textContent = "Retry remaining safe read-only group";
        setStatus(`Safe run group stopped at ${step.title}. No later group step ran.`); return;
      }
    }
    button.textContent = "Safe read-only group completed";
    setStatus("Approved read-only group completed. Proposal, artifact, provider-backed state changes, and memory steps still require individual approval.");
  }

  function renderPlan(label = "Approved execution queue") {
    planHost.replaceChildren(); stepUi.clear();
    if (!plan.length) return;
    const header = document.createElement("div"); header.className = "agent-step-head";
    const heading = document.createElement("h2"); heading.textContent = label; header.append(heading);
    const safe = plan.filter((step) => step.eligibleForApprovedRunGroup && !step.blocked);
    if (safe.length > 1) {
      const group = document.createElement("button"); group.type = "button"; group.className = "agent-secondary agent-group-run";
      group.textContent = `Approve & run ${safe.length} safe read-only steps`;
      group.addEventListener("click", () => runSafeGroup(group)); header.append(group);
    }
    planHost.append(header);
    plan.forEach((step, index) => {
      const card = document.createElement("section"); card.className = "agent-step"; card.dataset.stepId = step.id; card.dataset.toolId = step.toolId;
      const head = document.createElement("div"); head.className = "agent-step-head";
      const titleWrap = document.createElement("div");
      const title = document.createElement("h3"); title.textContent = `${index + 1}. ${step.title}`;
      const description = document.createElement("p"); description.className = "muted"; description.textContent = step.description;
      titleWrap.append(title, description);
      const badge = document.createElement("span"); badge.className = "agent-badge"; badge.textContent = step.authority;
      head.append(titleWrap, badge); card.append(head);
      if (step.eligibleForApprovedRunGroup) {
        const safeNote = document.createElement("p"); safeNote.className = "muted";
        safeNote.textContent = "Eligible for an author-approved read-only run group; it has no registered state effect."; card.append(safeNote);
      }
      if (step.blocked) {
        const blocked = document.createElement("p"); blocked.className = "agent-note"; blocked.textContent = `Blocked: ${step.blocked}`; card.append(blocked);
      }
      const button = document.createElement("button"); button.type = "button";
      button.textContent = step.blocked ? "Blocked by current project/mode" : "Approve & run this step"; button.disabled = Boolean(step.blocked);
      const output = document.createElement("pre"); output.className = "agent-result agent-hidden"; output.setAttribute("aria-live", "polite");
      button.addEventListener("click", () => executeStep(step)); stepUi.set(step.id, { button, output });
      card.append(button, output); planHost.append(card);
    });
  }

  async function refreshAfterStep() {
    try {
      const id = projectId();
      const [project, workspace, collaboration, health, recipeSnapshot] = await Promise.all([
        api(`/api/projects/${encodeURIComponent(id)}`), api(`/api/projects/${encodeURIComponent(id)}/workspace`),
        api(`/api/projects/${encodeURIComponent(id)}/collaboration`), api(`/api/projects/${encodeURIComponent(id)}/health`),
        api(`/api/projects/${encodeURIComponent(id)}/agent/recipes`),
      ]);
      recipes = Array.isArray(recipeSnapshot.recipes) ? recipeSnapshot.recipes : recipes;
      truth = { ...truth, project, workspace, collaboration, health };
      fillTargets({ bookId: bookInput.value, chapterId: chapterInput.value, sceneId: sceneInput.value });
      renderRecipes(); renderSnapshot();
    } catch { /* execution evidence stays authoritative even if snapshot refresh fails */ }
  }

  async function saveModeAndPlan(event) {
    event.preventDefault();
    try {
      const id = projectId(), goal = goalInput.value.trim();
      if (!goal) throw new Error("Describe the creative mission first.");
      if (!truth || truth.project.metadata?.id !== id) await loadTruth();
      setStatus("Saving collaboration policy and asking the server-owned planner…");
      const collaboration = await api(`/api/projects/${encodeURIComponent(id)}/collaboration`, { method: "POST", body: JSON.stringify({ mode: modeInput.value }) });
      truth = { ...truth, collaboration }; outcomes.clear();
      const planned = await serverPlan(goal); plan = planned.steps;
      renderSnapshot(); renderPlan("Server-governed execution queue");
      setStatus(`${plan.length} server-governed workflow steps planned from ${registry.length} discovered tools. Nothing has executed yet.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }

  async function saveRecipe() {
    try {
      if (!plan.length) throw new Error("Plan a governed workflow before saving it as a Forge Recipe.");
      const title = recipeName?.value?.trim();
      if (!title) throw new Error("Give the Forge Recipe a name first.");
      const steps = plan.filter((step) => step.toolId !== "memory.record-working").map((step) => ({ toolId: step.toolId, instruction: step.serverStep?.reason || `Run ${step.title}` }));
      if (!steps.length) throw new Error("The current plan has no reusable creative operation to save.");
      setRecipeStatus("Saving durable Forge Recipe…");
      const result = await api(`/api/projects/${encodeURIComponent(projectId())}/agent/recipes`, { method: "POST", body: JSON.stringify({ title, description: goalInput.value.trim() || title, steps }) });
      recipes = [...recipes.filter((recipe) => recipe.id !== result.recipe.id), result.recipe];
      renderRecipes(result.recipe.id); renderSnapshot(); if (recipeName) recipeName.value = "";
      setRecipeStatus(`Saved ${result.recipe.title} v${result.recipe.version}.`);
    } catch (error) { setRecipeStatus(error instanceof Error ? error.message : String(error)); }
  }

  async function compileRecipe() {
    try {
      const recipeId = recipeSelect?.value;
      if (!recipeId) throw new Error("Choose a Forge Recipe first.");
      const recipe = recipes.find((candidate) => candidate.id === recipeId);
      const goal = goalInput.value.trim() || recipe?.description || recipe?.title || "Run this Forge Recipe.";
      setRecipeStatus(`Compiling ${recipe?.title || recipeId} through the server governance boundary…`); outcomes.clear();
      const planned = await serverPlan(goal, recipeId); plan = planned.steps;
      renderPlan(`Forge Recipe · ${planned.response.recipe?.title || recipe?.title || recipeId}`);
      setRecipeStatus(`Recipe compiled to ${plan.length} visible governed steps. Nothing has executed yet.`);
      setStatus("Forge Recipe loaded. Review blocked/provider/state boundaries before approving any step.");
    } catch (error) { setRecipeStatus(error instanceof Error ? error.message : String(error)); }
  }

  async function deleteRecipe() {
    try {
      const recipeId = recipeSelect?.value;
      if (!recipeId) throw new Error("Choose a Forge Recipe first.");
      const recipe = recipes.find((candidate) => candidate.id === recipeId);
      setRecipeStatus(`Archiving ${recipe?.title || recipeId} with an append-only tombstone…`);
      await api(`/api/projects/${encodeURIComponent(projectId())}/agent/recipes/${encodeURIComponent(recipeId)}`, { method: "DELETE" });
      recipes = recipes.filter((candidate) => candidate.id !== recipeId); renderRecipes(); renderSnapshot();
      setRecipeStatus("Forge Recipe removed from the active list; its durable version history remains preserved.");
    } catch (error) { setRecipeStatus(error instanceof Error ? error.message : String(error)); }
  }

  bookInput.addEventListener("change", () => fillChapters());
  chapterInput.addEventListener("change", () => fillScenes());
  sceneInput.addEventListener("change", renderSnapshot);
  $("#agent-form").addEventListener("submit", saveModeAndPlan);
  $("#agent-refresh").addEventListener("click", () => loadTruth().catch((error) => setStatus(error.message)));
  projectInput.addEventListener("change", () => { plan = []; outcomes.clear(); planHost.replaceChildren(); loadTruth().catch((error) => setStatus(error.message)); });
  recipeSelect?.addEventListener("change", () => { if (recipeCompile) recipeCompile.disabled = !recipeSelect.value; if (recipeDelete) recipeDelete.disabled = !recipeSelect.value; });
  recipeSave?.addEventListener("click", saveRecipe);
  recipeCompile?.addEventListener("click", compileRecipe);
  recipeDelete?.addEventListener("click", deleteRecipe);

  loadTruth().catch((error) => {
    snapshot.innerHTML = "";
    const note = document.createElement("p"); note.className = "agent-note"; note.textContent = error.message;
    snapshot.append(note); setStatus("Project truth could not be loaded.");
  });
})();