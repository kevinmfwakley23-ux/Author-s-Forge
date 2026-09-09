(() => {
  "use strict";

  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  let installed = false;
  let plans = [];
  let assets = [];

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  };

  function install() {
    if (installed) return true;
    const cover = document.getElementById("cover");
    if (!cover) return false;
    installed = true;

    const binding = document.getElementById("cover-binding");
    if (binding && !binding.querySelector('option[value="ebook"]')) {
      const ebook = document.createElement("option");
      ebook.value = "ebook";
      ebook.textContent = "eBook";
      binding.prepend(ebook);
    }

    const host = document.createElement("article");
    host.id = "forge-cover-production";
    host.className = "card";
    host.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">FINAL COVER PRODUCTION</div><h3>Build a verified KDP cover file</h3><p class="muted">Choose a saved Cover Studio plan and an author-approved Image Lab asset whose purpose is Cover art. Forge renders real bytes, verifies them after persistence, and binds the file to the exact plan and source artwork.</p></div></div>
      <div class="grid">
        <div>
          <label>Cover plan<select id="forge-cover-plan"></select></label>
          <label>Approved cover artwork<select id="forge-cover-asset"></select></label>
          <div class="row"><button id="forge-cover-refresh" type="button">Refresh cover evidence</button><button id="forge-cover-open-art" type="button">Open Image Lab</button></div>
          <label class="muted"><input id="forge-cover-author-approval" type="checkbox"> I approve this Cover Studio plan and selected artwork as the source for the final cover file.</label>
          <button id="forge-cover-build" class="primary" type="button">Build & verify final cover</button>
        </div>
        <div>
          <div id="forge-cover-status" class="audit-status" role="status" aria-live="polite">Loading Cover Studio evidence…</div>
          <div id="forge-cover-artifacts" class="list"></div>
        </div>
      </div>`;
    cover.append(host);

    document.getElementById("forge-cover-refresh").addEventListener("click", refresh);
    document.getElementById("forge-cover-open-art").addEventListener("click", () => {
      const art = document.querySelector('[data-route="art"]');
      if (art instanceof HTMLElement) art.click();
      else location.hash = "#art";
      setTimeout(() => document.getElementById("forge-image-purpose")?.focus(), 50);
    });
    document.getElementById("forge-cover-build").addEventListener("click", build);
    document.getElementById("forge-cover-plan").addEventListener("change", renderArtifacts);
    document.getElementById("cover-run")?.addEventListener("click", () => {
      setTimeout(() => refresh().catch(() => {}), 750);
      setTimeout(() => refresh().catch(() => {}), 1800);
    });
    window.addEventListener("forge:workspace-ready", () => refresh().catch(() => {}));
    refresh();
    return true;
  }

  async function refresh() {
    const status = document.getElementById("forge-cover-status");
    try {
      const [project, imageResult, artifactResult] = await Promise.all([
        api(`/api/projects/${encodeURIComponent(projectId)}`),
        api(`/api/projects/${encodeURIComponent(projectId)}/ai/images`),
        api(`/api/projects/${encodeURIComponent(projectId)}/cover/artifacts`),
      ]);
      plans = Array.isArray(project.bookCoverPlans)
        ? project.bookCoverPlans.filter((plan) => ["ebook", "paperback", "hardcover"].includes(plan.format))
        : [];
      assets = Array.isArray(imageResult.assets)
        ? imageResult.assets.filter((asset) => asset.approvalStatus === "approved" && asset.generationSettings?.purpose === "cover-art")
        : [];
      const verifications = Array.isArray(artifactResult.artifacts) ? artifactResult.artifacts : [];
      renderSelections();
      renderArtifacts(verifications);
      const currentPlan = selectedPlan();
      const currentAssets = currentPlan ? assets.filter((asset) => asset.bookId === currentPlan.bookId) : [];
      if (!plans.length) status.textContent = "Create a Cover Studio plan first. eBook, paperback, and hardcover plans are supported.";
      else if (!currentAssets.length) status.textContent = "No approved Cover art asset exists for this book. Open Image Lab, choose Purpose: Cover art, generate real artwork, then approve the result.";
      else status.textContent = `${plans.length} cover plan${plans.length === 1 ? "" : "s"} • ${currentAssets.length} approved cover-art source${currentAssets.length === 1 ? "" : "s"} ready for final production.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  function renderSelections() {
    const planSelect = document.getElementById("forge-cover-plan");
    const assetSelect = document.getElementById("forge-cover-asset");
    if (!planSelect || !assetSelect) return;
    const previousPlan = planSelect.value;
    planSelect.innerHTML = plans.length
      ? plans.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.format)} • ${escapeHtml(plan.title)} • ${escapeHtml(plan.approvalStatus)}</option>`).join("")
      : '<option value="">Create a cover plan first</option>';
    if (previousPlan && plans.some((plan) => plan.id === previousPlan)) planSelect.value = previousPlan;
    const plan = selectedPlan();
    const matching = plan ? assets.filter((asset) => asset.bookId === plan.bookId) : [];
    assetSelect.innerHTML = matching.length
      ? matching.map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.prompt || asset.id)} • approved</option>`).join("")
      : '<option value="">Approve Cover art in Image Lab first</option>';
  }

  async function renderArtifacts(preloaded) {
    const host = document.getElementById("forge-cover-artifacts");
    if (!host) return;
    const plan = selectedPlan();
    if (!plan) {
      host.innerHTML = '<p class="muted">No final cover evidence yet.</p>';
      return;
    }
    try {
      const result = preloaded ?? (await api(`/api/projects/${encodeURIComponent(projectId)}/cover/artifacts?planId=${encodeURIComponent(plan.id)}`)).artifacts;
      const list = Array.isArray(result) ? result.filter((item) => item?.evidence?.planId === plan.id) : [];
      if (!list.length) {
        host.innerHTML = '<p class="muted">No final cover artifact has been built for this plan.</p>';
        return;
      }
      host.innerHTML = list.map((item) => {
        const evidence = item.evidence || {};
        const state = item.valid ? "VERIFIED" : "INVALID";
        const issues = Array.isArray(item.issues) && item.issues.length ? `<p>${item.issues.map(escapeHtml).join(" • ")}</p>` : "";
        const filePath = `/api/projects/${encodeURIComponent(projectId)}/cover/artifacts/${encodeURIComponent(evidence.artifactId || "")}/file`;
        return `<article class="memory"><strong>${state} • ${escapeHtml(evidence.fileName || "cover artifact")}</strong><p>${escapeHtml(evidence.fileFormat || "")} • ${Number(evidence.byteLength || 0).toLocaleString()} bytes • ${escapeHtml(evidence.dpi || "")} DPI</p><small>SHA-256 ${escapeHtml(evidence.sha256 || "")}</small>${issues}${item.valid ? `<p><a href="${filePath}" download>Download verified cover</a></p>` : ""}</article>`;
      }).join("");
    } catch (error) {
      host.innerHTML = `<p class="muted">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    }
  }

  async function build() {
    const plan = selectedPlan();
    const assetId = document.getElementById("forge-cover-asset")?.value || "";
    const approved = document.getElementById("forge-cover-author-approval")?.checked === true;
    const button = document.getElementById("forge-cover-build");
    const status = document.getElementById("forge-cover-status");
    if (!plan) return setStatus("Select or create a Cover Studio plan first.");
    if (!assetId) return setStatus("Select an approved Cover art asset from Image Lab first.");
    if (!approved) return setStatus("Explicit author approval is required before Forge can create the final cover file.");
    button.disabled = true;
    status.textContent = "Rendering and verifying the final cover file from durable project evidence…";
    try {
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/cover/artifacts`, {
        method: "POST",
        body: JSON.stringify({ bookId: plan.bookId, planId: plan.id, assetId, authorApproved: true }),
      });
      if (!result.evidence?.artifactId || !result.downloadPath) throw new Error("Forge did not return verified cover artifact evidence.");
      document.getElementById("forge-cover-author-approval").checked = false;
      status.textContent = `Verified ${result.evidence.fileName} • SHA-256 ${result.evidence.sha256}. Download starting…`;
      const link = document.createElement("a");
      link.href = result.downloadPath;
      link.download = result.evidence.fileName || "cover-artifact";
      document.body.append(link);
      link.click();
      link.remove();
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      button.disabled = false;
    }
  }

  function selectedPlan() {
    const id = document.getElementById("forge-cover-plan")?.value || "";
    return plans.find((plan) => plan.id === id) || plans[0];
  }
  function setStatus(message) {
    const status = document.getElementById("forge-cover-status");
    if (status) status.textContent = message;
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
  }

  window.addEventListener("load", install, { once: true });
  if (document.readyState !== "loading") install();
})();
