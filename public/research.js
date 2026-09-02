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
  let gapsSnapshot = [];

  function error(message = "") { $("#research-error").textContent = message; }
  function projectLinks() {
    $("#main-studio").href = `/?project=${encodeURIComponent(projectId)}#research`;
    $("#ai-control").href = `/author-craft.html?project=${encodeURIComponent(projectId)}`;
  }
  function renderStatus(status) {
    statusSnapshot = status;
    const node = $("#research-status");
    node.className = `research-status ${status.available ? "ready" : "blocked"}`;
    node.innerHTML = `<strong>${status.available ? "Live research ready" : "Live research blocked"}</strong><br>${esc(status.reason)}<div class="research-meta"><span class="research-badge">Spend: ${esc(status.spendPolicy)}</span><span class="research-badge">Authority: working</span><span class="research-badge">Canon: author promotion only</span><span class="research-badge">Source-backed web search</span>${status.pinnedProvider ? `<span class="research-badge">Pin: ${esc(status.pinnedProvider)}/${esc(status.pinnedModel)}</span>` : ""}</div>`;
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
  function gapCard(gap) {
    const scope = [gap.bookId && `book ${gap.bookId}`, gap.chapterId && `chapter ${gap.chapterId}`, gap.sceneId && `scene ${gap.sceneId}`].filter(Boolean).join(" · ");
    const provider = gap.provider && gap.model ? `${gap.provider}/${gap.model}` : gap.source;
    const researchReady = Boolean(statusSnapshot?.available);
    const actions = gap.status === "open"
      ? `<div class="gap-actions"><button type="button" data-gap-action="use" data-gap-id="${esc(gap.id)}">Use this question</button><button type="button" class="primary" data-gap-action="research" data-gap-id="${esc(gap.id)}" ${researchReady ? "" : "disabled"} title="${esc(researchReady ? "Verify this gap with source-backed web research" : statusSnapshot?.reason || "Live research is unavailable")}">Research now</button><button type="button" data-gap-action="dismiss" data-gap-id="${esc(gap.id)}">Dismiss</button></div>`
      : gap.status === "researched"
        ? `<p class="research-note"><strong>Evidence linked:</strong> ${gap.researchMemoryIds.length} working research memor${gap.researchMemoryIds.length === 1 ? "y" : "ies"}. The question itself never became canon.</p>`
        : `<p class="research-note"><strong>Dismissed:</strong> ${esc(gap.dismissedReason || "Dismissed by author.")}</p>`;
    return `<article class="gap-card" data-status="${esc(gap.status)}"><h3>${esc(gap.question)}</h3><div class="research-meta"><span class="research-badge">${esc(gap.status)}</span><span class="research-badge">priority ${esc(gap.priority)}</span><span class="research-badge">${esc(gap.domain)}</span><span class="research-badge">hypothesis only</span>${scope ? `<span class="research-badge">${esc(scope)}</span>` : ""}</div><p>${esc(gap.researchedBecause)}</p><p class="gap-basis"><strong>Why Radar flagged it:</strong> ${esc(gap.basis)}</p><p class="research-note">Detected by ${esc(provider)}. This is a question, not a fact or source.</p>${actions}</article>`;
  }
  function renderGaps(gaps) {
    gapsSnapshot = Array.isArray(gaps) ? gaps : [];
    $("#knowledge-gaps").innerHTML = gapsSnapshot.length ? gapsSnapshot.map(gapCard).join("") : '<p class="muted">No knowledge gaps have been surfaced yet. Scan when you want Forge to look for real-world details that may need verification.</p>';
    const open = gapsSnapshot.filter((gap) => gap.status === "open").length;
    const researched = gapsSnapshot.filter((gap) => gap.status === "researched").length;
    $("#radar-status").textContent = `${open} open research question${open === 1 ? "" : "s"}; ${researched} verified through Research. Radar hypotheses never enter Project Brain by themselves.`;
  }
  async function load() {
    error();
    projectLinks();
    const [status, project, gapData] = await Promise.all([
      api(projectUrl("/research/live/status")),
      api(projectUrl("")),
      api(projectUrl("/research/gaps")),
    ]);
    renderStatus(status);
    renderGaps(gapData.gaps || []);
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
  async function scanGaps(event) {
    event.preventDefault();
    error();
    const button = $("#scan-knowledge-gaps");
    button.disabled = true;
    button.textContent = "Scanning manuscript…";
    $("#radar-status").textContent = "Radar is reviewing manuscript cues and Project Brain context for researchable uncertainty…";
    try {
      const result = await api(projectUrl("/research/gaps/scan"), {
        method: "POST",
        body: JSON.stringify({
          focus: $("#gap-focus").value,
          maxGaps: Number($("#gap-max").value),
          bookId: $("#gap-book").value,
          chapterId: $("#gap-chapter").value,
          sceneId: $("#gap-scene").value,
        }),
      });
      await load();
      $("#radar-status").textContent = `Radar detected ${result.detectedCount} question${result.detectedCount === 1 ? "" : "s"}, saved ${result.persistedCount}, and suppressed ${result.duplicateCount} duplicate${result.duplicateCount === 1 ? "" : "s"}. Nothing was added to canon.`;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await load().catch(() => {});
      error(message);
    } finally {
      button.textContent = "Scan project for knowledge gaps";
      button.disabled = false;
    }
  }
  async function gapAction(event) {
    const button = event.target instanceof Element ? event.target.closest("[data-gap-action]") : null;
    if (!button) return;
    const id = button.dataset.gapId;
    const action = button.dataset.gapAction;
    const gap = gapsSnapshot.find((item) => item.id === id);
    if (!gap) return;
    error();
    if (action === "use") {
      $("#research-domain").value = gap.domain;
      $("#research-question").value = gap.question;
      $("#research-because").value = gap.researchedBecause;
      $("#research-book").value = gap.bookId || "";
      $("#research-chapter").value = gap.chapterId || "";
      $("#research-scene").value = gap.sceneId || "";
      $("#live-research-form").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    button.disabled = true;
    try {
      if (action === "dismiss") {
        await api(projectUrl(`/research/gaps/${encodeURIComponent(id)}/dismiss`), { method: "POST", body: JSON.stringify({ reason: "Dismissed by the author from the Research Office." }) });
        await load();
        return;
      }
      if (action === "research") {
        if (!statusSnapshot?.available) throw new Error(statusSnapshot?.reason || "Live source-backed research is unavailable.");
        button.textContent = "Researching…";
        const result = await api(projectUrl(`/research/gaps/${encodeURIComponent(id)}/research`), { method: "POST", body: "{}" });
        $("#research-results").innerHTML = result.research.record.claims.map(claimCard).join("");
        await load();
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await load().catch(() => {});
      error(message);
    }
  }

  $("#live-research-form")?.addEventListener("submit", run);
  $("#gap-scan-form")?.addEventListener("submit", scanGaps);
  $("#knowledge-gaps")?.addEventListener("click", gapAction);
  $("#refresh")?.addEventListener("click", () => load().catch((cause) => error(cause.message)));
  load().catch((cause) => error(cause instanceof Error ? cause.message : String(cause)));
})();
