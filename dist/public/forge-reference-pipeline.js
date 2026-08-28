/* Author's Forge reference-image workflow.
 * Runs before the legacy illustration submit handler so the selected file is
 * never silently discarded. The current server contract is JSON-only, so the
 * browser persists the original image as a project memory record while the
 * provider-side binary edit transport is completed in the server pipeline.
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

  async function persistReference(file, dataUrl, prompt) {
    // Keep the client-to-server payload bounded by the Studio's existing 8 MiB
    // JSON request ceiling. Images larger than this are rejected rather than
    // silently truncated or converted into unusable records.
    if (file.size > 5 * 1024 * 1024) throw new Error("Reference images must be 5 MiB or smaller in the current local Studio pipeline.");
    const id = `reference-image-${crypto.randomUUID()}`;
    const memory = await api(`/api/projects/${encodeURIComponent(projectId())}/memory`, {
      method: "POST",
      body: JSON.stringify({
        id,
        class: "visual-identity",
        authority: "working",
        summary: `Reference image: ${file.name}`,
        content: JSON.stringify({
          kind: "reference-image",
          originalFileName: file.name,
          mediaType: file.type,
          byteLength: file.size,
          dataUrl,
          prompt: String(prompt || "").trim(),
        }),
        reference: "illustration-studio-reference-upload",
        relevanceTags: ["illustration", "reference-image", "visual-identity"],
      }),
    });
    return memory;
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
        const dataUrl = await readFile(selected);
        showPreview(selected, dataUrl);
        reference = await persistReference(selected, dataUrl, prompt);
      }

      const payload = Object.fromEntries(new FormData(form()).entries());
      delete payload.referenceImage;
      payload.useReference = useReference;
      if (reference) {
        payload.referenceMemoryId = reference.id;
        payload.referenceFileName = selected.name;
        payload.prompt = `${prompt}\n\nREFERENCE IMAGE AVAILABLE IN PROJECT MEMORY: ${selected.name}. Preserve the referenced subject's identity, proportions, distinctive visual traits, and continuity where appropriate. Do not claim the image was used as an image input until the provider-side reference transport confirms it.`;
      }

      const generated = await api(`/api/projects/${encodeURIComponent(projectId())}/ai/image`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (result()) {
        result().innerHTML = `<img src="${escapeHtml(generated.url)}" alt="Generated illustration"><p>${escapeHtml(generated.model || "image provider")}</p><a href="${escapeHtml(generated.url)}" target="_blank" rel="noopener">Open image</a>${reference ? `<p class="muted">Reference preserved as project record <code>${escapeHtml(reference.id)}</code>. Provider reference transport is the next server integration step.</p>` : ""}`;
      }
      notify(reference ? "Reference image preserved and illustration generated. The image-reference provider boundary remains explicitly marked until server-side image input is enabled." : "Real image provider response received.", true);
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
