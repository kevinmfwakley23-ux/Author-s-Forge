(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const officeList = $("office-list");
  const acceptanceNote = $("acceptance-note");
  const projectForm = $("project-form");
  const projectStatus = $("project-status");
  const projectList = $("project-list");
  const providerForm = $("provider-form");
  const providerStatus = $("provider-status");
  const restoreProviders = $("restore-providers");
  const generationForm = $("generation-form");
  const generationStatus = $("generation-status");
  const generationOutput = $("generation-output");

  async function invoke(command, args = {}) {
    const tauri = window.__TAURI__?.core;
    if (!tauri?.invoke) throw new Error("Native Forge bridge is unavailable in this build.");
    return tauri.invoke(command, args);
  }

  function show(target, message, error = false) {
    if (!target) return;
    target.className = error ? "status error" : "status";
    target.textContent = message;
  }

  async function boot() {
    try {
      const runtime = await invoke("native_runtime_status");
      renderOffices(runtime.offices || []);

      if (runtime.standaloneAndroidRuntimeReady === true && runtime.requiresRemoteForgeRuntime === false) {
        show(status, "Device-local Forge runtime is ready.");
        acceptanceNote.textContent = "Source readiness is enabled. Device workflow acceptance and live-provider certification are still required before public release.";
      } else {
        show(status, "Standalone Android Forge runtime is still under construction. Native project storage, encrypted provider setup and office-brain transport are active foundations, but this package is not an accepted private-test build yet.", true);
        acceptanceNote.textContent = "The build remains blocked until every Main Forge and attached-office workflow has on-device parity, recovery/import/export coverage, restart proof and device-level acceptance.";
      }
      await refreshProjects();
    } catch (error) {
      show(status, error instanceof Error ? error.message : String(error), true);
      officeList.innerHTML = "<li>Native office registry unavailable.</li>";
    }
  }

  function renderOffices(offices) {
    officeList.textContent = "";
    for (const office of offices) {
      const item = document.createElement("li");
      const attachment = office.attachedByDefault ? "attached by default" : "not attached";
      const brain = office.separateLiveBrain ? `separate live brain: ${office.brainScope}` : "shared brain";
      item.textContent = `${office.name} — ${attachment}; ${brain}.`;
      officeList.appendChild(item);
    }
    if (!offices.length) officeList.innerHTML = "<li>No native Forge offices registered.</li>";
  }

  async function refreshProjects() {
    const projects = await invoke("forge_native_project_list");
    projectList.textContent = "";
    if (!projects.length) {
      projectList.innerHTML = '<p class="muted">No device-local Forge projects yet.</p>';
      return;
    }
    for (const project of projects) {
      const row = document.createElement("article");
      row.className = "project-row";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = project.title;
      const meta = document.createElement("small");
      const updated = Number.isFinite(project.updatedAtMs) ? new Date(project.updatedAtMs).toLocaleString() : "unknown update time";
      meta.textContent = `${project.id} · updated ${updated}`;
      copy.append(title, meta);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger compact-button";
      remove.dataset.projectId = project.id;
      remove.textContent = "Delete";
      row.append(copy, remove);
      projectList.appendChild(row);
    }
  }

  projectForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = $("project-id").value.trim();
    const title = $("project-title").value.trim();
    show(projectStatus, "Persisting project on this device…");
    try {
      await invoke("forge_native_project_put", {
        project: {
          id,
          title,
          state: {
            formatVersion: 1,
            title,
            offices: {
              studio: { attached: true },
              journal: { attached: true },
              workbooks: { attached: true },
              specialized: { attached: true },
              nft: { attached: true }
            }
          }
        }
      });
      show(projectStatus, `Saved ${title} in device-local Forge storage.`);
      projectForm.reset();
      await refreshProjects();
    } catch (error) {
      show(projectStatus, error instanceof Error ? error.message : String(error), true);
    }
  });

  projectList?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-project-id]");
    if (!button) return;
    const projectId = button.dataset.projectId;
    show(projectStatus, `Deleting ${projectId}…`);
    try {
      await invoke("forge_native_project_delete", { projectId });
      show(projectStatus, `Deleted ${projectId} from device-local Forge storage.`);
      await refreshProjects();
    } catch (error) {
      show(projectStatus, error instanceof Error ? error.message : String(error), true);
    }
  });

  function providerConfiguration() {
    const apiKey = $("provider-api-key").value.trim();
    const baseUrl = $("provider-base-url").value.trim();
    const models = $("provider-models").value.split(",").map((value) => value.trim()).filter(Boolean);
    return {
      officeId: $("provider-office").value,
      provider: $("provider-name").value,
      baseUrl: baseUrl || null,
      apiKey: apiKey || null,
      models,
      billingClass: $("provider-billing").value,
      quotaLimit: null,
      remainingTokens: null
    };
  }

  providerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const configuration = providerConfiguration();
    const vaultPassword = $("vault-password").value;
    show(providerStatus, `Encrypting and configuring ${configuration.provider} for ${configuration.officeId}…`);
    try {
      const brain = await invoke("forge_native_secure_configure_provider", { configuration, vaultPassword });
      $("provider-api-key").value = "";
      show(providerStatus, `${configuration.provider} is configured for ${configuration.officeId}; broker ${brain.brokerInstanceId} owns this office route.`);
    } catch (error) {
      show(providerStatus, error instanceof Error ? error.message : String(error), true);
    }
  });

  restoreProviders?.addEventListener("click", async () => {
    const vaultPassword = $("vault-password").value;
    show(providerStatus, "Unlocking encrypted provider vault…");
    try {
      const brains = await invoke("forge_native_secure_restore_providers", { vaultPassword });
      const configured = brains.reduce((total, brain) => total + Object.values(brain.providers || {}).filter((provider) => provider.configured).length, 0);
      show(providerStatus, `Restored ${configured} encrypted office-provider configuration${configured === 1 ? "" : "s"} into ${brains.length} isolated office brains.`);
    } catch (error) {
      show(providerStatus, error instanceof Error ? error.message : String(error), true);
    }
  });

  generationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    generationOutput.textContent = "";
    const officeId = $("generation-office").value;
    const preferProvider = $("generation-provider").value || null;
    show(generationStatus, `Routing native request through ${officeId}…`);
    try {
      const result = await invoke("forge_native_generate_text", {
        request: {
          officeId,
          system: $("generation-system").value,
          user: $("generation-prompt").value,
          temperature: 0.7,
          maxOutputTokens: 1200,
          preferProvider,
          preferModel: null
        }
      });
      generationOutput.textContent = result.text;
      show(generationStatus, `${result.provider}/${result.model} completed with ${result.usage.totalTokens} accounted tokens.`);
    } catch (error) {
      show(generationStatus, error instanceof Error ? error.message : String(error), true);
    }
  });

  boot();
})();
