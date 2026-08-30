/* Governed Studio AI proposal workflow: generation -> author review -> explicit manuscript apply. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  };
  const current = () => {
    const workspace = window.forgeWorkspaceState;
    const books = workspace?.books || [];
    const book = books.find((item) => item.id === $("#editor-book")?.value) || books.find((item) => item.id === workspace?.activeBookId) || books[0];
    const chapter = book?.chapters.find((item) => item.id === $("#editor-chapter")?.value) || book?.chapters[0];
    const scene = chapter?.scenes.find((item) => item.id === $("#editor-scene")?.value) || chapter?.scenes[0];
    return { book, chapter, scene };
  };
  const notify = (message, ok = false) => {
    const error = $("#error-banner");
    const success = $("#success-banner");
    const target = ok ? success : error;
    if (error) error.hidden = ok;
    if (success) success.hidden = !ok;
    if (target) { target.textContent = message; target.hidden = false; }
  };
  let proposals = [];
  let selectedProposalId = null;

  async function loadProposals() {
    try {
      proposals = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/proposals`);
      render();
    } catch (error) { notify(error.message); }
  }

  function render() {
    const host = $("#ai-proposals");
    if (!host) return;
    if (!proposals.length) {
      host.innerHTML = '<p class="muted">No durable AI proposals yet. Run the real AI writing engine to create one.</p>';
      return;
    }
    host.innerHTML = proposals.slice().reverse().map((proposal) => {
      const selected = proposal.id === selectedProposalId;
      const target = proposal.target ? `${proposal.target.bookId} / ${proposal.target.chapterId} / ${proposal.target.sceneId}` : "No target";
      const canReview = proposal.status === "pending";
      const canApply = proposal.status === "accepted";
      return `<article class="memory" data-proposal="${esc(proposal.id)}" style="${selected ? "outline:2px solid currentColor;" : ""}">
        <strong>${esc(proposal.title)}</strong>
        <small>${esc(proposal.status)} • ${esc(proposal.kind)} • ${esc(target)}</small>
        <p>${esc(proposal.rationale)}</p>
        <details><summary>Candidate</summary><pre style="white-space:pre-wrap">${esc(proposal.proposedContent)}</pre></details>
        <div class="row">
          <button type="button" data-proposal-select="${esc(proposal.id)}">${selected ? "Selected" : "Select"}</button>
          ${canReview ? `<button type="button" data-proposal-accept="${esc(proposal.id)}">Approve</button><button type="button" data-proposal-reject="${esc(proposal.id)}">Reject</button>` : ""}
          ${canApply ? `<button type="button" class="primary" data-proposal-apply="${esc(proposal.id)}">Apply to manuscript</button>` : ""}
        </div>
      </article>`;
    }).join("");
  }

  async function generate(event) {
    event.preventDefault();
    const { book, chapter, scene } = current();
    if (!book || !chapter || !scene) return notify("Select a book, chapter, and scene before asking Forge to write.");
    const instruction = $("#ai-instruction")?.value?.trim();
    if (!instruction) return notify("Give the AI writing engine a direction first.");
    try {
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/writing/generate`, {
        method: "POST",
        body: JSON.stringify({
          bookId: book.id,
          chapterId: chapter.id,
          sceneId: scene.id,
          task: $("#ai-task")?.value || "continue",
          instruction,
          proposalId: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      if ($("#ai-result")) $("#ai-result").value = result.proposal.proposedContent;
      if ($("#ai-meta")) $("#ai-meta").textContent = `Durable proposal ${result.proposal.id} • ${result.proposal.status} • author approval required`;
      await loadProposals();
      selectedProposalId = result.proposal.id;
      render();
      notify("AI candidate saved as a durable proposal. Review it before applying it to the manuscript.", true);
    } catch (error) { notify(error.message); }
  }

  async function review(proposalId, decision) {
    try {
      await api(`/api/projects/${encodeURIComponent(projectId)}/ai/proposals/${encodeURIComponent(proposalId)}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, note: decision === "accepted" ? "Author approved in Writing Desk." : "Author rejected in Writing Desk." }),
      });
      selectedProposalId = proposalId;
      await loadProposals();
      notify(decision === "accepted" ? "Proposal approved. It is still separate from manuscript state until you apply it." : "Proposal rejected and retained as review history.", true);
    } catch (error) { notify(error.message); }
  }

  async function apply(proposalId) {
    try {
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/proposals/${encodeURIComponent(proposalId)}/apply`, { method: "POST", body: JSON.stringify({}) });
      if ($("#ai-meta")) $("#ai-meta").textContent = `Applied approved proposal ${proposalId} to the manuscript.`;
      notify("Approved AI proposal applied to the manuscript and persisted.", true);
      if ($("#refresh")) $("#refresh").click();
      await loadProposals();
      return result;
    } catch (error) { notify(error.message); }
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const select = target.closest("[data-proposal-select]");
    const accept = target.closest("[data-proposal-accept]");
    const reject = target.closest("[data-proposal-reject]");
    const applyButton = target.closest("[data-proposal-apply]");
    if (select) { selectedProposalId = select.dataset.proposalSelect; const proposal = proposals.find((item) => item.id === selectedProposalId); if (proposal && $("#ai-result")) $("#ai-result").value = proposal.proposedContent; render(); return; }
    if (accept) { void review(accept.dataset.proposalAccept, "accepted"); return; }
    if (reject) { void review(reject.dataset.proposalReject, "rejected"); return; }
    if (applyButton) { void apply(applyButton.dataset.proposalApply); return; }
  });

  // Capture the existing Writing Desk AI button so it cannot bypass the durable proposal boundary.
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest("#ai-draft")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void generate(event);
  }, true);

  window.addEventListener("forge:workspace-ready", () => { void loadProposals(); });
  window.addEventListener("load", () => { void loadProposals(); });
})();
