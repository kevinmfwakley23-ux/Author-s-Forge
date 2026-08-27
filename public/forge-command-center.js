(() => {
  "use strict";

  const projectId = new URLSearchParams(location.search).get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const style = document.createElement("style");
  style.textContent = `
    #forge-command-center{position:fixed;right:22px;bottom:22px;z-index:9999;width:min(620px,calc(100vw - 44px));background:#111827;color:#f8fafc;border:1px solid #334155;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.45);font:14px/1.45 system-ui,sans-serif;overflow:hidden}
    #forge-command-center .fcc-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid #334155}
    #forge-command-center .fcc-title{font-weight:800;letter-spacing:.02em}.fcc-status{font-size:12px;color:#94a3b8}
    #forge-command-center .fcc-body{padding:14px}.fcc-row{display:flex;gap:8px;align-items:center}.fcc-row+ .fcc-row{margin-top:9px}
    #forge-command-center textarea{width:100%;min-height:86px;resize:vertical;box-sizing:border-box;background:#020617;color:#f8fafc;border:1px solid #475569;border-radius:12px;padding:11px;font:inherit}
    #forge-command-center button,#forge-command-center select{background:#1e293b;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer}
    #forge-command-center button:hover{background:#334155}.fcc-mic{min-width:96px}.fcc-mic.recording{background:#991b1b;border-color:#ef4444}.fcc-primary{background:#2563eb!important;border-color:#3b82f6!important;font-weight:700}
    #forge-command-center .fcc-result{margin-top:10px;padding:10px;border-radius:10px;background:#020617;color:#cbd5e1;white-space:pre-wrap;max-height:190px;overflow:auto}
    #forge-command-center .fcc-help{font-size:12px;color:#94a3b8;margin-top:8px}
    #forge-command-toggle{position:fixed;right:22px;bottom:22px;z-index:9998;border:1px solid #475569;border-radius:999px;background:#111827;color:#fff;padding:12px 16px;font-weight:800;box-shadow:0 12px 35px rgba(0,0,0,.35);cursor:pointer}
  `;
  document.head.appendChild(style);

  const root = document.createElement("section");
  root.id = "forge-command-center";
  root.innerHTML = `
    <div class="fcc-head"><div><div class="fcc-title">FORGE COMMAND CENTER</div><div class="fcc-status" id="fcc-status">Typed + voice input</div></div><button type="button" id="fcc-close" aria-label="Close command center">×</button></div>
    <div class="fcc-body">
      <div class="fcc-row"><select id="fcc-mode" aria-label="AI collaboration mode"><option value="co-pilot">Co-pilot</option><option value="partner">Partner</option><option value="director">Director</option><option value="autonomous">Autonomous</option><option value="editor">Editor</option></select><button type="button" class="fcc-mic" id="fcc-mic">🎙 Start mic</button><button type="button" class="fcc-primary" id="fcc-run">Run command</button></div>
      <div class="fcc-row"><textarea id="fcc-command" aria-label="Forge command" placeholder="Tell Forge what you want. Example: Build the story architecture for my psychological thriller, then take me to the Writing Desk."></textarea></div>
      <div class="fcc-help">Voice uses Chrome's speech recognition when available. The original transcript remains in this box. Commands that require AI use the project's configured real provider; unavailable providers fail explicitly.</div>
      <div class="fcc-result" id="fcc-result" hidden></div>
    </div>`;
  document.body.appendChild(root);

  const toggle = document.createElement("button");
  toggle.id = "forge-command-toggle";
  toggle.type = "button";
  toggle.textContent = "🎙 Forge";
  document.body.appendChild(toggle);

  const command = root.querySelector("#fcc-command");
  const result = root.querySelector("#fcc-result");
  const status = root.querySelector("#fcc-status");
  const mic = root.querySelector("#fcc-mic");
  const mode = root.querySelector("#fcc-mode");
  let recognition = null;

  function setStatus(text) { status.textContent = text; }
  function showResult(text) { result.hidden = false; result.textContent = text; }
  function navigate(route) { const el = document.querySelector(`[data-route="${CSS.escape(route)}"]`); if (el) { el.click(); return true; } return false; }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showResult("Voice input is not available in this browser. Author's Forge voice input requires a browser with SpeechRecognition support; Chrome on the Chromebook is the intended first target."); return; }
    if (recognition) { recognition.stop(); return; }
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = command.value.trim();
    recognition.onstart = () => { mic.classList.add("recording"); mic.textContent = "■ Stop mic"; setStatus("Listening…"); };
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText = `${finalText} ${text}`.trim(); else interim += text;
      }
      command.value = `${finalText}${interim ? ` ${interim}` : ""}`.trim();
    };
    recognition.onerror = (event) => { setStatus(`Voice error: ${event.error}`); };
    recognition.onend = () => { recognition = null; mic.classList.remove("recording"); mic.textContent = "🎙 Start mic"; if (!status.textContent.startsWith("Voice error")) setStatus("Transcript captured"); };
    recognition.start();
  }

  async function runCommand() {
    const instruction = command.value.trim();
    if (!instruction) { showResult("Enter or dictate a command first."); return; }
    clearTimeout(window.__forgeCommandTimer);
    setStatus("Interpreting command…");
    const lower = instruction.toLowerCase();
    const routes = ["dashboard", "manuscript", "writing", "characters", "world", "research", "art", "marketing", "publishing", "genome", "governance"];
    const direct = routes.find((route) => lower === `open ${route}` || lower.includes(`take me to ${route}`) || lower.includes(`go to ${route}`));
    if (direct && navigate(direct)) { setStatus(`Opened ${direct}`); showResult(`Navigation command executed: ${direct}`); return; }

    try {
      const workspace = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspace`, { cache: "no-store" }).then(async (r) => { const p = await r.json(); if (!r.ok) throw new Error(p.error || `Workspace request failed (${r.status}).`); return p; });
      const book = workspace.books?.find((b) => b.id === workspace.activeBookId) || workspace.books?.[0];
      const chapter = book?.chapters?.[0];
      if (!book || !chapter) {
        navigate("manuscript");
        showResult("Forge needs a book and chapter before this AI command can operate on manuscript content. I opened Manuscript so you can create them.");
        setStatus("Book structure required");
        return;
      }
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/draft`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId: book.id, chapterId: chapter.id, instruction: `[${mode.value}] Author command:\n${instruction}`, focus: chapter.synopsis || instruction }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `AI command failed (${response.status}).`);
      const ai = document.querySelector("#ai-result");
      const direction = document.querySelector("#ai-instruction");
      if (direction) direction.value = instruction;
      if (ai) ai.value = payload.text || "";
      navigate("writing");
      showResult(`${payload.provider || "provider"} / ${payload.model || "model"}\n\nAI returned a candidate for your command. It has NOT been saved as canon or manuscript text.`);
      setStatus("Real AI candidate ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showResult(message);
      setStatus("Command failed safely");
    }
  }

  mic.addEventListener("click", startVoice);
  root.querySelector("#fcc-run").addEventListener("click", runCommand);
  root.querySelector("#fcc-close").addEventListener("click", () => { root.hidden = true; toggle.hidden = false; });
  toggle.addEventListener("click", () => { root.hidden = false; toggle.hidden = true; command.focus(); });
  command.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runCommand(); });
  window.addEventListener("beforeunload", () => { if (recognition) recognition.stop(); });
})();
