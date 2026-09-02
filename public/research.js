(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const projectId = params.get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  };
  const projectUrl = (suffix) => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  let statusSnapshot = null;

  function error(message = "") { $("#research-error").textContent = message; }
  function projectLinks() {
    $("#main-studio").href = `/?project=${encodeURIComponent(projectId)}#research`;
    $("#ai-control").href = `/author-craft.html?project=${encodeURIComponent(projectId)}`;
  }
  function renderStatus(status) {
    statusSnapshot = status;
    const node = $("#research-status");
    node.className = `research-status ${status.available ? "ready" : "blocked"}`;
    node.innerHTML = `<strong>${status.available ? "Live research ready" : "Live research blocked"}</strong><br>${esc(status.reason)}<div class="research-meta"><span class="research-badge">Spend: ${esc(status.spendPolicy)}</span><span class="research-badge">Authority: working</span><span class="research-badge">Canon: author promotion only</span>${status.pinnedProvider ? `<span class="research-badge">Pin: ${esc(status.pinnedProvider)}/${esc(status.pinnedModel)}</span>` : ""}</div>`;
    const button = $("#run-live-research");
    button.disabled = !status.available;
    button.title = status.available ? "Run hosted source-backed web research" : status.reason;
    const domain = $("#research-domain");
    const current = domain.value;
    domain.innerHTML = (status.domains || []).map((value) => `<option value="${esc(value)}">${esc(value.replaceAll("-", " "))}</option>`).join("");
    if ([...domain.options].some((option) => option.value === current)) domain.value = current;
  }
  function claimCard(claim) {
    return `<article class="research-result"><h3>${esc(claim.claim)}</h3><div class="research-meta"><span class="research-badge">${esc(claim.domain || "research")}</span><span class="research-badge">confidence ${esc(claim.confidence)}</span><span class="research-badge">relevance ${esc(claim.relevance)}</span><span class="research-badge">${esc(claim.date)}</span></div><p><strong>${esc(claim.source)}</strong></p><p><a href="${esc(claim.url)}" target="_blank" rel="noopener noreferrer">Open consulted source</a></p>${claim.researchQuestion ? `<p class="research-note">Question: ${esc(claim.researchQuestion)}</p>` : ""}${claim.researchedBecause ? `<p class="research-note">Why stored: ${esc(claim.researchedBecause)}</p>` : ""}</article>`;
  }
  function parseResearchMemories(project) {
    const claims = [];
    for (const memory of project.memories || []) {
      if (memory.class !== "research-memory" || memory.authority === "archived" || memory.authority === "superseded") continue;
      try {
        const claim = JSON.parse(memory.content);
        if (claim && typeof claim === "object" && claim.url && claim.claim) claims.push(claim);
      } catch {}
    }
    return claims.sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
  }
  async function load() {
    error();
    projectLinks();
    const [status, project] = await Promise.all([api(projectUrl("/research/live/status")), api(projectUrl(""))]);
    renderStatus(status);
    localStorage.setItem("forge-project", projectId);
    const claims = parseResearchMemories(project);
    $("#saved-research").innerHTML = claims.length ? claims.map(claimCard).join("") : '<p class="muted">No source-backed research has been saved for this project yet.</p>';
  }
  async function run(event) {
    event.preventDefault();
    error();
    if (!statusSnapshot?.available) { error(statusSnapshot?.reason || "Live research is not available under the current owner AI control."); return; }
    const button = $("#run-live-research");
    button.disabled = true;
    button.textContent = "Researching sources…";
    try {
      const payload = {
        domain: $("#research-domain").value,
        question: $("#research-question").value,
        researchedBecause: $("#research-because").value,
        bookId: $("#research-book").value,
        chapterId: $("#research-chapter").value,
        sceneId: $("#research-scene").value,
      };
      const result = await api(projectUrl("/research/live"), { method: "POST", body: JSON.stringify(payload) });
      $("#research-results").innerHTML = result.record.claims.map(claimCard).join("");
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await load().catch(() => {});
      error(message);
    } finally {
      button.textContent = "Run source-backed web research";
      button.disabled = !statusSnapshot?.available;
    }
  }

  $("#live-research-form")?.addEventListener("submit", run);
  $("#refresh")?.addEventListener("click", () => load().catch((cause) => error(cause.message)));
  load().catch((cause) => error(cause instanceof Error ? cause.message : String(cause)));
})();
