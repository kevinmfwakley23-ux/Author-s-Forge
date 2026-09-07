(() => {
  "use strict";

  const status = document.getElementById("status");
  const retry = document.getElementById("retry");
  const progress = document.querySelector(".progress");

  function setStatus(message) {
    status.className = "status";
    status.textContent = String(message || "Starting the private Forge Core on this device…");
  }

  function fail(message) {
    status.className = "status error";
    status.textContent = String(message || "Forge could not start on this device.");
    progress?.setAttribute("data-failed", "true");
    retry.hidden = false;
  }

  retry.addEventListener("click", () => {
    retry.hidden = true;
    progress?.removeAttribute("data-failed");
    setStatus("Restarting the private Forge Core…");
    if (window.__TAURI_INTERNALS__?.invoke) {
      window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "forge-native-retry", payload: null }).catch(() => {
        window.location.reload();
      });
      return;
    }
    window.location.reload();
  });

  // Called by the Android native Activity when embedded Node startup fails.
  window.__forgeNativeBootFailed = fail;
  window.__forgeNativeBootStatus = setStatus;
})();
