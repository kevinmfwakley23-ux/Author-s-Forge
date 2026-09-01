(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const projectId = params.get("project") || localStorage.getItem("forge-project") || "forge-studio";
  let state = { library: { prompts: [], coverStatements: [] }, editions: [], currentEdition: null, aiProposal: null, format: null };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const apiRoot = `/api/projects/${encodeURIComponent(projectId)}`;
  localStorage.setItem("forge-project", projectId);

  function banner(message, error = false) {
    const el = $("#banner"); el.textContent = message; el.classList.toggle("error", error); el.hidden = !message;
    if (message) setTimeout(() => { if (el.textContent === message) el.hidden = true; }, 7000);
  }
  async function api(path, options = {}) {
    const response = await fetch(`${apiRoot}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }
  function tags(value) { return String(value || "").split(",").map((item) => item.trim()).filter(Boolean); }
  function lines(value) { return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
  function download(name, type, content) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function downloadBase64(name, type, base64) { const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)); download(name, type, bytes); }
  function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
  function selectedCategories(form) { return [...form.querySelectorAll('input[name="category"]:checked')].map((input) => input.value); }

  function setPanel(name) {
    $$('[data-workspace-panel]').forEach((panel) => panel.hidden = panel.id !== `panel-${name}`);
    $$('.office-nav [data-panel]').forEach((button) => button.classList.toggle("active", button.dataset.panel === name));
  }
  $$('.office-nav [data-panel]').forEach((button) => button.addEventListener("click", () => setPanel(button.dataset.panel)));

  function formatPayload() {
    const form = $("#format-form"); const v = formObject(form);
    return {
      trimWidthInches: Number(v.trimWidthInches), trimHeightInches: Number(v.trimHeightInches),
      pageStyle: state.currentEdition?.pageStyle || "lined", responsePagesPerPrompt: state.currentEdition?.responsePagesPerPrompt || 1,
      promptFontFamily: v.promptFontFamily, promptFontSizePt: Number(v.promptFontSizePt), responseFontFamily: v.responseFontFamily, responseFontSizePt: Number(v.responseFontSizePt),
      promptAlignment: v.promptAlignment, lineSpacingInches: Number(v.lineSpacingInches), dotSpacingInches: Number(v.dotSpacingInches),
      margins: { topInches: Number(v.topInches), bottomInches: Number(v.bottomInches), insideInches: Number(v.insideInches), outsideInches: Number(v.outsideInches) },
      showPageNumbers: form.elements.showPageNumbers.checked, showCategoryLabel: form.elements.showCategoryLabel.checked, promptStartsOnNewPage: form.elements.promptStartsOnNewPage.checked,
      includeTitlePage: form.elements.includeTitlePage.checked, includeCopyrightPage: form.elements.includeCopyrightPage.checked,
      includeIntroductionPages: Number(v.includeIntroductionPages), includeClosingPages: Number(v.includeClosingPages),
    };
  }

  function renderLibrary() {
    $("#prompt-count").textContent = `${state.library.prompts.length}`; $("#statement-count").textContent = `${state.library.coverStatements.length}`;
    $("#prompt-list").innerHTML = state.library.prompts.length ? state.library.prompts.map((prompt) => `<div class="item"><div class="item-title"><div><div class="category">${escapeHtml(prompt.category)}</div><strong>${escapeHtml(prompt.text)}</strong></div><span class="pill">${prompt.enabled ? "active" : "disabled"}</span></div>${prompt.tags?.length ? `<p class="muted">${escapeHtml(prompt.tags.join(" · "))}</p>` : ""}<div class="item-actions"><button data-toggle-prompt="${escapeHtml(prompt.id)}" data-enabled="${prompt.enabled}">${prompt.enabled ? "Disable" : "Enable"}</button><button data-remove-prompt="${escapeHtml(prompt.id)}">Remove</button></div></div>`).join("") : '<p class="muted">No questions yet. Add questions manually, import a library, or ask Forge AI for proposals.</p>';
    $("#cover-statement-list").innerHTML = state.library.coverStatements.length ? state.library.coverStatements.map((item) => `<div class="item"><div class="item-title"><strong>${escapeHtml(item.text)}</strong><span class="pill">${item.enabled ? "active" : "disabled"}</span></div><div class="item-actions"><button data-toggle-statement="${escapeHtml(item.id)}" data-enabled="${item.enabled}">${item.enabled ? "Disable" : "Enable"}</button><button data-remove-statement="${escapeHtml(item.id)}">Remove</button></div></div>`).join("") : '<p class="muted">No cover statements yet.</p>';
  }

  function renderEdition(journal) {
    state.currentEdition = journal;
    if (!journal) { $("#current-edition").innerHTML = '<p class="muted">Generate or select an edition.</p>'; return; }
    const categories = Object.entries(journal.categoryCounts || {}).filter(([, count]) => count > 0).map(([name, count]) => `${name}: ${count}`).join(" · ");
    $("#current-edition").innerHTML = `<div class="item"><div class="category">CURRENT EDITION</div><h3>${escapeHtml(journal.title)}</h3>${journal.subtitle ? `<p>${escapeHtml(journal.subtitle)}</p>` : ""}<p><strong>${journal.prompts.length}</strong> questions · ${escapeHtml(journal.pageStyle)} · ${journal.responsePagesPerPrompt} response page(s) each</p><p class="muted">Seed: ${escapeHtml(journal.seed)}<br>${escapeHtml(categories)}</p>${journal.coverStatement ? `<p><strong>Cover statement:</strong> ${escapeHtml(journal.coverStatement.text)}</p>` : ""}</div><div class="item-list">${journal.prompts.slice(0, 12).map((prompt) => `<div class="item"><span class="category">${escapeHtml(prompt.category)} · ${prompt.sequence}</span><p>${escapeHtml(prompt.prompt)}</p></div>`).join("")}${journal.prompts.length > 12 ? `<p class="muted">+ ${journal.prompts.length - 12} more questions</p>` : ""}</div>`;
    const preview = $("#page-preview"); preview.className = `page-preview ${journal.pageStyle}`; preview.querySelector(".preview-prompt").textContent = journal.prompts[0]?.prompt || "Your journal prompt appears here.";
  }

  function renderEditions() {
    $("#edition-list").innerHTML = state.editions.length ? state.editions.map((journal) => `<div class="item"><div class="item-title"><div><span class="category">${escapeHtml(journal.pageStyle)} · ${journal.prompts.length} questions</span><h3>${escapeHtml(journal.title)}</h3></div><span class="pill">${new Date(journal.generatedAt).toLocaleDateString()}</span></div><p class="muted">Seed ${escapeHtml(journal.seed)}</p><div class="item-actions"><button data-open-edition="${escapeHtml(journal.id)}">Open edition</button></div></div>`).join("") : '<p class="muted">No journal editions generated yet.</p>';
  }

  function renderCoverPlans(plans) {
    $("#cover-plan-list").innerHTML = plans.length ? plans.slice().reverse().map((plan) => `<div class="item"><div class="item-title"><strong>${escapeHtml(plan.title)}</strong><span class="pill">${escapeHtml(plan.approvalStatus)}</span></div><p class="muted">${plan.publishing.trimWidthInches} × ${plan.publishing.trimHeightInches} in · ${plan.publishing.pageCount} pages · spine ${plan.dimensions.spineWidthInches} in</p></div>`).join("") : '<p class="muted">No Cover Studio plans yet.</p>';
  }

  async function refresh() {
    try {
      const [info, library, editions, covers] = await Promise.all([api(""), api("/journal/library"), api("/journal/editions"), api("/journal/cover-plans")]);
      state.library = library; state.editions = editions;
      $("#project-title").textContent = info.project.title; $("#project-status").textContent = `Project ${info.project.id} · ${info.memoryCount} Brain memories · ${info.editionCount} journal edition(s)`;
      const enabledAi = Object.entries(info.ai).filter(([, enabled]) => enabled).map(([name]) => name);
      $("#brain-status").innerHTML = `<div class="status-chip"><span class="eyebrow">Project Brain</span><strong>${info.memoryCount} memories</strong></div><div class="status-chip"><span class="eyebrow">Question pool</span><strong>${info.promptCount} prompts</strong></div><div class="status-chip"><span class="eyebrow">AI resources</span><strong>${enabledAi.length ? escapeHtml(enabledAi.join(", ")) : "not configured"}</strong></div><div class="status-chip"><span class="eyebrow">Cover Studio</span><strong>${info.coverPlanCount} plan(s)</strong></div>`;
      renderLibrary(); renderEditions(); renderCoverPlans(covers); if (!state.currentEdition && editions.length) renderEdition(editions[0]);
      const mainBase = params.get("studio") || `${location.protocol}//${location.hostname}:4173`; $("#main-studio-link").href = `${mainBase}/?project=${encodeURIComponent(projectId)}#dashboard`; $("#cover-studio-link").href = `${mainBase}/?project=${encodeURIComponent(projectId)}#cover`;
    } catch (error) { banner(error.message, true); }
  }

  $("#refresh").addEventListener("click", refresh);
  $("#prompt-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const v = formObject(event.currentTarget); await api("/journal/library/prompts", { method: "POST", body: JSON.stringify({ id: v.id, category: v.category, text: v.text, tags: tags(v.tags) }) }); event.currentTarget.reset(); banner("Question saved to the durable library."); await refresh(); } catch (error) { banner(error.message, true); } });
  $("#cover-statement-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const v = formObject(event.currentTarget); await api("/journal/library/cover-statements", { method: "POST", body: JSON.stringify({ id: v.id, text: v.text, tags: tags(v.tags) }) }); event.currentTarget.reset(); banner("Cover statement saved."); await refresh(); } catch (error) { banner(error.message, true); } });
  document.addEventListener("click", async (event) => {
    const togglePrompt = event.target.closest("[data-toggle-prompt]"); const removePrompt = event.target.closest("[data-remove-prompt]"); const toggleStatement = event.target.closest("[data-toggle-statement]"); const removeStatement = event.target.closest("[data-remove-statement]"); const openEdition = event.target.closest("[data-open-edition]");
    try {
      if (togglePrompt) { await api(`/journal/library/prompts/${encodeURIComponent(togglePrompt.dataset.togglePrompt)}`, { method: "PATCH", body: JSON.stringify({ enabled: togglePrompt.dataset.enabled !== "true" }) }); await refresh(); }
      if (removePrompt && confirm("Remove this question from the master library?")) { await api(`/journal/library/prompts/${encodeURIComponent(removePrompt.dataset.removePrompt)}`, { method: "DELETE" }); await refresh(); }
      if (toggleStatement) { await api(`/journal/library/cover-statements/${encodeURIComponent(toggleStatement.dataset.toggleStatement)}`, { method: "PATCH", body: JSON.stringify({ enabled: toggleStatement.dataset.enabled !== "true" }) }); await refresh(); }
      if (removeStatement && confirm("Remove this cover statement?")) { await api(`/journal/library/cover-statements/${encodeURIComponent(removeStatement.dataset.removeStatement)}`, { method: "DELETE" }); await refresh(); }
      if (openEdition) { const journal = await api(`/journal/editions/${encodeURIComponent(openEdition.dataset.openEdition)}`); renderEdition(journal); setPanel("edition"); banner(`Opened ${journal.title}.`); }
    } catch (error) { banner(error.message, true); }
  });

  $("#library-import").addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const parsed = JSON.parse(await file.text()); await api("/journal/library/import", { method: "POST", body: JSON.stringify({ prompts: parsed.prompts || [], coverStatements: parsed.coverStatements || [] }) }); banner("Library imported."); await refresh(); } catch (error) { banner(`Import failed: ${error.message}`, true); } finally { event.target.value = ""; } });
  $("#export-library").addEventListener("click", () => download(`${projectId}-guided-journal-library.json`, "application/json", JSON.stringify(state.library, null, 2)));

  $("#random-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const v = formObject(event.currentTarget); const result = await api("/journal/random", { method: "POST", body: JSON.stringify({ seed: v.seed, category: v.category || undefined, excludedPromptIds: lines(v.excluded) }) }); $("#random-result").innerHTML = `<div class="category">${escapeHtml(result.category)}</div><p class="random-question">${escapeHtml(result.text)}</p><p class="muted">${escapeHtml(result.id)}${result.tags?.length ? ` · ${escapeHtml(result.tags.join(" · "))}` : ""}</p>`; } catch (error) { banner(error.message, true); } });

  $("#edition-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const form = event.currentTarget; const v = formObject(form); const journal = await api("/journal/editions", { method: "POST", body: JSON.stringify({ title: v.title, subtitle: v.subtitle, seed: v.seed, promptCount: Number(v.promptCount), categories: selectedCategories(form), pageStyle: v.pageStyle, responsePagesPerPrompt: Number(v.responsePagesPerPrompt), includeCoverStatement: form.elements.includeCoverStatement.checked, noRepeatAcrossEditions: form.elements.noRepeatAcrossEditions.checked }) }); renderEdition(journal); banner("Durable journal edition generated and recorded in Project Brain."); await refresh(); } catch (error) { banner(error.message, true); } });

  $("#format-form").addEventListener("input", () => { if (state.currentEdition) { const preview = $("#page-preview"); preview.className = `page-preview ${state.currentEdition.pageStyle}`; } });
  $("#format-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!state.currentEdition) return banner("Generate or open a journal edition first.", true); try { const v = formObject(event.currentTarget); const rendered = await api("/journal/render", { method: "POST", body: JSON.stringify({ journalId: state.currentEdition.id, bookId: v.bookId, author: v.author, copyrightHolder: v.author, introduction: String(v.introduction || "").split(/\n\s*\n/).filter(Boolean), closing: String(v.closing || "").split(/\n\s*\n/).filter(Boolean), format: formatPayload() }) }); state.format = rendered.layout.format; const a = rendered.artifact, l = rendered.layout; $("#production-result").innerHTML = `<div class="production-metric"><span>Total pages</span><strong>${l.totalPages}</strong></div><div class="production-metric"><span>Prompt pages</span><strong>${l.promptPages}</strong></div><div class="production-metric"><span>Response pages</span><strong>${l.responsePages}</strong></div><div class="production-metric"><span>Trim</span><strong>${l.format.trimWidthInches} × ${l.format.trimHeightInches} in</strong></div><div class="production-metric"><span>PDF bytes</span><strong>${a.byteLength.toLocaleString()}</strong></div><div class="production-metric"><span>SHA-256</span><code>${escapeHtml(a.sha256.slice(0, 16))}…</code></div><button id="download-pdf" class="primary download" type="button">Download ${escapeHtml(a.fileName)}</button>`; $("#download-pdf").onclick = () => downloadBase64(a.fileName, a.mimeType, a.contentBase64); banner("Production PDF generated from the selected journal formatting."); } catch (error) { banner(error.message, true); } });

  $("#ai-prompt-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const v = formObject(event.currentTarget); $("#ai-prompt-result").innerHTML = '<p class="muted">Using Project Brain context and the shared provider pool…</p>'; const proposal = await api("/journal/ai/prompts", { method: "POST", body: JSON.stringify({ category: v.category, count: Number(v.count), audience: v.audience, purpose: v.purpose }) }); state.aiProposal = proposal; $("#ai-evidence").innerHTML = `<div class="provider-evidence">Provider: <strong>${escapeHtml(proposal.ai.provider)}</strong> · Model: <strong>${escapeHtml(proposal.ai.model)}</strong>${proposal.ai.optimization ? ` · tokens saved: ${proposal.ai.optimization.tokensSaved}` : ""}</div>`; $("#ai-prompt-result").innerHTML = proposal.prompts.map((prompt) => `<div class="item ai-card"><span class="category">${escapeHtml(prompt.category)}</span><p>${escapeHtml(prompt.text)}</p></div>`).join(""); $("#approve-ai-prompts").disabled = false; } catch (error) { $("#ai-prompt-result").innerHTML = '<p class="muted">No proposal available.</p>'; banner(error.message, true); } });
  $("#approve-ai-prompts").addEventListener("click", async () => { if (!state.aiProposal) return; try { await api("/journal/ai/prompts/approve", { method: "POST", body: JSON.stringify({ proposal: state.aiProposal }) }); state.aiProposal = null; $("#approve-ai-prompts").disabled = true; $("#ai-prompt-result").innerHTML = '<p class="muted">Proposal approved into the author-controlled library.</p>'; banner("AI questions approved into the durable library."); await refresh(); } catch (error) { banner(error.message, true); } });

  $("#ai-cover-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!state.currentEdition) return banner("Generate or open a journal edition first.", true); try { const v = formObject(event.currentTarget); const result = await api("/journal/ai/cover", { method: "POST", body: JSON.stringify({ journalId: state.currentEdition.id, audience: v.audience, tone: v.tone }) }); $("#cover-form").elements.frontPrompt.value = result.frontPrompt; $("#cover-form").elements.backText.value = result.backText; $("#ai-cover-evidence").innerHTML = `<div class="provider-evidence">Provider: <strong>${escapeHtml(result.ai.provider)}</strong> · Model: <strong>${escapeHtml(result.ai.model)}</strong></div>`; banner("Cover direction generated as an editable candidate."); } catch (error) { banner(error.message, true); } });
  $("#cover-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!state.currentEdition) return banner("Generate or open a journal edition first.", true); try { const v = formObject(event.currentTarget); const result = await api("/journal/cover", { method: "POST", body: JSON.stringify({ journalId: state.currentEdition.id, bookId: v.bookId, author: v.author, frontPrompt: v.frontPrompt, backText: v.backText, binding: v.binding, interiorType: v.interiorType, paperType: v.paperType, format: formatPayload() }) }); const p = result.plan; $("#cover-result").innerHTML = `<div class="cover-geometry"><div><span class="eyebrow">Full width</span><strong>${p.dimensions.widthInches} in</strong></div><div><span class="eyebrow">Height</span><strong>${p.dimensions.heightInches} in</strong></div><div><span class="eyebrow">Spine</span><strong>${p.dimensions.spineWidthInches} in</strong></div><div><span class="eyebrow">Pages</span><strong>${p.publishing.pageCount}</strong></div></div><p class="muted">Cover plan ${escapeHtml(p.id)} is now durable project state and available to Cover Studio.</p>`; banner("Durable Cover Studio plan created from the journal's production geometry."); await refresh(); } catch (error) { banner(error.message, true); } });

  refresh();
})();
