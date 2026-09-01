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
        <small id="forge-image-status" class="muted" role="status" aria-live="polite">No source selected. New results are saved as pending artwork.</small>
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
        setReviewEnabled(false);
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
        selectedSourceAssetId = source.dataset.imageSource || "";
        uploadedReference = "";
        currentAssetId = "";
        document.querySelector("#forge-image-upload").value = "";
        setReviewEnabled(false);
        showPreview(source.dataset.imageUri || "", `Editing stored asset ${selectedSourceAssetId}`);
        setStatus("Stored artwork selected as a non-destructive edit source.");
        return;
      }
      const reviewButton = event.target.closest?.("[data-image-review]");
      if (reviewButton) {
        currentAssetId = reviewButton.dataset.assetId || "";
        await review(reviewButton.dataset.imageReview);
      }
    });
  }

  async function generate() {
    const prompt = document.querySelector("#forge-image-prompt").value.trim();
    if (!prompt) {
      setStatus("Describe the image or edit first.", true);
      return;
    }

    const button = document.querySelector("#forge-image-generate");
    button.disabled = true;
    setStatus("Sending the request through the real image provider…");
    try {
      const result = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/image`, {
        method: "POST",
        body: JSON.stringify({
          prompt,
          style: document.querySelector("#forge-image-style").value.trim(),
          purpose: document.querySelector("#forge-image-purpose").value,
          size: document.querySelector("#forge-image-size").value,
          quality: document.querySelector("#forge-image-quality").value,
          ...(selectedSourceAssetId ? { sourceAssetId: selectedSourceAssetId } : {}),
          ...(!selectedSourceAssetId && uploadedReference
            ? { referenceImage: uploadedReference, referenceLabel: "Author-uploaded Image Lab source" }
            : {}),
        }),
      });
      currentAssetId = result.asset.id;
      selectedSourceAssetId = result.asset.id;
      uploadedReference = "";
      document.querySelector("#forge-image-upload").value = "";
      showPreview(result.url || result.asset.assetUri, `Pending artwork from ${result.provider} / ${result.model}`);
      setReviewEnabled(true);
      setStatus(`Real provider result saved as pending artwork${result.sourceAsset ? "; uploaded original preserved separately" : ""}. Approve or reject it explicitly.`);
      await refreshHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), true);
    } finally {
      button.disabled = false;
    }
  }

  async function review(decision) {
    if (!currentAssetId) {
      setStatus("Select a pending result before reviewing it.", true);
      return;
    }
    if (decision !== "approved" && decision !== "rejected") {
      setStatus("Image review must be approved or rejected.", true);
      return;
    }

    setReviewEnabled(false);
    setStatus(`${decision === "approved" ? "Approving" : "Rejecting"} artwork…`);
    try {
      const asset = await api(`/api/projects/${encodeURIComponent(projectId)}/ai/images/${encodeURIComponent(currentAssetId)}/review`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setStatus(`Artwork ${asset.approvalStatus}. The decision is saved in durable project history.`);
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
      renderHistory(Array.isArray(result.assets) ? result.assets : []);
    } catch (error) {
      host.replaceChildren(messageNode(error instanceof Error ? error.message : String(error), true));
    }
  }

  function renderHistory(assets) {
    const host = document.querySelector("#forge-image-history");
    if (!host) return;
    host.replaceChildren();
    if (!assets.length) {
      host.append(messageNode("No Image Lab artwork has been saved yet."));
      return;
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
      const lineage = asset.sourceAssetId ? ` • derivative of ${asset.sourceAssetId}` : "";
      meta.textContent = `${asset.approvalStatus || "pending"}${provider}${lineage}`;
      item.append(meta);

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
      if (asset.approvalStatus === "pending") {
        actions.append(reviewButton(asset.id, "approved", "Approve"), reviewButton(asset.id, "rejected", "Reject"));
      }
      if (actions.childElementCount) item.append(actions);
      host.append(item);
    }
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
    const upload = document.querySelector("#forge-image-upload");
    if (upload) upload.value = "";
    setReviewEnabled(false);
    const preview = document.querySelector("#forge-image-preview");
    if (preview) {
      preview.replaceChildren();
      preview.textContent = "Upload a source, select prior artwork, or generate a new image.";
    }
    setStatus("Source cleared. The next request will generate new artwork.");
  }

  function showPreview(uri, label) {
    const preview = document.querySelector("#forge-image-preview");
    if (!preview) return;
    preview.replaceChildren();
    if (!uri) {
      preview.textContent = label || "Image preview unavailable.";
      return;
    }
    const image = document.createElement("img");
    image.src = uri;
    image.alt = label || "Image Lab preview";
    image.style.maxWidth = "100%";
    image.style.maxHeight = "420px";
    image.style.objectFit = "contain";
    preview.append(image);
    if (label) {
      const caption = document.createElement("small");
      caption.className = "muted";
      caption.textContent = label;
      preview.append(caption);
    }
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
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("load", () => install(), { once: true });
  }
})();
