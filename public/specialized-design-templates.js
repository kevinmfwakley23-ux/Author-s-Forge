(() => {
  "use strict";

  const state = window.forgeSpecializedState;
  const api = window.forgeSpecializedApi;
  if (!state || typeof api !== "function") return;

  const qs = new URLSearchParams(location.search);
  const forgeProjectId = qs.get("project") || localStorage.getItem("forge-specialized-project") || "forge-specialized";
  const root = `/api/projects/${encodeURIComponent(forgeProjectId)}/design-templates`;
  const brandRoot = `/api/projects/${encodeURIComponent(forgeProjectId)}/brand-kits`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

  let templates = [];
  let brandKits = [];
  let lastCandidate = null;

  function status(message, ok = true) {
    const el = $("#status");
    if (!el) return;
    el.textContent = message;
    el.style.background = ok ? "#163f28" : "#751919";
  }

  async function request(path, options = {}) {
    return api(path, options);
  }

  function install() {
    if ($("#design-template-card")) return;
    const right = document.querySelector(".sc-right");
    if (!right) return;

    const card = document.createElement("article");
    card.id = "design-template-card";
    card.className = "sc-card";
    card.innerHTML = `
      <h2>Reusable Design Templates</h2>
      <p class="sc-muted">Capture the current saved design as an editable semantic template. Forge preserves surfaces, text roles, styles, geometry, locked elements, target production settings, and provenance. Source-specific artwork is detached into explicit replacement slots so templates do not depend on hidden source assets.</p>
      <form id="design-template-form" class="sc-form">
        <label>Template name<input name="title" required placeholder="Royal launch flyer"></label>
        <label>Description<textarea name="description" placeholder="Reusable campaign layout for book launches"></textarea></label>
        <label>Tags<input name="tags" placeholder="launch, flyer, social"></label>
        <label>Production profile<select name="profileId" id="design-template-profile"></select></label>
        <label>Brand Kit<select name="brandKitId" id="design-template-brand"><option value="">No required Brand Kit</option></select></label>
        <button class="primary" type="submit">Capture current design as template</button>
      </form>
      <hr>
      <div class="sc-row"><h3 style="margin:0">Template library</h3><button id="design-template-refresh" type="button">Refresh</button></div>
      <div id="design-template-list" class="sc-list"></div>
      <div id="design-template-candidate" class="sc-output"></div>`;

    const brandCard = $("#brand-kit-card");
    if (brandCard?.parentNode === right) right.insertBefore(card, brandCard.nextSibling);
    else right.prepend(card);

    $("#design-template-form")?.addEventListener("submit", captureTemplate);
    $("#design-template-refresh")?.addEventListener("click", refresh);
    card.addEventListener("click", handleAction);
    refresh();
  }

  async function refresh() {
    try {
      const [templateResult, brandResult] = await Promise.all([
        request(root),
        request(brandRoot),
      ]);
      templates = templateResult.templates || [];
      brandKits = brandResult.kits || [];
      renderSelectors();
      renderLibrary();
    } catch (error) {
      status(error.message, false);
    }
  }

  function renderSelectors() {
    const profile = $("#design-template-profile");
    const profiles = state.current?.productionProfiles || [];
    if (profile) {
      profile.innerHTML = profiles.length
        ? profiles.map((item) => `<option value="${esc(item.id)}">${esc(item.label)} · ${item.widthInches} × ${item.heightInches}</option>`).join("")
        : '<option value="">No production profiles</option>';
      profile.disabled = !profiles.length;
    }

    const brand = $("#design-template-brand");
    if (brand) {
      brand.innerHTML = '<option value="">No required Brand Kit</option>' + brandKits
        .map((kit) => `<option value="${esc(kit.id)}">${esc(kit.name)}</option>`)
        .join("");
    }
  }

  function renderLibrary() {
    const host = $("#design-template-list");
    if (!host) return;
    if (!templates.length) {
      host.innerHTML = '<p class="sc-muted">No reusable design templates yet. Build and save a composition, then capture it here.</p>';
      return;
    }

    const targetMode = state.current?.mode;
    host.innerHTML = templates.map((template) => {
      const compatible = Boolean(targetMode && targetMode === template.mode);
      const tagText = template.tags?.length ? template.tags.join(" · ") : "untagged";
      return `<section>
        <h4>${esc(template.title)}</h4>
        <p>${esc(template.mode)} · v${template.version} · ${esc(template.profile.label)}</p>
        <p><small>${esc(template.description || "No description")}</small></p>
        <p><small>${esc(tagText)}${template.brandKitId ? ` · Brand Kit ${esc(template.brandKitId)}` : ""}</small></p>
        <div class="sc-row">
          <button type="button" data-template-action="preview" data-template-id="${esc(template.id)}" ${compatible ? "" : "disabled"}>Preview editable copy</button>
          <button type="button" data-template-action="delete" data-template-id="${esc(template.id)}">Delete</button>
        </div>
        ${compatible ? "" : '<p class="sc-warning"><small>Choose a Specialized project with the same mode to use this template.</small></p>'}
      </section>`;
    }).join("");
  }

  async function captureTemplate(event) {
    event.preventDefault();
    try {
      if (!state.current?.id) throw new Error("Choose a Specialized Creation project first.");
      if (!state.document?.id) throw new Error("Build and save a composition before capturing a template.");
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const tags = String(data.tags || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const result = await request(root, {
        method: "POST",
        body: JSON.stringify({
          sourceSpecializedProjectId: state.current.id,
          documentId: state.document.id,
          profileId: data.profileId,
          title: data.title,
          description: data.description || undefined,
          tags,
          brandKitId: data.brandKitId || undefined,
        }),
      });
      form.reset();
      templates.push(result.template);
      renderSelectors();
      renderLibrary();
      status(`Captured reusable template ${result.template.title}. ${result.detachedAssetSlots} source asset slot(s) were safely detached.`);
    } catch (error) {
      status(error.message, false);
    }
  }

  async function handleAction(event) {
    const button = event.target.closest?.("button[data-template-action]");
    if (!button) return;
    const id = button.dataset.templateId;
    const action = button.dataset.templateAction;
    try {
      if (action === "delete") {
        const template = templates.find((item) => item.id === id);
        if (!template || !confirm(`Delete reusable template ${template.title}?`)) return;
        await request(`${root}/${encodeURIComponent(id)}`, { method: "DELETE" });
        templates = templates.filter((item) => item.id !== id);
        renderLibrary();
        lastCandidate = null;
        const candidateHost = $("#design-template-candidate");
        if (candidateHost) candidateHost.innerHTML = "";
        status("Reusable design template deleted.");
        return;
      }

      if (action === "preview") {
        if (!state.current?.id) throw new Error("Choose the target Specialized project first.");
        const result = await request(`${root}/${encodeURIComponent(id)}/propose-use`, {
          method: "POST",
          body: JSON.stringify({ targetSpecializedProjectId: state.current.id }),
        });
        lastCandidate = result;
        renderCandidate(result);
        status(result.readyForAuthorReview
          ? "Editable template candidate created for author review. Nothing has been saved yet."
          : "Template candidate requires Brand Kit review before it can be approved.",
          result.readyForAuthorReview);
        return;
      }

      if (action === "save-candidate") {
        if (!lastCandidate?.candidate || !state.current?.id) throw new Error("No template candidate is ready.");
        if (!lastCandidate.readyForAuthorReview) throw new Error("This template candidate is blocked by Brand Kit governance.");
        const candidate = lastCandidate.candidate;
        if (!confirm(`Save ${lastCandidate.template.title} as a new editable document and production profile?`)) return;
        const projectPath = `/api/projects/${encodeURIComponent(forgeProjectId)}/specialized/${encodeURIComponent(state.current.id)}`;
        await request(`${projectPath}/profiles`, {
          method: "PUT",
          body: JSON.stringify({ profile: candidate.profile }),
        });
        const saved = await request(`${projectPath}/documents`, {
          method: "POST",
          body: JSON.stringify({
            document: candidate.document,
            reason: `Instantiated reusable design template ${lastCandidate.template.id} version ${lastCandidate.template.version} after author review`,
          }),
        });
        state.current = saved;
        state.document = saved.documents?.find((document) => document.id === candidate.document.id) || candidate.document;
        state.surface = state.document?.surfaces?.[0] || null;
        button.disabled = true;
        button.textContent = "Saved";
        status("Template copy saved as a real editable Specialized Creation revision.");
      }
    } catch (error) {
      status(error.message, false);
    }
  }

  function renderCandidate(result) {
    const host = $("#design-template-candidate");
    if (!host) return;
    const slots = result.candidate.detachedAssetSlots || [];
    const brand = result.brandCompliance;
    host.innerHTML = `
      <h3>${esc(result.template.title)} — candidate</h3>
      <p><strong>Persisted:</strong> no · <strong>Mode:</strong> ${esc(result.candidate.document.mode)} · <strong>Profile:</strong> ${esc(result.candidate.profile.label)}</p>
      <p><strong>Detached asset slots:</strong> ${slots.length}</p>
      ${slots.slice(0, 20).map((slot) => `<p><small>${esc(slot.slot)} · source asset ${esc(slot.sourceAssetId)}</small></p>`).join("")}
      ${slots.length > 20 ? `<p><small>+ ${slots.length - 20} more asset slots</small></p>` : ""}
      ${brand ? `<p><strong>Brand Kit:</strong> ${brand.compliant ? "PASS" : "REVIEW REQUIRED"} · ${brand.issues.length} issue(s)</p>${brand.issues.slice(0, 12).map((issue) => `<p class="${issue.severity === "error" ? "sc-error" : "sc-warning"}"><b>${esc(issue.code)}</b> ${esc(issue.message)}</p>`).join("")}` : '<p><strong>Brand Kit:</strong> none required</p>'}
      <p class="sc-muted">Replace detached image/logo slots as needed, then run normal Specialized preflight before production.</p>
      <button class="primary" type="button" data-template-action="save-candidate" ${result.readyForAuthorReview ? "" : "disabled"}>Approve + save editable template copy</button>`;
  }

  window.addEventListener("forge:specialized-ready", () => {
    if ($("#design-template-card")) refresh();
    else install();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
