/* Author's Forge reference-image workflow.
 * The selected reference is uploaded through the real binary server boundary,
 * then the returned durable asset URI is supplied to the image provider edit.
 */
(() => {
  "use strict";

  const form = () => document.querySelector("#image-form");
  const input = () => document.querySelector("#image-reference");
  const preview = () => document.querySelector("#image-reference-preview");
  const result = () => document.querySelector("#image-result");
  const projectId = () => new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function notify(text, ok = false) {
    const error = document.querySelector("#error-banner");
    const success = document.querySelector("#success-banner");
    const target = ok ? success : error;
    if (error) error.hidden = ok;
    if (success) success.hidden = !ok;
    if (target) { target.textContent = text; target.hidden = false; }
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("The reference image could not be read."));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
  }

  function showPreview(file, dataUrl) {
    const target = preview();
    if (!target) return;
    target.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="Reference image preview"><p><strong>${escapeHtml(file.name)}</strong> • ${escapeHtml(file.type)} • ${Math.ceil(file.size / 1024)} KiB</p>`;
  }

  async function uploadReference(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error("Reference images must be 5 MiB or smaller in the current local Studio pipeline.");
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId())}/illustration/references?fileName=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "content-type": file.type },
      body: file,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Reference upload failed (${response.status}).`);
    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const selected = input()?.files?.[0];
    const prompt = form()?.querySelector('[name="prompt"]')?.value?.trim();
    const useReference = form()?.querySelector('[name="useReference"]')?.checked !== false;
    if (!prompt) return notify("Image prompt is required.");

    try {
      let reference = null;
      if (selected && useReference) {
        showPreview(selected, await readFile(selected));
        reference = await uploadReference(selected);
      }

      const payload = Object.fromEntries(new FormData(form()).entries());
      delete payload.referenceImage;
      payload.useReference = useReference;
      if (reference) {
        payload.referenceId = reference.id;
        payload.referenceUri = reference.assetUri;
        payload.referenceFileName = reference.originalFileName;
        payload.referenceKind = "source";
        payload.referenceNotes = "Author-selected reference supplied as an actual image input to the provider edit boundary.";
      }

      const generated = await api(`/api/projects/${encodeURIComponent(projectId())}/ai/image`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (result()) {
        result().innerHTML = `<img src="${escapeHtml(generated.url)}" alt="Generated illustration"><p>${escapeHtml(generated.model || "image provider")} • ${escapeHtml(generated.mode || "generation")}</p><a href="${escapeHtml(generated.url)}" target="_blank" rel="noopener">Open image</a>${reference ? `<p class="muted">Reference ${escapeHtml(reference.originalFileName)} was uploaded to durable project storage and supplied to the provider edit request.</p>` : ""}`;
      }
      notify(reference ? "Reference image uploaded and supplied to the real image-edit provider boundary." : "Real image provider response received.", true);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  }

  function bind() {
    const target = form();
    if (!target) return;
    target.addEventListener("submit", handleSubmit, true);
    input()?.addEventListener("change", async () => {
      const file = input().files?.[0];
      if (!file) {
        if (preview()) preview().innerHTML = '<p class="muted">No reference selected. You can generate from text alone.</p>';
        return;
      }
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        input().value = "";
        notify("Choose a PNG, JPEG, or WebP reference image.");
        return;
      }
      try { showPreview(file, await readFile(file)); } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();
