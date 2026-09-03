/* Author's Forge royal marble interface shell. Presentation only: durable state, routes, forms, and provider boundaries remain owned by the existing Studio runtime. */
(() => {
  "use strict";

  const STORAGE_KEY = "forge-theme";
  const routeIcons = {
    dashboard: "✦", manuscript: "▤", writing: "✒", architecture: "⌘", characters: "♔", world: "♜", research: "⌕",
    editing: "⚒", voice: "❧", art: "▧", cover: "▥", marketing: "◖", publishing: "▣", genome: "◇", health: "✥",
    versions: "▱", settings: "⚙", governance: "♜",
  };
  const routeOrder = [
    "dashboard", "manuscript", "writing", "architecture",
    "characters", "world", "research", "genome",
    "editing", "voice", "health",
    "art", "cover",
    "publishing", "marketing",
    "versions", "settings", "governance",
  ];
  const wingStarts = new Map([
    ["dashboard", "CREATE"],
    ["characters", "WORLD & CANON"],
    ["editing", "REFINE"],
    ["art", "VISUALS"],
    ["publishing", "PUBLISH"],
    ["marketing", "PROMOTE"],
    ["versions", "VAULT"],
  ]);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

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
    if (!button) return;
    button.setAttribute("aria-pressed", String(value === "dark"));
    button.setAttribute("aria-label", `Switch to ${value === "dark" ? "light" : "dark"} mode`);
    button.title = `Switch to ${value === "dark" ? "light" : "dark"} mode`;
    const label = button.querySelector("[data-theme-label]");
    if (label) label.textContent = value === "dark" ? "Dark" : "Light";
  }

  function ensureThemeToggle() {
    const host = document.querySelector(".top-actions") || document.querySelector(".topbar");
    if (!host || document.getElementById("forge-theme-toggle")) return;
    const button = document.createElement("button");
    button.id = "forge-theme-toggle";
    button.type = "button";
    button.className = "forge-theme-toggle";
    button.innerHTML = `<span class="theme-sun" aria-hidden="true">☀</span><span data-theme-label>Light</span><span class="theme-moon" aria-hidden="true">☾</span>`;
    button.addEventListener("click", () => applyTheme(document.documentElement.dataset.forgeTheme === "dark" ? "light" : "dark"));
    host.prepend(button);
  }

  function ensureRuntimeStyles() {
    if (document.getElementById("forge-royal-runtime-styles")) return;
    const style = document.createElement("style");
    style.id = "forge-royal-runtime-styles";
    style.textContent = `
      .forge-current-project{display:grid!important;grid-template-columns:112px minmax(0,1fr) auto!important;align-items:center!important;gap:24px!important}
      .forge-current-cover{width:112px;height:168px;border:1px solid var(--forge-border-strong);border-radius:5px 9px 9px 5px;overflow:hidden;background:var(--forge-black-soft);box-shadow:0 12px 24px rgba(38,26,12,.18);align-self:center}
      .forge-current-cover img{display:block;width:100%;height:100%;object-fit:cover}
      .forge-current-cover .forge-book-generated{height:100%}
      .forge-current-project .hero-actions{display:grid;gap:9px;min-width:190px}
      .forge-current-project .hero-actions button{width:100%;white-space:nowrap}
      .forge-current-project .hero-actions .primary{min-height:48px;font-family:Georgia,serif;letter-spacing:.035em}
      @media(max-width:900px){.forge-current-project{grid-template-columns:92px minmax(0,1fr)!important}.forge-current-cover{width:92px;height:138px}.forge-current-project .hero-actions{grid-column:1/-1;display:flex;min-width:0}.forge-current-project .hero-actions button{flex:1}}
      @media(max-width:560px){.forge-current-project{grid-template-columns:1fr!important}.forge-current-cover{width:86px;height:129px}.forge-current-project .hero-actions{display:grid}.forge-current-project .hero-actions button{width:100%}}
    `;
    document.head.append(style);
  }

  function decorateNavigation() {
    const nav = document.querySelector(".sidebar nav");
    if (!nav || nav.dataset.royalDecorated === "true") return;
    nav.dataset.royalDecorated = "true";

    const links = new Map([...nav.querySelectorAll("a[data-route]")].map((link) => [link.dataset.route, link]));
    const seriesLink = document.getElementById("open-series-engine");
    for (const route of routeOrder) {
      const link = links.get(route);
      if (!link) continue;
      nav.append(link);
      if (route === "research" && seriesLink) nav.append(seriesLink);
    }

    [...nav.querySelectorAll("a[data-route]")].forEach((link) => {
      const route = link.dataset.route;
      if (wingStarts.has(route)) {
        const heading = document.createElement("div");
        heading.className = "forge-nav-heading";
        heading.textContent = wingStarts.get(route);
        link.before(heading);
      }
      link.dataset.icon = routeIcons[route] || "•";
    });

    const brand = document.querySelector(".brand");
    if (brand && !brand.querySelector(".brand-quill")) {
      brand.innerHTML = `<span class="brand-quill" aria-hidden="true">❧</span><span class="brand-word">AUTHOR'S</span><strong>FORGE</strong><span class="brand-rule" aria-hidden="true"></span>`;
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
    const candidates = [book?.coverUrl, book?.coverImage, book?.cover?.frontUrl, book?.cover?.imageUrl, book?.artwork?.coverUrl, book?.metadata?.coverUrl];
    return candidates.find((value) => typeof value === "string" && /^(https?:|data:|\/)/.test(value)) || "";
  }

  function generatedCover(book) {
    const title = String(book?.title || "Untitled book");
    const kind = String(book?.kind || "book").replaceAll("-", " ");
    const chapters = Array.isArray(book?.chapters) ? book.chapters.length : 0;
    return `<div class="forge-book-generated"><span class="forge-book-crown" aria-hidden="true">♛</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(kind)}</small><span class="forge-book-count">${chapters} chapter${chapters === 1 ? "" : "s"}</span></div>`;
  }

  function renderCurrentProject(workspace) {
    const hero = document.querySelector("#dashboard .hero");
    const books = Array.isArray(workspace?.books) ? workspace.books : [];
    if (!hero || !books.length) return;
    const book = books.find((item) => item.id === workspace?.activeBookId) || books[0];
    const cover = possibleCover(book);
    let coverHost = hero.querySelector(".forge-current-cover");
    if (!coverHost) {
      coverHost = document.createElement("div");
      coverHost.className = "forge-current-cover";
      hero.prepend(coverHost);
    }
    coverHost.innerHTML = cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(book.title || "Current book")} cover">` : generatedCover(book);

    const copy = [...hero.children].find((child) => child !== coverHost && !child.classList?.contains("hero-actions"));
    const eyebrow = copy?.querySelector(".eyebrow");
    const title = copy?.querySelector("h2");
    const description = copy?.querySelector("p");
    if (eyebrow) eyebrow.textContent = "CURRENT PROJECT";
    if (title) title.textContent = String(book.title || document.getElementById("project-title")?.textContent || "Current project");
    if (description) {
      const chapters = Array.isArray(book.chapters) ? book.chapters.length : 0;
      const meta = document.getElementById("project-meta")?.textContent?.trim();
      description.textContent = `${String(book.kind || "book").replaceAll("-", " ")} · ${chapters} chapter${chapters === 1 ? "" : "s"}${meta ? ` · ${meta}` : ""}`;
    }
    const actions = hero.querySelector(".hero-actions");
    const buttons = actions ? [...actions.querySelectorAll("button")] : [];
    if (buttons[0]) {
      buttons[0].dataset.route = "writing";
      buttons[0].classList.add("primary");
      buttons[0].textContent = "✒ Continue Forging";
    }
    if (buttons[1]) {
      buttons[1].dataset.route = "health";
      buttons[1].textContent = "Project Health";
    }
  }

  function renderShelf(workspace) {
    const shelf = document.getElementById("forge-book-shelf");
    if (!shelf) return;
    const books = Array.isArray(workspace?.books) ? workspace.books : [];
    renderCurrentProject(workspace);
    if (!books.length) {
      shelf.innerHTML = `<div class="forge-shelf-empty"><span aria-hidden="true">✒</span><strong>Your forged works will appear here.</strong><small>Create a book to begin the shelf.</small></div>`;
      return;
    }
    shelf.innerHTML = books.slice(0, 7).map((book, index) => {
      const title = String(book?.title || `Book ${index + 1}`);
      const cover = possibleCover(book);
      return `<article class="forge-book" title="${escapeHtml(title)}">${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(title)} cover">` : generatedCover(book)}</article>`;
    }).join("");
  }

  function polishDashboard() {
    const dashboard = document.getElementById("dashboard");
    if (!dashboard) return;
    dashboard.classList.add("royal-dashboard");
    dashboard.querySelector(".hero")?.classList.add("forge-current-project");
    document.getElementById("metrics")?.setAttribute("aria-label", "Forge status");
    document.querySelector("#dashboard .command-inline")?.closest(".card")?.classList.add("forge-command-card");
  }

  function addSidebarSeal() {
    const sidebar = document.querySelector(".sidebar");
    const status = document.querySelector(".local-status");
    if (!sidebar || !status || document.getElementById("forge-sidebar-seal")) return;
    const seal = document.createElement("div");
    seal.id = "forge-sidebar-seal";
    seal.className = "forge-sidebar-seal";
    seal.innerHTML = `<span class="seal-crest" aria-hidden="true">♛</span><span>Every great story<br><strong>is forged, not found.</strong></span>`;
    sidebar.insertBefore(seal, status);
  }

  function enhance() {
    applyTheme(currentTheme(), false);
    ensureRuntimeStyles();
    decorateNavigation();
    createMasthead();
    ensureThemeToggle();
    addSidebarSeal();
    polishDashboard();
    renderShelf(window.forgeWorkspaceState);
  }

  window.addEventListener("forge:workspace-ready", (event) => renderShelf(event.detail || window.forgeWorkspaceState));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance, { once: true });
  else enhance();
})();