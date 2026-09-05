/* Author's Forge project-wide Brand Studio. One governed Brand Kit source is shared with Specialized Creation and exposed to every Studio surface. */
(() => {
  "use strict";

  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const root = `/api/projects/${encodeURIComponent(projectId)}/brand-kits`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const uniqueLines = (value) => [...new Set(String(value || "").split(/\r?\n/u).map((item) => item.trim()).filter(Boolean))];

  let snapshot = { kits: [], activeBrandKitId: null, activeBrandKit: null };
  let selectedId = null;
  let creating = true;

  async function api(path, init = {}) {
    const response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Brand Studio request failed (${response.status}).`);
    return payload;
  }

  function notify(message, ok = false) {
    const global = $(ok ? "#success-banner" : "#error-banner");
    const other = $(!ok ? "#success-banner" : "#error-banner");
    if (other) other.hidden = true;
    if (global) { global.textContent = message; global.hidden = false; }
    const local = $("#brand-studio-status");
    if (local) { local.textContent = message; local.dataset.kind = ok ? "success" : "error"; }
  }

  function ensureStyles() {
    if ($("#forge-brand-studio-styles")) return;
    const style = document.createElement("style");
    style.id = "forge-brand-studio-styles";
    style.textContent = `
      .brand-studio-grid{display:grid;grid-template-columns:minmax(230px,.75fr) minmax(0,1.5fr);gap:1rem}.brand-studio-list{display:grid;gap:.5rem}.brand-studio-list button{text-align:left;min-height:46px}.brand-studio-list button[aria-current="true"]{outline:2px solid currentColor}.brand-studio-status{padding:.7rem .8rem;border:1px solid rgba(127,127,127,.35);border-radius:10px;margin:.7rem 0}.brand-studio-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.brand-studio-form-grid label{display:grid;gap:.3rem}.brand-studio-wide{grid-column:1/-1}.brand-studio-actions{display:flex;gap:.55rem;flex-wrap:wrap}.brand-studio-actions button{min-height:44px}.brand-studio-active{padding:.65rem .75rem;border:1px solid rgba(127,127,127,.35);border-radius:10px;margin-bottom:.7rem}.brand-studio-active strong{display:block}.brand-studio-format{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.83rem}.brand-studio-checks{display:flex;gap:1rem;flex-wrap:wrap}.brand-studio-checks label{display:flex;align-items:center;gap:.4rem}.brand-studio-checks input{width:auto}
      @media(max-width:850px){.brand-studio-grid,.brand-studio-form-grid{grid-template-columns:1fr}.brand-studio-wide{grid-column:1}.brand-studio-actions{display:grid;grid-template-columns:1fr}.brand-studio-actions button{width:100%;min-height:44px}}
    `;
    document.head.append(style);
  }

  function ensureUi() {
    if ($("#brand")) return true;
    const main = document.querySelector("main");
    const footer = main?.querySelector("footer");
    const nav = document.querySelector(".sidebar nav");
    if (!main || !nav) return false;

    const link = document.createElement("a");
    link.href = "#brand";
    link.dataset.route = "brand";
    link.textContent = "Brand Studio";
    const artLink = nav.querySelector('[data-route="art"]');
    nav.insertBefore(link, artLink || null);

    const section = document.createElement("section");
    section.id = "brand";
    section.className = "view";
    section.dataset.view = "";
    section.hidden = true;
    section.setAttribute("aria-hidden", "true");
    section.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">PROJECT BRAND SYSTEM</div><h2>One visual and voice identity across every Forge office</h2><p>Brand Kits govern approved colors, fonts, assets, voice, guidelines and locked roles. Selecting an active kit records authoritative Project Memory. Applying a brand elsewhere still uses that office's existing proposal/approval boundary.</p></div><button id="brand-refresh" type="button">Refresh</button></div>
      <div id="brand-studio-active" class="brand-studio-active"><strong>No active Brand Kit</strong><span class="muted">Choose a kit to make its constraints available across Forge.</span></div>
      <div id="brand-studio-status" class="brand-studio-status" role="status">Brand Studio ready.</div>
      <div class="brand-studio-grid">
        <article class="card"><div class="section-title"><div><h3>Project Brand Kits</h3><p class="muted">These same kits are available to Specialized Creation.</p></div><button id="brand-new" type="button">New kit</button></div><div id="brand-kit-list" class="brand-studio-list"></div></article>
        <article class="card"><h3 id="brand-editor-title">Create Brand Kit</h3><form id="brand-kit-form">
          <div class="brand-studio-form-grid">
            <label>Name<input id="brand-name" required maxlength="160" placeholder="Heartwood Jungle"></label>
            <label>Description<input id="brand-description" maxlength="4000" placeholder="Series-wide visual and voice identity"></label>
            <label class="brand-studio-wide">Colors <small>one per line: Label | #RRGGBB | role</small><textarea id="brand-colors" class="brand-studio-format" placeholder="Royal Gold | #b58a3c | primary\nMarble White | #f4f1e8 | background\nInk Black | #151515 | text"></textarea></label>
            <label class="brand-studio-wide">Fonts <small>one per line: Label | family | role | weights</small><textarea id="brand-fonts" class="brand-studio-format" placeholder="Display | Georgia | display | 400,700\nBody | Arial | body | 400,700"></textarea></label>
            <label class="brand-studio-wide">Approved assets <small>one per line: assetId | role | optional label</small><textarea id="brand-assets" class="brand-studio-format" placeholder="heartwood-logo | primary-logo | Heartwood Tree mark"></textarea></label>
            <label>Voice traits <small>one per line</small><textarea id="brand-voice-traits" placeholder="warm\nhopeful\nlyrical"></textarea></label>
            <label>Preferred phrases <small>one per line</small><textarea id="brand-preferred" placeholder="In Heartwood Jungle…"></textarea></label>
            <label>Avoided phrases <small>one per line</small><textarea id="brand-avoided" placeholder="phrases that break the established voice"></textarea></label>
            <label>Locked element roles <small>one per line</small><textarea id="brand-locked" placeholder="brand\nlegal"></textarea></label>
            <label class="brand-studio-wide">Brand guidelines <small>one rule per line</small><textarea id="brand-guidelines" placeholder="Keep title hierarchy consistent across the series.\nNever crop the primary logo below its safe area."></textarea></label>
            <div class="brand-studio-wide brand-studio-checks">
              <label><input id="brand-enforce-colors" type="checkbox" checked> Enforce approved colors</label>
              <label><input id="brand-enforce-fonts" type="checkbox" checked> Enforce approved fonts</label>
              <label><input id="brand-enforce-assets" type="checkbox" checked> Require approved brand assets</label>
            </div>
          </div>
          <div class="brand-studio-actions"><button id="brand-save" class="primary" type="submit">Create Brand Kit</button><button id="brand-set-active" type="button" disabled>Set as active project brand</button><button id="brand-clear-active" type="button" disabled>Clear active brand</button><button id="brand-delete" type="button" disabled>Delete kit</button></div>
        </form></article>
      </div>`;
    if (footer) main.insertBefore(section, footer); else main.append(section);

    $("#brand-refresh")?.addEventListener("click", () => void refresh());
    $("#brand-new")?.addEventListener("click", beginNew);
    $("#brand-kit-form")?.addEventListener("submit", saveKit);
    $("#brand-set-active")?.addEventListener("click", () => void setActive());
    $("#brand-clear-active")?.addEventListener("click", () => void clearActive());
    $("#brand-delete")?.addEventListener("click", () => void deleteKit());
    $("#brand-kit-list")?.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("button[data-brand-id]") : null;
      if (!button) return;
      selectedId = button.dataset.brandId || null;
      creating = false;
      render();
    });
    return true;
  }

  function parseColors(value) {
    return uniqueLines(value).map((line, index) => {
      const [label, color, role = "custom"] = line.split("|").map((part) => part.trim());
      if (!label || !color) throw new Error(`Color line ${index + 1} must use Label | #RRGGBB | role.`);
      return { id: `color-${slug(label)}-${index + 1}`, label, value: color, role };
    });
  }
  function parseFonts(value) {
    return uniqueLines(value).map((line, index) => {
      const [label, family, role = "custom", weightText = "400"] = line.split("|").map((part) => part.trim());
      if (!label || !family) throw new Error(`Font line ${index + 1} must use Label | family | role | weights.`);
      const weights = weightText.split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item));
      return { id: `font-${slug(label)}-${index + 1}`, label, family, role, weights };
    });
  }
  function parseAssets(value) {
    return uniqueLines(value).map((line, index) => {
      const [assetId, role = "reference", label] = line.split("|").map((part) => part.trim());
      if (!assetId) throw new Error(`Asset line ${index + 1} requires an asset id.`);
      return { assetId, role, ...(label ? { label } : {}) };
    });
  }
  function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "item"; }
  function selected() { return snapshot.kits.find((kit) => kit.id === selectedId) || null; }

  function payload() {
    return {
      name: $("#brand-name").value,
      description: $("#brand-description").value,
      colors: parseColors($("#brand-colors").value),
      fonts: parseFonts($("#brand-fonts").value),
      assets: parseAssets($("#brand-assets").value),
      voice: {
        traits: uniqueLines($("#brand-voice-traits").value),
        preferredPhrases: uniqueLines($("#brand-preferred").value),
        avoidedPhrases: uniqueLines($("#brand-avoided").value),
      },
      guidelines: uniqueLines($("#brand-guidelines").value),
      restrictions: {
        enforceColors: $("#brand-enforce-colors").checked,
        enforceFonts: $("#brand-enforce-fonts").checked,
        requireApprovedBrandAssets: $("#brand-enforce-assets").checked,
        lockedElementRoles: uniqueLines($("#brand-locked").value),
      },
    };
  }

  function beginNew() {
    creating = true;
    selectedId = null;
    $("#brand-kit-form")?.reset();
    $("#brand-enforce-colors").checked = true;
    $("#brand-enforce-fonts").checked = true;
    $("#brand-enforce-assets").checked = true;
    $("#brand-locked").value = "brand\nlegal";
    renderEditor();
    $("#brand-name")?.focus();
  }

  function fillEditor(kit) {
    $("#brand-name").value = kit.name || "";
    $("#brand-description").value = kit.description || "";
    $("#brand-colors").value = (kit.colors || []).map((item) => `${item.label} | ${item.value} | ${item.role}`).join("\n");
    $("#brand-fonts").value = (kit.fonts || []).map((item) => `${item.label} | ${item.family} | ${item.role} | ${(item.weights || []).join(",")}`).join("\n");
    $("#brand-assets").value = (kit.assets || []).map((item) => `${item.assetId} | ${item.role}${item.label ? ` | ${item.label}` : ""}`).join("\n");
    $("#brand-voice-traits").value = (kit.voice?.traits || []).join("\n");
    $("#brand-preferred").value = (kit.voice?.preferredPhrases || []).join("\n");
    $("#brand-avoided").value = (kit.voice?.avoidedPhrases || []).join("\n");
    $("#brand-guidelines").value = (kit.guidelines || []).join("\n");
    $("#brand-locked").value = (kit.restrictions?.lockedElementRoles || []).join("\n");
    $("#brand-enforce-colors").checked = Boolean(kit.restrictions?.enforceColors);
    $("#brand-enforce-fonts").checked = Boolean(kit.restrictions?.enforceFonts);
    $("#brand-enforce-assets").checked = Boolean(kit.restrictions?.requireApprovedBrandAssets);
  }

  function renderEditor() {
    const kit = selected();
    const title = $("#brand-editor-title"), save = $("#brand-save"), active = $("#brand-set-active"), remove = $("#brand-delete"), clear = $("#brand-clear-active");
    if (creating || !kit) {
      if (title) title.textContent = "Create Brand Kit";
      if (save) save.textContent = "Create Brand Kit";
      if (active) active.disabled = true;
      if (remove) remove.disabled = true;
      if (clear) clear.disabled = !snapshot.activeBrandKitId;
      return;
    }
    fillEditor(kit);
    if (title) title.textContent = `Edit ${kit.name}`;
    if (save) save.textContent = "Save Brand Kit";
    if (active) { active.disabled = snapshot.activeBrandKitId === kit.id; active.textContent = snapshot.activeBrandKitId === kit.id ? "Active project brand" : "Set as active project brand"; }
    if (remove) remove.disabled = false;
    if (clear) clear.disabled = !snapshot.activeBrandKitId;
  }

  function render() {
    ensureUi();
    const list = $("#brand-kit-list");
    if (list) {
      list.innerHTML = snapshot.kits.length ? snapshot.kits.map((kit) => {
        const active = kit.id === snapshot.activeBrandKitId;
        return `<button type="button" data-brand-id="${esc(kit.id)}" aria-current="${String(kit.id === selectedId)}"><strong>${active ? "♛ " : ""}${esc(kit.name)}</strong><br><small>${kit.colors.length} colors · ${kit.fonts.length} fonts · ${kit.assets.length} assets${active ? " · ACTIVE" : ""}</small></button>`;
      }).join("") : '<p class="muted">No Brand Kits yet. Create one to govern project identity.</p>';
    }
    const active = $("#brand-studio-active");
    if (active) active.innerHTML = snapshot.activeBrandKit ? `<strong>♛ Active: ${esc(snapshot.activeBrandKit.name)}</strong><span class="muted">${esc(snapshot.activeBrandKit.description || "Project-wide visual and voice constraints are active.")}</span>` : '<strong>No active Brand Kit</strong><span class="muted">Choose a kit to make its constraints available across Forge.</span>';
    renderEditor();
  }

  async function refresh(preferredId) {
    if (!ensureUi()) return;
    snapshot = await api(root);
    if (preferredId && snapshot.kits.some((kit) => kit.id === preferredId)) {
      selectedId = preferredId;
      creating = false;
    } else if (selectedId && !snapshot.kits.some((kit) => kit.id === selectedId)) {
      selectedId = snapshot.activeBrandKitId || snapshot.kits[0]?.id || null;
      creating = !selectedId;
    } else if (!selectedId && snapshot.kits.length && !creating) {
      selectedId = snapshot.activeBrandKitId || snapshot.kits[0].id;
    }
    window.forgeActiveBrandKit = snapshot.activeBrandKit || null;
    window.dispatchEvent(new CustomEvent("forge:brand-kit-ready", { detail: { projectId, brandKit: window.forgeActiveBrandKit, guidance: snapshot.activeGuidance || "" } }));
    render();
  }

  async function saveKit(event) {
    event.preventDefault();
    try {
      const current = selected();
      const value = payload();
      const result = await api(creating || !current ? root : `${root}/${encodeURIComponent(current.id)}`, {
        method: creating || !current ? "POST" : "PUT",
        body: JSON.stringify(value),
      });
      selectedId = result.id;
      creating = false;
      await refresh(result.id);
      notify(`${current ? "Brand Kit saved" : "Brand Kit created"}: ${result.name}.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function setActive() {
    const kit = selected();
    if (!kit) return notify("Choose a Brand Kit first.");
    try {
      await api(`${root}/active`, { method: "POST", body: JSON.stringify({ brandKitId: kit.id }) });
      await refresh(kit.id);
      notify(`${kit.name} is now the authoritative active project Brand Kit. Other Forge offices can use its constraints through their existing proposal/approval boundaries.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function clearActive() {
    if (!snapshot.activeBrandKitId) return;
    if (!window.confirm("Clear the active project Brand Kit? Saved kits remain available, but other offices will no longer receive an active brand constraint.")) return;
    try {
      await api(`${root}/active`, { method: "DELETE", body: "{}" });
      await refresh(selectedId || undefined);
      notify("Active project Brand Kit cleared. Saved Brand Kits were not deleted.", true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  async function deleteKit() {
    const kit = selected();
    if (!kit) return;
    if (!window.confirm(`Delete Brand Kit ${kit.name}? If it is active, Forge will also clear the active-brand selection.`)) return;
    try {
      const result = await api(`${root}/${encodeURIComponent(kit.id)}`, { method: "DELETE" });
      selectedId = null;
      creating = true;
      await refresh();
      beginNew();
      notify(`Brand Kit deleted${result.activeSelectionCleared ? " and active project brand cleared" : ""}.`, true);
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  }

  function boot() {
    ensureStyles();
    if (!ensureUi()) return;
    void refresh().catch((error) => notify(error instanceof Error ? error.message : String(error)));
  }

  window.addEventListener("forge:workspace-ready", () => { if ($("#brand")) void refresh(); });
  window.addEventListener("hashchange", () => { if (location.hash === "#brand") void refresh(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();