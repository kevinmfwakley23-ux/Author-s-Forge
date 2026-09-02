/* Author's Forge existing-manuscript intake. Preview is non-mutating; apply always creates a new durable book. */
(() => {
  "use strict";
  const MAX_BYTES = 5 * 1024 * 1024;
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const projectUrl = (suffix) => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const $ = (selector) => document.querySelector(selector);
  let prepared = null;

  function banner(message, ok = false) {
    const element = ok ? $("#success-banner") : $("#error-banner");
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    const other = ok ? $("#error-banner") : $("#success-banner");
    if (other) other.hidden = true;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  function ensureUi() {
    const manuscript = document.getElementById("manuscript");
    if (!manuscript || document.getElementById("manuscript-import-grid")) return;
    const grid = document.createElement("div");
    grid.id = "manuscript-import-grid";
    grid.className = "grid";
    grid.innerHTML = `
      <article class="card" id="manuscript-import-card">
        <div class="eyebrow">EXISTING MANUSCRIPT INTAKE</div>
        <h3>Bring an existing book into Forge</h3>
        <p class="muted">Forge reads the source locally through the Studio server, detects chapter/scene structure, and shows a preview before changing project state. Import never overwrites an existing Forge book.</p>
        <label>Manuscript file<input id="manuscript-import-file" type="file" accept=".docx,.txt,.md,.markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"></label>
        <label>Book title<input id="manuscript-import-title" maxlength="240" placeholder="Defaults to the source filename"></label>
        <label>Book type<select id="manuscript-import-kind"><option value="novel">Novel</option><option value="childrens-book">Children's book</option><option value="memoir">Memoir</option><option value="psychological-thriller">Psychological thriller</option><option value="comic-book">Comic book</option><option value="training-manual">Training manual</option><option value="other">Other</option></select></label>
        <label>Author note<textarea id="manuscript-import-description" maxlength="8000" placeholder="Optional purpose, edition, or source note"></textarea></label>
        <div class="row"><button id="manuscript-import-preview" type="button" class="primary">Preview import</button><button id="manuscript-import-apply" type="button" disabled>Import as new book</button></div>
        <small class="muted">Supported now: DOCX, UTF-8 TXT, Markdown. Maximum source file: 5 MiB. Unsupported formats fail explicitly.</small>
      </article>
      <article class="card">
        <h3>Import preview</h3>
        <div id="manuscript-import-status" class="muted" role="status" aria-live="polite">Choose a manuscript and preview it. Nothing is changed until you select “Import as new book.”</div>
        <div id="manuscript-import-summary" class="list"></div>
      </article>`;
    manuscript.appendChild(grid);
    $("#manuscript-import-file")?.addEventListener("change", resetPreview);
    $("#manuscript-import-preview")?.addEventListener("click", preview);
    $("#manuscript-import-apply")?.addEventListener("click", apply);
  }

  function resetPreview() {
    prepared = null;
    const applyButton = $("#manuscript-import-apply");
    if (applyButton) applyButton.disabled = true;
    const summary = $("#manuscript-import-summary");
    if (summary) summary.replaceChildren();
    setStatus("Source changed. Preview the manuscript again before importing.");
  }

  async function preview() {
    const file = $("#manuscript-import-file")?.files?.[0];
    if (!file) return banner("Choose a DOCX, TXT, or Markdown manuscript first.");
    if (file.size > MAX_BYTES) return banner("Manuscript source exceeds the 5 MiB import limit.");
    const button = $("#manuscript-import-preview");
    if (button) button.disabled = true;
    setStatus("Reading manuscript and detecting structure…");
    try {
      const dataBase64 = await fileBase64(file);
      const title = $("#manuscript-import-title")?.value?.trim() || undefined;
      const result = await api(projectUrl("/manuscript-import/preview"), { method: "POST", body: JSON.stringify({ fileName: file.name, dataBase64, title }) });
      prepared = { fileName: file.name, dataBase64, sourceSha256: result.sourceSha256 };
      if (!$("#manuscript-import-title")?.value?.trim() && result.suggestedBookTitle) $("#manuscript-import-title").value = result.suggestedBookTitle;
      renderPreview(result);
      const applyButton = $("#manuscript-import-apply");
      if (applyButton) applyButton.disabled = false;
      setStatus(`Preview ready: ${result.chapterCount} chapter(s), ${result.sceneCount} scene(s), ${result.wordCount} word(s). Review before importing.`);
    } catch (error) {
      prepared = null;
      const applyButton = $("#manuscript-import-apply");
      if (applyButton) applyButton.disabled = true;
      setStatus("Preview failed. Project state was not changed.");
      banner(error.message || String(error));
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function apply() {
    if (!prepared) return banner("Preview the current manuscript file before importing it.");
    const file = $("#manuscript-import-file")?.files?.[0];
    if (!file || file.name !== prepared.fileName) return resetPreview();
    const button = $("#manuscript-import-apply");
    if (button) button.disabled = true;
    setStatus("Re-validating the source and creating a new durable Forge book…");
    try {
      const result = await api(projectUrl("/manuscript-import/apply"), {
        method: "POST",
        body: JSON.stringify({
          fileName: prepared.fileName,
          dataBase64: prepared.dataBase64,
          title: $("#manuscript-import-title")?.value?.trim() || undefined,
          kind: $("#manuscript-import-kind")?.value || "novel",
          description: $("#manuscript-import-description")?.value?.trim() || undefined,
        }),
      });
      prepared = null;
      setStatus(`Imported ${result.chapterCount} chapter(s), ${result.sceneCount} scene(s), and ${result.wordCount} word(s) as a new book. Source hash: ${result.sourceSha256}.`);
      banner(`Existing manuscript imported as new Forge book “${result.importedBookId}”.`, true);
      document.getElementById("refresh")?.click();
      location.hash = "#manuscript";
    } catch (error) {
      setStatus("Import failed. No successful import was recorded.");
      banner(error.message || String(error));
      if (button) button.disabled = false;
    }
  }

  function renderPreview(result) {
    const host = $("#manuscript-import-summary");
    if (!host) return;
    host.replaceChildren();
    const provenance = document.createElement("article");
    provenance.className = "memory";
    const strong = document.createElement("strong");
    strong.textContent = `${result.fileName} • ${String(result.format).toUpperCase()}`;
    const detail = document.createElement("p");
    detail.textContent = `${formatBytes(result.sourceBytes)} • SHA-256 ${result.sourceSha256}`;
    provenance.append(strong, detail);
    host.appendChild(provenance);
    for (const chapter of result.chapters || []) {
      const item = document.createElement("article");
      item.className = "memory";
      const title = document.createElement("strong");
      title.textContent = `${chapter.number}. ${chapter.title}`;
      const detail = document.createElement("p");
      detail.textContent = `${chapter.scenes?.length || 0} scene(s) • ${chapter.wordCount || 0} words`;
      item.append(title, detail);
      host.appendChild(item);
    }
    for (const warning of result.warnings || []) {
      const item = document.createElement("article");
      item.className = "memory";
      const strong = document.createElement("strong");
      strong.textContent = "Review note";
      const detail = document.createElement("p");
      detail.textContent = warning;
      item.append(strong, detail);
      host.appendChild(item);
    }
  }

  async function fileBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
    return btoa(binary);
  }

  function setStatus(value) { const element = $("#manuscript-import-status"); if (element) element.textContent = value; }
  function formatBytes(value) { if (!Number.isFinite(Number(value))) return "Unknown size"; return Number(value) >= 1024 * 1024 ? `${(Number(value) / 1024 / 1024).toFixed(2)} MiB` : `${Math.max(1, Math.round(Number(value) / 1024))} KiB`; }

  window.addEventListener("load", ensureUi);
  if (document.readyState !== "loading") ensureUi();
})();
