(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const projectId = params.get("project") || "forge-studio";
  const apiBase = `/api/projects/${encodeURIComponent(projectId)}/execution`;
  const hostedPrefix = location.pathname.startsWith("/execution/") ? "/execution" : "";
  const api = (path = "") => `${hostedPrefix}${apiBase}${path}`;
  const back = $("#back-to-studio");
  if (back) back.href = hostedPrefix ? `/?project=${encodeURIComponent(projectId)}` : `${location.protocol}//${location.hostname}:4173/?project=${encodeURIComponent(projectId)}`;

  function setMessage(kind, message) {
    const error = $("#execution-error"), success = $("#execution-success");
    if (error) error.hidden = true;
    if (success) success.hidden = true;
    const target = kind === "error" ? error : success;
    if (target) { target.textContent = message; target.hidden = false; }
  }

  async function request(path = "", options = {}) {
    const response = await fetch(api(path), {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
    const text = await response.text();
    let value = {};
    if (text) {
      try { value = JSON.parse(text); } catch { value = { error: text }; }
    }
    if (!response.ok) throw new Error(value.error || `${response.status} ${response.statusText}`);
    return value;
  }

  function lines(value) {
    return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function renderProviders(providers) {
    const select = $("#execution-provider"), status = $("#execution-provider-status");
    if (select) {
      select.innerHTML = "";
      for (const provider of providers) {
        const option = document.createElement("option");
        option.value = provider.kind;
        option.textContent = `${provider.kind}${provider.available ? " • available" : " • unavailable"}`;
        option.disabled = !provider.available;
        select.append(option);
      }
      if (!providers.some((provider) => provider.available)) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No execution provider configured";
        option.selected = true;
        select.append(option);
      }
    }
    if (status) status.innerHTML = providers.length
      ? providers.map((provider) => `<div class="list-item"><strong>${escapeHtml(provider.kind)}</strong><span>${provider.available ? "Available" : "Configured but disabled/unavailable"}</span></div>`).join("")
      : '<p class="muted">No execution provider is configured on this Forge host. Configure an approved local Linux workspace or a server-side sandbox provider.</p>';
  }

  function commandSummary(job) {
    return job.plan.commands.map((command) => {
      const args = (command.args || []).map((arg) => JSON.stringify(arg)).join(" ");
      return `${command.program}${args ? ` ${args}` : ""}${command.cwd ? `\n  cwd: ${command.cwd}` : ""}\n  timeout: ${command.timeoutSeconds || 120}s`;
    }).join("\n");
  }

  function evidenceHtml(job) {
    if (!job.evidence) return job.failure ? `<pre>${escapeHtml(job.failure)}</pre>` : "";
    const commands = job.evidence.commands.map((command, index) => `<details><summary>Command ${index + 1}: ${escapeHtml(command.program)} • exit ${command.exitCode}</summary><h4>stdout</h4><pre>${escapeHtml(command.stdout || "")}</pre><h4>stderr</h4><pre>${escapeHtml(command.stderr || "")}</pre></details>`).join("");
    return `<div class="muted">Provider: ${escapeHtml(job.evidence.provider)}${job.evidence.sandboxId ? ` • sandbox ${escapeHtml(job.evidence.sandboxId)}` : ""} • ${escapeHtml(job.evidence.startedAt)} → ${escapeHtml(job.evidence.finishedAt)}</div>${commands}${job.failure ? `<pre>${escapeHtml(job.failure)}</pre>` : ""}`;
  }

  function renderJobs(jobs) {
    const host = $("#execution-jobs");
    if (!host) return;
    if (!jobs.length) {
      host.innerHTML = '<article class="card"><p class="muted">No execution proposals exist for this project.</p></article>';
      return;
    }
    host.innerHTML = jobs.slice().reverse().map((job) => {
      const domains = (job.plan.networkDomains || []).join(", ") || "blocked / none requested";
      const actions = job.status === "pending"
        ? `<div class="row"><button class="primary" data-execution-approve="${escapeHtml(job.id)}">Approve exact plan</button><button data-execution-reject="${escapeHtml(job.id)}">Reject</button></div>`
        : job.status === "approved"
          ? `<div class="row"><button class="primary" data-execution-run="${escapeHtml(job.id)}">Run approved job</button><button data-execution-reject="${escapeHtml(job.id)}">Reject before run</button></div>`
          : "";
      return `<article class="card" data-execution-job="${escapeHtml(job.id)}"><div class="section-title"><div><div class="eyebrow">${escapeHtml(job.status.toUpperCase())} • ${escapeHtml(job.requestedBy.toUpperCase())} REQUEST</div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.plan.purpose)}</p></div></div><p><strong>Provider:</strong> ${escapeHtml(job.plan.provider)}<br><strong>Network:</strong> ${escapeHtml(domains)}<br><strong>Plan digest:</strong> <code>${escapeHtml(job.planDigest)}</code></p><pre>${escapeHtml(commandSummary(job))}</pre>${actions}${evidenceHtml(job)}</article>`;
    }).join("");
  }

  async function refresh() {
    try {
      const snapshot = await request();
      renderProviders(snapshot.providers || []);
      renderJobs(snapshot.jobs || []);
    } catch (error) {
      setMessage("error", error.message);
    }
  }

  $("#execution-proposal-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const provider = String(form.get("provider") || "");
    if (!provider) return setMessage("error", "Configure an available execution provider before proposing a job.");
    const timeout = Number(form.get("timeoutSeconds") || 120);
    try {
      const job = await request("/proposals", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title") || ""),
          requestedBy: "author",
          plan: {
            provider,
            purpose: String(form.get("purpose") || ""),
            commands: [{ program: String(form.get("program") || ""), args: lines(form.get("args")), cwd: String(form.get("cwd") || ""), timeoutSeconds: timeout }],
            networkDomains: lines(form.get("networkDomains")),
          },
        }),
      });
      setMessage("success", `Pending execution proposal ${job.id} created. Nothing has run.`);
      event.currentTarget.reset();
      await refresh();
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  $("#execution-jobs")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const approve = button.dataset.executionApprove;
    const reject = button.dataset.executionReject;
    const run = button.dataset.executionRun;
    try {
      if (approve) {
        const card = button.closest("[data-execution-job]");
        const exactPlan = card?.querySelector("pre")?.textContent || "the displayed plan";
        if (!confirm(`Approve this exact execution plan?\n\n${exactPlan}\n\nApproval is locked to its SHA-256 digest.`)) return;
        await request(`/${encodeURIComponent(approve)}/approve`, { method: "POST", body: "{}" });
        setMessage("success", "Exact execution plan approved. It has still not run.");
      } else if (reject) {
        const reason = prompt("Why are you rejecting this execution job?", "Rejected by author.");
        if (reason === null) return;
        await request(`/${encodeURIComponent(reject)}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
        setMessage("success", "Execution job rejected. It cannot run.");
      } else if (run) {
        if (!confirm("Run the exact author-approved plan now? Tool output will remain evidence and will not silently alter manuscript, canon, or artwork.")) return;
        const result = await request(`/${encodeURIComponent(run)}/run`, { method: "POST", body: "{}" });
        setMessage(result.status === "succeeded" ? "success" : "error", result.status === "succeeded" ? "Execution completed successfully. Review the evidence below." : `Execution finished with status ${result.status}: ${result.failure || "review command evidence"}`);
      }
      await refresh();
    } catch (error) {
      setMessage("error", error.message);
      await refresh();
    }
  });

  $("#refresh-execution")?.addEventListener("click", refresh);
  refresh();
})();
