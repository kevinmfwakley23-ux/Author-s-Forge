/* Governed Studio AI proposal workflow: generation -> author review -> explicit manuscript apply. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const api = async (path, options = {}) => { const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`); return payload; };
  const current = () => { const workspace = window.forgeWorkspaceState; const books = workspace?.books || []; const book = books.find((item) => item.id === $("#editor-book")?.value) || books.find((item) => item.id === workspace?.activeBookId) || books[0]; const chapter = book?.chapters.find((item) => item.id === $("#editor-chapter")?.value) || book?.chapters[0]; const scene = chapter?.scenes.find((item) => item.id === $("#editor-scene")?.value) || chapter?.scenes[0]; return { book, chapter, scene }; };
  const notify = (message, ok = false) => { const error = $("#error-banner"), success = $("#success-banner"), target = ok ? success : error; if (error) error.hidden = ok; if (success) success.hidden = !ok; if (target) { target.textContent = message; target.hidden = false; } };
  let proposals = [];
  let selectedProposalId = null;

  function splitLines(value) { if (!value) return []; return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n"); }
  function countWords(value) { const text = String(value || "").trim(); return text ? text.split(/\s+/u).length : 0; }
  function sha256Fallback(value) { return String(value || ""); }
  function deterministicDiff(baseContent, proposedContent) {
    const base = splitLines(baseContent), proposed = splitLines(proposedContent), rows = base.length + 1, cols = proposed.length + 1;
    const table = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let i = base.length - 1; i >= 0; i -= 1) for (let j = proposed.length - 1; j >= 0; j -= 1) table[i][j] = base[i] === proposed[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    const lines = []; let i = 0, j = 0;
    while (i < base.length && j < proposed.length) { if (base[i] === proposed[j]) { lines.push({ kind: "unchanged", text: base[i], lineNumber: i + 1, proposedLineNumber: j + 1 }); i++; j++; } else if (table[i + 1][j] >= table[i][j + 1]) { lines.push({ kind: "removed", text: base[i], lineNumber: i + 1 }); i++; } else { lines.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 }); j++; } }
    while (i < base.length) lines.push({ kind: "removed", text: base[i], lineNumber: i + 1 }), i++;
    while (j < proposed.length) lines.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 }), j++;
    return { lines, addedLines: lines.filter((x) => x.kind === "added").length, removedLines: lines.filter((x) => x.kind === "removed").length, unchangedLines: lines.filter((x) => x.kind === "unchanged").length, baseCharacters: String(baseContent || "").length, proposedCharacters: String(proposedContent || "").length, baseWords: countWords(baseContent), proposedWords: countWords(proposedContent), changed: baseContent !== proposedContent };
  }
  function renderDiff(proposal) {
    const host = $("#ai-proposal-diff"); if (!host) return;
    if (!proposal) { host.innerHTML = '<p class="muted">Select a proposal to inspect its deterministic review diff.</p>'; return; }
    const { scene } = current(); const base = scene?.content || ""; const diff = deterministicDiff(base, proposal.proposedContent);
    const rows = diff.lines.map((line) => { const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "; return `<div class="proposal-diff-line ${esc(line.kind)}"><span>${prefix}</span><code>${esc(line.text || " ")}</code></div>`; }).join("");
    host.innerHTML = `<div class="proposal-diff-summary"><strong>${diff.changed ? "Changes detected" : "No changes"}</strong><span>+${diff.addedLines} added</span><span>−${diff.removedLines} removed</span><span>${diff.unchangedLines} unchanged</span><span>${diff.baseWords} → ${diff.proposedWords} words</span></div><details open><summary>Line-level review</summary><div class="proposal-diff" aria-label="Proposal line-level diff">${rows || '<p class="muted">No lines.</p>'}</div></details><small class="muted">Review base is the scene currently loaded in the Writing Desk. Applying remains a separate explicit action and server-side stale-write protection remains authoritative.</small>`;
  }
  function ensureDiffHost() {
    const list = $("#ai-proposals"); if (!list || $("#ai-proposal-diff")) return;
    const section = document.createElement("section"); section.id = "ai-proposal-review"; section.className = "card proposal-review"; section.innerHTML = '<h3>Proposal Review Diff</h3><div id="ai-proposal-diff"><p class="muted">Select a proposal to inspect its deterministic review diff.</p></div>';
    list.parentElement?.insertBefore(section, list);
  }
  async function loadProposals() { try { proposals = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/proposals`); ensureDiffHost(); render(); } catch (error) { notify(error.message); } }
  function render() {
    ensureDiffHost(); const host = $("#ai-proposals"); if (!host) return;
    if (!proposals.length) { host.innerHTML = '<p class="muted">No durable AI proposals yet. Run the real AI writing engine to create one.</p>'; renderDiff(null); return; }
    host.innerHTML = proposals.slice().reverse().map((proposal) => {
      const selected = proposal.id === selectedProposalId, target = proposal.target ? `${proposal.target.bookId} / ${proposal.target.chapterId} / ${proposal.target.sceneId}` : "No target", canReview = proposal.status === "pending", canApply = proposal.status === "accepted";
      return `<article class="memory" data-proposal="${esc(proposal.id)}" style="${selected ? "outline:2px solid currentColor;" : ""}"><strong>${esc(proposal.title)}</strong><small>${esc(proposal.status)} • ${esc(proposal.kind)} • ${esc(target)}</small><p>${esc(proposal.rationale)}</p><details><summary>Candidate</summary><pre style="white-space:pre-wrap">${esc(proposal.proposedContent)}</pre></details><small>Source-revision binding active; stale-write protection prevents this proposal from overwriting newer author work.</small><div class="row"><button type="button" data-proposal-select="${esc(proposal.id)}">${selected ? "Selected" : "Select & Compare"}</button>${canReview ? `<button type="button" data-proposal-accept="${esc(proposal.id)}">Approve</button><button type="button" data-proposal-reject="${esc(proposal.id)}">Reject</button>` : ""}${canApply ? `<button type="button" class="primary" data-proposal-apply="${esc(proposal.id)}">Apply to manuscript</button>` : ""}</div></article>`;
    }).join("");
    renderDiff(proposals.find((proposal) => proposal.id === selectedProposalId) || null);
  }
  async function generate(event) {
    event.preventDefault(); const { book, chapter, scene } = current(); if (!book || !chapter || !scene) return notify("Select a book, chapter, and scene before asking Forge to write."); const instruction = $("#ai-instruction")?.value?.trim(); if (!instruction) return notify("Give the AI writing engine a direction first.");
    try { const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/writing/generate`, { method: "POST", body: JSON.stringify({ bookId: book.id, chapterId: chapter.id, sceneId: scene.id, task: $("#ai-task")?.value || "continue", instruction, proposalId: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }) }); if ($("#ai-result")) $("#ai-result").value = result.proposal.proposedContent; if ($("#ai-meta")) $("#ai-meta").textContent = `Durable proposal ${result.proposal.id} • ${result.proposal.status} • author approval required`; await loadProposals(); selectedProposalId = result.proposal.id; render(); notify("AI candidate saved as a durable proposal. Review the line-level diff before applying it to the manuscript.", true); } catch (error) { notify(error.message); }
  }
  async function review(proposalId, decision) { try { await api(`/api/projects/${encodeURIComponent(projectId)}/ai/proposals/${encodeURIComponent(proposalId)}/review`, { method: "POST", body: JSON.stringify({ decision, note: decision === "accepted" ? "Author approved in Writing Desk." : "Author rejected in Writing Desk." }) }); selectedProposalId = proposalId; await loadProposals(); notify(decision === "accepted" ? "Proposal approved. It is still separate from manuscript state until you apply it." : "Proposal rejected and retained as review history.", true); } catch (error) { notify(error.message); } }
  async function apply(proposalId) { try { const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/proposals/${encodeURIComponent(proposalId)}/apply`, { method: "POST", body: JSON.stringify({}) }); if ($("#ai-meta")) $("#ai-meta").textContent = `Applied approved proposal ${proposalId} to the manuscript.`; notify("Approved AI proposal applied to the manuscript and persisted.", true); if ($("#refresh")) $("#refresh").click(); await loadProposals(); return result; } catch (error) { notify(error.message); } }
  document.addEventListener("click", (event) => { const target = event.target instanceof Element ? event.target : null; if (!target) return; const select = target.closest("[data-proposal-select]"), accept = target.closest("[data-proposal-accept]"), reject = target.closest("[data-proposal-reject]"), applyButton = target.closest("[data-proposal-apply]"); if (select) { selectedProposalId = select.dataset.proposalSelect; const proposal = proposals.find((item) => item.id === selectedProposalId); if (proposal && $("#ai-result")) $("#ai-result").value = proposal.proposedContent; render(); return; } if (accept) { void review(accept.dataset.proposalAccept, "accepted"); return; } if (reject) { void review(reject.dataset.proposalReject, "rejected"); return; } if (applyButton) { void apply(applyButton.dataset.proposalApply); return; } });
  document.addEventListener("click", (event) => { const target = event.target instanceof Element ? event.target : null; if (!target || !target.closest("#ai-draft")) return; event.preventDefault(); event.stopImmediatePropagation(); void generate(event); }, true);
  window.addEventListener("forge:workspace-ready", () => { ensureDiffHost(); void loadProposals(); });
  window.addEventListener("load", () => { ensureDiffHost(); void loadProposals(); });
})();

/* PWA install lifecycle is loaded from a separately testable module. */
(() => {
  "use strict";
  const script = document.createElement("script");
  script.src = "/forge-pwa.js";
  script.async = true;
  script.onload = () => window.dispatchEvent(new Event("forge:pwa-ready"));
  document.head.appendChild(script);
})();
