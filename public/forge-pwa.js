/* Author's Forge PWA lifecycle and install UX. No project data is stored here. */
(() => {
  "use strict";

  function ensureUi() {
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
