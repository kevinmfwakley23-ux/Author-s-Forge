(() => {
  "use strict";
  document.documentElement.dataset.forgeCoreOffice = "guided-journal";
  document.body?.setAttribute("data-forge-core-office", "guided-journal");

  const params = new URLSearchParams(location.search);
  const projectId = params.get("project")?.trim() || localStorage.getItem("forge-project") || "forge-studio";
  const studioLink = document.getElementById("main-studio-link");
  if (studioLink) studioLink.href = `/?project=${encodeURIComponent(projectId)}`;

  const coverLink = document.getElementById("cover-studio-link");
  if (coverLink) coverLink.href = `/?project=${encodeURIComponent(projectId)}#cover`;

  if (!document.querySelector('script[data-guided-journal-journeys]')) {
    const journeys = document.createElement("script");
    journeys.src = "guided-journal-journeys.js";
    journeys.defer = true;
    journeys.dataset.guidedJournalJourneys = "true";
    document.head.appendChild(journeys);
  }

  const legacyImport = document.getElementById("library-import");
  const importRow = legacyImport?.closest(".row");
  if (!importRow || document.getElementById("journal-bulk-import")) return;

  const box = document.createElement("div");
  box.id = "journal-bulk-import";
  box.className = "result-card";
  box.innerHTML = `
    <div class="eyebrow">BULK QUESTION IMPORT</div>
    <p class="muted">Paste one question per line, CSV, or JSON. Existing question text is skipped instead of silently duplicated.</p>
    <div class="row">
      <label>Format
        <select id="journal-import-format">
          <option value="text">Plain text</option>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </label>
      <label>Default category
        <select id="journal-import-category">
          <option value="remember">Remember</option>
          <option value="discover" selected>Discover</option>
          <option value="challenge">Challenge</option>
          <option value="create">Create</option>
          <option value="become">Become</option>
          <option value="hope">Hope</option>
        </select>
      </label>
    </div>
    <label>Questions
      <textarea id="journal-import-content" rows="7" placeholder="What would you like to remember about today?&#10;What did today teach you about yourself?"></textarea>
    </label>
    <button id="journal-run-import" type="button" class="secondary">Import questions</button>
    <p id="journal-import-result" class="muted" aria-live="polite"></p>
  `;
  importRow.insertAdjacentElement("afterend", box);

  document.getElementById("journal-run-import")?.addEventListener("click", async () => {
    const content = document.getElementById("journal-import-content")?.value || "";
    const format = document.getElementById("journal-import-format")?.value || "text";
    const defaultCategory = document.getElementById("journal-import-category")?.value || "discover";
    const resultNode = document.getElementById("journal-import-result");
    if (!content.trim()) {
      if (resultNode) resultNode.textContent = "Paste questions before importing.";
      return;
    }
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/journal/library/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format, defaultCategory, content }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Import failed (${response.status}).`);
      if (resultNode) resultNode.textContent = `Imported ${payload.imported?.length ?? 0} question(s); skipped ${payload.duplicateTextsSkipped?.length ?? 0} duplicate(s).`;
      const textarea = document.getElementById("journal-import-content");
      if (textarea) textarea.value = "";
      document.getElementById("refresh")?.click();
    } catch (error) {
      if (resultNode) resultNode.textContent = error instanceof Error ? error.message : String(error);
    }
  });
})();
