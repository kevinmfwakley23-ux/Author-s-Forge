/* Governed Editing Room: Craft Lens -> author-selected strategy -> durable AI rewrite proposal -> review -> explicit apply. */
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

  function analyzeCraft(text) {
    const normalized = String(text ?? "").replace(/\r\n?/g, "\n").trim();
    const words = normalized ? normalized.split(/\s+/u).filter(Boolean) : [];
    const sentences = normalized.split(/[.!?]+(?:\s+|$)/u).map((sentence) => sentence.trim()).filter(Boolean);
    const dialogueMatches = normalized.match(/[“\"][^”\"]*[”\"]/gu) || [];
    const passiveMatches = normalized.match(/\b(?:was|were|been|being|is|are|be)\s+(?:\w+ed|\w+en)\b/giu) || [];
    const longSentences = sentences.filter((sentence) => sentence.split(/\s+/u).length > 35);
    const findings = [];
    if (longSentences.length) findings.push({ id: "clarity-long-sentences", dimension: "clarity", severity: longSentences.length >= 3 ? "high" : "watch", message: `${longSentences.length} sentence${longSentences.length === 1 ? "" : "s"} exceed 35 words.`, evidence: longSentences.slice(0, 2).join(" / "), suggestions: ["Split at a natural beat.", "Check whether each clause advances the same thought."] });
    if (passiveMatches.length) findings.push({ id: "clarity-passive", dimension: "clarity", severity: passiveMatches.length >= 5 ? "watch" : "info", message: `${passiveMatches.length} possible passive constructions detected.`, evidence: passiveMatches.slice(0, 5).join(", "), suggestions: ["Confirm the passive voice is intentional.", "Prefer an active construction when the actor matters."] });
    if (sentences.length >= 5 && dialogueMatches.length === 0) findings.push({ id: "dialogue-none", dimension: "dialogue", severity: "info", message: "No quoted dialogue detected in this passage.", evidence: "The selected passage contains no detected dialogue spans.", suggestions: ["Keep the passage dialogue-free if that serves the scene.", "If characters are present, consider whether a spoken beat would sharpen conflict."] });
    const dialogueRatio = normalized.length ? dialogueMatches.join(" ").length / normalized.length : 0;
    if (dialogueRatio > 0.65) findings.push({ id: "dialogue-heavy", dimension: "dialogue", severity: "watch", message: "Dialogue occupies most of this passage.", evidence: `${Math.round(dialogueRatio * 100)}% of characters are inside detected dialogue spans.`, suggestions: ["Check for action or reaction beats between exchanges.", "Make sure dialogue carries subtext rather than exposition alone."] });
    const vocabulary = new Set(words.map((word) => word.toLowerCase().replace(/[^a-z']/g, "")).filter(Boolean));
    if (words.length >= 100 && vocabulary.size / words.length < 0.42) findings.push({ id: "concision-repetition", dimension: "concision", severity: "watch", message: "Vocabulary variety is unusually concentrated for this passage.", evidence: "Unique normalized word ratio is below 42%.", suggestions: ["Inspect repeated modifiers and sentence openings.", "Keep deliberate repetition; remove accidental echoes."] });
    if (words.length >= 100 && !/\b(?:smell|scent|taste|tasted|heard|hear|sound|felt|feel|touch|saw|see|look|light|dark|warm|cold|rough|soft)\b/i.test(normalized)) findings.push({ id: "sensory-light", dimension: "sensory", severity: "info", message: "No obvious sensory cue was detected.", evidence: "The passage lacks common sensory anchor terms.", suggestions: ["Add sensory detail only where it changes the reader's experience.", "Use a concrete physical detail instead of an abstract adjective when useful."] });
    if (sentences.length >= 6) {
      const lengths = sentences.map((sentence) => sentence.split(/\s+/u).length);
      const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
      const variance = lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length;
      if (Math.sqrt(variance) < 5) findings.push({ id: "rhythm-flat", dimension: "rhythm", severity: "watch", message: "Sentence lengths are unusually uniform.", evidence: `Sentence-length standard deviation is ${Math.sqrt(variance).toFixed(1)} words.`, suggestions: ["Vary sentence length around important beats.", "Preserve uniform rhythm when it is an intentional voice choice."] });
    }
    return { formatVersion: 1, wordCount: words.length, sentenceCount: sentences.length, findings };
  }

  function deterministicDiff(baseContent, proposedContent) {
    const base = splitLines(baseContent), proposed = splitLines(proposedContent), rows = base.length + 1, cols = proposed.length + 1;
    const table = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let i = base.length - 1; i >= 0; i -= 1) for (let j = proposed.length - 1; j >= 0; j -= 1) table[i][j] = base[i] === proposed[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    const lines = []; let i = 0, j = 0;
    while (i < base.length && j < proposed.length) {
      if (base[i] === proposed[j]) { lines.push({ kind: "unchanged", text: base[i], lineNumber: i + 1, proposedLineNumber: j + 1 }); i++; j++; }
      else if (table[i + 1][j] >= table[i][j + 1]) { lines.push({ kind: "removed", text: base[i], lineNumber: i + 1 }); i++; }
      else { lines.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 }); j++;
      }
    }
    while (i < base.length) { lines.push({ kind: "removed", text: base[i], lineNumber: i + 1 }); i++; }
    while (j < proposed.length) { lines.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 }); j++; }
    return { lines, addedLines: lines.filter((item) => item.kind === "added").length, removedLines: lines.filter((item) => item.kind === "removed").length, unchangedLines: lines.filter((item) => item.kind === "unchanged").length, baseWords: countWords(baseContent), proposedWords: countWords(proposedContent), changed: baseContent !== proposedContent };
  }

  function renderDiff(proposal) {
    const host = $("#ai-editing-proposal-diff"); if (!host) return;
    if (!proposal) { host.innerHTML = '<p class="muted">Select an editing proposal to inspect the deterministic review diff.</p>'; return; }
    const { scene } = current();
    const diff = deterministicDiff(scene?.content || "", proposal.proposedContent);
    const rows = diff.lines.map((line) => { const prefix = line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "; return `<div class="proposal-diff-line ${esc(line.kind)}"><span>${prefix}</span><code>${esc(line.text || " ")}</code></div>`; }).join("");
    const craft = proposal.craftLensEvidence ? `<div class="policy"><span>Craft Lens evidence</span><strong>${esc(proposal.craftLensEvidence.dimension)} • ${esc(proposal.craftLensEvidence.severity)}</strong></div><p>${esc(proposal.craftLensEvidence.message)}</p><small>${esc(proposal.craftLensEvidence.selectedSuggestion)}</small>` : "";
    const voice = proposal.voiceDrift ? `<div class="policy"><span>Author Voice drift</span><strong>${Number(proposal.voiceDrift.distance).toFixed(3)} • ${esc(proposal.voiceDrift.confidence)}</strong></div>` : "";
    const continuity = proposal.characterContinuity ? `<div class="policy"><span>Character continuity</span><strong>${esc(proposal.characterContinuity.status)}</strong></div>` : "";
    host.innerHTML = `${craft}${voice}${continuity}<div class="proposal-diff-summary"><strong>${diff.changed ? "Changes detected" : "No changes"}</strong><span>+${diff.addedLines} added</span><span>−${diff.removedLines} removed</span><span>${diff.unchangedLines} unchanged</span><span>${diff.baseWords} → ${diff.proposedWords} words</span></div><details open><summary>Line-level review</summary><div class="proposal-diff" aria-label="Editing proposal line-level diff">${rows || '<p class="muted">No lines.</p>'}</div></details><small class="muted">Craft diagnostics are advisory evidence, not universal style rules. Approval and application remain separate author actions, and server-side source-revision protection remains authoritative.</small>`;
  }

  function installPanel() {
    const result = $("#edit-result");
    if (!result || $("#ai-editing-proposal-panel")) return;
    const panel = document.createElement("article");
    panel.id = "ai-editing-proposal-panel";
    panel.className = "card";
    panel.innerHTML = `<div class="section-title"><div><div class="eyebrow">CRAFT LENS</div><h3>Evidence-led revision</h3><p class="muted">Analyze the saved scene for concrete craft patterns, choose a revision strategy yourself, then create a durable proposal. Forge never treats a diagnostic as an automatic correction.</p></div><button id="craft-lens-run" class="primary" type="button">Run Craft Lens</button></div><div id="craft-lens-summary" class="muted">Select a scene and run the lens. Analysis is read-only.</div><div id="craft-lens-findings" class="list" aria-live="polite"></div><details><summary>Manual editorial proposal</summary><p class="muted">Use this advanced path for a human/editor finding that is not produced by Craft Lens.</p><div class="grid"><label>Finding<textarea id="ai-editing-finding" placeholder="Describe the editorial problem exactly."></textarea></label><label>Recommendation<textarea id="ai-editing-recommendation" placeholder="What should the rewrite improve or change?"></textarea></label></div><div class="row"><label>Start <input id="ai-editing-start" type="number" min="0" value="0"></label><label>End <input id="ai-editing-end" type="number" min="1" value="1"></label><button id="ai-editing-propose" type="button">Generate manual rewrite proposal</button></div></details><div id="ai-editing-proposal-status" class="muted"></div><div id="ai-editing-proposal-list" class="list"></div><section class="card proposal-review"><h3>Proposal Review Diff</h3><div id="ai-editing-proposal-diff"><p class="muted">Select an editing proposal to inspect the deterministic review diff.</p></div></section>`;
    result.parentElement?.insertAdjacentElement("afterend", panel);
    $("#craft-lens-run")?.addEventListener("click", runCraftLens);
    $("#ai-editing-propose")?.addEventListener("click", proposeManual);
    $("#craft-lens-findings")?.addEventListener("click", onCraftAction);
    refresh();
  }

  function runCraftLens() {
    const { scene } = current();
    if (!scene) return notify("Select a saved scene before running Craft Lens.");
    if (!scene.content.trim()) return notify("Save scene content before running Craft Lens.");
    const report = analyzeCraft(scene.content);
    const summary = $("#craft-lens-summary");
    if (summary) summary.textContent = `${report.wordCount} words • ${report.sentenceCount} sentences • ${report.findings.length} finding${report.findings.length === 1 ? "" : "s"}. Analysis did not modify the manuscript.`;
    const host = $("#craft-lens-findings");
    if (!host) return;
    host.innerHTML = report.findings.length ? report.findings.map((finding) => `<article class="memory" data-craft-finding="${esc(finding.id)}"><div class="row"><strong>${esc(finding.dimension)}</strong><small>${esc(finding.severity)}</small></div><p>${esc(finding.message)}</p><blockquote>${esc(finding.evidence)}</blockquote><div class="list">${finding.suggestions.map((suggestion, index) => `<button type="button" data-craft-strategy="${esc(finding.id)}" data-craft-index="${index}">${esc(suggestion)}</button>`).join("")}</div><small class="muted">Choose a strategy only if it serves the scene and your voice.</small></article>`).join("") : '<p class="muted">No deterministic Craft Lens patterns were flagged in this scene. That is not a quality score and does not mean the scene needs no editorial judgment.</p>';
    host._craftReport = report;
  }

  async function onCraftAction(event) {
    const button = event.target instanceof Element ? event.target.closest("[data-craft-strategy]") : null;
    if (!button) return;
    const host = $("#craft-lens-findings"), report = host?._craftReport;
    const finding = report?.findings.find((item) => item.id === button.dataset.craftStrategy);
    const suggestion = finding?.suggestions[Number(button.dataset.craftIndex)];
    if (!finding || !suggestion) return notify("Craft Lens selection is no longer valid. Run the lens again.");
    await proposeCraft(finding, suggestion, button);
  }

  async function proposeCraft(finding, suggestion, button) {
    const { book, chapter, scene } = current();
    if (!book || !chapter || !scene) return notify("Select a book and scene before creating a Craft Lens proposal.");
    button.disabled = true;
    try {
      const result = await api(projectUrl("/ai/editing/propose"), { method: "POST", body: JSON.stringify({ bookId: book.id, chapterId: chapter.id, sceneId: scene.id, findingMessage: finding.message, recommendation: suggestion, findingStart: 0, findingEnd: scene.content.length, instruction: "Use the author-selected Craft Lens strategy only where it improves this scene. Preserve canon, continuity, POV, tense, voice, meaning, and intentional style choices.", proposalId: `craft-proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }) });
      if (!result.proposal?.craftLensEvidence || result.proposal.craftLensEvidence.findingId !== finding.id || result.proposal.craftLensEvidence.selectedSuggestion !== suggestion) throw new Error("The saved scene no longer matches this Craft Lens finding. Run Craft Lens again before proposing a rewrite.");
      $("#ai-editing-proposal-status").textContent = `Durable Craft Lens proposal ${result.proposal.id} • pending author review • source revision bound`;
      notify("Craft Lens rewrite proposal created. Review the evidence and line-level diff before approval.", true);
      await refresh(result.proposal.id);
    } catch (error) { notify(error.message); }
    finally { button.disabled = false; }
  }

  async function proposeManual() {
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
      const result = await api(projectUrl("/ai/editing/propose"), { method: "POST", body: JSON.stringify({ bookId: book.id, chapterId: chapter.id, sceneId: scene.id, findingMessage, recommendation, findingStart, findingEnd, instruction: "Preserve canon, continuity, POV, tense, and author intent while resolving this human editorial finding.", proposalId: `editing-proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }) });
      $("#ai-editing-proposal-status").textContent = `Durable proposal ${result.proposal.id} • pending author review • source revision bound`;
      notify("Manual editing proposal created. Review the line-level diff before approval or application.", true);
      await refresh(result.proposal.id);
    } catch (error) { notify(error.message); }
    finally { if (button) button.disabled = false; }
  }

  async function refresh(selectedId) {
    const host = $("#ai-editing-proposal-list"); if (!host) return;
    try {
      const proposals = (await api(projectUrl("/ai/proposals"))).filter((proposal) => proposal.kind === "manuscript-edit");
      const selected = selectedId ? proposals.find((proposal) => proposal.id === selectedId) : proposals[0];
      host.innerHTML = proposals.length ? proposals.slice().reverse().map((proposal) => { const craft = proposal.craftLensEvidence ? `<small>Craft Lens • ${esc(proposal.craftLensEvidence.dimension)} • ${esc(proposal.craftLensEvidence.severity)}</small>` : '<small>Manual/editorial proposal</small>'; return `<article class="memory" data-edit-proposal="${esc(proposal.id)}" style="${selected?.id === proposal.id ? "outline:2px solid currentColor;" : ""}"><strong>${esc(proposal.title)}</strong><small>${esc(proposal.status)} • ${esc(proposal.target?.sceneId || "No target")}</small>${craft}<p>${esc(proposal.rationale)}</p><details><summary>Proposed revision</summary><pre style="white-space:pre-wrap">${esc(proposal.proposedContent)}</pre></details><div class="row"><button type="button" data-edit-select="${esc(proposal.id)}">${selected?.id === proposal.id ? "Selected" : "Select & Compare"}</button>${proposal.status === "pending" ? `<button type="button" data-edit-approve="${esc(proposal.id)}">Approve</button><button type="button" data-edit-reject="${esc(proposal.id)}">Reject</button>` : ""}${proposal.status === "accepted" ? `<button type="button" class="primary" data-edit-apply="${esc(proposal.id)}">Apply to manuscript</button>` : ""}</div></article>`; }).join("") : '<p class="muted">No AI editing proposals yet.</p>';
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

  window.addEventListener("forge:workspace-ready", () => { installPanel(); const host = $("#craft-lens-findings"); if (host) { host.innerHTML = ""; delete host._craftReport; } });
  window.addEventListener("load", installPanel);
  window.addEventListener("hashchange", installPanel);
  function loadStoryMap() {
    if (document.querySelector('script[data-forge-story-map]')) return;
    const script = document.createElement("script"); script.src = "/forge-story-map.js"; script.dataset.forgeStoryMap = "true"; script.defer = true; document.head.appendChild(script);
  }
  window.addEventListener("load", loadStoryMap, { once: true });
})();
