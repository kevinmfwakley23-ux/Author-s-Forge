/* Author's Forge KDP Production Preflight UI. Uses only the live durable Studio API. */
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

  function renderSurface() {
    const section = $("#publishing");
    if (!section || $("#kdp-preflight-form")) return;
    section.insertAdjacentHTML("beforeend", `
      <article class="card" id="kdp-preflight-card">
        <div class="section-title"><div><div class="eyebrow">KDP PREFLIGHT</div><h3>Production file readiness</h3><p>Validate the final interior and full-wrap cover against the book's production configuration. Every run is stored in durable project history.</p></div><button id="kdp-preflight-refresh" type="button">Refresh history</button></div>
        <form id="kdp-preflight-form">
          <div class="grid">
            <fieldset><legend>Publishing configuration</legend>
              <label>Binding<select id="kdp-binding"><option value="paperback">Paperback</option><option value="hardcover">Hardcover</option></select></label>
              <label>Interior<select id="kdp-interior-type"><option value="black-white">Black & white</option><option value="premium-color">Premium color</option><option value="standard-color">Standard color</option></select></label>
              <label>Paper<select id="kdp-paper-type"><option value="white">White</option><option value="cream">Cream</option></select></label>
              <div class="row"><label>Trim width (in)<input id="kdp-trim-width" type="number" min="1" step="0.001" value="6" required></label><label>Trim height (in)<input id="kdp-trim-height" type="number" min="1" step="0.001" value="9" required></label></div>
              <div class="row"><label>Pages<input id="kdp-pages" type="number" min="24" step="1" value="120" required></label><label>Bleed (in)<input id="kdp-bleed" type="number" min="0" step="0.001" value="0.125" required></label></div>
              <label><input id="kdp-interior-bleed" type="checkbox"> Interior uses bleed</label>
            </fieldset>
            <fieldset><legend>Interior PDF facts</legend>
              <label>Format<input id="kdp-interior-format" value="pdf" required></label>
              <label>File size (bytes)<input id="kdp-interior-bytes" type="number" min="0" step="1" value="1000000" required></label>
              <div class="row"><label>Page width (in)<input id="kdp-page-width" type="number" min="0.01" step="0.001" value="6" required></label><label>Page height (in)<input id="kdp-page-height" type="number" min="0.01" step="0.001" value="9" required></label></div>
              <div class="row"><label>Inside margin<input id="kdp-inside-margin" type="number" min="0" step="0.001" value="0.375" required></label><label>Outside margin<input id="kdp-outside-margin" type="number" min="0" step="0.001" value="0.25" required></label></div>
              <div class="row"><label>Top margin<input id="kdp-top-margin" type="number" min="0" step="0.001" value="0.25" required></label><label>Bottom margin<input id="kdp-bottom-margin" type="number" min="0" step="0.001" value="0.25" required></label></div>
              <label>Minimum image DPI<input id="kdp-interior-dpi" type="number" min="0" step="1" value="300"></label>
              <label><input id="kdp-interior-fonts" type="checkbox" checked> Fonts embedded</label><label><input id="kdp-interior-images" type="checkbox" checked> Images embedded</label><label><input id="kdp-interior-flattened" type="checkbox" checked> Transparency flattened</label>
              <label><input id="kdp-interior-encrypted" type="checkbox"> Encrypted</label><label><input id="kdp-interior-crop" type="checkbox"> Crop marks</label><label><input id="kdp-interior-trim" type="checkbox"> Trim marks</label><label><input id="kdp-interior-bookmarks" type="checkbox"> Bookmarks</label><label><input id="kdp-interior-comments" type="checkbox"> Comments</label><label><input id="kdp-interior-annotations" type="checkbox"> Annotations</label><label><input id="kdp-interior-placeholder" type="checkbox"> Placeholder text</label><label><input id="kdp-interior-watermark" type="checkbox"> PDF creation watermark</label>
            </fieldset>
          </div>
          <fieldset><legend>Full-wrap cover PDF facts</legend>
            <div class="grid">
              <div><label>Format<input id="kdp-cover-format" value="pdf" required></label><label>File size (bytes)<input id="kdp-cover-bytes" type="number" min="0" step="1" value="2000000" required></label><label>Minimum image DPI<input id="kdp-cover-dpi" type="number" min="0" step="1" value="300"></label></div>
              <div><div class="row"><label>Width (in)<input id="kdp-cover-width" type="number" min="0.01" step="0.001" required></label><label>Height (in)<input id="kdp-cover-height" type="number" min="0.01" step="0.001" required></label></div><label><input id="kdp-cover-fonts" type="checkbox" checked> Fonts embedded</label><label><input id="kdp-cover-flattened" type="checkbox" checked> Transparency flattened</label><label><input id="kdp-cover-title" type="checkbox" checked> Front title present</label><label><input id="kdp-cover-spine" type="checkbox" checked> Spine text present</label><label><input id="kdp-cover-encrypted" type="checkbox"> Encrypted</label><label><input id="kdp-cover-crop" type="checkbox"> Crop marks</label><label><input id="kdp-cover-trim" type="checkbox"> Trim marks</label><label><input id="kdp-cover-template" type="checkbox"> Template text present</label></div>
            </div>
          </fieldset>
          <div class="row"><button id="kdp-use-cover-plan" type="button">Use latest Cover Studio plan</button><button id="kdp-preflight-run" class="primary" type="submit">Run KDP preflight</button></div>
        </form>
        <div id="kdp-preflight-summary" class="audit-status">No KDP preflight has been run yet.</div>
        <div id="kdp-preflight-findings" class="list"></div>
        <h3>Preflight history</h3><div id="kdp-preflight-history" class="list"></div>
      </article>`);
  }

  async function useLatestCoverPlan() {
    try {
      const project = await api(`/api/projects/${encodeURIComponent(projectId)}`);
      const plans = project.bookCoverPlans || [];
      const plan = plans[plans.length - 1];
      if (!plan) throw new Error("Create a Cover Studio plan first.");
      const publishing = plan.publishing;
      $("#kdp-binding").value = publishing.binding;
      $("#kdp-interior-type").value = publishing.interiorType;
      if (["white", "cream"].includes(publishing.paperType)) $("#kdp-paper-type").value = publishing.paperType;
      $("#kdp-trim-width").value = publishing.trimWidthInches;
      $("#kdp-trim-height").value = publishing.trimHeightInches;
      $("#kdp-pages").value = publishing.pageCount;
      $("#kdp-bleed").value = publishing.bleedInches;
      $("#kdp-page-width").value = publishing.trimWidthInches;
      $("#kdp-page-height").value = publishing.trimHeightInches;
      $("#kdp-cover-width").value = plan.dimensions.widthInches;
      $("#kdp-cover-height").value = plan.dimensions.heightInches;
      notify("Latest Cover Studio production geometry loaded into KDP preflight.", true);
    } catch (error) { notify(error.message); }
  }

  function payload() {
    return {
      publishing: {
        platform: "kdp",
        binding: text("#kdp-binding"),
        interiorType: text("#kdp-interior-type"),
        paperType: text("#kdp-paper-type"),
        trimWidthInches: number($("#kdp-trim-width"), "Trim width", { positive: true }),
        trimHeightInches: number($("#kdp-trim-height"), "Trim height", { positive: true }),
        pageCount: number($("#kdp-pages"), "Page count", { min: 24, integer: true }),
        bleedInches: number($("#kdp-bleed"), "Bleed"),
        readingDirection: "ltr",
      },
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
    $("#kdp-preflight-findings").innerHTML = report.findings.length ? report.findings.map((finding) => `<article class="memory"><strong>${finding.severity === "error" ? "BLOCKING" : "WARNING"} — ${esc(finding.code)}</strong><p>${esc(finding.message)}</p><small>${esc(finding.area)} • Fix: ${esc(finding.remediation)}</small></article>`).join("") : '<article class="memory"><strong>Ready</strong><p>No blocking KDP preflight findings were detected from the supplied production-file facts.</p></article>';
  }

  function renderHistory(reports) {
    $("#kdp-preflight-history").innerHTML = reports.length ? reports.map((report) => `<button type="button" class="link-button" data-kdp-report="${esc(report.id)}"><strong>${esc(report.status.toUpperCase())}</strong> ${esc(new Date(report.createdAt).toLocaleString())} <small>${report.errorCount} errors • ${report.warningCount} warnings</small></button>`).join("") : '<p class="muted">No stored KDP preflight reports.</p>';
  }

  let history = [];
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
      notify(report.status === "ready" ? "KDP preflight passed and was stored." : `KDP preflight stored with ${report.errorCount} blocking issue${report.errorCount === 1 ? "" : "s"}.`, report.status === "ready");
    } catch (error) { notify(error.message); }
  }

  function bind() {
    renderSurface();
    $("#kdp-preflight-form")?.addEventListener("submit", runPreflight);
    $("#kdp-use-cover-plan")?.addEventListener("click", useLatestCoverPlan);
    $("#kdp-preflight-refresh")?.addEventListener("click", refreshHistory);
    $("#kdp-preflight-history")?.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-kdp-report]") : null;
      if (!button) return;
      renderReport(history.find((report) => report.id === button.dataset.kdpReport));
    });
    refreshHistory();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();
