/* Exact-version Chapter Card approval controls for manual edits and re-approval. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const projectUrl = (suffix = "") => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  let selected = null;

  async function api(path, init = {}) {
    const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Chapter Card approval request failed (${response.status}).`);
    return payload;
  }

  function ensureControl() {
    const actions = document.querySelector("#story-map-chapter-editor .chapter-card-actions");
    if (!actions || document.getElementById("chapter-card-approve-current")) return;
    const button = document.createElement("button");
    button.id = "chapter-card-approve-current";
    button.type = "button";
    button.textContent = "Approve Current Card";
    button.title = "Approve the exact current Chapter Card so it may govern author-requested AI drafting.";
    button.addEventListener("click", () => void approveCurrent());
    const status = document.createElement("span");
    status.id = "chapter-card-approval-status";
    status.className = "muted";
    status.setAttribute("role", "status");
    actions.append(button, status);
  }

  async function refreshStatus() {
    ensureControl();
    const button = document.getElementById("chapter-card-approve-current");
    const status = document.getElementById("chapter-card-approval-status");
    if (!button || !status) return;
    if (!selected) {
      button.disabled = true;
      status.textContent = "Open a Chapter Card to approve it.";
      return;
    }
    button.disabled = false;
    try {
      const workflow = await api(projectUrl("/story-map/chapter-card-workflow"));
      const valid = (workflow.validApprovals || []).some((approval) => approval.chapterId === selected.chapterId);
      button.textContent = valid ? "Re-approve Current Card" : "Approve Current Card";
      status.textContent = valid
        ? "Current exact card version is author-approved for AI drafting. Editing it will make this approval stale."
        : "Current card is not approved, or it changed after its last approval.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  async function approveCurrent() {
    if (!selected) return;
    if (!window.confirm("Approve this exact Chapter Card version for AI drafting? If you edit the card later, Forge will require approval again before using it as a drafting constraint.")) return;
    const button = document.getElementById("chapter-card-approve-current");
    if (button) button.disabled = true;
    try {
      await api(projectUrl(`/story-map/chapter-card-workflow/chapters/${encodeURIComponent(selected.bookId)}/${encodeURIComponent(selected.chapterId)}/approve`), {
        method: "POST",
        body: JSON.stringify({ authorApproved: true }),
      });
      await refreshStatus();
      window.dispatchEvent(new CustomEvent("forge:chapter-card-approval-changed", { detail: selected }));
    } catch (error) {
      const status = document.getElementById("chapter-card-approval-status");
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      if (button) button.disabled = false;
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-plan-chapter]") : null;
    if (!target) return;
    const [bookId, chapterId] = String(target.getAttribute("data-plan-chapter") || "").split("|");
    if (!bookId || !chapterId) return;
    selected = { bookId, chapterId };
    setTimeout(() => void refreshStatus(), 0);
  });

  document.addEventListener("submit", (event) => {
    if (!(event.target instanceof HTMLFormElement) || event.target.id !== "chapter-card-form") return;
    setTimeout(() => void refreshStatus(), 350);
  });

  const observer = new MutationObserver(() => ensureControl());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("forge:chapter-card-approval-changed", () => void refreshStatus());
  window.addEventListener("load", () => ensureControl());
  if (document.readyState !== "loading") ensureControl();
})();
