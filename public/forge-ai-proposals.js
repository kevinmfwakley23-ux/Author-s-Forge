/* Governed Studio AI proposal workflow: generation -> author review -> explicit manuscript apply. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const api = async (path, options = {}) => { const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`); return payload; };
  const current = () => { const workspace = window.forgeWorkspaceState; const books = workspace?.books || []; const book = books.find((item) => item.id === $("#editor-book")?.value) || books.find((item) => item.id === workspace?.activeBookId) || books[0]; const chapter = book?.chapters.find((item) => item.id === $("#editor-chapter")?.value) || book?.chapters[0]; const scene = chapter?.scenes.find((item) => item.id === $("#editor-scene")?.value) || chapter?.scenes[0]; return { book, chapter, scene }; };
  const notify = (message, ok = false) => { const error = $("#error-banner"), success = $("#success-banner"), target = ok ? success : error; if (error) error.hidden = ok; if (success) success.hidden = !ok; if (target) { target.textContent = message; target.hidden = false; } };
  const DEFAULT_SECTION_MODES = { canon: "full", characters: "extended", relationships: "extended", timeline: "brief", research: "brief", voice: "full", "unresolved-threads": "full" };
  const SECTION_LABELS = { canon: "Canon", characters: "Characters", relationships: "Relationships", timeline: "Timeline", research: "Research", voice: "Style & voice", "unresolved-threads": "Open threads" };
  let proposals = [];
  let selectedProposalId = null;

  function splitLines(value) { if (!value) return []; return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n"); }
  function countWords(value) { const text = String(value || "").trim(); return text ? text.split(/\s+/u).length : 0; }
  function deterministicDiff(baseContent, proposedContent) { const base = splitLines(baseContent), proposed = splitLines(proposedContent), rows = base.length + 1, cols = proposed.length + 1; const table = Array.from({ length: rows }, () => Array(cols).fill(0)); for (let i = base.length - 1; i >= 0; i -= 1) for (let j = proposed.length - 1; j >= 0; j -= 1) table[i][j] = base[i] === proposed[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]); const lines = []; let i = 0, j = 0; while (i < base.length && j < proposed.length) { if (base[i] === proposed[j]) { lines.push({ kind: "unchanged", text: base[i], lineNumber: i + 1, proposedLineNumber: j + 1 }); i++; j++; } else if (table[i + 1][j] >= table[i][j + 1]) { lines.push({ kind: "removed", text: base[i], lineNumber: i + 1 }); i++; } else { lines.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 }); j++; } } while (i < base.length) lines.push({ kind: "removed", text: base[i], lineNumber: i + 1 }), i++; while (j < proposed.length) lines.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 }), j++; return { lines, addedLines: lines.filter((x) => x.kind === "added").length, removedLines: lines.filter((x) => x.kind === "removed").length, unchangedLines: lines.filter((x) => x.kind === "unchanged").length, baseWords: countWords(baseContent), proposedWords: countWords(proposedContent), changed: baseContent !== proposedContent }; }
  function renderVoiceDrift(proposal) { const report = proposal?.voiceDrift; if (!report) return '<p class="muted">No Author Voice Memory evidence is attached to this proposal.</p>'; const warnings = Array.isArray(report.warnings) ? report.warnings : []; const recommendations = Array.isArray(report.recommendations) ? report.recommendations : []; const matchedSamples = Array.isArray(report.matchedSamples) ? report.matchedSamples : []; const dimensions = report.dimensions && typeof report.dimensions === "object" ? Object.entries(report.dimensions) : []; const dimensionRows = dimensions.map(([name, value]) => `<li><strong>${esc(name)}</strong>: ${esc(Number(value).toFixed(3))}</li>`).join(""); return `<div class="proposal-voice-drift" data-voice-drift><div class="proposal-diff-summary"><strong>Author Voice Drift</strong><span>distance ${esc(Number(report.distance).toFixed(3))}</span><span>${esc(report.confidence)} confidence</span><span>${matchedSamples.length} matched sample${matchedSamples.length === 1 ? "" : "s"}</span></div><p><strong>Advisory only:</strong> this evidence never auto-rewrites, rejects, or applies the candidate. Author approval remains authoritative.</p>${warnings.length ? `<details open><summary>Voice warnings (${warnings.length})</summary><ul>${warnings.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></details>` : '<p class="muted">No voice-drift warnings were detected.</p>'}${recommendations.length ? `<details><summary>Recommendations (${recommendations.length})</summary><ul>${recommendations.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></details>` : ""}${dimensionRows ? `<details><summary>Measured dimensions</summary><ul>${dimensionRows}</ul></details>` : ""}${matchedSamples.length ? `<details><summary>Matched voice evidence</summary><ul>${matchedSamples.map((item) => `<li>${esc(typeof item === "string" ? item : item.id ?? item.sampleId ?? JSON.stringify(item))}</li>`).join("")}</ul></details>` : ""}</div>`; }
  function renderDiff(proposal) { const host = $("#ai-proposal-diff"); if (!host) return; if (!proposal) { host.innerHTML = '<p class="muted">Select a proposal to inspect its deterministic review diff.</p>'; return; } const { scene } = current(); const diff = deterministicDiff(scene?.content || "", proposal.proposedContent); const rows = diff.lines.map((line) => { const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "; return `<div class="proposal-diff-line ${esc(line.kind)}"><span>${prefix}</span><code>${esc(line.text || " ")}</code></div>`; }).join(""); host.innerHTML = `<div class="proposal-diff-summary"><strong>${diff.changed ? "Changes detected" : "No changes"}</strong><span>+${diff.addedLines} added</span><span>−${diff.removedLines} removed</span><span>${diff.unchangedLines} unchanged</span><span>${diff.baseWords} → ${diff.proposedWords} words</span></div><details open><summary>Line-level review</summary><div class="proposal-diff" aria-label="Proposal line-level diff">${rows || '<p class="muted">No lines.</p>'}</div></details><section aria-label="Author Voice Memory review"><h4>Author Voice Memory</h4>${renderVoiceDrift(proposal)}</section><small class="muted">Review base is the scene currently loaded in the Writing Desk. Applying remains a separate explicit action and server-side stale-write protection remains authoritative.</small>`; }
  function ensureDiffHost() { const list = $("#ai-proposals"); if (!list || $("#ai-proposal-diff")) return; const section = document.createElement("section"); section.id = "ai-proposal-review"; section.className = "card proposal-review"; section.innerHTML = '<h3>Proposal Review Diff</h3><div id="ai-proposal-diff"><p class="muted">Select a proposal to inspect its deterministic review diff.</p></div>'; list.parentElement?.insertBefore(section, list); }

  function ensureContextPreviewHost() {
    const draftButton = $("#ai-draft");
    if (!draftButton || $("#ai-context-preview")) return;
    const section = document.createElement("section");
    section.id = "ai-context-preview";
    section.className = "card proposal-review";
    section.setAttribute("aria-label", "Forge Brain context preview and controls");
    const toggles = Object.entries(SECTION_LABELS).map(([key, label]) => `<label><input type="checkbox" data-context-section="${esc(key)}" checked> ${esc(label)}</label>`).join("");
    section.innerHTML = `<div class="row"><div><h3>Forge Brain Context</h3><p class="muted">See and control what Forge will remember for this writing request. Previewing is read-only; generation rechecks current project state.</p></div><button type="button" data-context-preview>Preview context</button></div><fieldset class="context-controls"><legend>Context depth</legend><label>Retrieval depth <select id="ai-context-depth" aria-label="Context retrieval depth"><option value="3">Focused — least distraction</option><option value="6" selected>Balanced — recommended</option><option value="10">Deep — more supporting memory</option></select></label><div class="row" role="group" aria-label="Context sections">${toggles}</div><small class="muted">Canon and author authority are never changed by these controls. Turning a section off only excludes it from this AI request.</small></fieldset><div id="ai-context-preview-body" aria-live="polite"><p class="muted">No preview loaded yet.</p></div>`;
    const container = draftButton.closest("form") || draftButton.parentElement;
    container?.parentElement?.insertBefore(section, container.nextSibling);
  }

  function contextOptions() {
    ensureContextPreviewHost();
    const depth = Number($("#ai-context-depth")?.value || 6);
    const policies = Object.entries(DEFAULT_SECTION_MODES).map(([key, mode]) => ({ key, mode: document.querySelector(`[data-context-section="${key}"]`)?.checked === false ? "off" : mode }));
    return { memoryLimitPerSection: depth, characterMemoryLimit: depth, policies };
  }

  function friendlyReason(reason) {
    const value = String(reason || "");
    if (value === "authoritative") return "author-locked / authoritative";
    if (value === "verified") return "verified project memory";
    if (value === "author-provenance") return "entered or approved by the author";
    if (value === "fallback:authority") return "best available authority when no direct wording matched";
    if (value === "section-default") return "default support for this context section";
    if (value.startsWith("terms:")) return `matched request terms: ${value.slice(6)}`;
    if (value.startsWith("tags:")) return `matched project tags: ${value.slice(5)}`;
    if (value.startsWith("saliency-score:")) return `relevance score ${value.slice(15)}`;
    if (value.startsWith("authority:")) return `${value.slice(10)} project memory`;
    return value.replaceAll("-", " ");
  }

  function renderContextPreview(preview) {
    const host = $("#ai-context-preview-body");
    if (!host) return;
    if (!preview?.context) { host.innerHTML = '<p class="muted">No governed context matched the current instruction.</p>'; return; }
    const context = preview.context;
    const sections = Array.isArray(context.sections) ? context.sections : [];
    const evidence = Array.isArray(context.evidence) ? context.evidence : [];
    const sources = Array.isArray(context.sourceIds) ? context.sourceIds : [];
    const evidenceBySection = new Map();
    for (const item of evidence) { const group = evidenceBySection.get(item.sectionKey) || []; group.push(item); evidenceBySection.set(item.sectionKey, group); }
    const sectionHtml = sections.length ? sections.map((section) => { const sectionEvidence = evidenceBySection.get(section.key) || []; const why = sectionEvidence.length ? `<ul>${sectionEvidence.map((item) => `<li><strong>${esc(item.sourceId)}</strong>${Array.isArray(item.reasons) && item.reasons.length ? ` — ${item.reasons.map(friendlyReason).map(esc).join("; ")}` : ""}</li>`).join("")}</ul>` : '<p class="muted">Selected by the section policy.</p>'; return `<details><summary>${esc(section.title || section.key)} • ${esc(section.wordCount || 0)} words • ${esc((section.sourceIds || []).length)} source${(section.sourceIds || []).length === 1 ? "" : "s"}</summary><p><strong>Why Forge selected this</strong></p>${why}<details><summary>View supplied context</summary><pre style="white-space:pre-wrap">${esc(section.text || "")}</pre></details></details>`; }).join("") : '<p class="muted">No context sections selected. Enable a section above or add relevant project memory.</p>';
    const voice = preview.authorVoice || { available: false, sampleCount: 0, canonicalSampleCount: 0 };
    host.innerHTML = `<div class="proposal-diff-summary"><strong>${sections.length} active section${sections.length === 1 ? "" : "s"}</strong><span>${sources.length} source${sources.length === 1 ? "" : "s"}</span><span>${esc(context.totalWords ?? 0)} context words</span><span>Author Voice ${voice.available ? `on • ${esc(voice.canonicalSampleCount)} canonical` : "not yet trained"}</span></div>${sectionHtml}<details><summary>Source manifest (${sources.length})</summary>${sources.length ? `<ul>${sources.map((id) => `<li>${esc(id)}</li>`).join("")}</ul>` : '<p class="muted">No source records selected.</p>'}</details><small class="muted">Read-only preview. Forge reassembles authoritative project state immediately before generation, so a stale preview can never override newer author edits.</small>`;
  }

  async function previewContext() {
    ensureContextPreviewHost();
    const instruction = $("#ai-instruction")?.value?.trim();
    if (!instruction) { renderContextPreview(null); throw new Error("Give the AI writing engine a direction before previewing context."); }
    const payload = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/writing/context`, { method: "POST", body: JSON.stringify({ query: instruction, ...contextOptions() }) });
    renderContextPreview(payload);
    return payload;
  }

  async function loadProposals() { try { proposals = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/proposals`); ensureDiffHost(); ensureContextPreviewHost(); render(); } catch (error) { notify(error.message); } }
  function render() { ensureDiffHost(); ensureContextPreviewHost(); const host = $("#ai-proposals"); if (!host) return; if (!proposals.length) { host.innerHTML = '<p class="muted">No durable AI proposals yet. Run the real AI writing engine to create one.</p>'; renderDiff(null); return; } host.innerHTML = proposals.slice().reverse().map((proposal) => { const selected = proposal.id === selectedProposalId, target = proposal.target ? `${proposal.target.bookId} / ${proposal.target.chapterId} / ${proposal.target.sceneId}` : "No target", canReview = proposal.status === "pending", canApply = proposal.status === "accepted"; return `<article class="memory" data-proposal="${esc(proposal.id)}" style="${selected ? "outline:2px solid currentColor;" : ""}"><strong>${esc(proposal.title)}</strong><small>${esc(proposal.status)} • ${esc(proposal.kind)} • ${esc(target)}</small><p>${esc(proposal.rationale)}</p><details><summary>Candidate</summary><pre style="white-space:pre-wrap">${esc(proposal.proposedContent)}</pre></details><small>Source-revision binding active; stale-write protection prevents this proposal from overwriting newer author work.</small><div class="row"><button type="button" data-proposal-select="${esc(proposal.id)}">${selected ? "Selected" : "Select & Compare"}</button>${canReview ? `<button type="button" data-proposal-accept="${esc(proposal.id)}">Approve</button><button type="button" data-proposal-reject="${esc(proposal.id)}">Reject</button>` : ""}${canApply ? `<button type="button" class="primary" data-proposal-apply="${esc(proposal.id)}">Apply to manuscript</button>` : ""}</div></article>`; }).join(""); renderDiff(proposals.find((proposal) => proposal.id === selectedProposalId) || null); }

  async function generate(event) {
    event.preventDefault();
    const { book, chapter, scene } = current();
    if (!book || !chapter || !scene) return notify("Select a book, chapter, and scene before asking Forge to write.");
    const instruction = $("#ai-instruction")?.value?.trim();
    if (!instruction) return notify("Give the AI writing engine a direction first.");
    try {
      await previewContext();
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/writing/generate`, { method: "POST", body: JSON.stringify({ bookId: book.id, chapterId: chapter.id, sceneId: scene.id, task: $("#ai-task")?.value || "continue", instruction, contextQuery: instruction, ...contextOptions(), proposalId: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }) });
      if ($("#ai-result")) $("#ai-result").value = result.proposal.proposedContent;
      if ($("#ai-meta")) $("#ai-meta").textContent = `Durable proposal ${result.proposal.id} • ${result.proposal.status} • ${result.context?.sourceIds?.length || 0} governed sources • author approval required`;
      await loadProposals();
      selectedProposalId = result.proposal.id;
      render();
      notify("AI candidate saved as a durable proposal. Review context, line-level changes, continuity evidence, and Author Voice evidence before applying it.", true);
    } catch (error) { notify(error.message); }
  }

  async function review(proposalId, decision) { try { await api(`/api/projects/${encodeURIComponent(projectId)}/ai/proposals/${encodeURIComponent(proposalId)}/review`, { method: "POST", body: JSON.stringify({ decision, note: decision === "accepted" ? "Author approved in Writing Desk." : "Author rejected in Writing Desk." }) }); selectedProposalId = proposalId; await loadProposals(); notify(decision === "accepted" ? "Proposal approved. It is still separate from manuscript state until you apply it." : "Proposal rejected and retained as review history.", true); } catch (error) { notify(error.message); } }
  async function apply(proposalId) { try { const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/proposals/${encodeURIComponent(proposalId)}/apply`, { method: "POST", body: JSON.stringify({}) }); if ($("#ai-meta")) $("#ai-meta").textContent = `Applied approved proposal ${proposalId} to the manuscript.`; notify("Approved AI proposal applied to the manuscript and persisted.", true); if ($("#refresh")) $("#refresh").click(); await loadProposals(); return result; } catch (error) { notify(error.message); } }

  document.addEventListener("change", (event) => { const target = event.target instanceof Element ? event.target : null; if (!target || (!target.matches("#ai-context-depth") && !target.matches("[data-context-section]"))) return; const host = $("#ai-context-preview-body"); if (host) host.innerHTML = '<p class="muted">Context settings changed. Preview again to inspect exactly what Forge will use.</p>'; });
  document.addEventListener("click", (event) => { const target = event.target instanceof Element ? event.target : null; if (!target) return; const select = target.closest("[data-proposal-select]"), accept = target.closest("[data-proposal-accept]"), reject = target.closest("[data-proposal-reject]"), applyButton = target.closest("[data-proposal-apply]"), previewButton = target.closest("[data-context-preview]"); if (previewButton) { void previewContext().catch((error) => notify(error.message)); return; } if (select) { selectedProposalId = select.dataset.proposalSelect; const proposal = proposals.find((item) => item.id === selectedProposalId); if (proposal && $("#ai-result")) $("#ai-result").value = proposal.proposedContent; render(); return; } if (accept) { void review(accept.dataset.proposalAccept, "accepted"); return; } if (reject) { void review(reject.dataset.proposalReject, "rejected"); return; } if (applyButton) { void apply(applyButton.dataset.proposalApply); return; } });
  document.addEventListener("click", (event) => { const target = event.target instanceof Element ? event.target : null; if (!target || !target.closest("#ai-draft")) return; event.preventDefault(); event.stopImmediatePropagation(); void generate(event); }, true);
  window.addEventListener("forge:workspace-ready", () => { ensureDiffHost(); ensureContextPreviewHost(); void loadProposals(); });
  window.addEventListener("load", () => { ensureDiffHost(); ensureContextPreviewHost(); void loadProposals(); });
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

/* Editing Room proposal workflow is loaded as a separate surface so it can be regression-tested independently. */
(() => {
  "use strict";
  const script = document.createElement("script");
  script.src = "/forge-editing-proposals.js";
  script.async = true;
  script.onload = () => window.dispatchEvent(new Event("forge:editing-proposals-ready"));
  document.head.appendChild(script);
})();