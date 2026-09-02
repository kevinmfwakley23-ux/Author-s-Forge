/*
 * Author-directed book brief -> Chapter Cards -> approval -> AI draft proposals.
 * This extension deliberately replaces the legacy full-book shortcut that wrote
 * provider output directly into manuscript scenes. Approved cards govern AI
 * drafting; existing prose is never overwritten and generated prose remains in
 * the durable proposal ledger until the author reviews/applies it.
 */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const projectUrl = (suffix = "") => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const lines = (value) => String(value ?? "").split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);
  let workflow = { workflow: { candidates: [], approvals: [] }, validApprovals: [] };
  let busy = false;

  async function api(path, init = {}) {
    const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Chapter Card workflow request failed (${response.status}).`);
    return payload;
  }

  function notify(message, ok = false) {
    const banner = ok ? $("#success-banner") : $("#error-banner");
    const other = ok ? $("#error-banner") : $("#success-banner");
    if (other) other.hidden = true;
    if (banner) {
      banner.textContent = message;
      banner.hidden = false;
      if (ok) setTimeout(() => { banner.hidden = true; }, 5000);
    }
    const local = $("#chapter-card-workflow-status");
    if (local) {
      local.textContent = message;
      local.dataset.kind = ok ? "success" : "error";
    }
  }

  async function currentWorkspace() {
    return api(projectUrl("/workspace"));
  }

  function selectedBook(workspace) {
    const selectedId = $("#chapter-card-workflow-book")?.value;
    return workspace.books?.find((book) => book.id === selectedId)
      || workspace.books?.find((book) => book.id === workspace.activeBookId)
      || workspace.books?.[0];
  }

  function ensureStyles() {
    if ($("#chapter-card-workflow-styles")) return;
    const style = document.createElement("style");
    style.id = "chapter-card-workflow-styles";
    style.textContent = `
      .chapter-card-workflow{margin-top:1rem}
      .chapter-card-workflow textarea{width:100%;min-height:100px}
      .chapter-card-workflow .chapter-card-brief{min-height:170px}
      .chapter-card-workflow-grid{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
      .chapter-card-workflow-grid label{display:grid;gap:.35rem}
      .chapter-card-workflow-actions{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.8rem}
      .chapter-card-workflow-actions button{min-height:44px}
      .chapter-card-workflow-summary{display:grid;gap:.55rem;margin-top:.8rem}
      .chapter-card-workflow-candidate{border:1px solid rgba(127,127,127,.32);border-radius:10px;padding:.7rem}
      .chapter-card-workflow-candidate[data-status="approved"]{border-width:2px}
      #chapter-card-workflow-status[data-kind="error"]{font-weight:700}
      @media(max-width:800px){.chapter-card-workflow-grid{grid-template-columns:1fr}.chapter-card-workflow-actions button{flex:1 1 180px}}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    const architecture = $("#architecture");
    if (!architecture) return false;
    ensureStyles();
    if ($("#chapter-card-workflow")) return true;
    const card = document.createElement("article");
    card.id = "chapter-card-workflow";
    card.className = "card chapter-card-workflow";
    card.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">AUTHOR-DIRECTED CHAPTER CARDS</div><h3>Describe the book. Let Forge build the plan you approve.</h3><p class="muted">Give Forge the book description, important events, and timeline details. AI creates real Chapter Cards as unapproved planning. Edit them freely. Only the exact cards you approve may govern AI manuscript drafting.</p></div></div>
      <label>Book<select id="chapter-card-workflow-book"><option value="">Create a book first</option></select></label>
      <label>Book description / direction<textarea id="chapter-card-workflow-brief" class="chapter-card-brief" maxlength="32000" placeholder="Describe the story, genre, emotional journey, ending if known, non-negotiable facts, themes, and what the book should accomplish."></textarea></label>
      <div class="chapter-card-workflow-grid">
        <label>Known events <span class="muted">one per line</span><textarea id="chapter-card-workflow-events" maxlength="100000" placeholder="Mara finds the altered archive log.\nThe bridge collapses before dawn."></textarea></label>
        <label>Timeline details <span class="muted">one per line</span><textarea id="chapter-card-workflow-timeline" maxlength="100000" placeholder="Chapter 1 begins November 3, 1895.\nThe disappearance happened three days earlier."></textarea></label>
      </div>
      <div class="row">
        <label>Target chapters<input id="chapter-card-workflow-target" type="number" min="1" max="100" step="1" placeholder="Let Forge choose"></label>
        <label><input id="chapter-card-workflow-replace" type="checkbox"> Replace existing <strong>unapproved</strong> Chapter Cards</label>
      </div>
      <div class="chapter-card-workflow-actions">
        <button id="chapter-card-workflow-generate" class="primary" type="button">Generate Chapter Cards</button>
        <button id="chapter-card-workflow-review" type="button">Review / Edit Cards</button>
        <button id="chapter-card-workflow-approve" type="button">Approve Generated Cards</button>
        <button id="chapter-card-workflow-draft" class="primary" type="button">Draft Approved Novel</button>
      </div>
      <p id="chapter-card-workflow-status" class="muted" role="status">No Chapter Card generation run yet.</p>
      <div id="chapter-card-workflow-summary" class="chapter-card-workflow-summary"></div>`;
    architecture.appendChild(card);
    $("#chapter-card-workflow-generate")?.addEventListener("click", () => void generateCards());
    $("#chapter-card-workflow-review")?.addEventListener("click", reviewCards);
    $("#chapter-card-workflow-approve")?.addEventListener("click", () => void approveLatestCandidate());
    $("#chapter-card-workflow-draft")?.addEventListener("click", () => void draftApprovedBook());
    $("#chapter-card-workflow-book")?.addEventListener("change", () => void refreshWorkflow());
    return true;
  }

  function populateBooks(workspace) {
    const select = $("#chapter-card-workflow-book");
    if (!select) return;
    const previous = select.value;
    const books = workspace.books || [];
    select.innerHTML = books.length
      ? books.map((book) => `<option value="${esc(book.id)}">${esc(book.title)}</option>`).join("")
      : '<option value="">Create a book first</option>';
    const preferred = books.find((book) => book.id === previous)
      || books.find((book) => book.id === workspace.activeBookId)
      || books[0];
    if (preferred) select.value = preferred.id;
  }

  function latestPendingCandidate(bookId) {
    return (workflow.workflow?.candidates || []).find((candidate) => candidate.bookId === bookId && candidate.status === "pending");
  }

  function renderWorkflow(workspace) {
    const host = $("#chapter-card-workflow-summary");
    if (!host) return;
    const book = selectedBook(workspace);
    if (!book) {
      host.innerHTML = '<p class="muted">Create a book in Manuscript, then return here to generate its Chapter Cards.</p>';
      return;
    }
    const valid = new Set((workflow.validApprovals || []).map((approval) => approval.chapterId));
    const candidates = (workflow.workflow?.candidates || []).filter((candidate) => candidate.bookId === book.id);
    const approvedCount = (book.chapters || []).filter((chapter) => valid.has(chapter.id)).length;
    const cardCount = Object.keys(window.forgeChapterCardPlanning?.chapterCards || {}).filter((chapterId) => book.chapters.some((chapter) => chapter.id === chapterId)).length;
    host.innerHTML = `
      <div class="policy"><span>Book</span><strong>${esc(book.title)}</strong></div>
      <div class="policy"><span>Chapters</span><strong>${book.chapters?.length || 0}</strong></div>
      <div class="policy"><span>Current exact approvals</span><strong>${approvedCount}</strong></div>
      ${candidates.length ? candidates.slice(0, 5).map((candidate) => `<div class="chapter-card-workflow-candidate" data-status="${esc(candidate.status)}"><strong>${esc(candidate.status.toUpperCase())} · ${candidate.targetChapters} Chapter Cards</strong><small>${esc(candidate.provider)} · ${esc(candidate.model)} · ${esc(candidate.createdAt)}</small><p>${esc(candidate.description)}</p></div>`).join("") : '<p class="muted">No AI Chapter Card candidate sets for this book yet.</p>'}`;
    void cardCount;
  }

  async function refreshWorkflow() {
    if (!ensureUi()) return;
    try {
      const [workspace, currentWorkflow, planning] = await Promise.all([
        currentWorkspace(),
        api(projectUrl("/story-map/chapter-card-workflow")),
        api(projectUrl("/story-map/planning")),
      ]);
      workflow = currentWorkflow;
      window.forgeChapterCardPlanning = planning.planning || { chapterCards: {} };
      populateBooks(workspace);
      renderWorkflow(workspace);
      window.forgeWorkspaceState = workspace;
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  }

  async function ensureBookForBrief() {
    let workspace = await currentWorkspace();
    let book = selectedBook(workspace);
    if (book) return { workspace, book };
    const brief = $("#chapter-card-workflow-brief")?.value.trim() || $("#arch-idea")?.value.trim();
    if (!brief) throw new Error("Describe the book before creating its Chapter Cards.");
    const title = window.prompt("Name this book before Forge builds its Chapter Cards:", "Working Draft");
    if (!title?.trim()) throw new Error("A book title is required before Chapter Cards can be created.");
    await api(projectUrl("/workspace/books"), {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), kind: $("#arch-kind")?.value || "novel", description: brief }),
    });
    workspace = await currentWorkspace();
    book = selectedBook(workspace);
    if (!book) throw new Error("Forge created the book record but could not reload it.");
    populateBooks(workspace);
    return { workspace, book };
  }

  async function generateCards() {
    if (busy) return;
    busy = true;
    const button = $("#chapter-card-workflow-generate");
    if (button) button.disabled = true;
    try {
      const { book } = await ensureBookForBrief();
      const description = $("#chapter-card-workflow-brief")?.value.trim() || $("#arch-idea")?.value.trim() || book.description?.trim();
      if (!description) throw new Error("Describe the book before generating Chapter Cards.");
      const targetRaw = $("#chapter-card-workflow-target")?.value || $("#arch-target")?.value || "";
      const target = targetRaw ? Number(targetRaw) : undefined;
      if (target !== undefined && (!Number.isInteger(target) || target < 1 || target > 100)) throw new Error("Target chapters must be a whole number from 1 through 100.");
      notify("Forge is building structured Chapter Cards from the author brief, events, timeline, and Project Brain…", true);
      const result = await api(projectUrl("/story-map/chapter-card-workflow/generate"), {
        method: "POST",
        body: JSON.stringify({
          bookId: book.id,
          description,
          events: lines($("#chapter-card-workflow-events")?.value),
          timelineDetails: lines($("#chapter-card-workflow-timeline")?.value),
          ...(target === undefined ? {} : { targetChapters: target }),
          replaceExistingCards: $("#chapter-card-workflow-replace")?.checked === true,
        }),
      });
      await refreshWorkflow();
      document.getElementById("refresh")?.click();
      notify(`${result.candidate.targetChapters} Chapter Cards created as unapproved planning. Review and edit them before approval. No manuscript prose was written.`, true);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  function reviewCards() {
    const storyMapLink = document.querySelector('[data-route="story-map"]');
    if (storyMapLink) storyMapLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    else location.hash = "#story-map";
    setTimeout(() => document.querySelector("[data-plan-chapter]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
  }

  async function approveLatestCandidate() {
    if (busy) return;
    try {
      const workspace = await currentWorkspace();
      const book = selectedBook(workspace);
      if (!book) throw new Error("Select a book first.");
      await refreshWorkflow();
      const candidate = latestPendingCandidate(book.id);
      if (!candidate) throw new Error("There is no pending generated Chapter Card set for this book. Manual cards can be approved individually from their Chapter Card editor.");
      if (!window.confirm(`Approve the CURRENT edited Chapter Cards for ${book.title}? Approval is tied to their exact contents. Any later edit will invalidate the affected approval until you approve it again.`)) return;
      await api(projectUrl(`/story-map/chapter-card-workflow/candidates/${encodeURIComponent(candidate.id)}/approve`), {
        method: "POST",
        body: JSON.stringify({ authorApproved: true }),
      });
      await refreshWorkflow();
      notify(`Approved ${candidate.targetChapters} current Chapter Cards. They can now govern an author-requested AI draft.`, true);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  }

  async function draftApprovedBook() {
    if (busy) return;
    busy = true;
    const button = $("#chapter-card-workflow-draft");
    if (button) button.disabled = true;
    try {
      const [workspace, planningResult, workflowResult] = await Promise.all([
        currentWorkspace(),
        api(projectUrl("/story-map/planning")),
        api(projectUrl("/story-map/chapter-card-workflow")),
      ]);
      const book = selectedBook(workspace);
      if (!book) throw new Error("Select a book first.");
      const planning = planningResult.planning || { chapterCards: {} };
      const valid = new Set((workflowResult.validApprovals || []).map((approval) => approval.chapterId));
      const missing = (book.chapters || []).filter((chapter) => !planning.chapterCards?.[chapter.id] || !valid.has(chapter.id));
      if (missing.length) {
        throw new Error(`Every chapter must have a current author-approved Chapter Card before a whole-book AI draft. Missing/stale approval: ${missing.map((chapter) => `${chapter.number}. ${chapter.title}`).join("; ")}`);
      }
      if (!book.chapters?.length) throw new Error("This book has no chapters to draft.");
      const writable = book.chapters.filter((chapter) => !(chapter.scenes || []).some((scene) => String(scene.content || "").trim()));
      const preserved = book.chapters.length - writable.length;
      if (!writable.length) throw new Error("Every chapter already contains manuscript prose. Forge will not overwrite it with a generated draft.");
      if (!window.confirm(`Forge will make ${writable.length} real AI drafting call(s) using ONLY the current approved Chapter Cards. ${preserved ? `${preserved} chapter(s) with existing prose will be preserved and skipped. ` : ""}Each result will be a durable proposal requiring your review; manuscript prose will not be replaced automatically. Continue?`)) return;

      const generated = [];
      const failures = [];
      for (let index = 0; index < writable.length; index += 1) {
        const chapter = writable[index];
        const card = planning.chapterCards[chapter.id];
        notify(`Drafting proposal ${index + 1} of ${writable.length}: Chapter ${chapter.number}, ${chapter.title}…`, true);
        try {
          let liveWorkspace = await currentWorkspace();
          let liveBook = liveWorkspace.books.find((item) => item.id === book.id);
          let liveChapter = liveBook?.chapters.find((item) => item.id === chapter.id);
          if (!liveChapter) throw new Error("Chapter disappeared during drafting.");
          let scene = liveChapter.scenes?.[0];
          if (!scene) {
            await api(projectUrl(`/workspace/books/${encodeURIComponent(book.id)}/chapters/${encodeURIComponent(chapter.id)}/scenes`), {
              method: "POST",
              body: JSON.stringify({ number: 1, title: "Chapter Draft", synopsis: card.plotObjective || `Draft for Chapter ${chapter.number}` }),
            });
            liveWorkspace = await currentWorkspace();
            liveBook = liveWorkspace.books.find((item) => item.id === book.id);
            liveChapter = liveBook?.chapters.find((item) => item.id === chapter.id);
            scene = liveChapter?.scenes?.[0];
          }
          if (!scene) throw new Error("Forge could not prepare a manuscript scene for this chapter.");
          if (String(scene.content || "").trim()) {
            generated.push({ chapterId: chapter.id, skipped: true, reason: "Existing prose appeared during drafting and was preserved." });
            continue;
          }
          const response = await api(projectUrl("/ai/writing"), {
            method: "POST",
            body: JSON.stringify({
              bookId: book.id,
              chapterId: chapter.id,
              sceneId: scene.id,
              task: "draft",
              instruction: [
                `Draft the complete prose for Chapter ${chapter.number}, "${chapter.title}", from the explicitly approved Chapter Card.`,
                card.approximateWordCount ? `Aim for approximately ${card.approximateWordCount} words unless natural pacing requires modest variation.` : "Use an appropriate chapter length.",
                "Honor every required event, timeline constraint, POV assignment, continuity dependency, reveal boundary, and forbidden deviation.",
                "Return manuscript prose as an author-reviewable proposal only. Do not claim the draft is canon and do not alter any other chapter.",
              ].join(" "),
              contextQuery: `${chapter.title} ${card.plotObjective || ""} ${card.emotionalObjective || ""}`.trim(),
            }),
          });
          generated.push({ chapterId: chapter.id, proposalId: response.proposal?.id || "unknown" });
        } catch (error) {
          failures.push({ chapterId: chapter.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      document.getElementById("refresh")?.click();
      location.hash = "#writing";
      const message = `${generated.filter((item) => !item.skipped).length} chapter draft proposal(s) created for author review.${preserved ? ` ${preserved} chapter(s) with existing prose were preserved.` : ""}${failures.length ? ` ${failures.length} chapter(s) failed and can be retried; no prose was overwritten.` : ""}`;
      notify(message, failures.length === 0);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  function seedFromArchitecture() {
    const brief = $("#chapter-card-workflow-brief");
    const archIdea = $("#arch-idea")?.value?.trim();
    if (brief && !brief.value.trim() && archIdea) brief.value = archIdea;
    const target = $("#chapter-card-workflow-target");
    const archTarget = $("#arch-target")?.value;
    if (target && !target.value && archTarget) target.value = archTarget;
  }

  function installLegacyFullBookGuard() {
    const button = $("#book-run");
    if (button) {
      button.textContent = "Generate Chapter Cards";
      button.title = "Build structured Chapter Cards for author review. This no longer writes AI prose directly into the manuscript.";
    }
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("#book-run") : null;
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      seedFromArchitecture();
      $("#chapter-card-workflow")?.scrollIntoView({ behavior: "smooth", block: "start" });
      void generateCards();
    }, true);
  }

  async function boot() {
    if (!ensureUi()) return;
    installLegacyFullBookGuard();
    seedFromArchitecture();
    await refreshWorkflow();
  }

  window.addEventListener("forge:workspace-ready", () => { if ($("#chapter-card-workflow")) void refreshWorkflow(); });
  window.addEventListener("hashchange", () => { if (location.hash === "#architecture") { seedFromArchitecture(); void refreshWorkflow(); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
  else void boot();
})();
