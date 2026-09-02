(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const projectId = params.get("project") || localStorage.getItem("forge-project") || "forge-studio";
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "content-type":"application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  };
  const projectUrl = (suffix) => `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
  let questions = [], assessmentMemoryId = null, lastLookup = null, aiControl = null;
  const answersKey = `forge-author-training:${projectId}`;

  function status(message, ok = true) {
    const element = $("#craft-status");
    if (!element) return;
    element.textContent = message;
    element.style.background = ok ? "#163f28" : "#751919";
    if (message) setTimeout(() => { if (element.textContent === message) element.textContent = ""; }, 6500);
  }

  function renderAiControlSurface() {
    if ($("#ai-control-card")) return;
    $("#training-card")?.insertAdjacentHTML("beforebegin", `
      <section class="craft-card wide" id="ai-control-card">
        <div class="section-title"><div><div class="eyebrow">PRIMARY AI CONTROL</div><h2>Switch providers and prevent paid-token fallback</h2><p><strong>No Paid Tokens</strong> blocks metered, unknown, and gateway-managed routes unless you explicitly classify a specific configured route as local, subscription-covered, or free. OmniRoute and 9Router remain broad routing options, but Forge does not assume their automatic routes are no-spend. Ollama and K.I.N.G.S. remain local-first options. Pin one provider/model for an exact source switch, or leave Forge on automatic failover.</p></div><button id="ai-control-refresh" type="button">Refresh routes</button></div>
        <form id="ai-control-form" class="craft-form">
          <div class="craft-grid">
            <label>Spend policy<select id="ai-spend-policy"><option value="no-paid-tokens">No Paid Tokens</option><option value="budgeted">Budgeted paid fallback</option><option value="unrestricted">Unrestricted configured APIs</option></select></label>
            <label>Routing preference<select id="ai-routing-mode"><option value="economy">Economy</option><option value="balanced">Balanced</option><option value="quality">Quality</option></select></label>
            <label>Maximum request cost (budgeted only)<input id="ai-cost-cap" type="number" min="0" step="0.000001" placeholder="Example: 0.02"></label>
            <label>Provider<select id="ai-provider"><option value="">Automatic across routes</option></select></label>
            <label>Model<select id="ai-model"><option value="">Automatic / configured model set</option></select></label>
          </div>
          <div class="craft-row"><button id="ai-load-models" type="button">Load live model catalog</button><button class="primary" type="submit">Save AI control</button><button id="ai-clear-pin" type="button">Return to automatic switching</button></div>
        </form>
        <div id="ai-policy-explanation" class="craft-output"></div>
        <h3>Configured AI resources</h3><div id="ai-resource-list" class="craft-candidates"></div>
      </section>`);
  }

  async function loadAiControl() {
    try {
      renderAiControlSurface();
      const result = await api(projectUrl("/ai/control"));
      aiControl = result.control;
      $("#ai-spend-policy").value = aiControl.spendPolicy;
      $("#ai-routing-mode").value = aiControl.routingMode;
      $("#ai-cost-cap").value = aiControl.maxEstimatedRequestCostUsd ?? "";
      const providers = [...new Set((result.resources || []).map((resource) => resource.provider))];
      const select = $("#ai-provider");
      select.innerHTML = '<option value="">Automatic across routes</option>' + providers.map((provider) => `<option value="${esc(provider)}">${esc(provider)}</option>`).join("");
      select.value = aiControl.pinnedProvider || "";
      $("#ai-model").innerHTML = `<option value="${esc(aiControl.pinnedModel || "")}">${esc(aiControl.pinnedModel || "Automatic / configured model set")}</option>`;
      $("#ai-policy-explanation").textContent = `${result.policyExplanation}\nProvider order: ${(aiControl.providerOrder || []).join(" → ")}`;
      $("#ai-resource-list").innerHTML = (result.resources || []).length ? result.resources.map((resource) => {
        const telemetry = (result.telemetry || []).find((item) => item.provider === resource.provider && item.model === resource.model);
        return `<article class="craft-choice"><strong>${esc(resource.provider)} / ${esc(resource.model)}</strong><p>${esc(resource.billingClass || "unknown")} billing · ${resource.healthy === false ? "unhealthy" : "available"}</p><small>${telemetry ? `${Number(telemetry.totalTokens || 0).toLocaleString()} accounted tokens · ${Number(telemetry.consecutiveFailures || 0)} recent failures` : "No runtime usage yet"}</small></article>`;
      }).join("") : '<p>No AI resources are configured yet.</p>';
    } catch (error) { status(error.message, false); }
  }

  async function loadLiveModels() {
    try {
      const provider = $("#ai-provider").value;
      if (!provider) throw new Error("Choose a provider first, or leave Forge on automatic switching.");
      const button = $("#ai-load-models"); button.disabled = true;
      const result = await api(`${projectUrl("/ai/catalog")}?provider=${encodeURIComponent(provider)}`);
      const models = result.models || [];
      const select = $("#ai-model");
      select.innerHTML = '<option value="">Automatic / configured model set</option>' + models.map((model) => `<option value="${esc(model.id)}">${esc(model.name || model.displayName || model.id)}</option>`).join("");
      if (aiControl?.pinnedProvider === provider && aiControl?.pinnedModel) select.value = aiControl.pinnedModel;
      status(`Loaded ${models.length} live model options from ${provider}.`);
    } catch (error) { status(error.message, false); }
    finally { $("#ai-load-models").disabled = false; }
  }

  async function saveAiControl(event) {
    event.preventDefault();
    try {
      const provider = $("#ai-provider").value;
      const model = $("#ai-model").value;
      if ((provider && !model) || (!provider && model)) throw new Error("To pin AI, choose both a provider and a model. Otherwise leave both automatic.");
      const cap = $("#ai-cost-cap").value.trim();
      const payload = {
        spendPolicy: $("#ai-spend-policy").value,
        routingMode: $("#ai-routing-mode").value,
        providerOrder: aiControl?.providerOrder || ["omniroute","9router","kings","ollama","groq","mistral","gemini","anthropic","openrouter","openai"],
        pinnedProvider: provider || null,
        pinnedModel: model || null,
        maxEstimatedRequestCostUsd: cap === "" ? null : Number(cap),
      };
      const result = await api(projectUrl("/ai/control"), { method:"POST", body:JSON.stringify(payload) });
      aiControl = result.control;
      status(aiControl.spendPolicy === "no-paid-tokens" ? "AI control saved. Paid-token fallback is blocked." : "AI control saved.");
      await loadAiControl();
    } catch (error) { status(error.message, false); }
  }

  async function clearAiPin() {
    $("#ai-provider").value = "";
    $("#ai-model").innerHTML = '<option value="">Automatic / configured model set</option>';
    try {
      const payload = { spendPolicy: $("#ai-spend-policy").value, routingMode: $("#ai-routing-mode").value, providerOrder: aiControl?.providerOrder || [], pinnedProvider:null, pinnedModel:null, maxEstimatedRequestCostUsd: $("#ai-cost-cap").value.trim() || null };
      await api(projectUrl("/ai/control"), { method:"POST", body:JSON.stringify(payload) });
      status("Forge returned to automatic provider/model switching.");
      await loadAiControl();
    } catch (error) { status(error.message, false); }
  }

  function savedAnswers() { try { return JSON.parse(localStorage.getItem(answersKey) || "{}"); } catch { return {}; } }
  function persistAnswers() {
    const values = {};
    document.querySelectorAll("[data-training-answer]").forEach((textarea) => { values[textarea.dataset.trainingAnswer] = textarea.value; });
    localStorage.setItem(answersKey, JSON.stringify(values));
    renderProgress();
  }
  function renderProgress() {
    const answered = [...document.querySelectorAll("[data-training-answer]")].filter((textarea) => textarea.value.trim()).length;
    $("#training-progress").textContent = `${answered} of ${questions.length} questions answered. Minimum 6 for assessment.`;
  }
  async function loadQuestions() {
    const result = await api(projectUrl("/author-training/questions"));
    questions = result.questions || [];
    const saved = savedAnswers();
    $("#training-questions").innerHTML = questions.map((question, index) => `<article class="craft-question"><label><strong>${index + 1}. ${esc(question.prompt)}</strong><small>${esc(question.category)} · ${esc(question.purpose)}</small><textarea data-training-answer="${esc(question.id)}" placeholder="Answer naturally, in your own words.">${esc(saved[question.id] || "")}</textarea></label></article>`).join("");
    document.querySelectorAll("[data-training-answer]").forEach((textarea) => textarea.addEventListener("input", persistAnswers));
    renderProgress();
  }
  async function assessTraining() {
    try {
      persistAnswers();
      const answers = [...document.querySelectorAll("[data-training-answer]")].map((textarea) => ({ questionId: textarea.dataset.trainingAnswer, answer: textarea.value.trim() })).filter((entry) => entry.answer);
      if (answers.length < 6) throw new Error("Answer at least six questions first.");
      const button = $("#training-assess"); button.disabled = true;
      $("#training-assessment").textContent = "Running real AI assessment…";
      const result = await api(projectUrl("/author-training/assess"), { method:"POST", body:JSON.stringify({ answers }) });
      assessmentMemoryId = result.assessmentMemoryId;
      $("#training-assessment").textContent = result.assessment;
      $("#training-provider").textContent = `${result.provider}/${result.model} · ${result.answered}/${result.totalQuestions} answered · author approval required`;
      $("#training-approve").disabled = false;
      status("Author answers saved as authoritative memory. AI profile created as a proposal for your review.");
    } catch (error) { $("#training-assessment").textContent = error.message; status(error.message, false); }
    finally { $("#training-assess").disabled = false; }
  }
  async function approveTraining() {
    try {
      if (!assessmentMemoryId) throw new Error("Create an assessment first.");
      await api(projectUrl(`/author-training/assessments/${encodeURIComponent(assessmentMemoryId)}/approve`), { method:"POST", body:"{}" });
      $("#training-approve").disabled = true;
      status("Author Voice Training Profile approved into authoritative project memory.");
    } catch (error) { status(error.message, false); }
  }

  function rhymePayload() { return { mode:$("#rhyme-mode").value, text:$("#rhyme-text").value, instruction:$("#rhyme-instruction").value }; }
  function renderRhyme(result) {
    $("#rhyme-metrics").innerHTML = [
      ["Mean syllables", result.meanSyllables], ["Syllable range", `${result.syllableRange[0]}–${result.syllableRange[1]}`], ["Cadence", `${Math.round(result.cadenceConsistency*100)}%`], ["End rhyme", `${Math.round(result.endRhymeCoverage*100)}%`]
    ].map(([label,value]) => `<div><strong>${esc(value)}</strong><small>${esc(label)}</small></div>`).join("");
    const lineRows = (result.lines || []).map((line) => `<tr><td>${line.lineNumber}</td><td>${esc(line.text)}</td><td>${line.syllables}</td><td>${esc(line.scheme)}</td><td>${esc(line.endWord)}</td></tr>`).join("");
    $("#rhyme-findings").innerHTML = `<p><strong>Detected scheme:</strong> ${esc(result.detectedScheme)}</p><p><strong>Strengths:</strong> ${esc((result.strengths || []).join(" ") || "No strong pattern detected yet.")}</p><p><strong>Warnings:</strong> ${esc((result.warnings || []).join(" ") || "None.")}</p><p><strong>Recommendations:</strong> ${esc((result.recommendations || []).join(" "))}</p><table class="craft-table"><thead><tr><th>Line</th><th>Text</th><th>Syllables</th><th>Scheme</th><th>End word</th></tr></thead><tbody>${lineRows}</tbody></table>`;
  }
  async function analyzeRhyme(event) {
    event?.preventDefault();
    try { const result = await api(projectUrl("/rhyme/analyze"), { method:"POST", body:JSON.stringify(rhymePayload()) }); renderRhyme(result); status("Rhyme and cadence analysis complete."); }
    catch (error) { status(error.message, false); }
  }
  async function reviseRhyme() {
    try {
      const button=$("#rhyme-revise");button.disabled=true;$("#rhyme-candidate").value="Running real AI revision…";
      const result = await api(projectUrl("/rhyme/revise"), { method:"POST", body:JSON.stringify(rhymePayload()) });
      renderRhyme(result.analysis);$("#rhyme-candidate").value=result.candidate;
      status(`Rhyme candidate stored for review via ${result.provider}/${result.model}.`);
    } catch (error) { $("#rhyme-candidate").value=error.message; status(error.message,false); }
    finally { $("#rhyme-revise").disabled=false; }
  }

  function renderLookup(result) {
    lastLookup=result;
    $("#lexicon-definitions").innerHTML = `<h3>${esc(result.query)}${result.phonetic ? ` · ${esc(result.phonetic)}` : ""}</h3>` + ((result.definitions || []).length ? result.definitions.map((item) => `<p><strong>${esc(item.partOfSpeech)}</strong> — ${esc(item.definition)}${item.example ? `<br><small>Example: ${esc(item.example)}</small>`:""}</p>`).join("") : "<p>No dictionary definition returned.</p>") + `<p class="craft-source">${(result.sources||[]).map((source)=>`${esc(source.name)}: ${source.available?"available":`unavailable (${esc(source.error||"unknown error")})`}`).join(" · ")}</p>`;
    $("#lexicon-candidates").innerHTML = (result.candidates || []).map((candidate) => `<article class="craft-choice"><label><input type="checkbox" data-lexical-choice value="${esc(candidate.word)}"><span><strong>${esc(candidate.word)}</strong> <small>${esc(candidate.source)}</small><br>${candidate.definitions?.[0] ? esc(candidate.definitions[0]) : ""}${candidate.previewSentence ? `<br><em>${esc(candidate.previewSentence)}</em>`:""}${candidate.syllables ? `<br><small>${candidate.syllables} syllable${candidate.syllables===1?"":"s"}</small>`:""}</span></label></article>`).join("") || "<p>No lexical alternatives returned.</p>";
  }
  async function lookupLexicon(event) {
    event.preventDefault();
    try { const result=await api(projectUrl("/lexicon/lookup"),{method:"POST",body:JSON.stringify({word:$("#lexicon-word").value,sentence:$("#lexicon-sentence").value})});renderLookup(result);status("Dictionary and thesaurus lookup complete."); }
    catch(error){status(error.message,false);}
  }
  async function compareLexicon() {
    try {
      if(!lastLookup)throw new Error("Look up the word first.");
      const candidates=[...document.querySelectorAll("[data-lexical-choice]:checked")].map((input)=>input.value);
      if(!candidates.length)throw new Error("Select at least one alternative to compare.");
      const sentence=$("#lexicon-sentence").value.trim();if(!sentence)throw new Error("Add the source sentence so Forge can compare nuance in context.");
      const button=$("#lexicon-compare");button.disabled=true;$("#lexicon-comparison").textContent="Running real AI nuance comparison…";
      const result=await api(projectUrl("/lexicon/compare"),{method:"POST",body:JSON.stringify({word:$("#lexicon-word").value,sentence,candidates})});
      $("#lexicon-comparison").textContent=result.comparison;status(`Word-choice comparison complete via ${result.provider}/${result.model}.`);
    }catch(error){$("#lexicon-comparison").textContent=error.message;status(error.message,false);}finally{$("#lexicon-compare").disabled=false;}
  }

  function bind() {
    renderAiControlSurface();
    $("#main-studio").href=`/?project=${encodeURIComponent(projectId)}`;
    $("#refresh-project").addEventListener("click",()=>Promise.all([loadAiControl(),loadQuestions()]));
    $("#ai-control-form").addEventListener("submit",saveAiControl);
    $("#ai-control-refresh").addEventListener("click",loadAiControl);
    $("#ai-load-models").addEventListener("click",loadLiveModels);
    $("#ai-clear-pin").addEventListener("click",clearAiPin);
    $("#ai-provider").addEventListener("change",()=>{$("#ai-model").innerHTML='<option value="">Automatic / configured model set</option>';});
    $("#training-assess").addEventListener("click",assessTraining);
    $("#training-approve").addEventListener("click",approveTraining);
    $("#rhyme-form").addEventListener("submit",analyzeRhyme);
    $("#rhyme-revise").addEventListener("click",reviseRhyme);
    $("#lexicon-form").addEventListener("submit",lookupLexicon);
    $("#lexicon-compare").addEventListener("click",compareLexicon);
  }

  bind();
  Promise.all([loadAiControl(),loadQuestions()]).catch((error)=>status(error.message,false));
})();
