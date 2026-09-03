/* Author's Forge royal marble interface shell. Presentation only: durable state, routes, forms, and provider boundaries remain owned by the existing Studio runtime. */
(() => {
  "use strict";

  const STORAGE_KEY = "forge-theme";
  const routeIcons = {
    dashboard: "✦", manuscript: "▤", writing: "✒", architecture: "⌘", characters: "♔", world: "♜", research: "⌕",
    editing: "⚒", voice: "❧", art: "▧", cover: "▥", marketing: "◖", publishing: "▣", genome: "◇", health: "✥",
    versions: "▱", settings: "⚙", governance: "♜",
  };
  const wingStarts = [
    ["dashboard", "CREATE"],
    ["characters", "WORLD & CANON"],
    ["editing", "REFINE"],
    ["art", "VISUALS"],
    ["publishing", "PUBLISH"],
    ["marketing", "PROMOTE"],
    ["versions", "VAULT"],
  ];

  function currentTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function applyTheme(theme, persist = true) {
    const value = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.forgeTheme = value;
    document.documentElement.style.colorScheme = value;
    if (persist) localStorage.setItem(STORAGE_KEY, value);
    const button = document.getElementById("forge-theme-toggle");
    if (button) {
      button.setAttribute("aria-pressed", String(value === "dark"));
      button.setAttribute("aria-label", `Switch to ${value === "dark" ? "light" : "dark"} mode`);
      button.title = `Switch to ${value === "dark" ? "light" : "dark"} mode`;
      const label = button.querySelector("[data-theme-label]");
      if (label) label.textContent = value === "dark" ? "Dark" : "Light";
    }
  }

  function ensureThemeToggle() {
    const host = document.querySelector(".top-actions") || document.querySelector(".topbar");
    if (!host || document.getElementById("forge-theme-toggle")) return;
    const button = document.createElement("button");
    button.id = "forge-theme-toggle";
    button.type = "button";
    button.className = "forge-theme-toggle";
    button.innerHTML = '<span class="theme-sun" aria-hidden="true">☀</span><span data-theme-label>Light</span><span class="theme-moon" aria-hidden="true">☾</span>';
    button.addEventListener("click", () => applyTheme(document.documentElement.dataset.forgeTheme === "dark" ? "light" : "dark"));
    host.prepend(button);
  }

  function decorateNavigation() {
    const nav = document.querySelector(".sidebar nav");
    if (!nav || nav.dataset.royalDecorated === "true") return;
    nav.dataset.royalDecorated = "true";
    const starts = new Map(wingStarts);
    [...nav.querySelectorAll("a[data-route]")].forEach((link) => {
      const route = link.dataset.route;
      if (starts.has(route)) {
        const heading = document.createElement("div");
        heading.className = "forge-nav-heading";
        heading.textContent = starts.get(route);
        link.before(heading);
      }
      link.dataset.icon = routeIcons[route] || "•";
    });
    const brand = document.querySelector(".brand");
    if (brand && !brand.querySelector(".brand-quill")) {
      brand.innerHTML = '<span class="brand-quill" aria-hidden="true">❧</span><span class="brand-word">AUTHOR\'S</span><strong>FORGE</strong><span class="brand-rule" aria-hidden="true"></span>';
    }
    const tag = document.querySelector(".tag");
    if (tag) tag.textContent = "Shape stories. Forge legacies.";
  }

  function createMasthead() {
    if (document.getElementById("forge-masthead")) return;
    const main = document.querySelector("main");
    const topbar = document.querySelector(".topbar");
    if (!main || !topbar) return;
    const masthead = document.createElement("section");
    masthead.id = "forge-masthead";
    masthead.className = "forge-masthead";
    masthead.setAttribute("aria-label", "Forged works");
    masthead.innerHTML = `
      <div class="forge-shelf-wrap">
        <div class="forge-shelf-kicker">BOOKS FORGED · WORLDS REMEMBERED</div>
        <div id="forge-book-shelf" class="forge-book-shelf"><div class="forge-shelf-empty">Your forged works will appear here.</div></div>
        <div class="forge-shelf"><span class="forge-crown" aria-hidden="true">♛</span></div>
      </div>
      <div class="forge-title-lockup">
        <span aria-hidden="true" class="forge-title-rule"></span>
        <div><h1>AUTHOR'S FORGE</h1><p>SHAPE STORIES. FORGE LEGACIES.</p></div>
        <span aria-hidden="true" class="forge-title-rule"></span>
      </div>`;
    main.insertBefore(masthead, topbar);
  }

  function possibleCover(book) {
    const candidates = [
      book?.coverUrl,
      book?.coverImage,
      book?.cover?.frontUrl,
      book?.cover?.imageUrl,
      book?.artwork?.coverUrl,
      book?.metadata?.coverUrl,
    ];
    return candidates.find((value) => typeof value === "string" && /^(https?:|data:|\/)/.test(value)) || "";
  }

  function renderShelf(workspace) {
    const shelf = document.getElementById("forge-book-shelf");
    if (!shelf) return;
    const books = Array.isArray(workspace?.books) ? workspace.books : [];
    if (!books.length) {
      shelf.innerHTML = '<div class="forge-shelf-empty"><span aria-hidden="true">✒</span><strong>Your forged works will appear here.</strong><small>Create a book to begin the shelf.</small></div>';
      return;
    }
    shelf.innerHTML = books.slice(0, 7).map((book, index) => {
      const title = String(book?.title || `Book ${index + 1}`);
      const kind = String(book?.kind || "book").replaceAll("-", " ");
      const cover = possibleCover(book);
      const chapters = Array.isArray(book?.chapters) ? book.chapters.length : 0;
      return `<article class="forge-book" title="${escapeHtml(title)}">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(title)} cover">` : `<div class="forge-book-generated"><span class="forge-book-crown" aria-hidden="true">♛</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(kind)}</small><span class="forge-book-count">${chapters} chapter${chapters === 1 ? "" : "s"}</span></div>`}
      </article>`;
    }).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" }[char]));
  }

  function polishDashboard() {
    const dashboard = document.getElementById("dashboard");
    if (!dashboard) return;
    dashboard.classList.add("royal-dashboard");
    const hero = dashboard.querySelector(".hero");
    if (hero) hero.classList.add("forge-current-project");
    const metrics = document.getElementById("metrics");
    if (metrics) metrics.setAttribute("aria-label", "Forge status");
    const command = document.querySelector("#dashboard .command-inline")?.closest(".card");
    if (command) command.classList.add("forge-command-card");
  }

  function addSidebarSeal() {
    const sidebar = document.querySelector(".sidebar");
    const status = document.querySelector(".local-status");
    if (!sidebar || !status || document.getElementById("forge-sidebar-seal")) return;
    const seal = document.createElement("div");
    seal.id = "forge-sidebar-seal";
    seal.className = "forge-sidebar-seal";
    seal.innerHTML = '<span class="seal-crest" aria-hidden="true">♛</span><span>Every great story<br><strong>is forged, not found.</strong></span>';
    sidebar.insertBefore(seal, status);
  }

  function enhance() {
    applyTheme(currentTheme(), false);
    decorateNavigation();
    createMasthead();
    ensureThemeToggle();
    addSidebarSeal();
    polishDashboard();
    renderShelf(window.forgeWorkspaceState);
  }

  window.addEventListener("forge:workspace-ready", (event) => renderShelf(event.detail));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance, { once: true });
  else enhance();
})();