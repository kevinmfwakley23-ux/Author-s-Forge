(() => {
  "use strict";
  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  };
  let installed = false;
  let uploadedReference = "";
  let selectedSourceAssetId = "";
  let currentAssetId = "";

  function install() {
    if (installed) return true;
    const card = document.querySelector("#forge-image-lab");
    if (!card) return false;
    installed = true;
    card.innerHTML = `<div class="section-title"><div><div class="eyebrow">IMAGE LAB</div><h3>Generate and edit artwork with durable history</h3><p class="muted">Uses the configured real image provider. Uploaded originals are preserved when you deliberately generate an edit; every provider result stays pending until you approve or reject it.</p></div></div>
      <div class="forge-image-grid"><div>
        <label>Image direction<textarea id="forge-image-prompt" placeholder="Describe exactly what to create or change. For edits, say what must remain unchanged."></textarea></label>
        <div class="row"><label>Style<input id="forge-image-style" type="text" value="editorial cinematic realism" placeholder="Visual style"></label><label>Purpose<select id="forge-image-purpose"><option value="illustration">Book illustration</option><option value="character-reference">Character reference</option><option value="location-reference">Location reference</option><option value="concept-art">Concept art</option><option value="cover-art">Cover art</option></select></label></div>
        <div class="row"><label>Size<select id="forge-image-size"><option>1024x1024</option><option>1536x1024</option><option>1024x1536</option><option>2048x2048</option><option>2048x1152</option><option>auto</option></select></label><label>Quality<select id="forge-image-quality"><option>medium</option><option>low</option><option>high</option><option>auto</option></select></label></div>
        <div class="forge-image-actions"><label class="button primary" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;width:auto"><span>📎 Upload source</span><input id="forge-image-upload" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button id="forge-image-generate" class="primary" type="button">Generate / edit with real AI</button><button id="forge-image-clear" type="button">Clear source</button></div>
        <small id="forge-image-status" class="muted">No source selected. New results are saved as pending artwork.</small>
      </div><div><div class="forge-image-preview" id="forge-image-preview">Upload a source, select prior artwork, or generate a new image.</div><div class="forge-image-actions"><button id="forge-image-approve" type="button" disabled>Approve result</button><button id="forge-image-reject" type="button" disabled>Reject result</button></div></div></div>
      <hr><h4>Durable image history</h4><div id="forge-image-history" class="list"><p class="muted">Loading image history…</p></div>`;
    bind();
    refreshHistory();
    return true;
  }

  function bind() {
    const upload = document.querySelector("#forge-image-upload");
    upload.addEventListener("change", () => {
      const file = upload.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { setStatus("Source image exceeds the 5 MiB Studio upload limit.", true); upload.value = ""; return; }
      const reader = new FileReader();
      reader.onload = () => {
        uploadedReference = String(reader.result || "");
        selectedSourceAssetId = "";
        showPreview(uploadedReference, `Uploaded source: ${file.name}`);
        setStatus(`${file.name} loaded locally. It will be durably preserved only if you generate an edit.`);
      };
      reader.readAsDataURL(file);
    });
    document.querySelector("#forge-image-clear").addEventListener("click", clearSource);
    document.querySelector("#forge-image-generate").addEventListener("click", generate);
    document.querySelector("#forge-image-approve").addEventListener("click", () => review("approved"));
    document.querySelector("#forge-image-reject").addEventListener("click", () => review("rejected"));
    document.querySelector("#forge-image-history").addEventListener("click", async (event) => {
      const source = event.target.closest?.("[data-image-source]");
      if (source) {
        selectedSourceAssetId = source.dataset.imageSource;
        uploadedReference = "";
        document.querySelector("#forge-image-upload").value = "";
        showPreview(source.dataset.imageUri, `Editing stored asset ${selectedSourceAssetId}`);
        setStatus("Stored artwork selected as a non-destructive edit source.");
        return;
      }
      const reviewButton = event.target.closest?.("[data-image-review]");
      if (reviewButton) {
        currentAssetId = reviewButton.dataset.assetId;
        await review(reviewButton.dataset.imageReview);
      }
    });
  }

  async function generate() {
    const prompt = document.querySelector("#forge-image-prompt").value.trim();
    if (!prompt) { setStatus("Describe the image or edit first.", true); return; }
    const button = document.querySelector("#forge-image-generate");
    button.disabled = true;
    setStatus("Sending the request through the real image provider…");
    try {
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/image`, { method: "POST", body: JSON.stringify({
        prompt,
        style: document.querySelector("#forge-image-style").value.trim(),
        purpose: document.querySelector("#forge-image-purpose").value,
        size: document.querySelector("#forge-image-size").value,
        quality: document.querySelector("#forge-image-quality").value,
        ...(selectedSourceAssetId ? { sourceAssetId: selectedSourceAssetId } : {}),
        ...(!selectedSourceAssetId && uploadedReference ? { referenceImage: uploadedReference, referenceLabel: "Author-uploaded Image Lab source" } : {}),
      }) });
      currentAssetId = result.asset.id;
      selectedSourceAssetId = result.asset.id;
      uploadedReference = "";
      document.querySelector("#forge-image-upload").value = "";
      showPreview(result.url, `Pending artwork from ${result.provider} / ${result.model}`);
      setReviewEnabled(true);
      setStatus(`Real provider result saved as pending artwork${result.sourceAsset ? "; uploaded original preserved separately" : "