/* Author's Forge Design & Motion Offices — real browser rendering, Project Brain working-memory saves, GIF89a and MediaRecorder output. */
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const canvas = $("#media-canvas");
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  const controls = $("#media-controls");
  const status = $("#media-status");
  const projectInput = $("#media-project");
  const titleInput = $("#media-title");
  const frameCard = $("#media-timeline-card");
  const frameList = $("#media-frame-list");
  const memorySummary = $("#media-memory-summary");
  const sizePill = $("#media-size-pill");
  const officeTitle = $("#media-office-title");
  const officeNote = $("#media-office-note");
  const exportNote = $("#media-export-note");
  const imageUrlInput = $("#media-image-url");
  const imageFileInput = $("#media-image-file");
  const back = $("#media-back");

  const MODES = Object.freeze({
    calendar: { title: "Calendar Office", note: "Monthly planning with dated notes and clean print output.", width: 1500, height: 1200 },
    advertisement: { title: "Advertisement Office", note: "Brand-aware campaign creative with social, display, story and print presets.", width: 1080, height: 1080 },
    "daily-planner": { title: "Daily Planner Office", note: "Priorities, schedule, tasks and notes in a reusable dated layout.", width: 1200, height: 1600 },
    meme: { title: "Meme Office", note: "Static image memes with editable captions and real PNG/JPEG export.", width: 1080, height: 1080 },
    gif: { title: "GIF Office", note: "Frame-by-frame animated GIF creation with a native GIF89a encoder.", width: 720, height: 720 },
    "stop-motion": { title: "Stop-Motion Video Office", note: "Timed frames rendered into a real browser-recorded video file.", width: 720, height: 720 },
  });

  const AD_PRESETS = Object.freeze({
    square: { label: "Instagram / social square · 1080×1080", width: 1080, height: 1080 },
    story: { label: "Story / Reel · 1080×1920", width: 1080, height: 1920 },
    landscape: { label: "Landscape social/display · 1200×628", width: 1200, height: 628 },
    portrait: { label: "Portrait social · 1080×1350", width: 1080, height: 1350 },
    leaderboard: { label: "Leaderboard display · 728×90", width: 728, height: 90 },
    letter: { label: "US Letter print · 2550×3300", width: 2550, height: 3300 },
  });

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const imageCache = new Map();
  let state = defaultState("calendar");
  let rendering = 0;
  let playing = false;

  function nowDate() { return new Date(); }
  function currentProjectId() {
    const value = projectInput.value.trim();
    if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Project ID may contain only letters, numbers, hyphens, and underscores.");
    return value;
  }
  function safeUuid() { return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function safeName(value) { return String(value || "forge-design").trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "forge-design"; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function setStatus(message) { status.textContent = message || ""; }
  function activeFrame() { return state.frames.find((frame) => frame.id === state.activeFrameId) || state.frames[0] || null; }

  function defaultState(mode) {
    const today = nowDate();
    const base = {
      formatVersion: 1,
      mode,
      title: "New Forge Design",
      width: MODES[mode].width,
      height: MODES[mode].height,
      background: "#f7f2e7",
      accent: "#b68a3f",
      textColor: "#17191b",
      imageUrl: "",
      imageDataUrl: "",
      updatedAt: new Date().toISOString(),
      calendarMonth: today.getMonth(),
      calendarYear: today.getFullYear(),
      calendarEvents: "",
      adPreset: "square",
      brand: "AUTHOR'S FORGE",
      headline: mode === "advertisement" ? "MAKE THE MESSAGE IMPOSSIBLE TO MISS" : "",
      body: mode === "advertisement" ? "Clear value. Strong visual hierarchy. One deliberate action." : "",
      cta: mode === "advertisement" ? "LEARN MORE" : "",
      footer: "",
      plannerDate: today.toISOString().slice(0, 10),
      priorities: "Priority one\nPriority two\nPriority three",
      tasks: "Task one\nTask two\nTask three",
      notes: "",
      memeTop: "WHEN THE FIRST DRAFT",
      memeBottom: "ACTUALLY STARTS WORKING",
      frames: [],
      activeFrameId: "",
    };
    if (mode === "gif" || mode === "stop-motion") {
      base.frames = [
        makeFrame({ headline: "FRAME ONE", body: "Set the first beat.", background: "#f7f2e7", accent: "#b68a3f" }),
        makeFrame({ headline: "FRAME TWO", body: "Move the idea forward.", background: "#17191b", accent: "#d8b96f", textColor: "#f7f2e7" }),
      ];
      base.activeFrameId = base.frames[0].id;
    }
    return base;
  }

  function makeFrame(overrides = {}) {
    return {
      id: `frame-${safeUuid()}`,
      durationMs: 700,
      headline: "NEW FRAME",
      body: "Editable frame text",
      footer: "",
      background: "#f7f2e7",
      accent: "#b68a3f",
      textColor: "#17191b",
      imageUrl: "",
      imageDataUrl: "",
      ...overrides,
    };
  }

  function theme() {
    const saved = localStorage.getItem("forge-theme");
    return saved === "dark" || saved === "light" ? saved : (matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light");
  }
  function applyTheme(next = theme()) {
    document.documentElement.dataset.forgeTheme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("forge-theme", next);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Forge request failed (${response.status}).`);
    return body;
  }

  function optionList(values, selected) {
    return values.map(([value, label]) => `<option value="${escapeAttr(value)}"${String(value) === String(selected) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char])); }
  function escapeAttr(value) { return escapeHtml(value); }

  function renderControls() {
    const frame = activeFrame();
    let html = "";
    if (state.mode === "calendar") {
      html = `
        <div class="media-two"><label>Month<select data-field="calendarMonth">${optionList(MONTHS.map((name,index)=>[index,name]),state.calendarMonth)}</select></label><label>Year<input data-field="calendarYear" type="number" min="1900" max="2200" value="${state.calendarYear}"></label></div>
        <label>Dated notes <textarea data-field="calendarEvents" placeholder="5 | Launch day\n14 | Newsletter\n28 | Review results">${escapeHtml(state.calendarEvents)}</textarea></label>
        ${colorControls(state)}`;
    } else if (state.mode === "advertisement") {
      html = `
        <label>Ad format<select data-field="adPreset">${optionList(Object.entries(AD_PRESETS).map(([id,p])=>[id,p.label]),state.adPreset)}</select></label>
        <label>Brand<input data-field="brand" value="${escapeAttr(state.brand)}"></label>
        <label>Headline<textarea data-field="headline">${escapeHtml(state.headline)}</textarea></label>
        <label>Supporting copy<textarea data-field="body">${escapeHtml(state.body)}</textarea></label>
        <div class="media-two"><label>Call to action<input data-field="cta" value="${escapeAttr(state.cta)}"></label><label>Footer / URL<input data-field="footer" value="${escapeAttr(state.footer)}"></label></div>
        ${colorControls(state)}`;
    } else if (state.mode === "daily-planner") {
      html = `
        <label>Date<input data-field="plannerDate" type="date" value="${escapeAttr(state.plannerDate)}"></label>
        <label>Top priorities<textarea data-field="priorities">${escapeHtml(state.priorities)}</textarea></label>
        <label>Tasks<textarea data-field="tasks">${escapeHtml(state.tasks)}</textarea></label>
        <label>Notes<textarea data-field="notes">${escapeHtml(state.notes)}</textarea></label>
        ${colorControls(state)}`;
    } else if (state.mode === "meme") {
      html = `
        <label>Top text<textarea data-field="memeTop">${escapeHtml(state.memeTop)}</textarea></label>
        <label>Bottom text<textarea data-field="memeBottom">${escapeHtml(state.memeBottom)}</textarea></label>
        <label>Small footer<input data-field="footer" value="${escapeAttr(state.footer)}"></label>
        ${colorControls(state)}`;
    } else {
      html = `
        <label>Frame headline<textarea data-frame-field="headline">${escapeHtml(frame?.headline || "")}</textarea></label>
        <label>Frame body<textarea data-frame-field="body">${escapeHtml(frame?.body || "")}</textarea></label>
        <label>Frame footer<input data-frame-field="footer" value="${escapeAttr(frame?.footer || "")}"></label>
        <label>Frame duration (milliseconds)<input data-frame-field="durationMs" type="number" min="80" max="10000" step="10" value="${Number(frame?.durationMs || 700)}"></label>
        ${colorControls(frame || state, true)}`;
    }
    controls.innerHTML = html;
    controls.querySelectorAll("input,select,textarea").forEach((input) => input.addEventListener("input", syncControls));
    controls.querySelectorAll("select").forEach((input) => input.addEventListener("change", syncControls));
    updateModeUi();
  }

  function colorControls(source, frame = false) {
    const prefix = frame ? "data-frame-field" : "data-field";
    return `<div class="media-three"><label>Background<input ${prefix}="background" type="color" value="${escapeAttr(source.background)}"></label><label>Accent<input ${prefix}="accent" type="color" value="${escapeAttr(source.accent)}"></label><label>Text<input ${prefix}="textColor" type="color" value="${escapeAttr(source.textColor)}"></label></div>`;
  }

  function syncControls(event) {
    const node = event.target;
    const field = node.dataset.field;
    const frameField = node.dataset.frameField;
    let value = node.type === "number" ? Number(node.value) : node.value;
    if (field) {
      state[field] = value;
      if (field === "adPreset" && AD_PRESETS[value]) {
        state.width = AD_PRESETS[value].width;
        state.height = AD_PRESETS[value].height;
      }
    }
    if (frameField) {
      const frame = activeFrame();
      if (frame) frame[frameField] = frameField === "durationMs" ? clamp(Number(value) || 700, 80, 10000) : value;
    }
    state.updatedAt = new Date().toISOString();
    updateModeUi();
    render().catch((error) => setStatus(error.message));
  }

  function updateModeUi() {
    const config = MODES[state.mode];
    officeTitle.textContent = config.title;
    officeNote.textContent = config.note;
    sizePill.textContent = `${state.width} × ${state.height}px`;
    document.querySelectorAll("#media-modes [data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
    const motion = state.mode === "gif" || state.mode === "stop-motion";
    frameCard.hidden = !motion;
    $("#media-export-gif").disabled = !motion;
    $("#media-export-video").disabled = state.mode !== "stop-motion";
    exportNote.textContent = motion
      ? (state.mode === "gif" ? "GIF export creates a real looping GIF89a file from the visible frame timeline." : "Video export records the real frame timeline with MediaRecorder. GIF export is also available as a portable fallback.")
      : "Static modes export PNG/JPEG and can print or save to PDF through the browser print workflow.";
    renderFrames();
  }

  function setMode(mode) {
    if (!MODES[mode]) return;
    const title = titleInput.value.trim() || state.title || "New Forge Design";
    state = defaultState(mode);
    state.title = title;
    renderControls();
    render().catch((error) => setStatus(error.message));
    setStatus(`${MODES[mode].title} ready. No project state changed until you save.`);
  }

  function renderFrames() {
    if (frameCard.hidden) return;
    frameList.replaceChildren();
    for (const [index, frame] of state.frames.entries()) {
      const row = document.createElement("div");
      row.className = `media-frame${frame.id === state.activeFrameId ? " active" : ""}`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${index + 1}. ${frame.headline || "Untitled frame"} · ${frame.durationMs}ms`;
      button.addEventListener("click", () => { state.activeFrameId = frame.id; renderControls(); render().catch((error)=>setStatus(error.message)); });
      const badge = document.createElement("span"); badge.className = "media-pill"; badge.textContent = `${frame.durationMs} ms`;
      row.append(button, badge); frameList.append(row);
    }
  }

  async function render() {
    const ticket = ++rendering;
    canvas.width = Math.max(64, Math.round(state.width));
    canvas.height = Math.max(64, Math.round(state.height));
    await drawState(ctx, canvas.width, canvas.height, state, activeFrame());
    if (ticket !== rendering) return;
    sizePill.textContent = `${canvas.width} × ${canvas.height}px`;
  }

  async function drawState(context, width, height, design, frame = null) {
    const source = frame || design;
    context.save();
    context.fillStyle = source.background || design.background || "#ffffff";
    context.fillRect(0, 0, width, height);
    const imageSource = source.imageDataUrl || source.imageUrl || design.imageDataUrl || design.imageUrl;
    if (imageSource) {
      try { await drawCoverImage(context, width, height, imageSource, design.mode === "meme" ? 1 : 0.46); }
      catch (error) { if (context === ctx) setStatus(`Background visual could not be drawn safely: ${error.message}`); }
    }
    if (design.mode === "calendar") drawCalendar(context, width, height, design);
    else if (design.mode === "daily-planner") drawPlanner(context, width, height, design);
    else if (design.mode === "meme") drawMeme(context, width, height, design);
    else drawPoster(context, width, height, design, source);
    context.restore();
  }

  async function drawCoverImage(context, width, height, source, opacity = 1) {
    const image = await loadImage(source);
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
    context.save(); context.globalAlpha = opacity;
    context.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
    context.restore();
  }

  function loadImage(source) {
    if (imageCache.has(source)) return imageCache.get(source);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      if (/^https?:/i.test(source)) image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image could not be loaded. Remote URLs must allow cross-origin image use for export."));
      image.src = source;
    });
    imageCache.set(source, promise);
    return promise;
  }

  function drawCalendar(context, width, height, design) {
    const pad = width * .055, headerH = height * .17, gridTop = headerH + pad * .25;
    context.fillStyle = design.textColor; context.font = `700 ${Math.round(width*.055)}px Georgia,serif`;
    context.fillText(`${MONTHS[Number(design.calendarMonth)]} ${design.calendarYear}`, pad, pad * 1.2);
    context.fillStyle = design.accent; context.fillRect(pad, headerH - 10, width - pad * 2, 6);
    const names = ["SUN","MON","TUE","WED","THU","FRI","SAT"], cellW = (width - pad * 2) / 7, cellH = (height - gridTop - pad) / 7;
    context.textAlign = "center"; context.font = `700 ${Math.max(14,Math.round(width*.018))}px Arial,sans-serif`;
    for (let col=0; col<7; col++) { context.fillStyle = design.accent; context.fillText(names[col], pad + cellW*(col+.5), gridTop + cellH*.42); }
    context.textAlign = "left"; context.strokeStyle = withAlpha(design.textColor,.22); context.lineWidth = Math.max(1,width/900);
    const first = new Date(Number(design.calendarYear), Number(design.calendarMonth), 1).getDay();
    const count = new Date(Number(design.calendarYear), Number(design.calendarMonth)+1, 0).getDate();
    const events = parseCalendarEvents(design.calendarEvents);
    for (let row=0; row<6; row++) for (let col=0; col<7; col++) {
      const x=pad+cellW*col, y=gridTop+cellH*(row+1);
      context.strokeRect(x,y,cellW,cellH);
      const day=row*7+col-first+1;
      if(day>=1&&day<=count){
        context.fillStyle=design.textColor;context.font=`700 ${Math.max(16,Math.round(width*.022))}px Arial,sans-serif`;context.fillText(String(day),x+cellW*.08,y+cellH*.22);
        const note=events.get(day);if(note){context.fillStyle=design.accent;context.font=`600 ${Math.max(11,Math.round(width*.011))}px Arial,sans-serif`;drawWrapped(context,note,x+cellW*.08,y+cellH*.4,cellW*.84,cellH*.16,4);}
      }
    }
  }

  function parseCalendarEvents(value) {
    const map = new Map();
    for (const line of String(value||"").split(/\n+/)) { const match=line.match(/^\s*(\d{1,2})\s*[|:-]\s*(.+)$/); if(match) map.set(Number(match[1]),match[2].trim()); }
    return map;
  }

  function drawPlanner(context, width, height, design) {
    const pad=width*.055, gap=width*.025, header=height*.12, leftW=width*.42, rightX=pad+leftW+gap, rightW=width-pad-rightX;
    context.fillStyle=design.textColor;context.font=`700 ${Math.round(width*.048)}px Georgia,serif`;context.fillText("DAILY PLANNER",pad,pad*1.05);
    context.font=`600 ${Math.round(width*.022)}px Arial,sans-serif`;context.fillStyle=design.accent;context.fillText(formatDate(design.plannerDate),pad,header*.86);
    context.strokeStyle=withAlpha(design.textColor,.22);context.lineWidth=Math.max(2,width/900);
    sectionBox(context,pad,header,leftW,height*.24,"TOP PRIORITIES",design.priorities,design);
    sectionBox(context,pad,header+height*.26,leftW,height*.32,"TASKS",design.tasks,design,true);
    sectionBox(context,pad,header+height*.60,leftW,height*.27,"NOTES",design.notes,design);
    const scheduleY=header, scheduleH=height*.87;
    context.strokeRect(rightX,scheduleY,rightW,scheduleH);context.fillStyle=design.accent;context.font=`700 ${Math.round(width*.018)}px Arial,sans-serif`;context.fillText("SCHEDULE",rightX+rightW*.06,scheduleY+height*.035);
    const hours=13, top=scheduleY+height*.055, rowH=(scheduleH-height*.07)/hours;
    context.font=`600 ${Math.round(width*.014)}px Arial,sans-serif`;
    for(let i=0;i<hours;i++){const y=top+i*rowH;context.strokeStyle=withAlpha(design.textColor,.16);context.beginPath();context.moveTo(rightX,y);context.lineTo(rightX+rightW,y);context.stroke();context.fillStyle=design.textColor;context.fillText(`${i+8}:00`,rightX+rightW*.04,y+rowH*.42);}
  }

  function sectionBox(context,x,y,w,h,title,text,design,checks=false){context.strokeStyle=withAlpha(design.textColor,.22);context.strokeRect(x,y,w,h);context.fillStyle=design.accent;context.font=`700 ${Math.round(w*.05)}px Arial,sans-serif`;context.fillText(title,x+w*.05,y+h*.13);context.fillStyle=design.textColor;context.font=`500 ${Math.round(w*.042)}px Arial,sans-serif`;let cy=y+h*.24;for(const line of String(text||"").split(/\n/).filter(Boolean).slice(0,10)){if(checks){context.strokeRect(x+w*.05,cy-w*.025,w*.025,w*.025);drawWrapped(context,line,x+w*.1,cy,w*.84,h*.08,2);}else drawWrapped(context,`• ${line}`,x+w*.05,cy,w*.88,h*.08,2);cy+=h*.105;}}

  function drawMeme(context,width,height,design){
    context.textAlign="center";context.textBaseline="top";const font=Math.max(28,Math.round(width*.075));context.font=`900 ${font}px Impact,Arial Black,sans-serif`;context.lineJoin="round";context.lineWidth=Math.max(3,font*.08);context.strokeStyle="#000";context.fillStyle="#fff";
    drawMemeText(context,String(design.memeTop||"").toUpperCase(),width/2,height*.035,width*.92,font*1.02);
    context.textBaseline="bottom";drawMemeText(context,String(design.memeBottom||"").toUpperCase(),width/2,height*.965,width*.92,font*1.02,true);
    if(design.footer){context.textBaseline="bottom";context.lineWidth=0;context.fillStyle="rgba(255,255,255,.92)";context.font=`600 ${Math.max(14,Math.round(width*.018))}px Arial,sans-serif`;context.fillText(design.footer,width/2,height*.995);}
    context.textAlign="left";context.textBaseline="alphabetic";
  }

  function drawMemeText(context,text,cx,y,maxWidth,lineHeight,bottom=false){const words=text.split(/\s+/).filter(Boolean),lines=[];let line="";for(const word of words){const test=line?`${line} ${word}`:word;if(context.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);const start=bottom?y-(lines.length-1)*lineHeight:y;lines.forEach((item,index)=>{const yy=bottom?start+index*lineHeight:start+index*lineHeight;context.strokeText(item,cx,yy);context.fillText(item,cx,yy);});}

  function drawPoster(context,width,height,design,source){
    const pad=width*.065, accent=source.accent||design.accent, text=source.textColor||design.textColor;
    context.fillStyle=accent;context.fillRect(0,0,Math.max(10,width*.018),height);
    const brand=design.mode==="advertisement"?design.brand:"AUTHOR'S FORGE";
    context.fillStyle=accent;context.font=`700 ${Math.max(12,Math.round(width*.022))}px Arial,sans-serif`;context.fillText(String(brand||"").toUpperCase(),pad,pad*.9);
    context.fillStyle=text;context.font=`700 ${Math.max(28,Math.round(width*.075))}px Georgia,serif`;drawWrapped(context,source.headline||design.headline||"",pad,height*.25,width-pad*2,height*.09,5);
    context.font=`500 ${Math.max(18,Math.round(width*.029))}px Arial,sans-serif`;context.fillStyle=text;drawWrapped(context,source.body||design.body||"",pad,height*.58,width-pad*2,height*.045,7);
    const cta=design.mode==="advertisement"?design.cta:"";if(cta){const buttonW=Math.min(width*.55,Math.max(width*.24,context.measureText(cta).width+pad*.8)),buttonH=Math.max(50,height*.07),x=pad,y=height-buttonH-pad*1.4;context.fillStyle=accent;roundRect(context,x,y,buttonW,buttonH,buttonH*.18);context.fill();context.fillStyle="#111";context.font=`800 ${Math.max(14,Math.round(width*.022))}px Arial,sans-serif`;context.textAlign="center";context.textBaseline="middle";context.fillText(cta,x+buttonW/2,y+buttonH/2);context.textAlign="left";context.textBaseline="alphabetic";}
    const footer=source.footer||design.footer;if(footer){context.fillStyle=text;context.font=`600 ${Math.max(12,Math.round(width*.017))}px Arial,sans-serif`;context.fillText(footer,pad,height-pad*.7);}
  }

  function roundRect(context,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);context.beginPath();context.moveTo(x+rr,y);context.arcTo(x+w,y,x+w,y+h,rr);context.arcTo(x+w,y+h,x,y+h,rr);context.arcTo(x,y+h,x,y,rr);context.arcTo(x,y,x+w,y,rr);context.closePath();}
  function withAlpha(hex,alpha){const value=String(hex||"#000").replace("#","");const raw=value.length===3?value.split("").map(c=>c+c).join(""):value;const n=parseInt(raw,16);if(!Number.isFinite(n))return `rgba(0,0,0,${alpha})`;return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;}
  function drawWrapped(context,text,x,y,maxWidth,lineHeight,maxLines=99){const words=String(text||"").split(/\s+/).filter(Boolean);let line="",lines=[];for(const word of words){const test=line?`${line} ${word}`:word;if(context.measureText(test).width>maxWidth&&line){lines.push(line);line=word;if(lines.length>=maxLines)break;}else line=test;}if(line&&lines.length<maxLines)lines.push(line);lines.forEach((value,index)=>context.fillText(value,x,y+lineHeight*index));}
  function formatDate(value){const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?value:date.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"});}

  function setImageSource(source, isData=false) {
    const target = (state.mode === "gif" || state.mode === "stop-motion") ? activeFrame() : state;
    if (!target) return;
    target.imageUrl = isData ? "" : source;
    target.imageDataUrl = isData ? source : "";
    render().catch((error)=>setStatus(error.message));
  }

  async function applyImage() {
    const url=imageUrlInput.value.trim();
    const file=imageFileInput.files?.[0];
    if(file){if(file.size>4*1024*1024)throw new Error("Local design images are limited to 4 MiB per frame/session. Use a URL or smaller image for this browser workspace.");const data=await readDataUrl(file);setImageSource(data,true);setStatus(file.size<=350000?"Local image applied and small enough to persist with a Project Brain save.":"Local image applied for this session. It is too large for safe Project Brain embedding and will be omitted from saved working memory.");return;}
    if(!url)throw new Error("Enter an image URL or choose an image file.");setImageSource(url,false);setStatus("Image URL applied. Export will succeed only if the remote server permits cross-origin canvas use.");
  }
  function readDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Image file could not be read."));reader.readAsDataURL(file);});}

  function addFrame() { const frame=makeFrame({ headline:`FRAME ${state.frames.length+1}` }); state.frames.push(frame); state.activeFrameId=frame.id; renderControls(); render().catch((error)=>setStatus(error.message)); }
  function duplicateFrame(){const frame=activeFrame();if(!frame)return;const copy={...JSON.parse(JSON.stringify(frame)),id:`frame-${safeUuid()}`};state.frames.push(copy);state.activeFrameId=copy.id;renderControls();render().catch((error)=>setStatus(error.message));}
  function deleteFrame(){if(state.frames.length<=1){setStatus("Motion projects require at least one frame.");return;}const index=state.frames.findIndex(frame=>frame.id===state.activeFrameId);state.frames.splice(Math.max(0,index),1);state.activeFrameId=state.frames[Math.max(0,index-1)]?.id||state.frames[0].id;renderControls();render().catch((error)=>setStatus(error.message));}

  async function previewAnimation(){if(playing||!state.frames.length)return;playing=true;setStatus("Previewing the actual frame timeline…");const original=state.activeFrameId;try{for(const frame of state.frames){state.activeFrameId=frame.id;renderControls();await render();await sleep(clamp(frame.durationMs,80,3000));}}finally{state.activeFrameId=original;playing=false;renderControls();await render();setStatus("Animation preview complete.");}}
  const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

  async function exportRaster(type) {
    await render();
    const mime=type==="jpeg"?"image/jpeg":"image/png";
    const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob((value)=>value?resolve(value):reject(new Error("Canvas export returned no bytes.")),mime,type==="jpeg"?.92:undefined);}catch(error){reject(new Error(`Raster export blocked: ${error.message}`));}});
    downloadBlob(blob,`${safeName(titleInput.value||state.title)}.${type==="jpeg"?"jpg":"png"}`);
    setStatus(`${type.toUpperCase()} exported from the current canvas.`);
  }

  async function exportGif() {
    if(state.mode!=="gif"&&state.mode!=="stop-motion")throw new Error("Animated GIF export is available in the GIF and Stop-Motion offices.");
    if(state.frames.length<2)throw new Error("Animated GIF export requires at least two frames.");
    setStatus(`Rendering ${state.frames.length} frames into GIF89a…`);
    const {width,height}=scaledDimensions(state.width,state.height,480);
    const work=document.createElement("canvas");work.width=width;work.height=height;const c=work.getContext("2d",{alpha:false,willReadFrequently:true});
    const encodedFrames=[];
    for(const frame of state.frames){await drawState(c,width,height,{...state,width,height},frame);let data;try{data=c.getImageData(0,0,width,height);}catch(error){throw new Error(`GIF export cannot read the canvas pixels. A remote image may lack CORS permission. ${error.message}`);}encodedFrames.push({indices:quantize332(data.data),delayMs:clamp(Number(frame.durationMs)||700,80,10000)});}
    const bytes=encodeGif89a(width,height,encodedFrames);
    downloadBlob(new Blob([bytes],{type:"image/gif"}),`${safeName(titleInput.value||state.title)}.gif`);
    setStatus(`Animated GIF exported (${bytes.byteLength.toLocaleString()} bytes, ${width}×${height}).`);
  }

  async function exportVideo() {
    if(state.mode!=="stop-motion")throw new Error("Video export is available in the Stop-Motion office.");
    if(!globalThis.MediaRecorder||typeof document.createElement("canvas").captureStream!=="function")throw new Error("This browser does not expose MediaRecorder canvas video export. Forge will not pretend a video was created; use animated GIF export on this device.");
    const supported=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"].find((mime)=>!MediaRecorder.isTypeSupported||MediaRecorder.isTypeSupported(mime));
    if(!supported)throw new Error("This browser reports no supported MediaRecorder video format for canvas capture. Use GIF export instead.");
    const {width,height}=scaledDimensions(state.width,state.height,720);const work=document.createElement("canvas");work.width=width;work.height=height;const c=work.getContext("2d",{alpha:false});const stream=work.captureStream(30);const chunks=[];let recorder;
    try{recorder=new MediaRecorder(stream,{mimeType:supported});}catch(error){throw new Error(`Browser rejected ${supported} recording: ${error.message}`);}
    recorder.ondataavailable=(event)=>{if(event.data?.size)chunks.push(event.data);};
    const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=(event)=>reject(event.error||new Error("MediaRecorder failed."));});
    setStatus(`Recording stop-motion timeline as ${supported}…`);recorder.start(100);
    try{for(const frame of state.frames){await drawState(c,width,height,{...state,width,height},frame);await sleep(clamp(Number(frame.durationMs)||700,80,10000));}}finally{if(recorder.state!=="inactive")recorder.stop();}
    await stopped;stream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks,{type:supported});if(!blob.size)throw new Error("MediaRecorder completed without video bytes.");const ext=supported.includes("mp4")?"mp4":"webm";downloadBlob(blob,`${safeName(titleInput.value||state.title)}.${ext}`);setStatus(`Stop-motion video exported as ${ext.toUpperCase()} (${blob.size.toLocaleString()} bytes).`);
  }

  function scaledDimensions(width,height,max){const scale=Math.min(1,max/Math.max(width,height));return{width:Math.max(2,Math.round(width*scale)),height:Math.max(2,Math.round(height*scale))};}

  function quantize332(rgba){const out=new Uint8Array(rgba.length/4);for(let p=0,i=0;p<rgba.length;p+=4,i++){out[i]=((rgba[p]>>5)<<5)|((rgba[p+1]>>5)<<2)|(rgba[p+2]>>6);}return out;}

  function encodeGif89a(width,height,frames){
    const bytes=[];const push=(...values)=>bytes.push(...values.map(value=>value&255));const str=(value)=>{for(const char of value)push(char.charCodeAt(0));};const u16=(value)=>push(value&255,(value>>8)&255);
    str("GIF89a");u16(width);u16(height);push(0xF7,0,0);
    for(let i=0;i<256;i++){push(Math.round(((i>>5)&7)*255/7),Math.round(((i>>2)&7)*255/7),Math.round((i&3)*255/3));}
    push(0x21,0xFF,0x0B);str("NETSCAPE2.0");push(0x03,0x01,0x00,0x00,0x00);
    for(const frame of frames){const delay=clamp(Math.round(frame.delayMs/10),2,65535);push(0x21,0xF9,0x04,0x04);u16(delay);push(0,0);push(0x2C);u16(0);u16(0);u16(width);u16(height);push(0);push(8);const packed=lzwEncode(frame.indices,8);for(let offset=0;offset<packed.length;offset+=255){const len=Math.min(255,packed.length-offset);push(len);for(let i=0;i<len;i++)push(packed[offset+i]);}push(0);}
    push(0x3B);return new Uint8Array(bytes);
  }

  function lzwEncode(indices,minCodeSize){
    if(!indices.length)return new Uint8Array();const clear=1<<minCodeSize,end=clear+1;let codeSize=minCodeSize+1,next=end+1,dict=new Map(),current=0,bits=0;const out=[];
    const emit=(code)=>{current|=code<<bits;bits+=codeSize;while(bits>=8){out.push(current&255);current>>>=8;bits-=8;}};
    const reset=()=>{dict=new Map();codeSize=minCodeSize+1;next=end+1;};
    emit(clear);let prefix=indices[0];
    for(let i=1;i<indices.length;i++){const k=indices[i],key=(prefix<<8)|k;if(dict.has(key)){prefix=dict.get(key);continue;}emit(prefix);if(next<4096){dict.set(key,next++);if(next===(1<<codeSize)&&codeSize<12)codeSize++;}else{emit(clear);reset();}prefix=k;}
    emit(prefix);emit(end);if(bits>0)out.push(current&255);return new Uint8Array(out);
  }

  function downloadBlob(blob,fileName){const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=fileName;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}

  function memorySafeState(){const copy=JSON.parse(JSON.stringify(state));let stripped=0;const scrub=(target)=>{if(target?.imageDataUrl&&target.imageDataUrl.length>350000){target.imageDataUrl="";stripped++;}};scrub(copy);for(const frame of copy.frames||[])scrub(frame);let raw=JSON.stringify(copy);if(raw.length>1200000){scrubAll(copy);stripped++;raw=JSON.stringify(copy);}return{copy,stripped,raw};}
  function scrubAll(copy){copy.imageDataUrl="";for(const frame of copy.frames||[])frame.imageDataUrl="";}

  async function saveMemory(){
    const id=currentProjectId();state.title=titleInput.value.trim()||state.title;state.updatedAt=new Date().toISOString();const safe=memorySafeState();const envelope={formatVersion:1,kind:"forge-design-motion",state:safe.copy,savedAt:state.updatedAt};
    setStatus("Saving Design & Motion project as working Project Brain memory…");
    const result=await api(`/api/projects/${encodeURIComponent(id)}/memory`,{method:"POST",body:JSON.stringify({id:`media-${state.mode}-${safeUuid()}`,class:"creative-note",authority:"working",summary:`Design & Motion · ${MODES[state.mode].title} · ${state.title}`,content:JSON.stringify(envelope),reference:"forge-media-studio",relevanceTags:["forge-media-studio",`forge-media-studio:${state.mode}`,"creative-workflow","visual-creation"]})});
    memorySummary.textContent=`Saved ${state.updatedAt}\nMode: ${state.mode}\nTitle: ${state.title}\nMemory: ${result.id||"recorded"}${safe.stripped?`\nNote: ${safe.stripped} oversized local image payload(s) were intentionally omitted.`:""}`;setStatus(`Saved ${MODES[state.mode].title} to Project Brain as working memory${safe.stripped?"; oversized local image bytes stayed local to this browser session":""}.`);
  }

  async function loadLatest(){
    const id=currentProjectId();setStatus(`Loading latest saved ${MODES[state.mode].title} from Project Brain…`);const project=await api(`/api/projects/${encodeURIComponent(id)}`);const tag=`forge-media-studio:${state.mode}`;const memories=(project.memories||[]).filter(memory=>Array.isArray(memory.relevanceTags)&&memory.relevanceTags.includes("forge-media-studio")&&memory.relevanceTags.includes(tag)).sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));
    if(!memories.length){setStatus(`No saved ${MODES[state.mode].title} exists for this project yet.`);return;}
    let envelope;try{envelope=JSON.parse(memories[0].content);}catch{throw new Error("Latest Design & Motion memory contains invalid JSON.");}if(envelope?.formatVersion!==1||envelope?.kind!=="forge-design-motion"||!envelope.state)throw new Error("Latest Design & Motion memory has an unsupported format.");
    const loaded=envelope.state;if(loaded.mode!==state.mode)throw new Error("Saved Design & Motion mode does not match the selected office.");state={...defaultState(state.mode),...loaded,frames:Array.isArray(loaded.frames)?loaded.frames:[]};if((state.mode==="gif"||state.mode==="stop-motion")&&!state.frames.length)state.frames=[makeFrame()];if((state.mode==="gif"||state.mode==="stop-motion")&&!state.frames.some(frame=>frame.id===state.activeFrameId))state.activeFrameId=state.frames[0]?.id||"";titleInput.value=state.title;imageUrlInput.value=state.imageUrl||"";renderControls();await render();memorySummary.textContent=`Loaded ${memories[0].updatedAt||memories[0].createdAt}\n${memories[0].summary}\nMemory ID: ${memories[0].id}`;setStatus(`Loaded latest ${MODES[state.mode].title} working-memory save.`);
  }

  function exportJson(){const envelope={formatVersion:1,kind:"forge-design-motion",state:JSON.parse(JSON.stringify(state)),exportedAt:new Date().toISOString()};downloadBlob(new Blob([`${JSON.stringify(envelope,null,2)}\n`],{type:"application/json"}),`${safeName(titleInput.value||state.title)}.forge-media.json`);setStatus("Design & Motion project JSON exported.");}

  async function copyDimensions(){const text=`${state.width}×${state.height}px`;if(!navigator.clipboard?.writeText)throw new Error("Clipboard writing is not available in this browser.");await navigator.clipboard.writeText(text);setStatus(`Copied ${text}.`);}

  function bind() {
    const initial=new URLSearchParams(location.search).get("project")||localStorage.getItem("forge-project")||"forge-studio";projectInput.value=initial;back.href=`/?project=${encodeURIComponent(initial)}`;applyTheme();
    document.querySelectorAll("#media-modes [data-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
    $("#media-theme").addEventListener("click",()=>applyTheme(document.documentElement.dataset.forgeTheme==="dark"?"light":"dark"));
    $("#media-refresh").addEventListener("click",()=>loadLatest().catch(error=>setStatus(error.message)));
    $("#media-save").addEventListener("click",()=>saveMemory().catch(error=>setStatus(error.message)));
    $("#media-load").addEventListener("click",()=>loadLatest().catch(error=>setStatus(error.message)));
    $("#media-undo").addEventListener("click",()=>setMode(state.mode));
    $("#media-print").addEventListener("click",()=>window.print());
    $("#media-use-image").addEventListener("click",(event)=>{event.preventDefault();applyImage().catch(error=>setStatus(error.message));});
    $("#media-clear-image").addEventListener("click",(event)=>{event.preventDefault();setImageSource("",false);imageUrlInput.value="";imageFileInput.value="";setStatus("Background visual cleared from the current design/frame.");});
    $("#media-add-frame").addEventListener("click",addFrame);$("#media-duplicate-frame").addEventListener("click",duplicateFrame);$("#media-delete-frame").addEventListener("click",deleteFrame);$("#media-play").addEventListener("click",()=>previewAnimation().catch(error=>setStatus(error.message)));
    $("#media-export-png").addEventListener("click",()=>exportRaster("png").catch(error=>setStatus(error.message)));$("#media-export-jpeg").addEventListener("click",()=>exportRaster("jpeg").catch(error=>setStatus(error.message)));$("#media-export-gif").addEventListener("click",()=>exportGif().catch(error=>setStatus(error.message)));$("#media-export-video").addEventListener("click",()=>exportVideo().catch(error=>setStatus(error.message)));$("#media-export-json").addEventListener("click",exportJson);$("#media-copy-size").addEventListener("click",()=>copyDimensions().catch(error=>setStatus(error.message)));
    projectInput.addEventListener("change",()=>{try{const id=currentProjectId();localStorage.setItem("forge-project",id);back.href=`/?project=${encodeURIComponent(id)}`;memorySummary.textContent="Project changed. Load this office's latest working-memory save when needed.";setStatus(`Project switched to ${id}.`);}catch(error){setStatus(error.message);}});
    titleInput.addEventListener("input",()=>{state.title=titleInput.value;});
    renderControls();render().then(()=>loadLatest().catch(()=>setStatus(`${MODES[state.mode].title} ready. No saved design loaded yet.`))).catch(error=>setStatus(error.message));
  }

  bind();
})();
