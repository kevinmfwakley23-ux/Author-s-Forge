/* Forge Agent Workbench: transparent multi-step creative orchestration over existing real Forge APIs. */
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

  const initialProjectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  projectInput.value = initialProjectId;
  back.href = `/?project=${encodeURIComponent(initialProjectId)}`;

  let truth = null;
  let plan = [];
  const outcomes = new Map();

  function setStatus(message) { status.textContent = message; }

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
    const chapterId = chapters.some((chapter) => chapter.id === preferredChapterId) ? preferredChapterId : chapters[0]?.id || "";
    chapterInput.value = chapterId;
    fillScenes(preferredSceneId);
  }

  function fillScenes(preferredSceneId = "") {
    const chapter = selectedChapter();
    sceneInput.replaceChildren();
    const scenes = chapter?.scenes || [];
    if (!scenes.length) option(sceneInput, "", "No scenes yet");
    for (const scene of scenes) option(sceneInput, scene.id, `${scene.number}. ${scene.title || scene.id}`);
    const sceneId = scenes.some((scene) => scene.id === preferredSceneId) ? preferredSceneId : scenes[0]?.id || "";
    sceneInput.value = sceneId;
    renderSnapshot();
  }

  function renderSnapshot() {
    if (!truth) return;
    const book = selectedBook();
    const chapter = selectedChapter();
    const scene = selectedScene();
    const health = truth.health;
    const research = truth.researchStatus;
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
      ["Mode", truth.collaboration.mode],
    ];
    for (const [label, value] of values) {
      const row = document.createElement("div");
      row.className = "agent-stat";
      const strong = document.createElement("strong"); strong.textContent = label;
      const span = document.createElement("span"); span.textContent = value;
      row.append(strong, span); snapshot.append(row);
    }
    if (!research.available) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = research.reason || "Live research is not currently available.";
      snapshot.append(note);
    }
  }

  async function loadTruth() {
    const id = projectId();
    setStatus("Reading durable project truth…");
    const base = `/api/projects/${encodeURIComponent(id)}`;
    const [project, workspace, collaboration, health, researchStatus] = await Promise.all([
      api(base),
      api(`${base}/workspace`),
      api(`${base}/collaboration`),
      api(`${base}/health`),
      api(`${base}/research/live/status`).catch((error) => ({ available: false, reason: error.message, domains: [] })),
    ]);
    const previous = { bookId: bookInput.value, chapterId: chapterInput.value, sceneId: sceneInput.value };
    truth = { project, workspace, collaboration, health, researchStatus };
    modeInput.value = collaboration.mode;
    localStorage.setItem("forge-project", id);
    back.href = `/?project=${encodeURIComponent(id)}`;
    history.replaceState({}, "", `/forge-agent.html?project=${encodeURIComponent(id)}`);
    fillTargets(previous);
    setStatus("Project truth loaded. Choose a target and describe the mission.");
    return truth;
  }

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

  function chooseExportFormat(goal) {
    if (goal.includes("epub")) return "epub";
    if (goal.includes("docx") || goal.includes("word document")) return "docx";
    if (goal.includes("kdp") && goal.includes("epub")) return "kdp-epub";
    if (goal.includes("kdp") && goal.includes("docx")) return "kdp-docx";
    if (goal.includes("kdp")) return "kdp-pdf";
    return "pdf";
  }

  function makeStep(id, title, authority, description, run, blocked = "") {
    return { id, title, authority, description, run, blocked, state: "ready" };
  }

  function buildPlan(goalText) {
    if (!truth) throw new Error("Load project truth before planning.");
    const goal = goalText.trim();
    if (!goal) throw new Error("Describe the creative mission first.");
    const lower = goal.toLowerCase();
    const mode = modeInput.value;
    const book = selectedBook();
    const chapter = selectedChapter();
    const scene = selectedScene();
    const wantsResearch = hasAny(lower, ["research", "source", "fact", "verify", "market", "niche", "history", "setting", "real world"]);
    const wantsArchitecture = hasAny(lower, ["outline", "architecture", "plot", "story structure", "chapter plan", "plan the book", "premise"]);
    const wantsDraft = hasAny(lower, ["write", "draft", "continue", "prose", "scene", "chapter", "manuscript", "rewrite", "compose"]);
    const wantsEdit = hasAny(lower, ["edit", "revise", "revision", "polish", "critique", "continuity", "copyedit", "proofread", "proofreading"]);
    const wantsExport = hasAny(lower, ["export", "pdf", "epub", "docx", "production", "print", "review copy", "publish"]);
    const steps = [];

    if (wantsResearch) {
      const domain = chooseResearchDomain(lower);
      steps.push(makeStep("research", "Source-backed live research", "working memory", `Research the mission using Forge's hosted evidence boundary (${domain}). Returned claims remain working research, not canon.`, async () => {
        if (!truth.researchStatus.available) throw new Error(truth.researchStatus.reason || "Live research is unavailable under the current owner/provider policy.");
        return api(`/api/projects/${encodeURIComponent(projectId())}/research/live`, {
          method: "POST",
          body: JSON.stringify({
            question: goal,
            researchedBecause: "Author-approved Forge Agent Workbench mission",
            domain,
            ...(book ? { bookId: book.id } : {}),
            ...(chapter ? { chapterId: chapter.id } : {}),
            ...(scene ? { sceneId: scene.id } : {}),
          }),
        });
      }));
    }

    if (wantsArchitecture) {
      steps.push(makeStep("architecture", "Generate architecture candidate", "candidate only", "Ask the real AI broker for a structured story architecture. The response is displayed for review and is not silently persisted into the manuscript.", async () => api(`/api/projects/${encodeURIComponent(projectId())}/ai/architecture`, {
        method: "POST",
        body: JSON.stringify({ idea: goal, kind: book?.kind || "novel", targetChapters: book?.chapters?.length || 0 }),
      })));
    }

    if (wantsDraft || (!wantsResearch && !wantsArchitecture && !wantsEdit && !wantsExport && mode !== "editor")) {
      const blockReason = mode === "editor"
        ? "Editor mode does not permit drafting. Change collaboration mode if the author wants new prose."
        : (!book || !chapter || !scene ? "A real book, chapter, and scene target are required before Forge can create a durable writing proposal." : "");
      steps.push(makeStep("context", "Preview grounded project context", "read only", "Read the selected project's canon, character, voice, research, and other salient context before generation.", async () => api(`/api/projects/${encodeURIComponent(projectId())}/context`, {
        method: "POST",
        body: JSON.stringify({ query: goal }),
      }), !book ? "Create or select a book before grounded scene work." : ""));
      steps.push(makeStep("writing", "Create durable writing proposal", "author review required", "Generate against the selected scene through the governed writing service. The candidate is stored in the proposal ledger and cannot alter manuscript text until separately accepted and applied.", async () => {
        const currentBook = selectedBook(), currentChapter = selectedChapter(), currentScene = selectedScene();
        if (!currentBook || !currentChapter || !currentScene) throw new Error("Select a valid book, chapter, and scene.");
        const task = lower.includes("rewrite") || lower.includes("revise") ? "rewrite" : (currentScene.content?.trim() ? "continue" : "draft");
        return api(`/api/projects/${encodeURIComponent(projectId())}/ai/writing/generate`, {
          method: "POST",
          body: JSON.stringify({
            bookId: currentBook.id,
            chapterId: currentChapter.id,
            sceneId: currentScene.id,
            task,
            instruction: goal,
            contextQuery: goal,
          }),
        });
      }, blockReason));
    }

    if (wantsEdit || mode === "editor") {
      const blocked = !scene ? "Select a scene before running editorial analysis." : (!scene.content?.trim() ? "The selected scene has no manuscript text to analyze." : "");
      steps.push(makeStep("editing", "Run multi-lens editorial analysis", "read only", "Analyze the selected scene through Forge's developmental, continuity, line, copy, and proofreading lenses. This reports evidence and does not rewrite the manuscript.", async () => {
        const current = selectedScene();
        if (!current?.content?.trim()) throw new Error("The selected scene has no manuscript text to edit.");
        return api(`/api/projects/${encodeURIComponent(projectId())}/edit`, {
          method: "POST",
          body: JSON.stringify({
            manuscriptId: "studio-workspace",
            bookId: selectedBook()?.id,
            chapterId: selectedChapter()?.id,
            sceneId: current.id,
            title: current.title || "Agent editorial analysis",
            text: current.content,
            roles: ["developmental", "continuity", "line", "copy", "proofreading"],
          }),
        });
      }, blocked));
    }

    if (wantsExport) {
      const format = chooseExportFormat(lower);
      steps.push(makeStep("production", `Render real ${format.toUpperCase()} artifact`, "artifact generation", "Build the selected book with Forge's production engine and download the exact returned bytes. This does not claim external publication or retailer acceptance.", async () => {
        const currentBook = selectedBook();
        if (!currentBook) throw new Error("Select a book before production.");
        const artifact = await api(`/api/projects/${encodeURIComponent(projectId())}/export`, {
          method: "POST",
          body: JSON.stringify({ bookId: currentBook.id, format, pageSize: "6x9", author: authorInput.value.trim() || "Author" }),
        });
        downloadArtifact(artifact);
        return artifactSummary(artifact);
      }, !book ? "A book is required before production." : ""));
    }

    steps.push(makeStep("record", "Record workflow evidence in Project Brain", "working memory", "After at least one operation succeeds, save a compact run record as working creative memory. This is an audit/context record, not story canon.", async () => {
      const completed = [...outcomes.entries()];
      if (!completed.length) throw new Error("Run at least one workflow operation before recording its evidence.");
      const content = completed.map(([id, value]) => `${id.toUpperCase()}\n${summarize(value, 1400)}`).join("\n\n---\n\n");
      return api(`/api/projects/${encodeURIComponent(projectId())}/memory`, {
        method: "POST",
        body: JSON.stringify({
          id: `agent-run-${safeUuid()}`,
          class: "creative-note",
          authority: "working",
          summary: `Forge Agent Workbench: ${goal.slice(0, 140)}`,
          content: `AUTHOR GOAL:\n${goal}\n\nMODE: ${mode}\n\nTARGET: ${book?.title || "project"}${chapter ? ` / ${chapter.title}` : ""}${scene ? ` / ${scene.title}` : ""}\n\nEXECUTION EVIDENCE:\n${content}`,
          reference: "forge-agent-workbench",
          relevanceTags: ["agent-workflow", "creative-workflow", mode],
        }),
      });
    }));

    return steps;
  }

  function safeUuid() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function summarize(value, max = 4000) {
    const clean = artifactSummary(value);
    const text = typeof clean === "string" ? clean : JSON.stringify(clean, null, 2);
    return text.length > max ? `${text.slice(0, max)}\n… clipped by Agent Workbench display …` : text;
  }

  function artifactSummary(value) {
    if (!value || typeof value !== "object") return value;
    if (!("contentBase64" in value)) return value;
    const { contentBase64: _bytes, ...summaryValue } = value;
    return { ...summaryValue, contentBase64: `[${value.byteLength || 0} bytes returned and downloaded]` };
  }

  function downloadArtifact(artifact) {
    if (!artifact?.contentBase64 || !artifact?.fileName || !artifact?.mimeType) throw new Error("Forge production returned no downloadable artifact bytes.");
    const raw = atob(artifact.contentBase64);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    const url = URL.createObjectURL(new Blob([bytes], { type: artifact.mimeType }));
    const link = document.createElement("a");
    link.href = url; link.download = artifact.fileName; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderPlan() {
    planHost.replaceChildren();
    if (!plan.length) return;
    const heading = document.createElement("h2"); heading.textContent = "Approved execution queue"; planHost.append(heading);
    plan.forEach((step, index) => {
      const card = document.createElement("section"); card.className = "agent-step"; card.dataset.stepId = step.id;
      const head = document.createElement("div"); head.className = "agent-step-head";
      const titleWrap = document.createElement("div");
      const title = document.createElement("h3"); title.textContent = `${index + 1}. ${step.title}`;
      const description = document.createElement("p"); description.className = "muted"; description.textContent = step.description;
      titleWrap.append(title, description);
      const badge = document.createElement("span"); badge.className = "agent-badge"; badge.textContent = step.authority;
      head.append(titleWrap, badge); card.append(head);
      if (step.blocked) {
        const blocked = document.createElement("p"); blocked.className = "agent-note"; blocked.textContent = `Blocked: ${step.blocked}`; card.append(blocked);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = step.blocked ? "Blocked by current project/mode" : "Approve & run this step";
      button.disabled = Boolean(step.blocked);
      const output = document.createElement("pre"); output.className = "agent-result agent-hidden"; output.setAttribute("aria-live", "polite");
      button.addEventListener("click", async () => {
        button.disabled = true; step.state = "running"; button.textContent = "Running real Forge operation…";
        setStatus(`Running: ${step.title}`);
        try {
          const value = await step.run();
          outcomes.set(step.id, artifactSummary(value));
          step.state = "done";
          output.textContent = summarize(value);
          output.classList.remove("agent-hidden");
          button.textContent = "Completed";
          setStatus(`${step.title} completed. No additional step ran automatically.`);
          if (step.id !== "record") await refreshAfterStep();
        } catch (error) {
          step.state = "failed";
          output.textContent = error instanceof Error ? error.message : String(error);
          output.classList.remove("agent-hidden");
          button.disabled = false; button.textContent = "Retry approved step";
          setStatus(`${step.title} failed safely. No later step was run.`);
        }
      });
      card.append(button, output); planHost.append(card);
    });
  }

  async function refreshAfterStep() {
    try {
      const id = projectId();
      const [project, workspace, collaboration, health] = await Promise.all([
        api(`/api/projects/${encodeURIComponent(id)}`), api(`/api/projects/${encodeURIComponent(id)}/workspace`), api(`/api/projects/${encodeURIComponent(id)}/collaboration`), api(`/api/projects/${encodeURIComponent(id)}/health`),
      ]);
      truth = { ...truth, project, workspace, collaboration, health };
      fillTargets({ bookId: bookInput.value, chapterId: chapterInput.value, sceneId: sceneInput.value });
    } catch { /* execution result remains authoritative even if snapshot refresh fails */ }
  }

  async function saveModeAndPlan(event) {
    event.preventDefault();
    try {
      const id = projectId();
      const goal = goalInput.value.trim();
      if (!goal) throw new Error("Describe the creative mission first.");
      if (!truth || truth.project.metadata?.id !== id) await loadTruth();
      setStatus("Saving the author-selected collaboration policy…");
      const collaboration = await api(`/api/projects/${encodeURIComponent(id)}/collaboration`, { method: "POST", body: JSON.stringify({ mode: modeInput.value }) });
      truth = { ...truth, collaboration };
      outcomes.clear();
      plan = buildPlan(goal);
      renderSnapshot(); renderPlan();
      setStatus(`${plan.length} transparent workflow steps planned. Nothing has executed yet.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  bookInput.addEventListener("change", () => fillChapters());
  chapterInput.addEventListener("change", () => fillScenes());
  sceneInput.addEventListener("change", renderSnapshot);
  $("#agent-form").addEventListener("submit", saveModeAndPlan);
  $("#agent-refresh").addEventListener("click", () => loadTruth().catch((error) => setStatus(error.message)));
  projectInput.addEventListener("change", () => { plan = []; outcomes.clear(); planHost.replaceChildren(); loadTruth().catch((error) => setStatus(error.message)); });

  loadTruth().catch((error) => {
    snapshot.innerHTML = "";
    const note = document.createElement("p"); note.className = "agent-note"; note.textContent = error.message;
    snapshot.append(note); setStatus("Project truth could not be loaded.");
  });
})();
