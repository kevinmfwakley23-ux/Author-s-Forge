(() => {
  "use strict";
  const strategy = document.querySelector('#nft-view-strategy');
  const projectInput = document.querySelector('#nft-project-id');
  const collectionList = document.querySelector('#nft-collection-list');
  const status = document.querySelector('#nft-status');
  if (!strategy || !projectInput || !collectionList || !status || document.querySelector('#nft-strategy-market-panel')) return;

  const panel = document.createElement('article');
  panel.id = 'nft-strategy-market-panel';
  panel.className = 'nft-panel';
  panel.innerHTML = `<div class="nft-row"><div class="grow"><h3>Market Signal Lab · live source-backed research</h3><p class="nft-muted">Research current public audience, marketplace, comparable-category, launch, reveal, and collector-communication signals before finalizing positioning. This is evidence—not a demand, price, or investment forecast. Hosted web research runs only when your Forge AI control explicitly permits its cost.</p></div><span class="nft-pill">working evidence</span></div><form id="nft-strategy-market-form" class="nft-form"><div class="nft-two"><label>Collection<select id="nft-strategy-market-collection" required></select></label><label>Focus<input name="focus" placeholder="e.g. original fantasy art collectors, Base drops, reveal strategy"></label></div><button class="primary" type="submit">Research current market signals</button></form><div id="nft-strategy-market-output" class="nft-list" style="margin-top:12px"><p class="nft-muted">No market research run yet.</p></div>`;
  strategy.append(panel);

  const form = panel.querySelector('#nft-strategy-market-form');
  const select = panel.querySelector('#nft-strategy-market-collection');
  const output = panel.querySelector('#nft-strategy-market-output');
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])); }
  function projectId() { const id = projectInput.value.trim() || new URLSearchParams(location.search).get('project') || localStorage.getItem('forge-project') || ''; if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Open a valid Forge project first.'); return id; }
  function refreshCollections() {
    const prior = select.value;
    const rows = [...collectionList.querySelectorAll('[data-open-nft]')].map((button) => ({ id: button.dataset.openNft, title: button.querySelector('strong')?.textContent?.trim() || button.dataset.openNft })).filter((item) => item.id);
    select.innerHTML = rows.length ? rows.map((item) => `<option value="${esc(item.id)}">${esc(item.title)} · ${esc(item.id)}</option>`).join('') : '<option value="">No collection available</option>';
    if (rows.some((item) => item.id === prior)) select.value = prior;
    else { const currentTitle = document.querySelector('#nft-current-title')?.textContent?.trim(); const current = rows.find((item) => item.title === currentTitle); if (current) select.value = current.id; }
  }
  function render(report) {
    output.innerHTML = `<div class="nft-list-item"><div class="nft-row"><strong class="grow">Source-backed market evidence</strong><span class="nft-pill">${report.claims?.length || 0} claim(s)</span></div><p class="nft-muted">${esc(report.note)}</p></div>${(report.claims || []).map((claim) => `<article class="nft-list-item"><div class="nft-row"><strong class="grow">${esc(claim.source)}</strong><span class="nft-pill">${esc(claim.date)}</span><span class="nft-pill">${esc(claim.confidence)} confidence</span></div><p>${esc(claim.claim)}</p><a href="${esc(claim.url)}" target="_blank" rel="noopener noreferrer">Open source</a></article>`).join('')}<article class="nft-list-item"><strong>Positioning questions</strong><ul>${(report.positioningQuestions || []).map((question) => `<li>${esc(question)}</li>`).join('')}</ul></article>`;
  }
  async function research(event) {
    event.preventDefault();
    const collectionId = select.value;
    if (!collectionId) throw new Error('Choose an NFT collection first.');
    status.textContent = 'Running governed live NFT market research. Source-backed claims will be persisted as working Project Brain evidence…';
    const data = new FormData(form);
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId())}/nft/${encodeURIComponent(collectionId)}/market-research`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ focus: String(data.get('focus') || '').trim() }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Market research failed (${response.status}).`);
    render(payload);
    status.textContent = `Market Signal Lab saved ${payload.claims?.length || 0} source-backed claim(s) to working Project Brain evidence. No demand or price prediction was made.`;
  }

  form.addEventListener('submit', (event) => research(event).catch((error) => { status.textContent = error.message; output.innerHTML = `<div class="nft-list-item"><strong>Live research did not run.</strong><p class="nft-muted">${esc(error.message)}</p></div>`; }));
  new MutationObserver(refreshCollections).observe(collectionList, { childList: true, subtree: true });
  refreshCollections();
})();