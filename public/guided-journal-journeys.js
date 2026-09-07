(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const projectId = params.get("project")?.trim() || localStorage.getItem("forge-project") || "forge-studio";
  const apiRoot = `/api/projects/${encodeURIComponent(projectId)}/journal`;
  let packs = [];
  let journeys = [];
  let activeJourneyId = "";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const lines = (value) => String(value || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);

  async function api(path, options = {}) {
    const response = await fetch(`${apiRoot}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Journey request failed (${response.status}).`);
    return payload;
  }

  function notify(message, error = false) {
    const banner = document.getElementById("banner");
    if (!banner) return;
    banner.textContent = message;
    banner.hidden = false;
    banner.classList.toggle("error", error);
    setTimeout(() => { if (banner.textContent === message) banner.hidden = true; }, 7000);
  }

  function showPanel() {
    document.querySelectorAll("[data-workspace-panel]").forEach((panel) => { panel.hidden = panel.id !== "panel-journeys"; });
    document.querySelectorAll(".office-nav [data-panel]").forEach((button) => button.classList.toggle("active", button.dataset.panel === "journeys"));
  }

  function installSurface() {
    if (document.getElementById("panel-journeys")) return;
    const nav = document.querySelector(".office-nav");
    const main = document.querySelector("main");
    if (!nav || !main) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.panel = "journeys";
    button.textContent = "Guided Journeys";
    button.addEventListener("click", () => { showPanel(); refresh().catch((error) => notify(error.message, true)); });
    nav.insertBefore(button, nav.querySelector('[data-panel="edition"]'));

    const section = document.createElement("section");
    section.id = "panel-journeys";
    section.className = "workspace-panel";
    section.dataset.workspacePanel = "";
    section.hidden = true;
    section.innerHTML = `
      <div class="section-heading"><div><div class="eyebrow">GUIDED + PERSONALIZED JOURNEYS</div><h2>Turn the master question library into reusable reader journeys</h2><p>Prompt packs are frozen, versioned snapshots. A started journey stays pinned to the exact pack it began with, so later library edits cannot silently change a reader's experience.</p></div></div>
      <div class="two-col">
        <article class="panel">
          <h3>Create a reusable prompt pack</h3>
          <form id="journey-pack-form">
            <input name="id" required placeholder="Pack id, e.g. confidence-30">
            <input name="title" required placeholder="Pack title">
            <textarea name="description" placeholder="Purpose / description"></textarea>
            <div class="row"><label>Order<select name="mode"><option value="ordered">Author order</option><option value="deterministic-shuffle">Deterministic shuffle</option></select></label><label>Source<select name="source"><option value="user">User</option><option value="curated">Curated</option><option value="imported">Imported</option></select></label></div>
            <textarea name="promptIds" required placeholder="Prompt ids, one per line. Copy ids from the Question Library."></textarea>
            <input name="tags" placeholder="Tags, comma separated">
            <button class="primary" type="submit">Create frozen pack</button>
          </form>
        </article>
        <article class="panel">
          <h3>Start a journey from a pack</h3>
          <form id="journey-start-form">
            <input name="id" required placeholder="Journey id">
            <select name="packId" id="journey-pack-select" required><option value="">Create a pack first</option></select>
            <input name="seed" placeholder="Optional deterministic seed">
            <button class="primary" type="submit">Start journey</button>
          </form>
          <hr>
          <h3>Personalized journey</h3>
          <form id="journey-personal-form">
            <input name="journeyId" required placeholder="Journey id">
            <input name="packId" required placeholder="Frozen pack id">
            <input name="title" required placeholder="Journey title">
            <div class="row"><label>Primary goal<select name="goal"><option value="gratitude">Gratitude</option><option value="self-discovery">Self-discovery</option><option value="relationships">Relationships</option><option value="confidence">Confidence</option><option value="creativity">Creativity</option><option value="habits">Habits</option><option value="purpose">Purpose</option><option value="resilience">Resilience</option><option value="planning">Planning</option><option value="mindfulness">Mindfulness</option></select></label><label>Weight<select name="weight"><option value="5">5 · strongest</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></label></div>
            <div class="row"><label>Reflection<select name="reflectionDepth"><option value="gentle">Gentle</option><option value="balanced" selected>Balanced</option><option value="deep">Deep</option></select></label><label>Variety<select name="variety"><option value="focused">Focused</option><option value="balanced" selected>Balanced</option><option value="exploratory">Exploratory</option></select></label><label>Questions<input name="promptCount" type="number" min="1" value="12"></label></div>
            <input name="preferredCategories" placeholder="Preferred categories, e.g. challenge,become">
            <input name="preferredTags" placeholder="Preferred tags, comma separated">
            <input name="blockedTags" placeholder="Blocked tags, comma separated">
            <input name="seed" required value="personalized-journey" placeholder="Personalization seed">
            <button class="primary" type="submit">Build personalized journey</button>
          </form>
        </article>
      </div>
      <div class="two-col">
        <article class="panel"><div class="row spread"><h3>Prompt packs</h3><span id="journey-pack-count" class="pill">0</span></div><div id="journey-pack-list" class="item-list"><p class="muted">No packs yet.</p></div></article>
        <article class="panel"><div class="row spread"><h3>Journeys</h3><span id="journey-count" class="pill">0</span></div><div id="journey-list" class="item-list"><p class="muted">No journeys yet.</p></div></article>
      </div>
      <article class="panel"><div class="row spread"><h3>Current journey</h3><button id="journey-refresh" type="button">Refresh journeys</button></div><div id="journey-current"><p class="muted">Open a journey to continue it.</p></div></article>
    `;
    main.appendChild(section);
    wireForms();
  }

  function wireForms() {
    document.getElementById("journey-pack-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const value = Object.fromEntries(new FormData(event.currentTarget).entries());
        await api("/journey-packs", { method: "POST", body: JSON.stringify({ id: value.id, title: value.title, description: value.description, mode: value.mode, source: value.source, tags: lines(value.tags), promptIds: lines(value.promptIds) }) });
        event.currentTarget.reset();
        notify("Guided Journal prompt pack created and frozen.");
        await refresh();
      } catch (error) { notify(error.message, true); }
    });

    document.getElementById("journey-start-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const value = Object.fromEntries(new FormData(event.currentTarget).entries());
        const result = await api("/journeys", { method: "POST", body: JSON.stringify({ id: value.id, packId: value.packId, seed: value.seed || undefined }) });
        activeJourneyId = result.progress.id;
        notify("Guided journey started and saved.");
        await refresh();
        renderCurrent(result);
      } catch (error) { notify(error.message, true); }
    });

    document.getElementById("journey-personal-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const value = Object.fromEntries(new FormData(event.currentTarget).entries());
        const result = await api("/journeys/personalized", {
          method: "POST",
          body: JSON.stringify({
            journeyId: value.journeyId,
            packId: value.packId,
            title: value.title,
            questionnaire: {
              id: `${value.journeyId}-questionnaire`,
              goals: [{ goal: value.goal, weight: Number(value.weight) }],
              preferredCategories: lines(value.preferredCategories),
              preferredTags: lines(value.preferredTags),
              blockedTags: lines(value.blockedTags),
              reflectionDepth: value.reflectionDepth,
              variety: value.variety,
              promptCount: Number(value.promptCount),
              seed: value.seed,
            },
          }),
        });
        activeJourneyId = result.journey.id;
        notify("Personalized journey created from the current master library and frozen to its selected prompts.");
        await refresh();
        await openJourney(activeJourneyId);
      } catch (error) { notify(error.message, true); }
    });

    document.getElementById("journey-refresh")?.addEventListener("click", () => refresh().catch((error) => notify(error.message, true)));
    document.getElementById("panel-journeys")?.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-open-journey]");
      const action = event.target.closest("[data-journey-action]");
      try {
        if (open) await openJourney(open.dataset.openJourney);
        if (action) {
          const id = action.dataset.journeyId;
          const promptId = action.dataset.promptId;
          const type = action.dataset.journeyAction;
          const result = await api(`/journeys/${encodeURIComponent(id)}/${type}`, { method: "POST", body: JSON.stringify({ promptId }) });
          activeJourneyId = id;
          renderCurrent(result);
          await refresh(false);
        }
      } catch (error) { notify(error.message, true); }
    });
  }

  function renderPacks() {
    const count = document.getElementById("journey-pack-count");
    if (count) count.textContent = String(packs.length);
    const select = document.getElementById("journey-pack-select");
    if (select) select.innerHTML = packs.length ? `<option value="">Choose a pack</option>${packs.map((pack) => `<option value="${escapeHtml(pack.id)}">${escapeHtml(pack.title)} · v${pack.version}</option>`).join("")}` : '<option value="">Create a pack first</option>';
    const list = document.getElementById("journey-pack-list");
    if (!list) return;
    list.innerHTML = packs.length ? packs.map((pack) => `<div class="item"><div class="item-title"><strong>${escapeHtml(pack.title)}</strong><span class="pill">v${pack.version}</span></div><p>${pack.prompts.length} questions · ${escapeHtml(pack.mode)}</p><p class="muted">${escapeHtml(pack.id)} · ${escapeHtml(pack.sourceLibraryFingerprint)}</p></div>`).join("") : '<p class="muted">No prompt packs yet.</p>';
  }

  function renderJourneys() {
    const count = document.getElementById("journey-count");
    if (count) count.textContent = String(journeys.length);
    const list = document.getElementById("journey-list");
    if (!list) return;
    list.innerHTML = journeys.length ? journeys.map((journey) => `<div class="item"><div class="item-title"><strong>${escapeHtml(journey.id)}</strong><span class="pill">pack v${journey.packVersion}</span></div><p>${journey.completedPromptIds.length}/${journey.promptOrder.length} completed · ${journey.hiddenPromptIds.length} hidden</p><p class="muted">Pack ${escapeHtml(journey.packId)} · updated ${escapeHtml(new Date(journey.updatedAt).toLocaleString())}</p><div class="item-actions"><button type="button" data-open-journey="${escapeHtml(journey.id)}">Open journey</button></div></div>`).join("") : '<p class="muted">No guided journeys yet.</p>';
  }

  function renderCurrent(result) {
    const host = document.getElementById("journey-current");
    if (!host || !result?.progress) return;
    const { progress, status, next } = result;
    const completed = new Set(progress.completedPromptIds || []);
    const hidden = new Set(progress.hiddenPromptIds || []);
    const pack = packs.find((candidate) => candidate.id === progress.packId && candidate.version === progress.packVersion) || packs.find((candidate) => candidate.id === progress.packId);
    const rows = (pack?.prompts || []).filter((prompt) => progress.promptOrder.includes(prompt.id)).sort((a, b) => progress.promptOrder.indexOf(a.id) - progress.promptOrder.indexOf(b.id)).map((prompt) => {
      const state = completed.has(prompt.id) ? "completed" : hidden.has(prompt.id) ? "hidden" : next?.id === prompt.id ? "next" : "pending";
      const actions = state === "completed" ? `<button type="button" data-journey-action="reopen" data-journey-id="${escapeHtml(progress.id)}" data-prompt-id="${escapeHtml(prompt.id)}">Reopen</button>` : state === "hidden" ? `<button type="button" data-journey-action="unhide" data-journey-id="${escapeHtml(progress.id)}" data-prompt-id="${escapeHtml(prompt.id)}">Unhide</button>` : `<button type="button" data-journey-action="complete" data-journey-id="${escapeHtml(progress.id)}" data-prompt-id="${escapeHtml(prompt.id)}">Complete</button><button type="button" data-journey-action="hide" data-journey-id="${escapeHtml(progress.id)}" data-prompt-id="${escapeHtml(prompt.id)}">Hide</button>`;
      return `<div class="item"><div class="item-title"><div><span class="category">${escapeHtml(prompt.category)}</span><strong>${escapeHtml(prompt.text)}</strong></div><span class="pill">${state}</span></div><div class="item-actions">${actions}</div></div>`;
    }).join("");
    host.innerHTML = `<div class="status-grid"><div class="status-chip"><span class="eyebrow">Progress</span><strong>${status.progressPercent}%</strong></div><div class="status-chip"><span class="eyebrow">Completed</span><strong>${status.completedPrompts}/${status.visiblePrompts}</strong></div><div class="status-chip"><span class="eyebrow">Remaining</span><strong>${status.remainingPrompts}</strong></div><div class="status-chip"><span class="eyebrow">Pack</span><strong>${escapeHtml(progress.packId)} · v${progress.packVersion}</strong></div></div>${next ? `<div class="result-card"><div class="eyebrow">NEXT QUESTION</div><p class="random-question">${escapeHtml(next.text)}</p></div>` : '<div class="result-card"><strong>Journey complete.</strong></div>'}<div class="item-list">${rows || '<p class="muted">Prompt snapshot unavailable in latest-pack list.</p>'}</div>`;
  }

  async function openJourney(id) {
    const result = await api(`/journeys/${encodeURIComponent(id)}`);
    activeJourneyId = id;
    renderCurrent(result);
  }

  async function refresh(reopenActive = true) {
    [packs, journeys] = await Promise.all([api("/journey-packs"), api("/journeys")]);
    renderPacks();
    renderJourneys();
    if (reopenActive && activeJourneyId) await openJourney(activeJourneyId);
  }

  installSurface();
  refresh().catch((error) => notify(`Guided Journeys: ${error.message}`, true));
})();
