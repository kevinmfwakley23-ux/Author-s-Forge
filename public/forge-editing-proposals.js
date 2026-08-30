/* Governed Editing Room extension: editorial finding -> durable AI rewrite proposal -> author review -> explicit apply. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const api = async (path, options = {}) => { const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`); return payload; };
  const projectUrl = (suffix = "") => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const notify = (message, ok = false) => { const error = $("#error-banner"), success = $("#success-banner"), target = ok ? success : error; if (error) error.hidden = ok; if (success) success.hidden = !ok; if (target) { target.textContent = message; target.hidden = false; } };
  const current = () => { const workspace = window.forgeWorkspaceState; const books = workspace?.books || []; const book = books.find((item) => item.id === $("#edit-source-book")?.value) || books.find((item) => item.id === workspace?.activeBookId) || books[0]; const scene = book?.chapters.flatMap((chapter) => chapter.scenes).find((item) => item.id === $("#edit-source-scene")?.value) || book?.chapters[0]?.scenes[0]; const chapter = book?.chapters.find((item) => item.scenes.some((sceneItem) => sceneItem.id === scene?.id)) || book?.chapters[0]; return { book, chapter, scene }; };
  const splitLines = (value) => String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const countWords = (value) => { const text = String(value || "").trim(); return text ? text.split(/\s+/u).length : 0; };
  function deterministicDiff(baseContent, proposedContent) {
    const base = splitLines(baseContent), proposed = splitLines(proposedContent), rows = base.length + 1, cols = proposed.length + 1;
    const table = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let i = base.length - 1; i >= 0; i -= 1) for (let j = proposed.length - 1; j >= 0; j -= 1) table[i][j] = base[i] === proposed[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    const lines = []; let i = 0, j = 0;
    while (i < base.length && j < proposed.length) {
      if (base[i] === proposed[j]) { lines.push({ kind: "unchanged", text: base[i], lineNumber: i + 1, proposedLineNumber: j + 1 }); i++; j++; }
      else if (table[i + 1][j] >= table[i][j + 1]) { lines.push({ kind: "removed", text: base[i], lineNumber: i + 1 }); i++; }
      else { lines.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 }); j++; }
    }
    while (i < base.length) lines.push({ kind: "removed", text: base[i], lineNumber: i + 1 }), i++;
    while (j < proposed.length) lines.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 }), j++;
    return { lines, addedLines: lines.filter((x) => x.kind === "added").length, removedLines: lines.filter((x) => x.kind === "removed").length, unchangedLines: lines.filter((x) => x.kind === "unchanged").length, baseWords: countWords(baseContent), proposedWords: countWords(proposedContent), changed: baseContent !== proposedContent };
  }
  function renderDiff(proposal) {
    const host = $("#ai-editing-proposal-diff"); if (!host) return;
    if (!proposal) { host.innerHTML = '<p class="muted">Select an editing proposal to inspect the deterministic review diff.</p>'; return; }
    const { scene } = current();
    const diff = deterministicDiff(scene?.content || "", proposal.proposedContent);
    const rows = diff.lines.map((line) => { const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "; return `<div class="proposal-diff-line ${esc(line.kind)}"><span>${prefix}</span><code>${esc(line.text || " ")}</code></div>`; }).join("");
    host.innerHTML = `<div class="proposal-diff-summary"><strong>${diff.changed ? "Changes detected" : "No changes"}</strong><span>+${diff.addedLines} added</span><span>−${diff.removedLines} removed</span><span>${diff.unchangedLines} unchanged</span><span>${diff.baseWords} → ${diff.proposedWords} words</span></div><details open><summary>Line-level review</summary><div class="proposal-diff" aria-label="Editing proposal line-level diff">${rows || '<p class="muted">No lines.</p>'}</div></details><small class="muted">The diff compares the currently loaded scene with the durable proposal. Applying remains a separate explicit author action and server-side source-revision protection remains authoritative.</small>`;
  }

  function installPanel() {
    const result = $("#edit-result");
    if (!result || $("#ai-editing-proposal-panel")) return;
    const panel = document.createElement("article");
    panel.id = "ai-editing-proposal-panel";
    panel.className = "card";
    panel.innerHTML = `<h3>AI Rewrite Proposal</h3><p class="muted">Turn a specific editorial finding into a durable manuscript-edit proposal. Forge will not mutate the manuscript until you explicitly approve and apply the proposal.</p><div class="grid"><label>Finding<textarea id="ai-editing-finding" placeholder="Describe the editorial problem exactly as identified by the editor."></textarea></label><label>Recommendation<textarea id="ai-editing-recommendation" placeholder="What should the rewrite improve or change?"></textarea></label></div><div class="row"><label>Start <input id="ai-editing-start" type="number" min="0" value="0"></label><label>End <input id="ai-editing-end" type="number" min="1" value="1"></label><button id="ai-editing-propose" class="primary" type="button">Generate rewrite proposal</button></div><div id="ai-editing-proposal-status" class="muted"></div><div id="ai-editing-proposal-list" class="list"></div><section class="card proposal-review"><h3>Proposal Review Diff</h3><div id="ai-editing-proposal-diff"><p class="muted">Select an editing proposal to inspect the deterministic review diff.</p></div></section>`;
    result.parentElement?.insertAdjacentElement("afterend", panel);
    $("#ai-editing-propose")?.addEventListener("click", propose);
    refresh();
  }

  async function propose() {
    const { book, chapter, scene } = current();
    if (!book || !chapter || !scene) return notify("Select a book and scene before creating an AI editing proposal.");
    const findingMessage = $("#ai-editing-finding")?.value.trim();
    const recommendation = $("#ai-editing-recommendation")?.value.trim();
    const findingStart = Number($("#ai-editing-start")?.value);
    const findingEnd = Number($("#ai-editing-end")?.value);
    if (!findingMessage || !recommendation) return notify("Provide both the editorial finding and recommendation.");
    if (!Number.isInteger(findingStart) || !Number.isInteger(findingEnd) || findingStart < 0 || findingEnd <= findingStart || findingEnd > scene.content.length) return notify(`Finding range must be within the selected scene (0–${scene.content.length}).`);
    const button = $("#ai-editing-propose"); if (button) button.disabled = true;
    try {
      const result = await api(projectUrl("/ai/editing/propose"), { method: "POST", body: JSON.stringify({ bookId: book.id, chapterId: chapter.id, sceneId: scene.id, findingMessage, recommendation, findingStart, findingEnd, instruction: "Preserve canon, continuity, POV, tense, and author intent while resolving this finding.", proposalId: `editing-proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }) });
      $("#ai-editing-proposal-status").textContent = `Durable proposal ${result.proposal.id} • pending author review • source revision bound`;
      notify("AI editing proposal created. Review the line-level diff before approval or application.", true);
      await refresh(result.proposal.id);
    } catch (error) { notify(error.message); }
    finally { if (button) button.disabled = false; }
  }

  async function refresh(selectedId) {
    const host = $("#ai-editing-proposal-list"); if (!host) return;
    try {
      const proposals = (await api(projectUrl("/ai/proposals"))).filter((proposal) => proposal.kind === "manuscript-edit");
      const selected = selectedId ? proposals.find((proposal) => proposal.id === selectedId) : proposals[0];
      host.innerHTML = proposals.length ? proposals.slice().reverse().map((proposal) => `<article class="memory" data-edit-proposal="${esc(proposal.id)}" style="${selected?.id === proposal.id ? "outline:2px solid currentColor;" : ""}"><strong>${esc(proposal.title)}</strong><small>${esc(proposal.status)} • ${esc(proposal.target?.sceneId || "No target")}</small><p>${esc(proposal.rationale)}</p><details><summary>Proposed revision</summary><pre style="white-space:pre-wrap">${esc(proposal.proposedContent)}</pre></details><div class="row"><button type="button" data-edit-select="${esc(proposal.id)}">${selected?.id === proposal.id ? "Selected" : "Select & Compare"}</button>${proposal.status === "pending" ? `<button type="button" data-edit-approve="${esc(proposal.id)}">Approve</button><button type="button" data-edit-reject="${esc(proposal.id)}">Reject</button>` : ""}${proposal.status === "accepted" ? `<button type="button" class="primary" data-edit-apply="${esc(proposal.id)}">Apply to manuscript</button>` : ""}</div></article>`).join("") : '<p class="muted">No AI editing proposals yet.</p>';
      renderDiff(selected || null);
    } catch (error) { host.innerHTML = `<p class="muted">${esc(error.message)}</p>`; renderDiff(null); }
  }

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null; if (!target) return;
    const select = target.closest("[data-edit-select]"), approve = target.closest("[data-edit-approve]"), reject = target.closest("[data-edit-reject]"), apply = target.closest("[data-edit-apply]");
    try {
      if (select) { await refresh(select.dataset.editSelect); return; }
      if (approve) { await api(projectUrl(`/ai/proposals/${encodeURIComponent(approve.dataset.editApprove)}/review`), { method: "POST", body: JSON.stringify({ decision: "accepted", note: "Author approved editorial rewrite in Editing Room." }) }); notify("Editing proposal approved. Apply remains a separate author action.", true); await refresh(approve.dataset.editApprove); }
      if (reject) { await api(projectUrl(`/ai/proposals/${encodeURIComponent(reject.dataset.editReject)}/review`), { method: "POST", body: JSON.stringify({ decision: "rejected", note: "Author rejected editorial rewrite in Editing Room." }) }); notify("Editing proposal rejected and retained as review history.", true); await refresh(reject.dataset.editReject); }
      if (apply) { await api(projectUrl(`/ai/proposals/${encodeURIComponent(apply.dataset.editApply)}/apply`), { method: "POST", body: JSON.stringify({}) }); notify("Approved editing proposal applied to the manuscript and persisted.", true); $("#refresh")?.click(); await refresh(apply.dataset.editApply); }
    } catch (error) { notify(error.message); }
  });

  window.addEventListener("forge:workspace-ready", installPanel);
  window.addEventListener("load", installPanel);
  window.addEventListener("hashchange", installPanel);
})();
