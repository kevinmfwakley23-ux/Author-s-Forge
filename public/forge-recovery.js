/* Author-visible project package recovery. The server remains the authorization, validation, and durable mutation authority. */
(() => {
  'use strict';

  function ensureChildrenStoryTopicsClient() {
    if (window.forgeChildrenStoryTopics || document.querySelector('script[data-forge-children-topics]')) return;
    const script = document.createElement('script');
    script.src = '/forge-children-topics.js';
    script.defer = true;
    script.dataset.forgeChildrenTopics = 'true';
    document.head.appendChild(script);
  }
  ensureChildrenStoryTopicsClient();

  const projectId = new URLSearchParams(location.search).get('project') || localStorage.getItem('forge-project') || 'forge-studio';
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const projectUrl = (suffix = '') => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  function message(text, ok = false) {
    const target = ok ? $('#success-banner') : $('#error-banner');
    if (!target) return;
    target.textContent = text;
    target.hidden = false;
    const other = ok ? $('#error-banner') : $('#success-banner');
    if (other) other.hidden = true;
    if (ok) setTimeout(() => { target.hidden = true; }, 5000);
  }

  function downloadJson(value, filename) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function ensureRecoveryPanel() {
    const versions = $('#versions');
    const grid = versions?.querySelector('.grid');
    if (!grid || $('#project-recovery-card')) return;
    const card = document.createElement('article');
    card.id = 'project-recovery-card';
    card.className = 'card';
    card.innerHTML = `
      <h3>Restore project package</h3>
      <p>Restore a previously exported Forge project package into this project. The server validates the package and saves a rollback package of your current state before replacement.</p>
      <label for="restore-project-file">Forge package JSON</label>
      <input id="restore-project-file" type="file" accept="application/json,.json">
      <label class="recovery-approval"><input id="restore-project-confirm" type="checkbox"> I understand this replaces the current durable project state and I want Forge to perform this restore.</label>
      <button id="restore-project" type="button">Restore selected package</button>
      <p id="restore-project-status" class="muted" aria-live="polite">No recovery package selected.</p>`;
    grid.appendChild(card);
    $('#restore-project-file')?.addEventListener('change', describeSelectedPackage);
    $('#restore-project')?.addEventListener('click', restoreProject);
  }

  async function describeSelectedPackage() {
    const input = $('#restore-project-file');
    const file = input?.files?.[0];
    const status = $('#restore-project-status');
    if (!status) return;
    if (!file) {
      status.textContent = 'No recovery package selected.';
      return;
    }
    try {
      const raw = await file.text();
      const pkg = JSON.parse(raw);
      const manifest = pkg && typeof pkg === 'object' && !Array.isArray(pkg) ? pkg.manifest : null;
      if (!manifest || typeof manifest !== 'object') throw new Error('Selected JSON does not contain a Forge package manifest.');
      status.textContent = `Selected ${file.name} • project ${String(manifest.projectId ?? 'unknown')} • format v${String(manifest.formatVersion ?? 'unknown')}.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Selected file is not valid JSON.';
    }
  }

  async function restoreProject() {
    const input = $('#restore-project-file');
    const approval = $('#restore-project-confirm');
    const button = $('#restore-project');
    const status = $('#restore-project-status');
    const file = input?.files?.[0];
    if (!file) return message('Select a Forge project package JSON file first.');
    if (!approval?.checked) return message('Acknowledge the recovery warning before restoring project state.');

    if (button) button.disabled = true;
    try {
      const raw = await file.text();
      let pkg;
      try { pkg = JSON.parse(raw); } catch { throw new Error('Selected recovery package is not valid JSON.'); }
      if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('Selected recovery package must be a JSON object.');
      const manifestProjectId = pkg.manifest?.projectId;
      if (typeof manifestProjectId === 'string' && manifestProjectId !== projectId) throw new Error(`Package belongs to project "${manifestProjectId}", not "${projectId}".`);
      const formatVersion = pkg.manifest?.formatVersion ?? 'unknown';
      const confirmed = window.confirm(`Restore ${file.name} into project "${projectId}"? This replaces the current durable project state. Forge will return and download a rollback package containing the state that exists immediately before recovery.`);
      if (!confirmed) {
        if (status) status.textContent = 'Restore cancelled. No project state was changed.';
        return;
      }

      const result = await api(projectUrl('/package/restore'), {
        method: 'POST',
        body: JSON.stringify({ authorApproved: true, package: pkg }),
      });
      if (!result.rollbackPackage || typeof result.rollbackPackage !== 'object') throw new Error('Recovery completed without a rollback package; refusing to report success.');
      const stamp = String(result.rollbackPackage.manifest?.exportedAt || new Date().toISOString()).replace(/[:.]/g, '-');
      downloadJson(result.rollbackPackage, `${projectId}-forge-rollback-${stamp}.json`);

      const versionState = $('#version-state');
      if (versionState) versionState.innerHTML = `<div class="policy"><span>Restored package</span><strong>${esc(file.name)}</strong></div><div class="policy"><span>Format</span><strong>v${esc(formatVersion)}</strong></div><div class="policy"><span>Rollback package</span><strong>Downloaded</strong></div><div class="policy"><span>Project</span><strong>${esc(result.projectId || projectId)}</strong></div>`;
      if (status) status.textContent = 'Restore complete. A rollback package of the pre-restore state was downloaded automatically.';
      input.value = '';
      approval.checked = false;
      message('Project restored from the validated package. Rollback package downloaded.', true);
      $('#refresh')?.click();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Project recovery failed.';
      if (status) status.textContent = text;
      message(text);
    } finally {
      if (button) button.disabled = false;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureRecoveryPanel, { once: true });
  else ensureRecoveryPanel();
})();
