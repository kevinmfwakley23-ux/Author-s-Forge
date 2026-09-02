/* Author's Forge KDP Production Preflight UI. Production geometry is server-authoritative. */
(() => {
  "use strict";

  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  };

  let history = [];
  let selectedCoverPlanId = "";

  function notify(message, ok = false) {
    const error = $("#error-banner");
    const success = $("#success-banner");
    if (error) error.hidden = ok;
    if (success) success.hidden = !ok;
    const target = ok ? success : error;
    if (target) {
      target.textContent = message;
      target.hidden = false;
    }
  }

  function number(input, label, { min = 0, positive = false, integer = false } = {}) {
    const value = Number(input?.value);
    if (!Number.isFinite(value)) throw new Error(`${label} must be a number.`);
    if (positive && value <= 0) throw new Error(`${label} must be greater than zero.`);
    if (!positive && value < min) throw new Error(`${label} cannot be below ${min}.`);
    if (integer && !Number.isInteger(value)) throw new Error(`${label} must be a whole number.`);
    return value;
  }

  function checked(id) { return Boolean($(id)?.checked); }
  function text(id) { return String($(id)?.value || "").trim(); }
  function setValue(id, value) { const field = $(id); if (field) field.value = String(value ?? ""); }

  function renderSurface() {
    const section = $("#publishing");
    if (!section || $("#kdp-preflight-form")) return;
    section.insertAdjacentHTML("beforeend", `
      <article class="card" id="kdp-preflight-card">
        <div class="section-title"><div><div class="eyebrow">KDP PREFLIGHT</div><h3>Production file readiness</h3><p>Forge audits measured interior and cover facts against the durable Cover Studio plan. Trim, binding, page count, bleed, paper, and calculated cover dimensions cannot be overridden by this form.</p></div><button id="kdp-preflight-refresh" type="button">Refresh history</button></div>
        <form id="kdp-preflight-form">
          <div class="grid">
            <fieldset><legend>Authoritative Cover Studio plan</legend>
              <div id="kdp-plan-status" class="audit-status">Loading the latest KDP cover plan…</div>
              <label>Binding<input id="kdp-binding" readonly></label>
              <label>Interior<input id="kdp-interior-type" readonly></label>
              <label>Paper<input id="kdp-paper-type" readonly></label>
              <div class="row"><label>Trim width (in)<input id="kdp-trim-width" readonly></label><label>Trim height (in)<input id="kdp-trim-height" readonly></label></div>
              <div class="row"><label>Pages<input id="kdp-pages" readonly></label><label>Bleed (in)<input id="kdp-bleed" readonly></label></div>
              <label><input id="kdp-interior-bleed" type="checkbox"> Interior file uses bleed</label>
              <button id="kdp-use-cover-plan" type="button">Reload latest Cover Studio plan</button>
            </fieldset>
            <fieldset><legend>Measured interior PDF facts</legend>
              <label>Format<input id="kdp-interior-format" value="pdf" required></label>
              <label>File size (bytes)<input id="kdp-interior-bytes" type="number" min="0" step="1" value="1000000" required></label>
              <div class="row"><label>Page width (in)<input id="kdp-page-width" type="number" min="0.01" step="0.001" required></label><label>Page height (in)<input id="kdp-page-height" type="number" min="0.01" step="0.001" required></label></div>
              <div class="row"><label>Inside margin<input id="kdp-inside-margin" type="number" min="0" step="0.001" required></label><label>Outside margin<input id="kdp-outside-margin" type="number" min="0" step="0.001" required></label></div>
              <div class="row"><label>Top margin<input id="kdp-top-margin" type="number" min="0" step="0.001" required></label><label>Bottom margin<input id="kdp-bottom-margin" type="number" min="0" step="0.001" required></label></div>
              <label>Minimum image DPI<input id="kdp-interior-dpi" type="number" min="0" step="1" value="300"></label>
              <label><input id="kdp-interior-fonts" type="checkbox" checked> Fonts embedded</label><label><input id="kdp-interior-images" type="checkbox" checked> Images embedded</label><label><input id="kdp-interior-flattened" type="checkbox" checked> Transparency flattened</label>
              <label><input id="kdp-interior-encrypted" type="checkbox"> Encrypted</label><label><input id="kdp-interior-crop" type="checkbox"> Crop marks</label><label><input id="kdp-interior-trim" type="checkbox"> Trim marks</label><label><input id="kdp-interior-bookmarks" type="checkbox"> Bookmarks</label><label><input id="kdp-interior-comments" type="checkbox"> Comments</label><label><input id="kdp-interior-annotations" type="checkbox"> Annotations</label><label><input id="kdp-interior-placeholder" type="checkbox"> Placeholder text</label><label><input id="kdp-interior-watermark" type="checkbox"> PDF creation watermark</label>
            </fieldset>
          </div>
          <fieldset><legend>Measured full-wrap cover PDF facts</legend>
            <div class="grid">
              <div><label>Format<input id="kdp-cover-format" value="pdf" required></label><label>File size (bytes)<input id="kdp-cover-bytes" type="number" min="0" step="1" value="2000000" required></label><label>Minimum image DPI<input id="kdp-cover-dpi" type="number" min="0" step="1" value="300"></label></div>
              <div><div class="row"><label>Width (in)<input id="kdp-cover-width" type="number" min="0.01" step="0.000001" required></label><label>Height (in)<input id="kdp-cover-height" type="number" min="0.01" step="0.000001" required></label></div><label><input id="kdp-cover-fonts" type="checkbox" checked> Fonts embedded</label><label><input id="kdp-cover-flattened" type="checkbox" checked> Transparency flattened</label><label><input id="kdp-cover-title" type="checkbox" checked> Front title present</label><label><input id="kdp-cover-spine" type="checkbox" checked> Spine text present</label><label><input id="kdp-cover-encrypted" type="checkbox"> Encrypted</label><label><input id="kdp-cover-crop" type="checkbox"> Crop marks</label><label><input id="kdp-cover-trim" type="checkbox"> Trim marks</label><label><input id="kdp-cover-template" type="checkbox"> Template text present</label></div>
            </div>
          </fieldset>
          <div class="row"><button id="kdp-preflight-run" class="primary" type="submit" disabled>Run KDP preflight</button></div>
        </form>
        <div id="kdp-preflight-summary" class="audit-status">No KDP preflight has been run yet.</div>
        <div id="kdp-preflight-findings" class="list"></div>
        <h3>Preflight history</h3><div id="kdp-preflight-history" class="list"></div>
      </article>`);
  }

  function minimumInsideMargin(pageCount) {
    if (pageCount <= 150) return 0.375;
    if (pageCount <= 300) return 0.5;
    if (pageCount <= 500) return 0.625;
    if (pageCount <= 700) return 0.75;
    return 0.875;
  }

  function applyMeasuredDefaults(plan) {
    const publishing = plan.publishing;
    const usesBleed = checked("#kdp-interior-bleed");
    const bleed = Number(publishing.bleedInches || 0);
    setValue("#kdp-page-width", Number(publishing.trimWidthInches) + (usesBleed ? bleed : 0));
    setValue("#kdp-page-height", Number(publishing.trimHeightInches) + (usesBleed ? bleed * 2 : 0));
    setValue("#kdp-inside-margin", minimumInsideMargin(Number(publishing.pageCount)));
    const outer = usesBleed ? 0.375 : 0.25;
    setValue("#kdp-outside-margin", outer);
    setValue("#kdp-top-margin", outer);
    setValue("#kdp-bottom-margin", outer);
  }

  async function useLatestCoverPlan({ announce = true } = {}) {
    const run = $("#kdp-preflight-run");
    try {
      const project = await api(`/api/projects/${encodeURIComponent(projectId)}`);
      const plans = (project.bookCoverPlans || []).filter((plan) => plan?.publishing?.platform === "kdp");
      plans.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")) || Number(b.version || 0) - Number(a.version || 0) || String(b.id).localeCompare(String(a.id)));
      const plan = plans[0];
      if (!plan) throw new Error("Create a KDP Cover Studio plan before running production preflight.");

      selectedCoverPlanId = String(plan.id);
      const publishing = plan.publishing;
      setValue("#kdp-binding", publishing.binding);
      setValue("#kdp-interior-type", publishing.interiorType);
      setValue("#kdp-paper-type", publishing.paperType);
      setValue("#kdp-trim-width", publishing.trimWidthInches);
      setValue("#kdp-trim-height", publishing.trimHeightInches);
      setValue("#kdp-pages", publishing.pageCount);
      setValue("#kdp-bleed", publishing.bleedInches);
      setValue("#kdp-cover-width", plan.dimensions.widthInches);
      setValue("#kdp-cover-height", plan.dimensions.heightInches);
      applyMeasuredDefaults(plan);
      $("#kdp-plan-status").textContent = `Plan ${plan.id} • version ${plan.version} • ${String(plan.approvalStatus || "draft")} • server-authoritative geometry`;
      if (run) run.disabled = false;
      if (announce) notify("Latest durable Cover Studio plan loaded. Publishing geometry is locked to server truth.", true);
      return plan;
    } catch (error) {
      selectedCoverPlanId = "";
      if (run) run.disabled = true;
      if ($("#kdp-plan-status")) $("#kdp-plan-status").textContent = error.message;
      if (announce) notify(error.message);
      return undefined;
    }
  }

  function payload() {
    if (!selectedCoverPlanId) throw new Error("Create or reload a durable KDP Cover Studio plan first.");
    return {
      coverPlanId: selectedCoverPlanId,
      interiorHasBleed: checked("#kdp-interior-bleed"),
      interior: {
        format: text("#kdp-interior-format"), sizeBytes: number($("#kdp-interior-bytes"), "Interior file size"), encrypted: checked("#kdp-interior-encrypted"), fontsEmbedded: checked("#kdp-interior-fonts"), imagesEmbedded: checked("#kdp-interior-images"), minimumImageDpi: number($("#kdp-interior-dpi"), "Interior DPI"), transparentObjectsFlattened: checked("#kdp-interior-flattened"), hasCropMarks: checked("#kdp-interior-crop"), hasTrimMarks: checked("#kdp-interior-trim"), hasBookmarks: checked("#kdp-interior-bookmarks"), hasComments: checked("#kdp-interior-comments"), hasAnnotations: checked("#kdp-interior-annotations"), hasPlaceholderText: checked("#kdp-interior-placeholder"), hasPdfCreationWatermark: checked("#kdp-interior-watermark"), pageWidthInches: number($("#kdp-page-width"), "Interior page width", { positive: true }), pageHeightInches: number($("#kdp-page-height"), "Interior page height", { positive: true }), insideMarginInches: number($("#kdp-inside-margin"), "Inside margin"), outsideMarginInches: number($("#kdp-outside-margin"), "Outside margin"), topMarginInches: number($("#kdp-top-margin"), "Top margin"), bottomMarginInches: number($("#kdp-bottom-margin"), "Bottom margin"),
      },
      cover: {
        format: text("#kdp-cover-format"), sizeBytes: number($("#kdp-cover-bytes"), "Cover file size"), encrypted: checked("#kdp-cover-encrypted"), fontsEmbedded: checked("#kdp-cover-fonts"), minimumImageDpi: number($("#kdp-cover-dpi"), "Cover DPI"), transparentObjectsFlattened: checked("#kdp-cover-flattened"), hasCropMarks: checked("#kdp-cover-crop"), hasTrimMarks: checked("#kdp-cover-trim"), hasTemplateText: checked("#kdp-cover-template"), titleOnFront: checked("#kdp-cover-title"), widthInches: number($("#kdp-cover-width"), "Cover width", { positive: true }), heightInches: number($("#kdp-cover-height"), "Cover height", { positive: true }), spineTextPresent: checked("#kdp-cover-spine"),
      },
    };
  }

  function renderReport(report) {
    if (!report) {
      $("#kdp-preflight-summary").textContent = "No KDP preflight has been run yet.";
      $("#kdp-preflight-findings").innerHTML = "";
      return;
    }
    $("#kdp-preflight-summary").textContent = `${report.status.toUpperCase()} • ${report.errorCount} errors • ${report.warningCount} warnings • expected interior ${report.expectedInteriorPageWidthInches} × ${report.expectedInteriorPageHeightInches} in`;
    $("#kdp-preflight-findings").innerHTML = report.findings.length ? report.findings.map((finding) => `<article class="memory"><strong>${finding.severity === "error" ? "BLOCKING" : "WARNING"} — ${esc(finding.code)}</strong><p>${esc(finding.message)}</p><small>${esc(finding.area)} • Fix: ${esc(finding.remediation)}</small></article>`).join("") : '<article class="memory"><strong>Ready</strong><p>No blocking KDP preflight findings were detected from the measured production-file facts.</p></article>';
  }

  function renderHistory(reports) {
    $("#kdp-preflight-history").innerHTML = reports.length ? reports.map((report) => `<button type="button" class="link-button" data-kdp-report="${esc(report.id)}"><strong>${esc(report.status.toUpperCase())}</strong> ${esc(new Date(report.createdAt).toLocaleString())} <small>${report.errorCount} errors • ${report.warningCount} warnings</small></button>`).join("") : '<p class="muted">No stored KDP preflight reports.</p>';
  }

  async function refreshHistory() {
    try {
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/production/kdp-preflight`);
      history = result.reports || [];
      renderHistory(history);
      renderReport(result.latest);
    } catch (error) { notify(error.message); }
  }

  async function runPreflight(event) {
    event.preventDefault();
    try {
      const report = await api(`/api/projects/${encodeURIComponent(projectId)}/production/kdp-preflight`, { method: "POST", body: JSON.stringify(payload()) });
      renderReport(report);
      await refreshHistory();
      notify(report.status === "ready" ? "KDP preflight passed against the durable Cover Studio plan and was stored." : `KDP preflight stored with ${report.errorCount} blocking issue${report.errorCount === 1 ? "" : "s"}.`, report.status === "ready");
    } catch (error) { notify(error.message); }
  }

  function bind() {
    renderSurface();
    $("#kdp-preflight-form")?.addEventListener("submit", runPreflight);
    $("#kdp-use-cover-plan")?.addEventListener("click", () => useLatestCoverPlan({ announce: true }));
    $("#kdp-interior-bleed")?.addEventListener("change", async () => {
      if (selectedCoverPlanId) await useLatestCoverPlan({ announce: false });
    });
    $("#kdp-preflight-refresh")?.addEventListener("click", refreshHistory);
    $("#kdp-preflight-history")?.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-kdp-report]") : null;
      if (!button) return;
      renderReport(history.find((report) => report.id === button.dataset.kdpReport));
    });
    Promise.all([refreshHistory(), useLatestCoverPlan({ announce: false })]).catch((error) => notify(error.message));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();
