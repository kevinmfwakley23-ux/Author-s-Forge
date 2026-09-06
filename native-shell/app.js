(() => {
  "use strict";

  const status = document.getElementById("status");
  const officeList = document.getElementById("office-list");
  const acceptanceNote = document.getElementById("acceptance-note");

  async function invoke(command) {
    const tauri = window.__TAURI__?.core;
    if (!tauri?.invoke) throw new Error("Native Forge bridge is unavailable in this build.");
    return tauri.invoke(command);
  }

  async function boot() {
    try {
      const runtime = await invoke("native_runtime_status");
      renderOffices(runtime.offices || []);

      if (runtime.standaloneAndroidRuntimeReady === true && runtime.requiresRemoteForgeRuntime === false) {
        status.className = "status";
        status.textContent = "Device-local Forge runtime is ready.";
        acceptanceNote.textContent = "Source readiness is enabled. Device workflow acceptance and live-provider certification are still required before public release.";
      } else {
        status.className = "status error";
        status.textContent = "Standalone Android Forge runtime is still under construction. This package is not an accepted private-test build yet.";
        acceptanceNote.textContent = "The build remains blocked until local persistence, secure office credentials, native provider transport, independent office brains and full Forge workflows are operational on-device.";
      }
    } catch (error) {
      status.className = "status error";
      status.textContent = error instanceof Error ? error.message : String(error);
      officeList.innerHTML = "<li>Native office registry unavailable.</li>";
    }
  }

  function renderOffices(offices) {
    officeList.textContent = "";
    for (const office of offices) {
      const item = document.createElement("li");
      const kind = office.optionalAddOn ? "optional add-on" : "Forge core";
      item.textContent = `${office.name} — ${kind}; independent AI brain scope: ${office.brainScope}.`;
      officeList.appendChild(item);
    }
    if (!offices.length) officeList.innerHTML = "<li>No native Forge offices registered.</li>";
  }

  boot();
})();
