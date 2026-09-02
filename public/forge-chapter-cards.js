/* First-class Chapter Cards for Story Development. Chapter identity/title remain manuscript-owned; planning stays project-scoped and author-controlled. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const projectUrl = (suffix) => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const workspace = () => window.forgeWorkspaceState;
  let planning = { formatVersion: 1, sceneAttributes: {}, chapterCards: {}, plotlines: [] };
  let options = { characters: [], locations: [], tags: [] };
  let selected = null;
  let observer = null;
  let syncing = false;

  async function api(path, init = {}) {
    const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Chapter Card request failed (${response.status}).`);
    return payload;
  }
  function notify(message, kind = "info") {
    const node = document.getElementById("story-map-message");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.kind = kind;
    node.hidden = !message;
  }
  function splitLines(id) {
    return String(document.getElementById(id)?.value || "").split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
  }
  function checked(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((node) => node.value);
  }
  function findChapter(bookId, chapterId) {
    const book = workspace()?.books?.find((item) => item.id === bookId);
    const chapter = book?.chapters?.find((item) => item.id === chapterId);
    return book && chapter ? { book, chapter } : null;
  }
  function installStyles() {
    if (document.getElementById("forge-chapter-card-styles")) return;
    const style = document.createElement("style");
    style.id = "forge-chapter-card-styles";
    style.textContent = `
      .chapter-card-open{min-height:44px;margin-left:.45rem}.chapter-card-summary{font-size:.78rem;opacity:.78;margin:.25rem 0 .45rem}.chapter-card-editor{margin-top:1rem;border:1px solid rgba(127,127,127,.35);border-radius:12px;padding:1rem}.chapter-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.chapter-card-grid label{display:grid;gap:.3rem}.chapter-card-grid input,.chapter-card-grid textarea{width:100%;min-height:44px}.chapter-card-grid textarea{min-height:88px}.chapter-card-people{display:flex;gap:.5rem;flex-wrap:wrap}.chapter-card-people label{display:flex;align-items:center;gap:.35rem;border:1px solid rgba(127,127,127,.35);border-radius:999px;padding:.35rem .55rem;min-height:44px}.chapter-card-actions{display:flex;gap:.55rem;flex-wrap:wrap;margin-top:.8rem}.chapter-card-actions button{min-height:44px}
      @media(max-width:800px){.chapter-card-grid{grid-template-columns:1fr}.chapter-card-open{min-height:44px}.chapter-card-editor{padding:.75rem}.chapter-card-actions button{flex:1 1 150px}}
    `;
    document.head.appendChild(style);
  }
  function ensureEditor() {
    installStyles();
    const view = document.getElementById("story-map");
    if (!view || document.getElementById("story-map-chapter-editor")) return Boolean(view);
    const editor = document.createElement("section");
    editor.id = "story-map-chapter-editor";
    editor.className = "chapter-card-editor";
    editor.hidden = true;
    editor.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">CHAPTER CARD</div><h3 id="chapter-card-title">Chapter</h3><p class="muted">Plan what this chapter must accomplish before drafting it. Chapter number and title stay authoritative in Manuscript.</p></div><button id="chapter-card-close" type="button">Close</button></div>
      <form id="chapter-card-form">
        <div class="chapter-card-grid">
          <label>Location<input id="chapter-card-location" maxlength="500"></label>
          <label>Date / story time<input id="chapter-card-time" maxlength="500"></label>
          <label>Emotional objective<textarea id="chapter-card-emotional" maxlength="3000"></textarea></label>
          <label>Plot objective<textarea id="chapter-card-plot" maxlength="3000"></textarea></label>
          <label>Atmosphere<textarea id="chapter-card-atmosphere" maxlength="3000"></textarea></label>
          <label>Ending hook<textarea id="chapter-card-hook" maxlength="3000"></textarea></label>
          <label>Approximate word count<input id="chapter-card-words" type="number" min="0" step="1" value="0"></label>
        </div>
        <h4>POV character(s)</h4><div id="chapter-card-povs" class="chapter-card-people"></div>
        <h4>Characters present</h4><div id="chapter-card-characters" class="chapter-card-people"></div>
        <div class="chapter-card-grid">
          <label>Required events <span class="muted">one per line</span><textarea id="chapter-card-events" maxlength="40000"></textarea></label>
          <label>Clues <span class="muted">one per line</span><textarea id="chapter-card-clues" maxlength="40000"></textarea></label>
          <label>Reveals <span class="muted">one per line</span><textarea id="chapter-card-reveals" maxlength="40000"></textarea></label>
          <label>Continuity dependencies <span class="muted">one per line</span><textarea id="chapter-card-continuity" maxlength="40000"></textarea></label>
          <label style="grid-column:1/-1">Forbidden deviations <span class="muted">one non-negotiable per line</span><textarea id="chapter-card-forbidden" maxlength="40000" placeholder="Do not reveal the killer.\nMara cannot know about the letter yet."></textarea></label>
        </div>
        <div class="chapter-card-actions"><button class="primary" type="submit">Save Chapter Card</button><button id="chapter-card-remove" type="button">Remove Chapter Card</button></div>
      </form>`;
    view.appendChild(editor);
    document.getElementById("chapter-card-form")?.addEventListener("submit", saveCard);
    document.getElementById("chapter-card-close")?.addEventListener("click", closeEditor);
    document.getElementById("chapter-card-remove")?.addEventListener("click", removeCard);
    return true;
  }
  function renderPeople(containerId, name, selectedIds) {
    const host = document.getElementById(containerId);
    if (!host) return;
    host.innerHTML = options.characters?.length
      ? options.characters.map((character) => `<label><input type="checkbox" name="${name}" value="${esc(character.id)}" ${selectedIds.includes(character.id) ? "checked" : ""}>${esc(character.name)}</label>`).join("")
      : '<span class="muted">Add characters to the Character Bible first.</span>';
  }
  function decorateChapters() {
    const books = workspace()?.books || [];
    const host = document.getElementById("story-map-books");
    if (!host) return;
    const chapterNodes = [...host.querySelectorAll(".story-map-chapter")];
    const chapters = books.flatMap((book) => (book.chapters || []).map((chapter) => ({ book, chapter })));
    chapterNodes.forEach((node, index) => {
      const item = chapters[index];
      if (!item) return;
      let button = node.querySelector("[data-plan-chapter]");
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "chapter-card-open";
        node.querySelector("header")?.appendChild(button);
      }
      button.dataset.planChapter = `${item.book.id}|${item.chapter.id}`;
      const card = planning.chapterCards?.[item.chapter.id];
      button.textContent = card ? "Edit Chapter Card" : "Chapter Card";
      let summary = node.querySelector(".chapter-card-summary");
      if (!summary) { summary = document.createElement("div"); summary.className = "chapter-card-summary"; node.querySelector("header")?.insertAdjacentElement("afterend", summary); }
      if (!card) { summary.textContent = "No chapter-level plan yet."; return; }
      const parts = [card.location, card.storyTime, card.plotObjective, card.endingHook, card.approximateWordCount ? `${card.approximateWordCount} words` : ""].filter(Boolean);
      summary.textContent = parts.join(" • ") || "Chapter Card saved.";
    });
  }
  async function loadPlanning() {
    const result = await api(projectUrl("/story-map/planning"));
    planning = result.planning || planning;
    if (!planning.chapterCards) planning.chapterCards = {};
    options = result.options || options;
  }
  async function sync() {
    if (syncing || !document.getElementById("story-map")) return;
    syncing = true;
    try {
      ensureEditor();
      await loadPlanning();
      decorateChapters();
      if (selected) openCard(selected.bookId, selected.chapterId, false);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally { syncing = false; }
  }
  function openCard(bookId, chapterId, scroll = true) {
    const found = findChapter(bookId, chapterId);
    const editor = document.getElementById("story-map-chapter-editor");
    if (!found || !editor) return;
    selected = { bookId, chapterId };
    const card = planning.chapterCards?.[chapterId] || {
      povCharacterIds: [], location: "", storyTime: "", emotionalObjective: "", plotObjective: "", characterIds: [], requiredEvents: [], clues: [], reveals: [], continuityDependencies: [], atmosphere: "", endingHook: "", approximateWordCount: 0, forbiddenDeviations: [],
    };
    editor.hidden = false;
    document.getElementById("chapter-card-title").textContent = `${found.book.title} · ${found.chapter.number}. ${found.chapter.title}`;
    document.getElementById("chapter-card-location").value = card.location || "";
    document.getElementById("chapter-card-time").value = card.storyTime || "";
    document.getElementById("chapter-card-emotional").value = card.emotionalObjective || "";
    document.getElementById("chapter-card-plot").value = card.plotObjective || "";
    document.getElementById("chapter-card-atmosphere").value = card.atmosphere || "";
    document.getElementById("chapter-card-hook").value = card.endingHook || "";
    document.getElementById("chapter-card-words").value = String(card.approximateWordCount || 0);
    document.getElementById("chapter-card-events").value = (card.requiredEvents || []).join("\n");
    document.getElementById("chapter-card-clues").value = (card.clues || []).join("\n");
    document.getElementById("chapter-card-reveals").value = (card.reveals || []).join("\n");
    document.getElementById("chapter-card-continuity").value = (card.continuityDependencies || []).join("\n");
    document.getElementById("chapter-card-forbidden").value = (card.forbiddenDeviations || []).join("\n");
    renderPeople("chapter-card-povs", "chapter-card-pov", card.povCharacterIds || []);
    renderPeople("chapter-card-characters", "chapter-card-character", card.characterIds || []);
    document.getElementById("chapter-card-remove").disabled = !planning.chapterCards?.[chapterId];
    if (scroll) editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeEditor() {
    selected = null;
    const editor = document.getElementById("story-map-chapter-editor");
    if (editor) editor.hidden = true;
  }
  async function saveCard(event) {
    event.preventDefault();
    if (!selected) return;
    const wordCount = Number(document.getElementById("chapter-card-words")?.value || 0);
    if (!Number.isInteger(wordCount) || wordCount < 0) return notify("Approximate word count must be a non-negative whole number.", "error");
    try {
      const suffix = `/story-map/chapters/${encodeURIComponent(selected.bookId)}/${encodeURIComponent(selected.chapterId)}/card`;
      const result = await api(projectUrl(suffix), { method: "PUT", body: JSON.stringify({ card: {
        povCharacterIds: checked("chapter-card-pov"),
        location: document.getElementById("chapter-card-location").value,
        storyTime: document.getElementById("chapter-card-time").value,
        emotionalObjective: document.getElementById("chapter-card-emotional").value,
        plotObjective: document.getElementById("chapter-card-plot").value,
        characterIds: checked("chapter-card-character"),
        requiredEvents: splitLines("chapter-card-events"),
        clues: splitLines("chapter-card-clues"),
        reveals: splitLines("chapter-card-reveals"),
        continuityDependencies: splitLines("chapter-card-continuity"),
        atmosphere: document.getElementById("chapter-card-atmosphere").value,
        endingHook: document.getElementById("chapter-card-hook").value,
        approximateWordCount: wordCount,
        forbiddenDeviations: splitLines("chapter-card-forbidden"),
      } }) });
      planning = result.planning; options = result.options; decorateChapters(); openCard(selected.bookId, selected.chapterId, false);
      notify("Chapter Card saved as durable planning. Manuscript prose, chapter title, and scene order were not changed.");
    } catch (error) { notify(error instanceof Error ? error.message : String(error), "error"); }
  }
  async function removeCard() {
    if (!selected || !planning.chapterCards?.[selected.chapterId]) return;
    try {
      const suffix = `/story-map/chapters/${encodeURIComponent(selected.bookId)}/${encodeURIComponent(selected.chapterId)}/card`;
      const result = await api(projectUrl(suffix), { method: "DELETE" });
      planning = result.planning; options = result.options; decorateChapters(); closeEditor();
      notify("Chapter Card removed. The manuscript chapter and its scenes remain intact.");
    } catch (error) { notify(error instanceof Error ? error.message : String(error), "error"); }
  }
  function observeStoryMap() {
    const host = document.getElementById("story-map-books");
    if (!host || observer) return;
    observer = new MutationObserver(() => { if (!syncing) decorateChapters(); });
    observer.observe(host, { childList: true, subtree: true });
  }
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-plan-chapter]") : null;
    if (!target) return;
    event.preventDefault();
    const [bookId, chapterId] = String(target.getAttribute("data-plan-chapter") || "").split("|");
    if (bookId && chapterId) openCard(bookId, chapterId);
  });
  async function boot() {
    if (!document.getElementById("story-map")) return;
    ensureEditor(); observeStoryMap(); await sync();
  }
  window.addEventListener("forge:workspace-ready", () => { void boot(); });
  window.addEventListener("hashchange", () => { if (location.hash === "#story-map") void boot(); });
  window.addEventListener("load", () => { setTimeout(() => { void boot(); }, 0); });
  const rootObserver = new MutationObserver(() => { if (document.getElementById("story-map")) { observeStoryMap(); void boot(); } });
  rootObserver.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== "loading") setTimeout(() => { void boot(); }, 0);
})();
