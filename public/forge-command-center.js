/* First-class typed/voice command surface for Author's Forge Studio. */
/* AI candidates have NOT been saved as canon until the author approves and saves them. */
/* Every voice capture keeps the original transcript available to the author. */
(() => {
  'use strict';

  const projectId = new URLSearchParams(location.search).get('project') || localStorage.getItem('forge-project') || 'forge-studio';
  const routes = ['dashboard','manuscript','writing','architecture','characters','world','research','editing','voice','art','cover','marketing','publishing','genome','health','versions','settings','governance'];
  const $ = (selector) => document.querySelector(selector);
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  };
  const projectUrl = (suffix = '') => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  const show = (text) => { const result = $('#fcc-result'); if (result) { result.hidden = false; result.textContent = text; } };
  const setStatus = (text) => { const status = $('#fcc-status'); if (status) status.textContent = text; };
  const navigate = (route) => { const link = document.querySelector(`[data-route="${CSS.escape(route)}"]`); if (link) { link.click(); return true; } return false; };

  if (window.__forgeCommandCenterInitialized) return;
  window.__forgeCommandCenterInitialized = true;

  const style = document.createElement('style');
  style.textContent = `#forge-command-center{position:fixed;right:20px;bottom:20px;z-index:9999;width:min(700px,calc(100vw - 40px));background:#111827;color:#f8fafc;border:1px solid #334155;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.45);font:14px/1.45 system-ui,sans-serif;overflow:hidden}#forge-command-center[hidden],#forge-command-toggle[hidden]{display:none!important}#forge-command-center .head{display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-bottom:1px solid #334155}#forge-command-center .body{padding:14px}#forge-command-center textarea{width:100%;min-height:92px;box-sizing:border-box;background:#020617;color:#f8fafc;border:1px solid #475569;border-radius:12px;padding:10px;font:inherit;resize:vertical}#forge-command-center button,#forge-command-center select{background:#1e293b;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer}.fcc-row{display:flex;gap:8px;align-items:center;margin-bottom:9px}.fcc-primary{background:#2563eb!important;border-color:#3b82f6!important;font-weight:700}.fcc-recording{background:#991b1b!important;border-color:#ef4444!important}.fcc-result{margin-top:10px;background:#020617;border-radius:10px;padding:10px;white-space:pre-wrap;max-height:260px;overflow:auto;color:#cbd5e1}.fcc-status{font-size:12px;color:#94a3b8}#forge-command-toggle{position:fixed;right:20px;bottom:20px;z-index:9998;border:1px solid #475569;border-radius:999px;background:#111827;color:#fff;padding:12px 16px;font-weight:800;box-shadow:0 12px 35px rgba(0,0,0,.35);cursor:pointer}`;
  document.head.appendChild(style);

  const root = document.createElement('section');
  root.id = 'forge-command-center';
  root.setAttribute('aria-label', 'Forge Command Center');
  root.innerHTML = `<div class="head"><div><strong>FORGE COMMAND CENTER</strong><div class="fcc-status" id="fcc-status">Typed + voice + real AI boundary</div></div><button id="fcc-close" type="button" aria-label="Close command center">×</button></div><div class="body"><div class="fcc-row"><select id="fcc-mode" aria-label="AI collaboration mode"><option value="co-pilot">Co-pilot</option><option value="partner">Partner</option><option value="director">Director</option><option value="autonomous">Autonomous</option><option value="editor">Editor</option></select><button id="fcc-mic" type="button">🎙 Start mic</button><button id="fcc-run" class="fcc-primary" type="button">Run command</button></div><textarea id="fcc-command" aria-label="Forge command" placeholder="Tell Forge what to do."></textarea><div class="fcc-result" id="fcc-result" hidden></div></div>`;
  document.body.appendChild(root);
  const toggle = document.createElement('button');
  toggle.id = 'forge-command-toggle';
  toggle.type = 'button';
  toggle.textContent = '🎙 Forge';
  toggle.setAttribute('aria-label', 'Open Forge Command Center');
  document.body.appendChild(toggle);

  const command = $('#fcc-command');
  const result = $('#fcc-result');
  const mic = $('#fcc-mic');
  const mode = $('#fcc-mode');
  let recognition = null;
  let originalTranscript = '';

  function startMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      show('Chrome SpeechRecognition is unavailable. Use typed commands or browser voice input.');
      setStatus('Voice unavailable');
      return;
    }
    if (recognition) { recognition.stop(); return; }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    originalTranscript = command.value.trim();
    let finalTranscript = originalTranscript;

    recognition.onstart = () => {
      mic.classList.add('fcc-recording');
      mic.textContent = '■ Stop mic';
      setStatus('Listening…');
    };
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalTranscript = `${finalTranscript} ${text}`.trim();
        else interim += text;
      }
      command.value = `${finalTranscript}${interim ? ` ${interim}` : ''}`.trim();
    };
    recognition.onerror = (event) => setStatus(`Voice error: ${event.error}`);
    recognition.onend = () => {
      originalTranscript = finalTranscript.trim();
      recognition = null;
      mic.classList.remove('fcc-recording');
      mic.textContent = '🎙 Start mic';
      if (originalTranscript) localStorage.setItem(`forge-original-transcript:${projectId}`, originalTranscript);
      if (!$('#fcc-status').textContent.startsWith('Voice error')) setStatus('Original transcript captured');
    };
    recognition.start();
  }

  async function run() {
    const instruction = command.value.trim();
    if (!instruction) { show('Enter or dictate a command first.'); return; }
    const lower = instruction.toLowerCase();
    const direct = routes.find((route) => lower === `open ${route}` || lower.includes(`take me to ${route}`) || lower.includes(`go to ${route}`));
    if (direct && navigate(direct)) {
      setStatus(`Opened ${direct}`);
      show(`Navigation executed: ${direct}`);
      return;
    }

    setStatus('Interpreting command…');
    try {
      const workspace = await api(projectUrl('/workspace'));
      const book = workspace.books?.find((item) => item.id === workspace.activeBookId) || workspace.books?.[0];
      if (!book) { show('No book exists yet. Open Manuscript to create one.'); navigate('manuscript'); setStatus('Book structure required'); return; }
      const chapter = book.chapters?.[0];
      if (!chapter) { show('The active book has no chapter yet. Create a chapter in Manuscript before asking Forge to draft prose.'); navigate('manuscript'); setStatus('Chapter structure required'); return; }

      const payload = await api(projectUrl('/ai/draft'), {
        method: 'POST',
        body: JSON.stringify({
          bookId: book.id,
          chapterId: chapter.id,
          instruction: `[${mode.value}] Author command:\n${instruction}`,
          focus: chapter.synopsis || instruction,
          maxOutputTokens: 6000
        })
      });

      const ai = $('#ai-result');
      if (ai) ai.value = payload.text || '';
      const direction = $('#ai-instruction');
      if (direction) direction.value = instruction;
      const transcript = originalTranscript || localStorage.getItem(`forge-original-transcript:${projectId}`) || instruction;
      show(`${payload.provider || 'provider'} / ${payload.model || 'model'}\n\nOriginal transcript:\n${transcript}\n\nAI candidate:\n${payload.text || ''}\n\nThis candidate has NOT been saved as canon. It is NOT saved automatically. Author approval is required.`);
      setStatus('Real AI candidate ready');
      navigate('writing');
    } catch (error) {
      show(error.message);
      setStatus('Command failed safely');
    }
  }

  mic.addEventListener('click', startMic);
  $('#fcc-run').addEventListener('click', run);
  $('#fcc-close').addEventListener('click', () => { root.hidden = true; toggle.hidden = false; });
  toggle.addEventListener('click', () => { root.hidden = false; toggle.hidden = true; command.focus(); });
  command.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') run(); });
  window.addEventListener('beforeunload', () => { if (recognition) recognition.stop(); });

  const script = document.createElement('script');
  script.src = '/forge-workbench.js';
  script.defer = true;
  document.body.appendChild(script);
})();
