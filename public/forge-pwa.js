/* Author's Forge PWA lifecycle, install UX, and cross-office launcher. No project data is stored here. */
(() => {
  "use strict";

  function currentProjectId() {
    return new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  }

  function officeUrl(port) {
    const protocol = location.protocol === "https:" ? "https:" : "http:";
    const host = location.hostname || "127.0.0.1";
    return `${protocol}//${host}:${port}/?project=${encodeURIComponent(currentProjectId())}`;
  }

  function ensureOfficeLauncher() {
    if (document.getElementById("forge-office-launcher")) return;
    const dashboard = document.getElementById("dashboard");
    if (!dashboard) return;
    const card = document.createElement("article");
    card.id = "forge-office-launcher";
    card.className = "card";
    card.innerHTML = `
      <h3>Creation offices</h3>
      <p class="muted">Open a first-class creation workplace for this same durable Forge project. Start the complete local workplace with <code>npm run forge</code> (or <code>npm run forge:android</code> for LAN/device access).</p>
      <div class="row">
        <a class="forge-office-link" id="open-guided-journal-office" href="${officeUrl(4273)}" target="_blank" rel="noopener">Guided Journal</a>
        <a class="forge-office-link" id="open-workbook-office" href="${officeUrl(4373)}" target="_blank" rel="noopener">Educational Workbooks</a>
        <a class="forge-office-link" id="open-specialized-office" href="${officeUrl(4473)}" target="_blank" rel="noopener">Specialized Creation</a>
      </div>`;
    dashboard.append(card);
    card.querySelectorAll(".forge-office-link").forEach((link) => {
      Object.assign(link.style, {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "44px",
        padding: "10px 14px",
        border: "1px solid #20252b",
        borderRadius: "7px",
        background: "#20252b",
        color: "#fff",
        textDecoration: "none",
        flex: "1 1 180px",
      });
    });
  }

  function ensureUi() {
    ensureOfficeLauncher();
    if (document.getElementById("pwa-status")) return;
    const host = document.querySelector(".top-actions") || document.querySelector(".topbar") || document.body;
    const status = document.createElement("span");
    status.id = "pwa-status";
    status.className = "muted";
    status.setAttribute("role", "status");
    status.textContent = "Preparing Forge app shell…";
    const button = document.createElement("button");
    button.id = "install-forge";
    button.type = "button";
    button.className = "primary";
    button.textContent = "Install Forge";
    button.hidden = true;
    button.addEventListener("click", install);
    host.append(button, status);
  }

  const installButton = () => document.getElementById("install-forge");
  const status = () => document.getElementById("pwa-status");
  let deferredPrompt = null;

  function setStatus(message) {
    const element = status();
    if (element) element.textContent = message;
  }

  function setInstallVisible(visible) {
    const button = installButton();
    if (!button) return;
    button.hidden = !visible;
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      setStatus("Browser offline shell unavailable.");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      setStatus(navigator.onLine ? "Forge shell ready • online" : "Forge shell ready • offline");
    } catch (error) {
      setStatus(`Offline shell unavailable: ${error.message}`);
    }
  }

  async function install() {
    if (!deferredPrompt) {
      setStatus("Use the browser menu to install Forge when the install prompt is unavailable.");
      return;
    }
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    setInstallVisible(false);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setStatus("Forge installed. Open it from your Android home screen.");
    else setStatus("Install dismissed. You can install Forge later from the browser menu.");
  }

  function updateDisplayMode() {
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    if (standalone) {
      setInstallVisible(false);
      setStatus(navigator.onLine ? "Forge app • online" : "Forge app • offline shell");
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setInstallVisible(true);
    setStatus("Forge is ready to install on this device.");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setInstallVisible(false);
    setStatus("Forge installed on this device.");
  });

  window.addEventListener("online", () => setStatus("Forge shell ready • online"));
  window.addEventListener("offline", () => setStatus("Forge shell ready • offline"));
  window.addEventListener("load", () => {
    ensureUi();
    registerServiceWorker();
    updateDisplayMode();
  });

  if (document.readyState !== "loading") {
    ensureUi();
    registerServiceWorker();
    updateDisplayMode();
  }
})();
