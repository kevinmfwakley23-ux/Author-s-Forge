/* Story Map: visual planning derived from the live durable manuscript workspace plus project-scoped planning metadata. */
(() => {
  "use strict";
  const esc = (v) => String(v ?? "").replace(/[&<>\"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c]));
  const pct = (done, total) => total ? Math.round((done / total) * 100) : 0;
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const projectUrl = (suffix) => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const books = () => window.forgeWorkspaceState?.books || [];
  let planning = { formatVersion: 1, sceneAttributes: {}, plotlines: [] };
  let options = { characters: [], locations: [], tags: [] };
  let planningLoaded = false;
  let selectedScene = null;

  async function api(path, init = {}) {
    const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Story Map request failed (${response.status}).`);
    return payload;
  }
  function notify(message, kind = "info") {
    const node = document.getElementById("story-map-message");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.kind = kind;
    node.hidden = !message;
  }
  function injectStyles() {
    if (document.getElementById("story-map-planning-styles")) return;
    const style = document.createElement("style");
    style.id = "story-map-planning-styles";
    style.textContent = `
      .story-map-tools{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:.65rem;margin:1rem 0}.story-map-tools label,.story-map-editor label,.story-map-plotline-form label{display:grid;gap:.3rem}.story-map-tools select,.story-map-editor input,.story-map-editor textarea,.story-map-editor select,.story-map-plotline-form input,.story-map-plotline-form textarea,.story-map-plotline-form select{min-height:42px;width:100%}.story-map-scenes{display:flex;gap:.55rem;flex-wrap:wrap}.story-map-scene-wrap{display:flex;gap:.25rem;align-items:stretch}.story-map-scene{min-width:150px}.story-map-plan{min-height:44px}.story-map-chips{display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.35rem}.story-map-chip{font-size:.75rem;padding:.12rem .4rem;border:1px solid currentColor;border-radius:999px;opacity:.8}.story-map-editor{margin-top:1rem;border:1px solid rgba(127,127,127,.35);border-radius:12px;padding:1rem}.story-map-editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.story-map-checks{display:flex;gap:.6rem;flex-wrap:wrap}.story-map-checks label{display:flex;align-items:center;gap:.3rem;border:1px solid rgba(127,127,127,.35);border-radius:999px;padding:.25rem .5rem}.story-map-plotline-panel{margin:1rem 0}.story-map-plotline-form{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.story-map-plotline-list{display:grid;gap:.45rem;margin-top:.7rem}.story-map-plotline-row{display:flex;gap:.55rem;align-items:center;justify-content:space-between;border:1px solid rgba(127,127,127,.3);border-radius:9px;padding:.55rem}.story-map-message{padding:.55rem .7rem;border-radius:8px;margin:.5rem 0;background:rgba(127,127,127,.12)}.story-map-message[data-kind="error"]{background:#711;color:#fff}.story-map-scene-wrap[hidden]{display:none!important}.story-map-empty-filter{padding:1rem;border:1px dashed rgba(127,127,127,.4);border-radius:10px}.story-map-meta{font-size:.78rem;opacity:.75;margin-top:.25rem}
      @media(max-width:800px){.story-map-tools,.story-map-editor-grid,.story-map-plotline-form{grid-template-columns:1fr}.story-map-scene-wrap{width:100%}.story-map-scene{flex:1;min-width:0}.story-map-plan{min-width:62px}.story-map-tools select,.story-map-plan,.story-map-editor button,.story-map-plotline-form button{min-height:44px}}
    `;
    document.head.appendChild(style);
  }
  function ensureSurface() {
    injectStyles();
    if (document.querySelector('[data-route="story-map"]')) return;
    const nav = document.querySelector(".sidebar nav");
    const manuscript = document.getElementById("manuscript");
    if (!nav || !manuscript) return;
    const link = document.createElement("a");
    link.href = "#story-map"; link.dataset.route = "story-map"; link.textContent = "Story Map";
    const writing = nav.querySelector('[data-route="writing"]');
    writing ? writing.insertAdjacentElement("beforebegin", link) : nav.appendChild(link);
    const view = document.createElement("section");
    view.id = "story-map"; view.className = "view"; view.dataset.view = ""; view.hidden = true;
    view.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">STORY MAP</div><h2>See the book before you write it</h2><p>Books, chapters and scenes remain the manuscript source of truth. Planning metadata adds POV, location, time, goal, conflict, outcome, emotional beat, tags, plotlines and character arcs without duplicating manuscript structure.</p></div><div class="row"><button id="story-map-refresh" type="button">Refresh map</button></div></div>
      <div id="story-map-message" class="story-map-message" role="status" aria-live="polite" hidden></div>
      <div id="story-map-summary" class="metrics"></div>
      <section class="card"><h3>Cross-scene filters</h3><div class="story-map-tools"><label>Plotline<select id="story-map-filter-plotline"><option value="">All plotlines</option></select></label><label>POV character<select id="story-map-filter-pov"><option value="">All POVs</option></select></label><label>Location<select id="story-map-filter-location"><option value="">All locations</option></select></label><label>Tag<select id="story-map-filter-tag"><option value="">All tags</option></select></label></div><div class="row"><button id="story-map-clear-filters" type="button">Clear filters</button></div></section>
      <details class="card story-map-plotline-panel"><summary><strong>Plotlines & character arcs</strong></summary><form id="story-map-plotline-form" class="story-map-plotline-form"><label>Book<select id="story-map-plotline-book" required></select></label><label>Name<input id="story-map-plotline-name" required maxlength="300" placeholder="Main plot, romance subplot, Mara learns trust…"></label><label>Kind<select id="story-map-plotline-kind"><option value="main">Main plot</option><option value="subplot" selected>Subplot</option><option value="character-arc">Character arc</option></select></label><label>Character<select id="story-map-plotline-character"><option value="">Not character-specific</option></select></label><label style="grid-column:1/-1">Description<textarea id="story-map-plotline-description" maxlength="4000" placeholder="What changes along this line of the story?"></textarea></label><button class="primary" type="submit">Create plotline</button></form><div id="story-map-plotline-list" class="story-map-plotline-list"></div></details>
      <div id="story-map-books" class="story-map-books"></div>
      <section id="story-map-scene-editor" class="story-map-editor" hidden><div class="section-title"><div><div class="eyebrow">SCENE PLANNING</div><h3 id="story-map-editor-title">Scene</h3></div><button id="story-map-editor-close" type="button">Close</button></div><form id="story-map-scene-form"><div class="story-map-editor-grid"><label>Location<input id="story-plan-location" maxlength="500"></label><label>Story time<input id="story-plan-time" maxlength="500" placeholder="Date, time, or relative story moment"></label><label>Scene goal<textarea id="story-plan-goal" maxlength="3000"></textarea></label><label>Conflict<textarea id="story-plan-conflict" maxlength="3000"></textarea></label><label>Outcome<textarea id="story-plan-outcome" maxlength="3000"></textarea></label><label>Emotional beat<textarea id="story-plan-emotion" maxlength="2000"></textarea></label><label style="grid-column:1/-1">Tags<input id="story-plan-tags" placeholder="reveal, romance, clue"></label></div><h4>POV characters</h4><div id="story-plan-povs" class="story-map-checks"></div><h4>Plotline membership</h4><div id="story-plan-plotlines" class="story-map-checks"></div><div class="row"><button class="primary" type="submit">Save scene planning</button></div></form></section>
    `;
    manuscript.insertAdjacentElement("beforebegin", view);
    bindSurface();
  }
  function bindSurface() {
    document.getElementById("story-map-refresh")?.addEventListener("click", () => refresh(true));
    document.getElementById("story-map-clear-filters")?.addEventListener("click", clearFilters);
    for (const id of ["story-map-filter-plotline", "story-map-filter-pov", "story-map-filter-location", "story-map-filter-tag"]) document.getElementById(id)?.addEventListener("change", applyFilters);
    document.getElementById("story-map-plotline-form")?.addEventListener("submit", createPlotline);
    document.getElementById("story-map-plotline-kind")?.addEventListener("change", syncCharacterRequirement);
    document.getElementById("story-map-scene-form")?.addEventListener("submit", saveScenePlanning);
    document.getElementById("story-map-editor-close")?.addEventListener("click", () => { document.getElementById("story-map-scene-editor").hidden = true; selectedScene = null; });
  }
  async function loadPlanning() {
    const result = await api(projectUrl("/story-map/planning"));
    planning = result.planning || planning;
    options = result.options || options;
    planningLoaded = true;
  }
  async function refresh(showMessage = false) {
    ensureSurface();
    try {
      await loadPlanning();
      render();
      if (showMessage) notify("Story Map refreshed from durable manuscript and planning state.");
    } catch (error) {
      planningLoaded = false;
      render();
      notify(error instanceof Error ? error.message : String(error), "error");
    }
  }
  function populateControls() {
    const setOptions = (id, first, values, valueFn = (v) => v, labelFn = (v) => v) => {
      const select = document.getElementById(id); if (!select) return;
      const current = select.value;
      select.innerHTML = `<option value="">${esc(first)}</option>` + values.map((value) => `<option value="${esc(valueFn(value))}">${esc(labelFn(value))}</option>`).join("");
      if ([...select.options].some((option) => option.value === current)) select.value = current;
    };
    setOptions("story-map-filter-plotline", "All plotlines", planning.plotlines, (p) => p.id, (p) => `${p.name} · ${p.kind}`);
    setOptions("story-map-filter-pov", "All POVs", options.characters || [], (c) => c.id, (c) => c.name);
    setOptions("story-map-filter-location", "All locations", options.locations || []);
    setOptions("story-map-filter-tag", "All tags", options.tags || []);
    const bookSelect = document.getElementById("story-map-plotline-book");
    if (bookSelect) bookSelect.innerHTML = books().map((book) => `<option value="${esc(book.id)}">${esc(book.title)}</option>`).join("");
    setOptions("story-map-plotline-character", "Not character-specific", options.characters || [], (c) => c.id, (c) => c.name);
    renderPlotlines();
  }
  function renderPlotlines() {
    const host = document.getElementById("story-map-plotline-list"); if (!host) return;
    if (!planning.plotlines.length) { host.innerHTML = '<p class="muted">No plotlines yet. Create a main plot, subplot, or character arc, then assign scenes from the scene planner.</p>'; return; }
    const names = new Map((options.characters || []).map((character) => [character.id, character.name]));
    host.innerHTML = planning.plotlines.map((plotline) => `<div class="story-map-plotline-row"><div><strong>${esc(plotline.name)}</strong><div class="story-map-meta">${esc(plotline.kind)} · ${plotline.sceneIds.length} scene${plotline.sceneIds.length === 1 ? "" : "s"}${plotline.characterId ? ` · ${esc(names.get(plotline.characterId) || plotline.characterId)}` : ""}</div>${plotline.description ? `<div class="story-map-meta">${esc(plotline.description)}</div>` : ""}</div><button type="button" data-delete-plotline="${esc(plotline.id)}">Delete</button></div>`).join("");
  }
  function render() {
    ensureSurface();
    const host = document.getElementById("story-map-books"), summary = document.getElementById("story-map-summary"); if (!host || !summary) return;
    populateControls();
    const all = books();
    const chapters = all.flatMap((b) => b.chapters || []), scenes = chapters.flatMap((c) => c.scenes || []);
    const completed = scenes.filter((s) => s.lifecycle === "complete").length;
    const plannedScenes = Object.keys(planning.sceneAttributes || {}).length;
    summary.innerHTML = [["Books", all.length], ["Chapters", chapters.length], ["Scenes", scenes.length], ["Complete", `${pct(completed, scenes.length)}%`], ["Planned metadata", plannedScenes], ["Plotlines", planning.plotlines.length]].map(([label, value]) => `<div class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join("");
    if (!all.length) { host.innerHTML = '<article class="card"><h3>No book structure yet</h3><p class="muted">Create a book, chapters, and scenes in Manuscript. The Story Map updates from that durable state.</p></article>'; return; }
    const characterNames = new Map((options.characters || []).map((character) => [character.id, character.name]));
    host.innerHTML = all.map((book) => {
      const bookScenes = (book.chapters || []).flatMap((c) => c.scenes || []), done = bookScenes.filter((s) => s.lifecycle === "complete").length;
      return `<article class="card story-map-book"><div class="section-title"><div><h3>${esc(book.title)}</h3><small>${esc(book.kind || book.lifecycle || "book")} • ${pct(done, bookScenes.length)}% scene completion</small></div></div><div class="story-map-timeline">${(book.chapters || []).map((chapter) => { const cs = chapter.scenes || [], cd = cs.filter((s) => s.lifecycle === "complete").length; return `<section class="story-map-chapter"><header><strong>${esc(chapter.number)}. ${esc(chapter.title)}</strong><span>${pct(cd, cs.length)}%</span></header><div class="story-map-scenes">${cs.length ? cs.map((scene) => sceneHtml(book, chapter, scene, characterNames)).join("") : '<span class="muted">No scenes yet.</span>'}</div></section>`; }).join("")}</div></article>`;
    }).join("") + '<div id="story-map-filter-empty" class="story-map-empty-filter" hidden>No scenes match the active Story Map filters.</div>';
    applyFilters();
    if (selectedScene) openPlanner(selectedScene.bookId, selectedScene.chapterId, selectedScene.sceneId, false);
  }
  function sceneHtml(book, chapter, scene, characterNames) {
    const attrs = planning.sceneAttributes?.[scene.id] || {};
    const memberships = planning.plotlines.filter((plotline) => plotline.sceneIds.includes(scene.id));
    const povNames = (attrs.povCharacterIds || []).map((id) => characterNames.get(id) || id);
    const chips = [attrs.location, ...(attrs.tags || []), ...memberships.map((p) => p.name)].filter(Boolean);
    const meta = [povNames.length ? `POV: ${povNames.join(", ")}` : "", attrs.storyTime || "", attrs.emotionalBeat || ""].filter(Boolean).join(" · ");
    return `<div class="story-map-scene-wrap" data-scene-id="${esc(scene.id)}" data-book-id="${esc(book.id)}" data-plotlines="${esc(memberships.map((p) => p.id).join("|"))}" data-povs="${esc((attrs.povCharacterIds || []).join("|"))}" data-location="${esc(attrs.location || "")}" data-tags="${esc((attrs.tags || []).join("|"))}"><button type="button" class="story-map-scene ${scene.lifecycle === "complete" ? "complete" : ""}" data-open-scene="${esc(book.id)}|${esc(chapter.id)}|${esc(scene.id)}"><b>${esc(scene.number)}</b><span>${esc(scene.title)}</span><small>${esc(scene.lifecycle)}</small>${meta ? `<div class="story-map-meta">${esc(meta)}</div>` : ""}${chips.length ? `<div class="story-map-chips">${chips.slice(0, 6).map((chip) => `<span class="story-map-chip">${esc(chip)}</span>`).join("")}</div>` : ""}</button><button type="button" class="story-map-plan" data-plan-scene="${esc(book.id)}|${esc(chapter.id)}|${esc(scene.id)}">Plan</button></div>`;
  }
  function applyFilters() {
    const plotline = document.getElementById("story-map-filter-plotline")?.value || "";
    const pov = document.getElementById("story-map-filter-pov")?.value || "";
    const locationValue = document.getElementById("story-map-filter-location")?.value || "";
    const tag = document.getElementById("story-map-filter-tag")?.value || "";
    let visible = 0;
    document.querySelectorAll("#story-map-books .story-map-scene-wrap").forEach((node) => {
      const plotlines = String(node.dataset.plotlines || "").split("|").filter(Boolean);
      const povs = String(node.dataset.povs || "").split("|").filter(Boolean);
      const tags = String(node.dataset.tags || "").split("|").filter(Boolean);
      const match = (!plotline || plotlines.includes(plotline)) && (!pov || povs.includes(pov)) && (!locationValue || node.dataset.location === locationValue) && (!tag || tags.includes(tag));
      node.hidden = !match;
      if (match) visible += 1;
    });
    const empty = document.getElementById("story-map-filter-empty"); if (empty) empty.hidden = visible > 0 || books().flatMap((b) => b.chapters || []).flatMap((c) => c.scenes || []).length === 0;
  }
  function clearFilters() {
    for (const id of ["story-map-filter-plotline", "story-map-filter-pov", "story-map-filter-location", "story-map-filter-tag"]) { const node = document.getElementById(id); if (node) node.value = ""; }
    applyFilters();
  }
  function syncCharacterRequirement() {
    const kind = document.getElementById("story-map-plotline-kind")?.value;
    const select = document.getElementById("story-map-plotline-character");
    if (select) select.required = kind === "character-arc";
  }
  async function createPlotline(event) {
    event.preventDefault(); notify("");
    const kind = document.getElementById("story-map-plotline-kind").value;
    const characterId = document.getElementById("story-map-plotline-character").value;
    if (kind === "character-arc" && !characterId) { notify("Choose the character whose arc this plotline tracks.", "error"); return; }
    try {
      const result = await api(projectUrl("/story-map/plotlines"), { method: "POST", body: JSON.stringify({
        bookId: document.getElementById("story-map-plotline-book").value,
        name: document.getElementById("story-map-plotline-name").value,
        kind,
        characterId: characterId || undefined,
        description: document.getElementById("story-map-plotline-description").value,
      }) });
      planning = result.planning; options = result.options; planningLoaded = true;
      document.getElementById("story-map-plotline-form").reset(); syncCharacterRequirement(); render(); notify("Plotline saved. Assign scenes from each scene's Plan button.");
    } catch (error) { notify(error instanceof Error ? error.message : String(error), "error"); }
  }
  async function deletePlotline(id) {
    if (!id) return;
    try {
      const result = await api(projectUrl(`/story-map/plotlines/${encodeURIComponent(id)}`), { method: "DELETE" });
      planning = result.planning; options = result.options; render(); notify("Plotline removed. Manuscript scenes were not changed.");
    } catch (error) { notify(error instanceof Error ? error.message : String(error), "error"); }
  }
  function openPlanner(bookId, chapterId, sceneId, scroll = true) {
    const book = books().find((item) => item.id === bookId);
    const chapter = book?.chapters?.find((item) => item.id === chapterId);
    const scene = chapter?.scenes?.find((item) => item.id === sceneId);
    if (!book || !chapter || !scene) return;
    selectedScene = { bookId, chapterId, sceneId };
    const editor = document.getElementById("story-map-scene-editor"); if (!editor) return;
    editor.hidden = false;
    document.getElementById("story-map-editor-title").textContent = `${book.title} · ${chapter.number}. ${chapter.title} · ${scene.number}. ${scene.title}`;
    const attrs = planning.sceneAttributes?.[sceneId] || { povCharacterIds: [], location: "", storyTime: "", goal: "", conflict: "", outcome: "", emotionalBeat: "", tags: [] };
    document.getElementById("story-plan-location").value = attrs.location || "";
    document.getElementById("story-plan-time").value = attrs.storyTime || "";
    document.getElementById("story-plan-goal").value = attrs.goal || "";
    document.getElementById("story-plan-conflict").value = attrs.conflict || "";
    document.getElementById("story-plan-outcome").value = attrs.outcome || "";
    document.getElementById("story-plan-emotion").value = attrs.emotionalBeat || "";
    document.getElementById("story-plan-tags").value = (attrs.tags || []).join(", ");
    document.getElementById("story-plan-povs").innerHTML = (options.characters || []).length ? options.characters.map((character) => `<label><input type="checkbox" name="story-plan-pov" value="${esc(character.id)}" ${(attrs.povCharacterIds || []).includes(character.id) ? "checked" : ""}>${esc(character.name)}</label>`).join("") : '<span class="muted">Add characters to the Character Bible to assign POV.</span>';
    const bookPlotlines = planning.plotlines.filter((plotline) => plotline.bookId === bookId);
    document.getElementById("story-plan-plotlines").innerHTML = bookPlotlines.length ? bookPlotlines.map((plotline) => `<label><input type="checkbox" name="story-plan-plotline" value="${esc(plotline.id)}" ${plotline.sceneIds.includes(sceneId) ? "checked" : ""}>${esc(plotline.name)}</label>`).join("") : '<span class="muted">Create a plotline above to connect this scene to a plot or character arc.</span>';
    if (scroll) editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function saveScenePlanning(event) {
    event.preventDefault(); notify(""); if (!selectedScene) return;
    const checked = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((node) => node.value);
    const tags = document.getElementById("story-plan-tags").value.split(",").map((value) => value.trim()).filter(Boolean);
    try {
      const suffix = `/story-map/scenes/${encodeURIComponent(selectedScene.bookId)}/${encodeURIComponent(selectedScene.chapterId)}/${encodeURIComponent(selectedScene.sceneId)}/planning`;
      const result = await api(projectUrl(suffix), { method: "PUT", body: JSON.stringify({ attributes: {
        povCharacterIds: checked("story-plan-pov"),
        location: document.getElementById("story-plan-location").value,
        storyTime: document.getElementById("story-plan-time").value,
        goal: document.getElementById("story-plan-goal").value,
        conflict: document.getElementById("story-plan-conflict").value,
        outcome: document.getElementById("story-plan-outcome").value,
        emotionalBeat: document.getElementById("story-plan-emotion").value,
        tags,
      }, plotlineIds: checked("story-plan-plotline") }) });
      planning = result.planning; options = result.options; render(); notify("Scene planning saved without changing manuscript prose or order.");
    } catch (error) { notify(error instanceof Error ? error.message : String(error), "error"); }
  }
  function openScene(bookId, chapterId, sceneId) {
    const workspace = window.forgeWorkspaceState;
    const book = workspace?.books?.find((item) => item.id === bookId);
    const chapter = book?.chapters?.find((item) => item.id === chapterId);
    const scene = chapter?.scenes?.find((item) => item.id === sceneId);
    if (!book || !chapter || !scene) return;
    window.forgeStoryMapSelection = { bookId, chapterId, sceneId };
    const bookSelect = document.querySelector("#edit-source-book");
    const sceneSelect = document.querySelector("#edit-source-scene");
    if (bookSelect) { bookSelect.value = bookId; bookSelect.dispatchEvent(new Event("change", { bubbles: true })); }
    if (sceneSelect) sceneSelect.value = sceneId;
    location.hash = "#manuscript";
    window.dispatchEvent(new CustomEvent("forge:story-map-open-scene", { detail: { bookId, chapterId, sceneId } }));
    document.querySelector("#edit-text")?.focus();
  }
  document.addEventListener("click", (event) => {
    const element = event.target instanceof Element ? event.target : null;
    const open = element?.closest("[data-open-scene]");
    if (open) {
      event.preventDefault();
      const [bookId, chapterId, sceneId] = String(open.getAttribute("data-open-scene") || "").split("|");
      if (bookId && chapterId && sceneId) openScene(bookId, chapterId, sceneId);
      return;
    }
    const plan = element?.closest("[data-plan-scene]");
    if (plan) {
      event.preventDefault();
      const [bookId, chapterId, sceneId] = String(plan.getAttribute("data-plan-scene") || "").split("|");
      if (bookId && chapterId && sceneId) openPlanner(bookId, chapterId, sceneId);
      return;
    }
    const remove = element?.closest("[data-delete-plotline]");
    if (remove) { event.preventDefault(); deletePlotline(remove.getAttribute("data-delete-plotline")); }
  });
  window.addEventListener("forge:workspace-ready", () => refresh(false));
  window.addEventListener("load", () => refresh(false));
  window.addEventListener("hashchange", () => { if (location.hash === "#story-map") refresh(false); });
  ensureSurface();
  render();
  if (!planningLoaded) refresh(false);
})();
