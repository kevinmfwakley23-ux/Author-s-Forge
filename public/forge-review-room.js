/* Author's Forge human Review Room. Human feedback is durable; reviewer suggestions never mutate manuscript text until the author accepts and separately applies them. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const root = `/api/projects/${encodeURIComponent(projectId)}/human-review`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  let state = { reviewers: [], comments: [], suggestions: [] };

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Review request failed (${response.status}).`);
    return payload;
  }

  function notify(message, ok = false) {
    const target = ok ? $("#success-banner") : $("#error-banner");
    if (!target) return;
    target.textContent = message; target.hidden = false;
    const other = ok ? $("#error-banner") : $("#success-banner"); if (other) other.hidden = true;
    if (ok) setTimeout(() => { target.hidden = true; }, 5000);
  }

  function ensureUi() {
    if (!$("#dashboard") || $("#review-room")) return;
    const nav = $(".sidebar nav");
    if (nav) {
      const link = document.createElement("a");
      link.href = "#review-room"; link.dataset.route = "review-room"; link.textContent = "Review Room";
      const editing = nav.querySelector('[data-route="editing"]');
      nav.insertBefore(link, editing || null);
    }
    const main = document.querySelector("main");
    const footer = main?.querySelector("footer");
    const section = document.createElement("section");
    section.id = "review-room"; section.className = "view"; section.dataset.view = ""; section.hidden = true; section.setAttribute("aria-hidden", "true");
    section.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">HUMAN REVIEW</div><h2>Comments and tracked suggestions without surrendering author control</h2><p>Invite a co-writer, editor, or beta reader. Reviewer tokens are shown once. Human suggestions remain separate from the manuscript until you accept and apply them.</p></div><button id="review-refresh" type="button">Refresh</button></div>
      <div class="grid">
        <article class="card"><h3>Invite reviewer</h3><form id="reviewer-form"><input name="displayName" required maxlength="160" placeholder="Reviewer name"><select name="role"><option value="beta-reader">Beta Reader — comments</option><option value="editor">Editor — comments + tracked suggestions</option><option value="co-writer">Co-writer — comments + governed suggestions</option></select><button class="primary" type="submit">Create secure review link</button></form><div id="review-invite-result" class="list"></div><hr><h3>Reviewer access</h3><div id="reviewer-list" class="list"></div></article>
        <article class="card"><h3>Open comments</h3><div id="review-comment-list" class="list"></div></article>
      </div>
      <article class="card"><h3>Tracked human suggestions</h3><p class="muted">Accept/reject records the author decision. Apply is deliberately separate and fails if the underlying scene revision changed.</p><div id="review-suggestion-list" class="list"></div></article>`;
    if (footer) main.insertBefore(section, footer); else main?.appendChild(section);
    bind(); refresh();
  }

  function bind() {
    $("#reviewer-form")?.addEventListener("submit", inviteReviewer);
    $("#review-refresh")?.addEventListener("click", refresh);
    $("#review-room")?.addEventListener("click", async (event) => {
      const button = event.target instanceof Element ? event.target.closest("button[data-review-action]") : null;
      if (!button) return;
      const action = button.dataset.reviewAction, id = button.dataset.id;
      if (!id) return;
      button.disabled = true;
      try {
        if (action === "revoke") await api(`${root}/reviewers/${encodeURIComponent(id)}/revoke`, { method: "POST", body: "{}" });
        if (action === "resolve") await api(`${root}/comments/${encodeURIComponent(id)}/resolve`, { method: "POST", body: JSON.stringify({ note: "Resolved by author in Review Room." }) });
        if (action === "accept" || action === "reject") await api(`${root}/suggestions/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify({ decision: action === "accept" ? "accepted" : "rejected" }) });
        if (action === "apply") {
          if (!window.confirm("Apply this accepted human suggestion to the manuscript? Forge will refuse if the scene changed since the reviewer created it.")) return;
          await api(`${root}/suggestions/${encodeURIComponent(id)}/apply`, { method: "POST", body: "{}" });
          window.dispatchEvent(new CustomEvent("forge:human-review-applied", { detail: { suggestionId: id } }));
        }
        await refresh(); notify(`Review action completed: ${action}.`, true);
      } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
      finally { button.disabled = false; }
    });
    $("#review-invite-result")?.addEventListener("click", async (event) => {
      const button = event.target instanceof Element ? event.target.closest("button[data-copy-review-link]") : null;
      if (!button) return;
      const value = button.dataset.copyReviewLink;
      try { await navigator.clipboard.writeText(value); notify("Review link copied.", true); }
      catch { notify("Clipboard access is unavailable. Select and copy the review link manually."); }
    });
  }

  async function inviteReviewer(event) {
    event.preventDefault();
    const form = event.currentTarget, data = Object.fromEntries(new FormData(form).entries());
    try {
      const created = await api(`${root}/reviewers`, { method: "POST", body: JSON.stringify(data) });
      const absolute = new URL(created.reviewUrl, location.origin).href;
      $("#review-invite-result").innerHTML = `<article class="memory"><strong>${esc(created.reviewer.displayName)} — ${esc(created.reviewer.role)}</strong><p>This credential is shown once. Share it only with the intended reviewer.</p><input readonly value="${esc(absolute)}" aria-label="Secure review link"><div class="row"><button type="button" data-copy-review-link="${esc(absolute)}">Copy secure link</button><a class="forge-office-link" href="${esc(absolute)}" target="_blank" rel="noopener">Open reviewer portal</a></div></article>`;
      form.reset(); await refresh(); notify("Reviewer access created. The token will not be shown again after this page state is replaced.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function refresh() {
    try { state = await api(root); render(); }
    catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  function reviewerName(id) { return state.reviewers.find((reviewer) => reviewer.id === id)?.displayName || id; }
  function targetLabel(target) {
    const workspace = window.forgeWorkspaceState;
    const book = workspace?.books?.find((item) => item.id === target.bookId);
    const chapter = book?.chapters?.find((item) => item.id === target.chapterId);
    const scene = chapter?.scenes?.find((item) => item.id === target.sceneId);
    return [book?.title || target.bookId, chapter?.title || target.chapterId, scene?.title || target.sceneId].join(" › ");
  }

  function render() {
    const reviewers = $("#reviewer-list");
    if (reviewers) reviewers.innerHTML = state.reviewers.length ? state.reviewers.map((item) => `<article class="memory"><strong>${esc(item.displayName)}</strong><p>${esc(item.role)} • ${esc(item.status)}</p><small>Created ${esc(new Date(item.createdAt).toLocaleString())}</small>${item.status === "active" ? `<button type="button" data-review-action="revoke" data-id="${esc(item.id)}">Revoke access</button>` : ""}</article>`).join("") : '<p class="muted">No human reviewers invited yet.</p>';

    const comments = $("#review-comment-list");
    const open = state.comments.filter((item) => item.status === "open");
    if (comments) comments.innerHTML = open.length ? open.map((item) => `<article class="memory"><strong>${esc(reviewerName(item.reviewerId))}</strong><small>${esc(targetLabel(item.target))}</small>${item.selection ? `<blockquote>“${esc(item.selection.quote)}”</blockquote>` : ""}<p>${esc(item.body)}</p><button type="button" data-review-action="resolve" data-id="${esc(item.id)}">Resolve comment</button></article>`).join("") : '<p class="muted">No open reviewer comments.</p>';

    const suggestions = $("#review-suggestion-list");
    if (suggestions) suggestions.innerHTML = state.suggestions.length ? state.suggestions.slice().reverse().map((item) => `<article class="memory"><strong>${esc(reviewerName(item.reviewerId))} • ${esc(item.status)}</strong><small>${esc(targetLabel(item.target))}</small><p><b>Reason:</b> ${esc(item.rationale)}</p><details><summary>Review proposed replacement</summary><textarea class="editor candidate" readonly>${esc(item.replacementContent)}</textarea></details><div class="row">${item.status === "pending" ? `<button type="button" data-review-action="accept" data-id="${esc(item.id)}">Accept</button><button type="button" data-review-action="reject" data-id="${esc(item.id)}">Reject</button>` : ""}${item.status === "accepted" ? `<button class="primary" type="button" data-review-action="apply" data-id="${esc(item.id)}">Apply to manuscript</button>` : ""}</div></article>`).join("") : '<p class="muted">No tracked human suggestions.</p>';
  }

  window.addEventListener("forge:workspace-ready", () => { if ($("#review-room")) render(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureUi, { once: true }); else ensureUi();
})();
