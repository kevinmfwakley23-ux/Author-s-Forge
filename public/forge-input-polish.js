/* Author's Forge input polish: browser-native dictation on author fields and a real Image Lab reference workflow. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function announce(message, ok = false) {
    const error = $('#error-banner');
    const success = $('#success-banner');
    const target = ok ? success : error;
    const other = ok ? error : success;
    if (other) other.hidden = true;
    if (!target) return;
    target.textContent = message;
    target.hidden = false;
    if (ok) window.setTimeout(() => { target.hidden = true; }, 4000);
  }

  function recognitionConstructor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function addMicControl(field) {
    if (!field || field.dataset.forgeMicReady === 'true' || field.disabled || field.readOnly) return;
    const Recognition = recognitionConstructor();
    field.dataset.forgeMicReady = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'forge-input-with-mic';
    wrapper.dataset.forgeMicFor = field.id || field.name || 'field';
    field.parentNode?.insertBefore(wrapper, field);
    wrapper.appendChild(field);

    const mic = document.createElement('button');
    mic.type = 'button';
    mic.className = 'forge-mic-button';
    mic.setAttribute('aria-label', `Dictate into ${field.getAttribute('aria-label') || field.name || 'this field'}`);
    mic.textContent = Recognition ? '🎙 Dictate' : '🎙 Mic unavailable';
    mic.disabled = !Recognition;
    wrapper.appendChild(mic);

    if (!Recognition) return;

    mic.addEventListener('click', () => {
      if (window.forgeActiveRecognition && window.forgeActiveRecognition !== recognition) {
        try { window.forgeActiveRecognition.stop(); } catch (_) {}
      }
      const recognition = new Recognition();
      window.forgeActiveRecognition = recognition;
      recognition.lang = document.documentElement.lang || 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      mic.textContent = '■ Stop dictation';
      mic.classList.add('recording');
      field.focus();

      recognition.onresult = (event) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        }
        if (!finalText.trim()) return;
        const separator = field.value && !/[\s\n]$/.test(field.value) ? ' ' : '';
        field.value += `${separator}${finalText.trim()}`;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      };
      recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          announce('Microphone access was denied. Allow microphone access for this Studio origin in Chrome site settings.');
        } else if (event.error !== 'aborted') {
          announce(`Microphone error: ${event.error}.`);
        }
      };
      recognition.onend = () => {
        if (window.forgeActiveRecognition === recognition) window.forgeActiveRecognition = null;
        mic.textContent = '🎙 Dictate';
        mic.classList.remove('recording');
      };

      try { recognition.start(); } catch (error) {
        mic.textContent = '🎙 Dictate';
        mic.classList.remove('recording');
        announce(error instanceof Error ? error.message : 'Unable to start microphone input.');
      }
    });
  }

  function bindMicrophones() {
    $$('textarea, input[type="text"], input:not([type])').forEach((field) => {
      if (field.closest('#image-reference-controls')) return;
      addMicControl(field);
    });
  }

  function addImageLabControls() {
    const form = $('#image-form');
    if (!form || $('#image-reference-controls')) return;

    const controls = document.createElement('div');
    controls.id = 'image-reference-controls';
    controls.className = 'image-reference-controls';
    controls.innerHTML = `
      <div class="image-reference-heading">
        <div>
          <strong>Reference image</strong>
          <p class="muted">Upload a visual reference for the authoring session. It stays local to this browser and is not silently sent to the provider.</p>
        </div>
        <label class="secondary-button" for="image-reference-file">＋ Upload reference</label>
        <input id="image-reference-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
      </div>
      <div id="image-reference-preview" class="image-reference-preview" hidden></div>
    `;
    form.insertBefore(controls, form.firstChild);

    const input = $('#image-reference-file', controls);
    const preview = $('#image-reference-preview', controls);
    input?.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        input.value = '';
        announce('Reference image is too large. Choose an image under 8 MiB.');
        return;
      }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        input.value = '';
        announce('Reference image must be PNG, JPEG, or WebP.');
        return;
      }
      const url = URL.createObjectURL(file);
      preview.hidden = false;
      preview.innerHTML = `
        <img src="${url}" alt="Uploaded illustration reference preview">
        <div><strong>${file.name}</strong><small>${Math.round(file.size / 1024)} KB • ${file.type}</small>
        <button type="button" id="remove-image-reference">Remove reference</button></div>
      `;
      $('#remove-image-reference', preview)?.addEventListener('click', () => {
        URL.revokeObjectURL(url);
        input.value = '';
        preview.hidden = true;
        preview.replaceChildren();
      }, { once: true });
    });

    const status = document.createElement('div');
    status.className = 'image-ai-access';
    status.innerHTML = `
      <div><strong>AI image access</strong><span id="image-ai-status" class="muted">Checking provider…</span></div>
      <button type="button" id="image-ai-check">Check AI access</button>
      <button type="button" id="image-ai-settings">Open Provider Settings</button>
    `;
    form.appendChild(status);

    const updateStatus = async () => {
      const target = $('#image-ai-status');
      if (!target) return;
      target.textContent = 'Checking provider…';
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
        target.textContent = payload.ai?.image ? 'Ready — OpenAI image generation is configured.' : 'Not configured — set OPENAI_API_KEY for image generation.';
        target.className = payload.ai?.image ? 'provider-ready' : 'provider-missing';
      } catch (error) {
        target.textContent = error instanceof Error ? error.message : 'Provider status unavailable.';
        target.className = 'provider-missing';
      }
    };

    $('#image-ai-check')?.addEventListener('click', updateStatus);
    $('#image-ai-settings')?.addEventListener('click', () => {
      const route = document.querySelector('[data-route="settings"]');
      route?.click();
    });
    updateStatus();
  }

  function addPolishStyles() {
    if ($('#forge-input-polish-styles')) return;
    const style = document.createElement('style');
    style.id = 'forge-input-polish-styles';
    style.textContent = `
      .forge-input-with-mic { display:flex; align-items:stretch; gap:.5rem; width:100%; }
      .forge-input-with-mic > input, .forge-input-with-mic > textarea { flex:1 1 auto; min-width:0; }
      .forge-mic-button { flex:0 0 auto; align-self:flex-end; white-space:nowrap; min-height:2.65rem; }
      .forge-mic-button.recording { font-weight:700; }
      .image-reference-controls { margin:.75rem 0 1rem; padding:1rem; border:1px solid var(--border, #ccc); border-radius:.75rem; }
      .image-reference-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
      .image-reference-heading p { margin:.25rem 0 0; }
      .secondary-button { display:inline-flex; align-items:center; justify-content:center; min-height:2.65rem; padding:.55rem .8rem; border:1px solid currentColor; border-radius:.5rem; cursor:pointer; }
      .image-reference-preview { display:flex; align-items:center; gap:1rem; margin-top:.85rem; }
      .image-reference-preview img { width:96px; height:96px; object-fit:cover; border-radius:.5rem; border:1px solid var(--border, #ccc); }
      .image-reference-preview small { display:block; margin:.25rem 0 .5rem; }
      .image-reference-preview button { font-size:.9rem; }
      .image-ai-access { display:flex; align-items:center; justify-content:space-between; gap:.75rem; flex-wrap:wrap; margin-top:.75rem; padding:.75rem; border-top:1px solid var(--border, #ccc); }
      .image-ai-access > div { display:flex; flex-direction:column; gap:.2rem; flex:1 1 18rem; }
      .provider-ready { font-weight:600; }
      .provider-missing { font-weight:600; }
      @media (max-width:700px) { .forge-input-with-mic { flex-direction:column; } .forge-mic-button { width:100%; } .image-reference-preview { align-items:flex-start; } }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    addPolishStyles();
    bindMicrophones();
    addImageLabControls();
    window.setTimeout(bindMicrophones, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
