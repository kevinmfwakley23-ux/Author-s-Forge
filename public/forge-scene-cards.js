/* Author-controlled Scene Cards layered onto the existing Story Map scene source of truth. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const projectUrl = (suffix) => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c]));
  let selected = null;
  let snapshot = null;
  let characters = [];

  async function api(path, init = {}) {
    const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Scene Card request failed (${response.status}).`);
    return payload;
  }
  function lines(value) {
    return [...new Set(String(value || "").split(/\r?\n/u).map((item) => item.trim()).filter(Boolean))];
  }
  function show(message, kind = "info") {
    const host = $("#scene-card-message");
    if (host) { host.textContent = message || ""; host.dataset.kind = kind; host.hidden = !message; }
    if (kind === "error") {
      const error = $("#error-banner"); if (error) { error.textContent = message; error.hidden = false; }
    }
  }
  function showSuccess(message) {
    show(message, "info");
    const success = $("#success-banner"); if (success) { success.textContent = message; success.hidden = false; }
  }
  function injectStyles() {
    if ($("#scene-card-workflow-styles")) return;
    const style = document.createElement("style");
    style.id = "scene-card-workflow-styles";
    style.textContent = `
      .scene-card-workflow{margin-top:1rem;border-top:1px solid rgba(127,127,127,.35);padding-top:1rem}.scene-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.scene-card-grid label{display:grid;gap:.3rem}.scene-card-grid textarea,.scene-card-grid input{width:100%;min-height:42px}.scene-card-wide{grid-column:1/-1}.scene-card-character-list{display:flex;gap:.5rem;flex-wrap:wrap}.scene-card-character-list label{display:flex;align-items:center;gap:.3rem;border:1px solid rgba(127,127,127,.35);border-radius:999px;padding:.3rem .55rem}.scene-card-status{padding:.65rem .75rem;border:1px solid rgba(127,127,127,.35);border-radius:10px;margin:.7rem 0}.scene-card-status[data-state="approved"]{border-style:solid}.scene-card-status[data-state="stale"]{border-style:dashed}.scene-card-message{padding:.55rem .7rem;border-radius:8px;margin:.5rem 0;background:rgba(127,127,127,.12)}.scene-card-message[data-kind="error"]{background:#711;color:#fff}.scene-card-actions{display:flex;gap:.55rem;flex-wrap:wrap}.scene-card-actions button{min-height:44px}.scene-card-source{font-size:.82rem;opacity:.8}
      @media(max-width:800px){.scene-card-grid{grid-template-columns:1fr}.scene-card-wide{grid-column:1}.scene-card-actions{display:grid;grid-template-columns:1fr}.scene-card-actions button{width:100%;min-height:44px}}
    `;
    document.head.appendChild(style);
  }
  function ensurePanel() {
    injectStyles();
    const editor = $("#story-map-scene-editor");
    if (!editor || $("#scene-card-workflow")) return;
    const section = document.createElement("section");
    section.id = "scene-card-workflow";
    section.className = "scene-card-workflow";
    section.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">SCENE CARD</div><h3>Author-approved scene blueprint</h3><p>These details extend the live Story Map scene. Approval is bound to the exact current scene, planning metadata, plotline membership, and card details; any later change makes the old approval stale automatically.</p></div></div>
      <div id="scene-card-message" class="scene-card-message" role="status" aria-live="polite" hidden></div>
      <div id="scene-card-status" class="scene-card-status" data-state="unapproved">Choose a scene with <strong>Plan</strong> to load its Scene Card.</div>
      <form id="scene-card-form">
        <div class="scene-card-grid">
          <label class="scene-card-wide">Scene purpose<textarea id="scene-card-purpose" maxlength="4000" placeholder="Why must this scene exist? What changes because of it?"></textarea></label>
          <label>Opening situation<textarea id="scene-card-opening" maxlength="4000"></textarea></label>
          <label>Closing situation<textarea id="scene-card-closing" maxlength="4000"></textarea></label>
          <label class="scene-card-wide">Required events <small>One per line</small><textarea id="scene-card-events" maxlength="60000"></textarea></label>
          <label>Clues <small>One per line</small><textarea id="scene-card-clues" maxlength="60000"></textarea></label>
          <label>Reveals <small>One per line</small><textarea id="scene-card-reveals" maxlength="60000"></textarea></label>
          <label class="scene-card-wide">Continuity dependencies <small>One per line</small><textarea id="scene-card-continuity" maxlength="60000"></textarea></label>
          <label>Atmosphere<textarea id="scene-card-atmosphere" maxlength="3000"></textarea></label>
          <label>Approximate word count<input id="scene-card-word-count" type="number" min="0" max="100000" step="1" value="0"></label>
          <label class="scene-card-wide">Forbidden deviations <small>One per line</small><textarea id="scene-card-forbidden" maxlength="60000" placeholder="Things AI must not invent, reveal, move, change, or contradict."></textarea></label>
          <label class="scene-card-wide">Author notes<textarea id="scene-card-notes" maxlength="8000"></textarea></label>
        </div>
        <h4>Characters present</h4><div id="scene-card-characters" class="scene-card-character-list"></div>
        <p id="scene-card-source" class="scene-card-source"></p>
        <div class="scene-card-actions"><button class="primary" type="submit">Save Scene Card</button><button id="scene-card-approve" type="button">Approve current Scene Card</button><button id="scene-card-revoke" type="button">Revoke approval</button><button id="scene-card-draft" class="primary" type="button">Draft scene from approved card</button><button id="scene-card-refresh" type="button">Refresh status</button></div>
      </form>
    `;
    editor.appendChild(section);
    $("#scene-card-form")?.addEventListener("submit", saveCard);
    $("#scene-card-approve")?.addEventListener("click", approveCard);
    $("#scene-card-revoke")?.addEventListener("click", revokeApproval);
    $("#scene-card-draft")?.addEventListener("click", draftFromCard);
    $("#scene-card-refresh")?.addEventListener("click", () => void refreshSelected());
    syncButtons();
  }
  function currentCard() {
    if (!selected || !snapshot?.cards) return null;
    return snapshot.cards.find((card) => card.bookId === selected.bookId && card.chapterId === selected.chapterId && card.sceneId === selected.sceneId) || null;
  }
  function syncButtons() {
    const card = currentCard();
    const approve = $("#scene-card-approve"), revoke = $("#scene-card-revoke"), draft = $("#scene-card-draft");
    if (approve) approve.disabled = !selected || Boolean(card?.approved);
    if (revoke) revoke.disabled = !selected || !(card?.approved || card?.approvalStale);
    if (draft) draft.disabled = !selected || !card?.approved || Boolean(card?.sceneHasContent);
  }
  function renderCharacters(selectedIds = []) {
    const host = $("#scene-card-characters"); if (!host) return;
    if (!characters.length) { host.innerHTML = '<span class="muted">No Character Bible records yet.</span>'; return; }
    const set = new Set(selectedIds);
    host.innerHTML = characters.map((character) => `<label><input type="checkbox" value="${esc(character.id)}" ${set.has(character.id) ? "checked" : ""}> ${esc(character.name)}</label>`).join("");
  }
  function renderCard() {
    ensurePanel();
    const card = currentCard();
    if (!selected || !card) {
      $("#scene-card-status").innerHTML = 'Choose a scene with <strong>Plan</strong> to load its Scene Card.';
      syncButtons();
      return;
    }
    const details = card.details || {};
    $("#scene-card-purpose").value = details.purpose || "";
    $("#scene-card-opening").value = details.openingSituation || "";
    $("#scene-card-closing").value = details.closingSituation || "";
    $("#scene-card-events").value = (details.requiredEvents || []).join("\n");
    $("#scene-card-clues").value = (details.clues || []).join("\n");
    $("#scene-card-reveals").value = (details.reveals || []).join("\n");
    $("#scene-card-continuity").value = (details.continuityDependencies || []).join("\n");
    $("#scene-card-atmosphere").value = details.atmosphere || "";
    $("#scene-card-word-count").value = String(details.approximateWordCount || 0);
    $("#scene-card-forbidden").value = (details.forbiddenDeviations || []).join("\n");
    $("#scene-card-notes").value = details.notes || "";
    renderCharacters(details.characterIds || []);
    const status = $("#scene-card-status");
    const state = card.approved ? "approved" : card.approvalStale ? "stale" : "unapproved";
    status.dataset.state = state;
    status.innerHTML = card.approved
      ? `<strong>Approved</strong> • exact card ${esc(card.cardSha256.slice(0, 12))}…${card.approvedAt ? ` • ${esc(new Date(card.approvedAt).toLocaleString())}` : ""}${card.sceneHasContent ? '<br><small>This scene already contains manuscript text, so automatic Scene Card drafting is disabled to protect author work.</small>' : ""}`
      : card.approvalStale
        ? `<strong>Approval stale</strong> • the scene, Story Map planning, plotlines, or Scene Card changed after approval. Reapprove this exact version before card-driven drafting.`
        : `<strong>Not approved</strong> • save the card, review the live Story Map planning above, then explicitly approve this version.`;
    const attrs = card.attributes || {};
    const source = [
      `Scene ${card.sceneNumber}: ${card.sceneTitle}`,
      attrs.goal ? `Goal: ${attrs.goal}` : "",
      attrs.conflict ? `Conflict: ${attrs.conflict}` : "",
      attrs.outcome ? `Outcome: ${attrs.outcome}` : "",
      card.plotlineNames?.length ? `Plotlines: ${card.plotlineNames.join(", ")}` : "",
    ].filter(Boolean).join(" • ");
    $("#scene-card-source").textContent = `Live source: ${source}`;
    syncButtons();
  }
  async function loadSnapshot() {
    const [cards, planning] = await Promise.all([
      api(projectUrl("/scene-cards")),
      api(projectUrl("/story-map/planning")),
    ]);
    snapshot = cards;
    characters = planning.options?.characters || [];
    return cards;
  }
  async function refreshSelected() {
    if (!selected) return;
    try { await loadSnapshot(); renderCard(); show("Scene Card status refreshed from durable project state."); }
    catch (error) { show(error instanceof Error ? error.message : String(error), "error"); }
  }
  function targetPath(action = "") {
    if (!selected) throw new Error("Choose a scene with Plan first.");
    const suffix = [selected.bookId, selected.chapterId, selected.sceneId].map(encodeURIComponent).join("/");
    return projectUrl(`/scene-cards/${suffix}${action ? `/${action}` : ""}`);
  }
  function selectedCharacterIds() {
    return [...document.querySelectorAll("#scene-card-characters input[type=checkbox]:checked")].map((input) => input.value);
  }
  async function saveCard(event) {
    event.preventDefault();
    if (!selected) { show("Choose a scene with Plan first.", "error"); return; }
    try {
      const details = {
        purpose: $("#scene-card-purpose").value,
        openingSituation: $("#scene-card-opening").value,
        closingSituation: $("#scene-card-closing").value,
        characterIds: selectedCharacterIds(),
        requiredEvents: lines($("#scene-card-events").value),
        clues: lines($("#scene-card-clues").value),
        reveals: lines($("#scene-card-reveals").value),
        continuityDependencies: lines($("#scene-card-continuity").value),
        atmosphere: $("#scene-card-atmosphere").value,
        approximateWordCount: Number($("#scene-card-word-count").value || 0),
        forbiddenDeviations: lines($("#scene-card-forbidden").value),
        notes: $("#scene-card-notes").value,
      };
      snapshot = await api(targetPath(), { method: "PUT", body: JSON.stringify({ details }) });
      renderCard();
      showSuccess("Scene Card saved. Any prior approval is valid only if this exact card version still matches it.");
    } catch (error) { show(error instanceof Error ? error.message : String(error), "error"); }
  }
  async function approveCard() {
    if (!selected) return;
    try {
      snapshot = await api(targetPath("approve"), { method: "POST", body: JSON.stringify({ authorApproved: true }) });
      renderCard();
      showSuccess("Scene Card approved by the author. Card-driven AI drafting is now allowed only while this exact version remains current.");
    } catch (error) { show(error instanceof Error ? error.message : String(error), "error"); }
  }
  async function revokeApproval() {
    if (!selected) return;
    try {
      snapshot = await api(targetPath("revoke"), { method: "POST", body: JSON.stringify({}) });
      renderCard();
      showSuccess("Scene Card approval revoked. No card-driven drafting can proceed until the author approves again.");
    } catch (error) { show(error instanceof Error ? error.message : String(error), "error"); }
  }
  async function draftFromCard() {
    if (!selected) return;
    try {
      const brief = await api(targetPath("draft-brief"), { method: "POST", body: JSON.stringify({}) });
      const result = await api(projectUrl("/ai/writing/generate"), {
        method: "POST",
        body: JSON.stringify({
          bookId: brief.bookId,
          chapterId: brief.chapterId,
          sceneId: brief.sceneId,
          task: brief.task,
          instruction: brief.instruction,
          contextQuery: brief.instruction,
          characterIds: brief.characterIds || [],
          proposalId: `scene-card-proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      if ($("#ai-result")) $("#ai-result").value = result.proposal?.proposedContent || "";
      window.dispatchEvent(new Event("forge:workspace-ready"));
      const writing = document.querySelector('[data-route="writing"]');
      if (writing instanceof HTMLElement) writing.click();
      showSuccess(`Scene Card draft created as pending proposal ${result.proposal?.id || ""}. Review and approve it in the Writing Desk; nothing was applied to the manuscript.`);
    } catch (error) { show(error instanceof Error ? error.message : String(error), "error"); }
  }
  function chooseFromPlanButton(button) {
    const value = String(button.getAttribute("data-plan-scene") || "");
    const [bookId, chapterId, sceneId] = value.split("|");
    if (!bookId || !chapterId || !sceneId) return;
    selected = { bookId, chapterId, sceneId };
    window.setTimeout(() => { ensurePanel(); void loadSnapshot().then(renderCard).catch((error) => show(error.message, "error")); }, 0);
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-plan-scene]") : null;
    if (target) chooseFromPlanButton(target);
  }, true);
  document.addEventListener("submit", (event) => {
    if (!(event.target instanceof Element) || event.target.id !== "story-map-scene-form" || !selected) return;
    window.setTimeout(() => void loadSnapshot().then(renderCard).catch(() => {}), 700);
  });
  window.addEventListener("forge:workspace-ready", ensurePanel);
  window.addEventListener("load", ensurePanel);
  if (document.readyState !== "loading") ensurePanel();
})();
