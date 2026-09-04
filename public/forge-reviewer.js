/* Author's Forge reviewer portal. Review tokens live in the URL fragment only long enough to enter sessionStorage; reviewer actions are role checked again by the server. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || "";
  const tokenKey = `forge-review-token:${projectId}`;
  let token = sessionStorage.getItem(tokenKey) || "";
  let context = null;
  let comments = [];
  let suggestions = [];
  let selected = { bookId: "", chapterId: "", sceneId: "" };
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function captureFragmentToken() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const fragmentToken = params.get("token");
    if (fragmentToken) {
      token = fragmentToken;
      sessionStorage.setItem(tokenKey, token);
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", "x-forge-review-token": token, ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Review request failed (${response.status}).`);
    return payload;
  }

  function notify(message, ok = false) {
    const target = ok ? $("#review-success") : $("#review-error");
    const other = ok ? $("#review-error") : $("#review-success");
    if (other) other.hidden = true;
    if (target) { target.textContent = message; target.hidden = false; }
  }

  const root = () => `/api/projects/${encodeURIComponent(projectId)}/human-review`;
  const books = () => context?.workspace?.books || [];
  const currentBook = () => books().find((item) => item.id === selected.bookId) || books()[0];
  const currentChapter = () => currentBook()?.chapters?.find((item) => item.id === selected.chapterId) || currentBook()?.chapters?.[0];
  const currentScene = () => currentChapter()?.scenes?.find((item) => item.id === selected.sceneId) || currentChapter()?.scenes?.[0];

  async function load() {
    if (!projectId) return notify("This review link is missing a project id.");
    if (!token) return notify("This review link is missing its secure review token. Ask the author for a new link.");
    try {
      const [nextContext, commentState, suggestionState] = await Promise.all([
        api(`${root()}/context`), api(`${root()}/comments`), api(`${root()}/suggestions`),
      ]);
      context = nextContext; comments = commentState.comments || []; suggestions = suggestionState.suggestions || [];
      $("#reviewer-meta").textContent = `${context.reviewer.displayName} • ${context.reviewer.role} • ${context.permissions.description}`;
      $("#review-suggestion-card").hidden = !context.permissions.suggest;
      preserveOrSelectFirst(); renderSelectors(); renderScene(); renderFeedback();
      notify("Review access verified. Manuscript loaded.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  function preserveOrSelectFirst() {
    const book = currentBook(); selected.bookId = book?.id || "";
    const chapter = currentChapter(); selected.chapterId = chapter?.id || "";
    const scene = currentScene(); selected.sceneId = scene?.id || "";
  }

  function renderSelectors() {
    const bookSelect = $("#review-book"), chapterSelect = $("#review-chapter"), sceneSelect = $("#review-scene");
    if (!bookSelect || !chapterSelect || !sceneSelect) return;
    bookSelect.innerHTML = books().map((item) => `<option value="${esc(item.id)}">${esc(item.title)}</option>`).join("") || '<option value="">No books shared</option>';
    bookSelect.value = selected.bookId;
    const chapters = currentBook()?.chapters || [];
    chapterSelect.innerHTML = chapters.map((item) => `<option value="${esc(item.id)}">${item.number}. ${esc(item.title)}</option>`).join("") || '<option value="">No chapters</option>';
    if (!chapters.some((item) => item.id === selected.chapterId)) selected.chapterId = chapters[0]?.id || "";
    chapterSelect.value = selected.chapterId;
    const scenes = currentChapter()?.scenes || [];
    sceneSelect.innerHTML = scenes.map((item) => `<option value="${esc(item.id)}">${item.number}. ${esc(item.title)}</option>`).join("") || '<option value="">No scenes</option>';
    if (!scenes.some((item) => item.id === selected.sceneId)) selected.sceneId = scenes[0]?.id || "";
    sceneSelect.value = selected.sceneId;
  }

  function renderScene() {
    const scene = currentScene(), content = $("#review-scene-content"), replacement = $("#review-replacement"), meta = $("#review-scene-meta");
    if (!scene) {
      if (content) content.value = ""; if (replacement) replacement.value = ""; if (meta) meta.textContent = "No scene selected."; return;
    }
    if (content) content.value = scene.content || "";
    if (replacement) replacement.value = scene.content || "";
    if (meta) meta.textContent = `${scene.wordCount || 0} words • source revision ${new Date(scene.updatedAt).toLocaleString()}`;
  }

  function renderFeedback() {
    const commentHost = $("#review-comments"), suggestionHost = $("#review-suggestions");
    const sceneComments = comments.filter((item) => item.target.sceneId === selected.sceneId);
    if (commentHost) commentHost.innerHTML = sceneComments.length ? sceneComments.slice().reverse().map((item) => `<article class="memory"><strong>${esc(item.status)}</strong>${item.selection ? `<blockquote>“${esc(item.selection.quote)}”</blockquote>` : ""}<p>${esc(item.body)}</p><small>${esc(new Date(item.createdAt).toLocaleString())}</small></article>`).join("") : '<p class="muted">No comments on this scene yet.</p>';
    const sceneSuggestions = suggestions.filter((item) => item.target.sceneId === selected.sceneId);
    if (suggestionHost) suggestionHost.innerHTML = sceneSuggestions.length ? sceneSuggestions.slice().reverse().map((item) => `<article class="memory"><strong>${esc(item.status)}</strong><p>${esc(item.rationale)}</p><small>${esc(new Date(item.createdAt).toLocaleString())}</small></article>`).join("") : '<p class="muted">No tracked suggestions on this scene yet.</p>';
  }

  function target() { return { bookId: selected.bookId, chapterId: selected.chapterId, sceneId: selected.sceneId }; }
  async function sha256(text) {
    if (!globalThis.crypto?.subtle) throw new Error("This browser cannot create secure revision hashes. Open the review link in a current HTTPS browser.");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function submitComment() {
    const scene = currentScene(), body = $("#review-comment")?.value?.trim(), content = $("#review-scene-content");
    if (!scene || !body || !content) return notify("Select a scene and write a comment first.");
    try {
      const start = content.selectionStart, end = content.selectionEnd;
      let selection;
      if (Number.isInteger(start) && Number.isInteger(end) && end > start) {
        selection = { start, end, quote: content.value.slice(start, end), baseContentSha256: await sha256(content.value) };
      }
      await api(`${root()}/comments`, { method: "POST", body: JSON.stringify({ target: target(), body, ...(selection ? { selection } : {}) }) });
      $("#review-comment").value = ""; await load(); notify("Comment submitted. The author can resolve it without altering your original review record.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function submitSuggestion() {
    if (!context?.permissions?.suggest) return notify("Your review role cannot submit manuscript replacement suggestions.");
    const scene = currentScene(), replacementContent = $("#review-replacement")?.value ?? "", rationale = $("#review-rationale")?.value?.trim();
    if (!scene || !rationale || !replacementContent.trim()) return notify("Select a scene, provide the replacement, and explain the change.");
    try {
      const baseContentSha256 = await sha256(scene.content || "");
      await api(`${root()}/suggestions`, { method: "POST", body: JSON.stringify({ target: target(), baseContentSha256, replacementContent, rationale }) });
      $("#review-rationale").value = ""; await load(); notify("Tracked suggestion submitted. Nothing was changed in the manuscript; the author must accept and apply it separately.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  function bind() {
    $("#review-refresh")?.addEventListener("click", load);
    $("#review-book")?.addEventListener("change", (event) => { selected.bookId = event.currentTarget.value; selected.chapterId = ""; selected.sceneId = ""; preserveOrSelectFirst(); renderSelectors(); renderScene(); renderFeedback(); });
    $("#review-chapter")?.addEventListener("change", (event) => { selected.chapterId = event.currentTarget.value; selected.sceneId = ""; preserveOrSelectFirst(); renderSelectors(); renderScene(); renderFeedback(); });
    $("#review-scene")?.addEventListener("change", (event) => { selected.sceneId = event.currentTarget.value; renderScene(); renderFeedback(); });
    $("#submit-review-comment")?.addEventListener("click", submitComment);
    $("#submit-review-suggestion")?.addEventListener("click", submitSuggestion);
  }

  captureFragmentToken(); bind(); load();
})();
