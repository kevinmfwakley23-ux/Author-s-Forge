(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c]));
  const projectUrl = (suffix = "") => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const notify = (message, ok = false) => {
    const target = ok ? $("#success-banner") : $("#error-banner");
    const other = ok ? $("#error-banner") : $("#success-banner");
    if (other) other.hidden = true;
    if (target) { target.textContent = message; target.hidden = false; if (ok) setTimeout(() => { target.hidden = true; }, 4000); }
  };
  const apiJson = async (path, options = {}) => {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  };
  const referenceFile = () => $("#image-reference")?.files?.[0] || null;
  const renderPreview = (file) => {
    const target = $("#image-reference-preview");
    if (!target) return;
    if (!file) { target.innerHTML = '<p class="muted">No reference selected. You can generate from text alone.</p>'; return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { target.innerHTML = '<p class="muted">Unsupported reference type. Use PNG, JPEG, or WebP.</p>'; return; }
    if (file.size > 5 * 1024 * 1024) { target.innerHTML = '<p class="muted">Reference exceeds the 5 MiB limit.</p>'; return; }
    const url = URL.createObjectURL(file);
    target.innerHTML = `<img src="${url}" alt="Selected reference image"><p>${escapeHtml(file.name)} • ${(file.size / 1024 / 1024).toFixed(2)} MiB</p><small class="muted">This preview is local until you choose to generate.</small>`;
  };
  async function uploadReference(file) {
    if (!file) return null;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Reference image must be PNG, JPEG, or WebP.");
    if (file.size <= 0) throw new Error("Reference image is empty.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Reference image exceeds the 5 MiB limit.");
    return apiJson(`${projectUrl("/illustration/references")}?fileName=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "content-type": file.type }, body: file });
  }
  async function generate(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const file = referenceFile();
    const useReference = Boolean($("#use-reference")?.checked && file);
    const prompt = String(new FormData(form).get("prompt") || "").trim();
    if (!prompt) return notify("Image prompt is required.");
    if (button) { button.disabled = true; button.dataset.originalText = button.textContent || ""; button.textContent = "Generating…"; }
    try {
      let reference = null;
      if (useReference) { notify("Uploading reference…", true); reference = await uploadReference(file); }
      const values = new FormData(form);
      const payload = {
        prompt,
        size: String(values.get("size") || "1024x1024"),
        quality: String(values.get("quality") || "high"),
        bookId: window.forgeWorkspaceState?.activeBookId || undefined,
        referenceUri: reference?.assetUri || undefined,
        referenceId: reference?.id || undefined,
        referenceFileName: reference?.originalFileName || undefined,
        referenceKind: "source",
        referenceNotes: "Author-selected reference uploaded through Illustration Studio."
      };
      const result = await apiJson(projectUrl("/ai/image"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const target = $("#image-result");
      if (target) target.innerHTML = `<img src="${escapeHtml(result.url)}" alt="Generated illustration"><p><strong>${escapeHtml(result.mode === "reference-edit" ? "Reference-guided illustration" : "Generated illustration")}</strong> • ${escapeHtml(result.model || "image provider")}</p><a href="${escapeHtml(result.url)}" target="_blank" rel="noopener">Open full-size image</a>`;
      notify(result.mode === "reference-edit" ? "Reference-guided illustration generated and saved to the project asset library." : "Illustration generated and saved to the project asset library.", true);
      window.dispatchEvent(new CustomEvent("forge:illustration-created", { detail: result }));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Illustration generation failed.");
    } finally {
      if (button) { button.disabled = false; button.textContent = button.dataset.originalText || "Generate illustration"; }
    }
  }
  function initialize() {
    $("#image-reference")?.addEventListener("change", (event) => renderPreview(event.target.files?.[0] || null));
    document.addEventListener("submit", (event) => {
      const form = event.target instanceof Element ? event.target.closest("#image-form") : null;
      if (form) generate(event);
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true }); else initialize();
})();
