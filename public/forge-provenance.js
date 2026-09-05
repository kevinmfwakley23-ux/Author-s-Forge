/* Author's Forge creative provenance inspector. The ledger is hash chained; exported metadata is explicitly not a signed C2PA credential until a conforming signer is integrated. */
(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const root = `/api/projects/${encodeURIComponent(projectId)}/provenance`;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  let state = { records: [], verification: { valid: true, recordCount: 0, headSha256: null } };

  async function api(path) {
    const response = await fetch(path, { headers: { accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Provenance request failed (${response.status}).`);
    return payload;
  }

  function ensureBrandStudioExtension() {
    if (!document.getElementById("dashboard") || document.querySelector('script[data-forge-extension="brand-studio"]')) return;
    const script = document.createElement("script");
    script.src = "/forge-brand-studio.js";
    script.defer = true;
    script.dataset.forgeExtension = "brand-studio";
    document.head.appendChild(script);
  }

  function ensureUi() {
    ensureBrandStudioExtension();
    if (!$("#dashboard") || $("#provenance-room")) return;
    const nav = $(".sidebar nav");
    if (nav) {
      const link = document.createElement("a");
      link.href = "#provenance-room"; link.dataset.route = "provenance-room"; link.textContent = "Provenance";
      const publishing = nav.querySelector('[data-route="publishing"]');
      nav.insertBefore(link, publishing || null);
    }
    const main = document.querySelector("main");
    const footer = main?.querySelector("footer");
    const section = document.createElement("section");
    section.id = "provenance-room"; section.className = "view"; section.dataset.view = ""; section.hidden = true; section.setAttribute("aria-hidden", "true");
    section.innerHTML = `
      <div class="section-title"><div><div class="eyebrow">CREATIVE PROVENANCE</div><h2>Trace how the work was created and changed</h2><p>Forge records hash-linked creative events so authors can distinguish human edits, AI generations, review applications, and future media transformations.</p></div><div class="row"><button id="provenance-refresh" type="button">Verify ledger</button><button id="provenance-export" class="primary" type="button">Export provenance JSON</button></div></div>
      <div id="provenance-error" class="banner error" hidden role="alert"></div>
      <div class="grid"><article class="card"><h3>Integrity</h3><div id="provenance-integrity"></div></article><article class="card"><h3>Content Credentials readiness</h3><p>Forge stores lifecycle actions, AI/human source type, human-oversight mode, content hashes, regions, ingredients, and generation-recipe metadata where available.</p><p class="muted"><b>Current status:</b> C2PA-ready metadata foundation only. Exported JSON is not a signed C2PA manifest and Forge will not label it compliant until a conforming cryptographic signing workflow exists.</p></article></div>
      <article class="card"><h3>Creative history</h3><div id="provenance-list" class="list"></div></article>`;
    if (footer) main.insertBefore(section, footer); else main?.appendChild(section);
    $("#provenance-refresh")?.addEventListener("click", refresh);
    $("#provenance-export")?.addEventListener("click", exportLedger);
    refresh();
  }

  async function refresh() {
    try {
      state = await api(root);
      render();
      const error = $("#provenance-error"); if (error) error.hidden = true;
    } catch (error) {
      const host = $("#provenance-error"); if (host) { host.textContent = error instanceof Error ? error.message : String(error); host.hidden = false; }
    }
  }

  function render() {
    const verification = state.verification || {};
    const integrity = $("#provenance-integrity");
    if (integrity) integrity.innerHTML = `<p><strong>${verification.valid ? "Verified" : "Integrity failure"}</strong></p><p>${Number(verification.recordCount || 0).toLocaleString()} records</p><small class="muted">Head SHA-256: ${esc(verification.headSha256 || "No records yet")}</small>${verification.error ? `<p class="error">${esc(verification.error)}</p>` : ""}`;
    const list = $("#provenance-list");
    const records = Array.isArray(state.records) ? state.records.slice().reverse() : [];
    if (list) list.innerHTML = records.length ? records.map(recordCard).join("") : '<p class="muted">No provenance events recorded yet. Governed creative changes will appear here as they are integrated.</p>';
  }

  function actorLabel(actor) {
    if (!actor) return "unknown";
    if (actor.kind === "ai") return `AI • ${actor.provider}/${actor.model}`;
    if (actor.kind === "human") return `Human • ${actor.role}${actor.displayName ? ` • ${actor.displayName}` : ""}`;
    return `Tool • ${actor.name}${actor.version ? ` ${actor.version}` : ""}`;
  }

  function recordCard(record) {
    const detailPairs = Object.entries(record.details || {}).slice(0, 8).map(([key, value]) => `<small><b>${esc(key)}:</b> ${esc(value)}</small>`).join("<br>");
    return `<article class="memory"><div class="row"><strong>${esc(record.action)} • ${esc(record.sourceType)}</strong><small>${esc(new Date(record.createdAt).toLocaleString())}</small></div><p>${esc(actorLabel(record.actor))}</p><small>${esc(record.asset?.kind)} • ${esc(record.asset?.id)}</small>${detailPairs ? `<details><summary>Event details</summary>${detailPairs}</details>` : ""}<details><summary>Integrity hashes</summary><small>Record: ${esc(record.recordSha256)}</small><br><small>Previous: ${esc(record.previousRecordSha256 || "GENESIS")}</small>${record.beforeSha256 ? `<br><small>Before content: ${esc(record.beforeSha256)}</small>` : ""}${record.afterSha256 ? `<br><small>After content: ${esc(record.afterSha256)}</small>` : ""}</details></article>`;
  }

  async function exportLedger() {
    try {
      const payload = await api(`${root}/export`);
      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `authors-forge-provenance-${projectId}.json`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (error) {
      const host = $("#provenance-error"); if (host) { host.textContent = error instanceof Error ? error.message : String(error); host.hidden = false; }
    }
  }

  window.addEventListener("forge:human-review-applied", refresh);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureUi, { once: true }); else ensureUi();
})();