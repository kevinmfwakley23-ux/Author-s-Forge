(() => {
  "use strict";

  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  };

  let installed = false;
  let uploadedReference = "";
  let selectedSourceAssetId = "";
  let currentAssetId = "";
  let sourceNeedsDeclaration = false;
  let rightsDeclarations = new Map();
  let generationProvenance = new Set();

  function install() {
    if (installed) return true;
    const card = document.querySelector("#forge-image-lab");
    if (!card) return false;
    installed = true;
    card.innerHTML = `<div class="section-title"><div><div class="eyebrow">IMAGE LAB</div><h3>Generate and edit artwork with durable history</h3><p class="muted">Uses the configured real image provider. Uploaded originals are preserved when you deliberately generate an edit; every provider result stays pending until you approve or reject it. Source rights, AI provenance, and external-processing consent are tracked separately from creative approval.</p></div></div>
      <div class="forge-image-grid"><div>
        <label>Image direction<textarea id="forge-image-prompt" placeholder="Describe exactly what to create or change. For edits, say what must remain unchanged."></textarea></label>
        <div class="row"><label>Style<input id="forge-image-style" type="text" value="editorial cinematic realism" placeholder="Visual style"></label><label>Purpose<select id="forge-image-purpose"><option value="illustration">Book illustration</option><option value="character-reference">Character reference</option><option value="location-reference">Location reference</option><option value="concept-art">Concept art</option><option value="cover-art">Cover art</option></select></label></div>
        <div class="row"><label>Size<select id="forge-image-size"><option>1024x1024</option><option>1536x1024</option><option>1024x1536</option><option>2048x2048</option><option>2048x1152</option><option>auto</option></select></label><label>Quality<select id="forge-image-quality"><option>medium</option><option>low</option><option>high</option><option>auto</option></select></label></div>
        <div class="forge-image-actions"><label class="button primary" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;width:auto"><span>📎 Upload source</span><input id="forge-image-upload" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button id="forge-image-generate" class="primary" type="button">Generate / edit with real AI</button><button id="forge-image-clear" type="button">Clear source</button></div>
        <fieldset class="forge-image-rights"><legend>Rights, provenance & external processing</legend>
          <p class="muted">These are author declarations and provenance records, not legal advice or an automatic copyright/trademark determination.</p>
          <div class="row"><label>Rights basis<select id="forge-image-rights-basis"><option value="unknown">Unknown / needs review</option><option value="author-owned">I own/control this source</option><option value="licensed">Licensed for intended use</option><option value="public-domain">Public domain</option><option value="external-reference">External reference only</option></select></label><label>Model / likeness release<select id="forge-image-model-release"><option value="not-applicable">Not applicable</option><option value="not-required">Not required / author declaration</option><option value="obtained">Obtained</option><option value="not-obtained">Not obtained</option><option value="unknown">Unknown</option></select></label></div>
          <label><input id="forge-image-real-person" type="checkbox"> Source contains a real person's likeness</label>
          <label><input id="forge-image-trademark" type="checkbox"> Source contains a trademark / protected brand element</label>
          <label>Source / rights reference<input id="forge-image-source-reference" type="text" placeholder="File origin, creator, contract, archive, or source URL/reference"></label>
          <label>License URL<input id="forge-image-license-url" type="url" placeholder="https://… (when applicable)"></label>
          <label>Rights / usage terms<textarea id="forge-image-rights-terms" placeholder="License scope, restrictions, attribution, release notes, or other usage terms"></textarea></label>
          <label>Rights notes<textarea id="forge-image-rights-notes" placeholder="Anything the author should remember before publication"></textarea></label>
          <label><input id="forge-image-publication-cleared" type="checkbox"> I declare that I have the rights/permission needed for my intended publication use.</label>
          <label><input id="forge-image-processing-consent" type="checkbox" disabled> For this request, I authorize Forge to send the selected source image bytes to the configured OpenAI image provider for processing.</label>
          <div class="forge-image-actions"><button id="forge-image-save-rights" type="button" disabled>Save rights declaration for selected artwork</button></div>
        </fieldset>
        <small id="forge-image-status" class="muted" role="status" aria-live="polite">No source selected. New results are saved as pending AI-generated artwork with generation provenance.</small>
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
      if (file.size > 5 * 1024 * 1024) {
        setStatus("Source image exceeds the 5 MiB Studio upload limit.", true);
        upload.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => {
        uploadedReference = "";
        upload.value = "";
        setStatus("The selected source image could not be read.", true);
      };
      reader.onload = () => {
        uploadedReference = String(reader.result || "");
        selectedSourceAssetId = "";
        currentAssetId = "";
        sourceNeedsDeclaration = true;
        resetRightsForm(file.name);
        setReviewEnabled(false);
        syncSourceControls();
        showPreview(uploadedReference, `Uploaded source: ${file.name}`);
        setStatus(`${file.name} loaded locally. Declare its provenance and grant per-request external-processing consent before Forge may send it to OpenAI.`);
      };
      reader.readAsDataURL(file);
    });

    document.querySelector("#forge-image-clear").addEventListener("click", clearSource);
    document.querySelector("#forge-image-generate").addEventListener("click", generate);
    document.querySelector("#forge-image-save-rights").addEventListener("click", saveRights);
    document.querySelector("#forge-image-approve").addEventListener("click", () => review("approved"));
    document.querySelector("#forge-image-reject").addEventListener("click", () => review("rejected"));
    document.querySelector("#forge-image-real-person").addEventListener("change", syncModelRelease);
    document.querySelector("#forge-image-history").addEventListener("click", async (event) => {
      const source = event.target.closest?.("[data-image-source]");
      if (source) {
        selectedSourceAssetId = source.dataset.imageSource || "";
        uploadedReference = "";
        currentAssetId = "";
        document.querySelector("#forge-image-upload").value = "";
        setReviewEnabled(false);
        sourceNeedsDeclaration = !rightsDeclarations.has(selectedSourceAssetId) && !generationProvenance.has(selectedSourceAssetId);
        populateRightsForm(rightsDeclarations.get(selectedSourceAssetId));
        syncSourceControls();
        showPreview(source.dataset.imageUri || "", `Editing stored asset ${selectedSourceAssetId}`);
        setStatus(sourceNeedsDeclaration ? "Stored artwork selected. Declare its source rights/provenance and grant per-request processing consent before external processing." : "Stored artwork selected as a non-destructive edit source. Per-request external-processing consent is still required before transmission.");
        return;
      }
      const reviewButton = event.target.closest?.("[data-image-review]");
      if (reviewButton) {
        currentAssetId = reviewButton.dataset.assetId || "";
        await review(reviewButton.dataset.imageReview);
      }
      const rightsButton = event.target.closest?.("[data-image-rights]");
      if (rightsButton) {
        currentAssetId = rightsButton.dataset.imageRights || "";
        selectedSourceAssetId = currentAssetId;
        uploadedReference = "";
        sourceNeedsDeclaration = false;
        populateRightsForm(rightsDeclarations.get(currentAssetId));
        syncSourceControls();
        setStatus("Artwork selected for a new author rights/provenance declaration.");
      }
    });
  }

  async function generate() {
    const prompt = document.querySelector("#forge-image-prompt").value.trim();
    if (!prompt) return setStatus("Describe the image or edit first.", true);
    const hasSource = Boolean(selectedSourceAssetId || uploadedReference);
    if (hasSource && !document.querySelector("#forge-image-processing-consent").checked) {
      return setStatus("Explicit per-request consent is required before Forge can send source image bytes to OpenAI.", true);
    }

    const button = document.querySelector("#forge-image-generate");
    button.disabled = true;
    setStatus(hasSource ? "Sending the consented source and request through the real image provider…" : "Sending the request through the real image provider…");
    try {
      const body = {
        prompt,
        style: document.querySelector("#forge-image-style").value.trim(),
        purpose: document.querySelector("#forge-image-purpose").value,
        size: document.querySelector("#forge-image-size").value,
        quality: document.querySelector("#forge-image-quality").value,
        ...(selectedSourceAssetId ? { sourceAssetId: selectedSourceAssetId } : {}),
        ...(!selectedSourceAssetId && uploadedReference ? { referenceImage: uploadedReference, referenceLabel: document.querySelector("#forge-image-source-reference").value.trim() || "Author-uploaded Image Lab source" } : {}),
        ...(hasSource ? { externalProcessingConsent: true } : {}),
        ...(hasSource && sourceNeedsDeclaration ? { referenceRights: rightsPayload() } : {}),
      };
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/image`, { method: "POST", body: JSON.stringify(body) });
      currentAssetId = result.asset.id;
      selectedSourceAssetId = result.asset.id;
      sourceNeedsDeclaration = false;
      generationProvenance.add(result.asset.id);
      uploadedReference = "";
      document.querySelector("#forge-image-upload").value = "";
      document.querySelector("#forge-image-processing-consent").checked = false;
      showPreview(result.url || result.asset.assetUri, `Pending artwork from ${result.provider} / ${result.model}`);
      setReviewEnabled(true);
      syncSourceControls();
      setStatus(`Real provider result saved as pending AI-generated artwork${result.sourceAsset ? "; source preserved with provenance/consent audit" : ""}. Creative approval and publication rights review remain separate.`);
      await refreshHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), true);
      await refreshHistory().catch(() => {});
    } finally {
      button.disabled = false;
    }
  }

  async function saveRights() {
    const assetId = currentAssetId || selectedSourceAssetId;
    if (!assetId) return setStatus("Select saved artwork before recording a rights declaration.", true);
    try {
      const record = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/images/${encodeURIComponent(assetId)}/rights`, {
        method: "POST",
        body: JSON.stringify(rightsPayload()),
      });
      rightsDeclarations.set(assetId, record);
      sourceNeedsDeclaration = false;
      setStatus(`Rights/provenance declaration saved for ${assetId}. Publication clearance is ${record.publicationClearance}.`);
      await refreshHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), true);
    }
  }

  async function review(decision) {
    if (!currentAssetId) return setStatus("Select a pending result before reviewing it.", true);
    if (decision !== "approved" && decision !== "rejected") return setStatus("Image review must be approved or rejected.", true);
    setReviewEnabled(false);
    setStatus(`${decision === "approved" ? "Approving" : "Rejecting"} artwork…`);
    try {
      const asset = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/images/${encodeURIComponent(currentAssetId)}/review`, { method: "POST", body: JSON.stringify({ decision }) });
      setStatus(`Artwork ${asset.approvalStatus}. Creative approval does not change the separate rights/provenance declaration.`);
      if (asset.assetUri) showPreview(asset.assetUri, `${asset.approvalStatus} artwork`);
      currentAssetId = "";
      await refreshHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), true);
      setReviewEnabled(true);
    }
  }

  async function refreshHistory() {
    const host = document.querySelector("#forge-image-history");
    if (!host) return;
    try {
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/images`);
      const records = Array.isArray(result.rightsRecords) ? result.rightsRecords : [];
      rightsDeclarations = latestDeclarations(records);
      generationProvenance = new Set(records.filter((record) => record.eventType === "generation").map((record) => String(record.artifactId || "")));
      renderHistory(Array.isArray(result.assets) ? result.assets : [], records);
    } catch (error) {
      host.replaceChildren(messageNode(error instanceof Error ? error.message : String(error), true));
    }
  }

  function renderHistory(assets, records) {
    const host = document.querySelector("#forge-image-history");
    if (!host) return;
    host.replaceChildren();
    if (!assets.length) return host.append(messageNode("No Image Lab artwork has been saved yet."));
    const eventsByAsset = new Map();
    for (const record of records) {
      const list = eventsByAsset.get(record.artifactId) || [];
      list.push(record);
      eventsByAsset.set(record.artifactId, list);
    }

    for (const asset of assets) {
      const item = document.createElement("article");
      item.className = "list-item forge-image-history-item";
      item.dataset.imageAsset = String(asset.id || "");
      const heading = document.createElement("strong");
      heading.textContent = asset.prompt || "Untitled image request";
      item.append(heading);

      const meta = document.createElement("p");
      meta.className = "muted";
      const provider = asset.generationSettings?.provider ? ` • ${asset.generationSettings.provider}` : "";
      const lineage = asset.reusedFromAssetId ? ` • derivative of ${asset.reusedFromAssetId}` : "";
      meta.textContent = `${asset.approvalStatus || "pending"}${provider}${lineage}`;
      item.append(meta);

      const declaration = rightsDeclarations.get(asset.id);
      const generated = generationProvenance.has(asset.id);
      const rights = document.createElement("p");
      rights.className = "muted";
      rights.textContent = declaration
        ? `Rights: ${declaration.rightsBasis} • ${declaration.publicationClearance}${declaration.containsRealPerson ? ` • real-person likeness (${declaration.modelReleaseStatus})` : ""}${declaration.containsTrademark ? " • trademark/brand flagged" : ""}`
        : generated
          ? "Provenance: AI-generated • publication rights review required"
          : "Rights/provenance: not yet declared";
      item.append(rights);

      const events = eventsByAsset.get(asset.id) || [];
      const consentCount = events.filter((record) => record.eventType === "external-processing-consent").length;
      if (consentCount) {
        const audit = document.createElement("small");
        audit.className = "muted";
        audit.textContent = `${consentCount} explicit external-processing consent event${consentCount === 1 ? "" : "s"} recorded.`;
        item.append(audit);
      }

      if (asset.assetUri) {
        const image = document.createElement("img");
        image.src = asset.assetUri;
        image.alt = asset.prompt ? `Image Lab artwork: ${asset.prompt}` : "Image Lab artwork";
        image.loading = "lazy";
        image.style.maxWidth = "100%";
        image.style.maxHeight = "240px";
        image.style.objectFit = "contain";
        image.style.display = "block";
        image.style.margin = "8px 0";
        item.append(image);
      }

      const actions = document.createElement("div");
      actions.className = "forge-image-actions";
      if (asset.assetUri && asset.approvalStatus !== "rejected") {
        const sourceButton = document.createElement("button");
        sourceButton.type = "button";
        sourceButton.dataset.imageSource = String(asset.id || "");
        sourceButton.dataset.imageUri = asset.assetUri;
        sourceButton.textContent = "Use as edit source";
        actions.append(sourceButton);
      }
      const rightsButton = document.createElement("button");
      rightsButton.type = "button";
      rightsButton.dataset.imageRights = String(asset.id || "");
      rightsButton.textContent = declaration ? "Update rights" : "Declare rights";
      actions.append(rightsButton);
      if (asset.approvalStatus === "pending") actions.append(reviewButton(asset.id, "approved", "Approve"), reviewButton(asset.id, "rejected", "Reject"));
      item.append(actions);
      host.append(item);
    }
  }

  function rightsPayload() {
    return {
      rightsBasis: document.querySelector("#forge-image-rights-basis").value,
      authorDeclaresPublicationClearance: document.querySelector("#forge-image-publication-cleared").checked,
      containsRealPerson: document.querySelector("#forge-image-real-person").checked,
      modelReleaseStatus: document.querySelector("#forge-image-model-release").value,
      containsTrademark: document.querySelector("#forge-image-trademark").checked,
      sourceReference: document.querySelector("#forge-image-source-reference").value.trim(),
      licenseUrl: document.querySelector("#forge-image-license-url").value.trim(),
      rightsUsageTerms: document.querySelector("#forge-image-rights-terms").value.trim(),
      notes: document.querySelector("#forge-image-rights-notes").value.trim(),
    };
  }

  function latestDeclarations(records) {
    const map = new Map();
    for (const record of records.slice().sort((a, b) => String(a.recordedAt).localeCompare(String(b.recordedAt)))) {
      if (record.eventType === "source-declaration") map.set(String(record.artifactId || ""), record);
    }
    return map;
  }

  function populateRightsForm(record) {
    document.querySelector("#forge-image-rights-basis").value = record?.rightsBasis || "unknown";
    document.querySelector("#forge-image-publication-cleared").checked = record?.publicationClearance === "author-declared-cleared";
    document.querySelector("#forge-image-real-person").checked = Boolean(record?.containsRealPerson);
    document.querySelector("#forge-image-model-release").value = record?.modelReleaseStatus || "not-applicable";
    document.querySelector("#forge-image-trademark").checked = Boolean(record?.containsTrademark);
    document.querySelector("#forge-image-source-reference").value = record?.sourceReference || "";
    document.querySelector("#forge-image-license-url").value = record?.licenseUrl || "";
    document.querySelector("#forge-image-rights-terms").value = record?.rightsUsageTerms || "";
    document.querySelector("#forge-image-rights-notes").value = record?.provenance?.notes || "";
    document.querySelector("#forge-image-processing-consent").checked = false;
    syncModelRelease();
  }

  function resetRightsForm(sourceReference = "") {
    populateRightsForm(null);
    document.querySelector("#forge-image-source-reference").value = sourceReference;
  }

  function syncModelRelease() {
    const real = document.querySelector("#forge-image-real-person").checked;
    const release = document.querySelector("#forge-image-model-release");
    release.disabled = !real;
    if (!real) release.value = "not-applicable";
    else if (release.value === "not-applicable") release.value = "unknown";
  }

  function syncSourceControls() {
    const hasSource = Boolean(selectedSourceAssetId || uploadedReference);
    const consent = document.querySelector("#forge-image-processing-consent");
    if (consent) { consent.disabled = !hasSource; if (!hasSource) consent.checked = false; }
    const save = document.querySelector("#forge-image-save-rights");
    if (save) save.disabled = !(currentAssetId || selectedSourceAssetId);
  }

  function reviewButton(assetId, decision, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.imageReview = decision;
    button.dataset.assetId = String(assetId || "");
    button.textContent = label;
    return button;
  }

  function clearSource() {
    uploadedReference = "";
    selectedSourceAssetId = "";
    currentAssetId = "";
    sourceNeedsDeclaration = false;
    const upload = document.querySelector("#forge-image-upload");
    if (upload) upload.value = "";
    setReviewEnabled(false);
    resetRightsForm();
    syncSourceControls();
    const preview = document.querySelector("#forge-image-preview");
    if (preview) { preview.replaceChildren(); preview.textContent = "Upload a source, select prior artwork, or generate a new image."; }
    setStatus("Source cleared. The next request will generate new AI artwork without transmitting a reference image.");
  }

  function showPreview(uri, label) {
    const preview = document.querySelector("#forge-image-preview");
    if (!preview) return;
    preview.replaceChildren();
    if (!uri) { preview.textContent = label || "Image preview unavailable."; return; }
    const image = document.createElement("img");
    image.src = uri;
    image.alt = label || "Image Lab preview";
    image.style.maxWidth = "100%";
    image.style.maxHeight = "420px";
    image.style.objectFit = "contain";
    preview.append(image);
    if (label) { const caption = document.createElement("small"); caption.className = "muted"; caption.textContent = label; preview.append(caption); }
  }

  function setReviewEnabled(enabled) {
    const approve = document.querySelector("#forge-image-approve");
    const reject = document.querySelector("#forge-image-reject");
    if (approve) approve.disabled = !enabled;
    if (reject) reject.disabled = !enabled;
  }

  function setStatus(message, error = false) {
    const status = document.querySelector("#forge-image-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", error);
  }

  function messageNode(message, error = false) {
    const node = document.createElement("p");
    node.className = error ? "muted error" : "muted";
    node.textContent = message;
    return node;
  }

  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("load", () => install(), { once: true });
  }
})();
