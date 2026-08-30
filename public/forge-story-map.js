/* Story Map: visual planning surface derived from the live durable manuscript workspace. */
(() => {
  "use strict";
  const esc = (v) => String(v ?? "").replace(/[&<>\"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[c]));
  const pct = (done, total) => total ? Math.round((done / total) * 100) : 0;
  const books = () => window.forgeWorkspaceState?.books || [];
  function ensureSurface() {
    if (document.querySelector('[data-route="story-map"]')) return;
    const nav = document.querySelector(".sidebar nav");
    const manuscript = document.getElementById("manuscript");
    if (!nav || !manuscript) return;
    const link = document.createElement("a"); link.href = "#story-map"; link.dataset.route = "story-map"; link.textContent = "Story Map";
    const writing = nav.querySelector('[data-route="writing"]'); writing ? writing.insertAdjacentElement("beforebegin", link) : nav.appendChild(link);
    const view = document.createElement("section"); view.id = "story-map"; view.className = "view"; view.dataset.view = ""; view.hidden = true;
    view.innerHTML = `<div class="section-title"><div><div class="eyebrow">STORY MAP</div><h2>See the book before you write it</h2><p>Visual planning derived directly from durable books, chapters, and scenes. No second source of truth.</p></div><div class="row"><button id="story-map-refresh" type="button">Refresh map</button></div></div><div id="story-map-summary" class="metrics"></div><div id="story-map-books" class="story-map-books"></div>`;
    manuscript.insertAdjacentElement("beforebegin", view);
    document.getElementById("story-map-refresh")?.addEventListener("click", render);
  }
  function render() {
    ensureSurface();
    const host = document.getElementById("story-map-books"), summary = document.getElementById("story-map-summary"); if (!host || !summary) return;
    const all = books();
    const chapters = all.flatMap((b) => b.chapters || []), scenes = chapters.flatMap((c) => c.scenes || []);
    const completed = scenes.filter((s) => s.lifecycle === "complete").length;
    summary.innerHTML = [["Books", all.length], ["Chapters", chapters.length], ["Scenes", scenes.length], ["Complete", `${pct(completed, scenes.length)}%`]].map(([label, value]) => `<div class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join("");
    if (!all.length) { host.innerHTML = '<article class="card"><h3>No book structure yet</h3><p class="muted">Create a book, chapters, and scenes in Manuscript. The Story Map will update from that durable state.</p></article>'; return; }
    host.innerHTML = all.map((book) => {
      const bookScenes = (book.chapters || []).flatMap((c) => c.scenes || []), done = bookScenes.filter((s) => s.lifecycle === "complete").length;
      return `<article class="card story-map-book"><div class="section-title"><div><h3>${esc(book.title)}</h3><small>${esc(book.kind || book.lifecycle || "book")} • ${pct(done, bookScenes.length)}% scene completion</small></div></div><div class="story-map-timeline">${(book.chapters || []).map((chapter) => { const cs = chapter.scenes || [], cd = cs.filter((s) => s.lifecycle === "complete").length; return `<section class="story-map-chapter"><header><strong>${esc(chapter.number)}. ${esc(chapter.title)}</strong><span>${pct(cd, cs.length)}%</span></header><div class="story-map-scenes">${cs.length ? cs.map((scene) => `<button type="button" class="story-map-scene ${scene.lifecycle === "complete" ? "complete" : ""}" data-open-scene="${esc(book.id)}|${esc(chapter.id)}|${esc(scene.id)}"><b>${esc(scene.number)}</b><span>${esc(scene.title)}</span><small>${esc(scene.lifecycle)}</small></button>`).join("") : '<span class="muted">No scenes yet.</span>'}</div></section>`; }).join("")}</div></article>`;
    }).join("");
  }
  window.addEventListener("forge:workspace-ready", render);
  window.addEventListener("load", render);
  window.addEventListener("hashchange", () => { if (location.hash === "#story-map") render(); });
  render();
})();
