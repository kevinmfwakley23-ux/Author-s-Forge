(() => {
  "use strict";
  const form = document.querySelector('#nft-author-art-form');
  const projectInput = document.querySelector('#nft-project-id');
  const collectionSelect = document.querySelector('#nft-author-art-collection');
  const status = document.querySelector('#nft-status');
  const collectionList = document.querySelector('#nft-collection-list');
  if (!form || !projectInput || !collectionSelect || !status || !collectionList) return;

  function setStatus(message) { status.textContent = message || ''; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[char])); }
  function projectId() {
    const value = projectInput.value.trim() || new URLSearchParams(location.search).get('project') || localStorage.getItem('forge-project') || '';
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Open a valid Forge project first.');
    return value;
  }
  function refreshCollections() {
    const prior = collectionSelect.value;
    const rows = [...collectionList.querySelectorAll('[data-open-nft]')].map((button) => ({ id: button.dataset.openNft, title: button.querySelector('strong')?.textContent?.trim() || button.dataset.openNft })).filter((item) => item.id);
    collectionSelect.innerHTML = rows.length ? rows.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)} · ${escapeHtml(item.id)}</option>`).join('') : '<option value="">No collection available</option>';
    if (rows.some((item) => item.id === prior)) collectionSelect.value = prior;
    else {
      const currentTitle = document.querySelector('#nft-current-title')?.textContent?.trim();
      const current = rows.find((item) => item.title === currentTitle);
      if (current) collectionSelect.value = current.id;
    }
  }

  async function attach(event) {
    event.preventDefault();
    const project = projectId();
    const collectionId = collectionSelect.value;
    if (!collectionId) throw new Error('Choose an NFT collection first.');
    const data = new FormData(form);
    const tokenId = String(data.get('tokenId') || '').trim();
    const imageUri = String(data.get('imageUri') || '').trim();
    const animationUrl = String(data.get('animationUrl') || '').trim();
    const sourceReference = String(data.get('sourceReference') || '').trim();
    if (!tokenId || !imageUri || !sourceReference) throw new Error('Token ID, image URI, and source/provenance reference are required.');
    if (data.get('authorDeclaresRights') !== 'on') throw new Error('Explicit rights/provenance declaration is required before Forge can attach the artwork.');
    setStatus(`Attaching author-owned artwork to token ${tokenId} and recording provenance…`);
    const response = await fetch(`/api/projects/${encodeURIComponent(project)}/nft/${encodeURIComponent(collectionId)}/art/${encodeURIComponent(tokenId)}/author`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageUri, ...(animationUrl ? { animationUrl } : {}), sourceReference, authorDeclaresRights: true }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Artwork attach failed (${response.status}).`);
    form.reset();
    collectionSelect.value = collectionId;
    const open = [...collectionList.querySelectorAll('[data-open-nft]')].find((button) => button.dataset.openNft === collectionId);
    open?.click();
    setStatus(`Author artwork attached to token ${tokenId}. Rights/provenance declaration recorded in Project Brain.`);
  }

  function loadMarketSignalLab() {
    if (document.querySelector('script[data-nft-market-ui]')) return;
    const script = document.createElement('script');
    script.src = '/nft-market-ui.js';
    script.defer = true;
    script.dataset.nftMarketUi = 'true';
    document.head.append(script);
  }

  form.addEventListener('submit', (event) => attach(event).catch((error) => setStatus(error.message)));
  new MutationObserver(refreshCollections).observe(collectionList, { childList: true, subtree: true });
  document.querySelector('#nft-refresh')?.addEventListener('click', () => setTimeout(refreshCollections, 50));
  refreshCollections();
  loadMarketSignalLab();
})();
