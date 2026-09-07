/* Author's Forge PWA lifecycle, Android install UX, persisted appearance, and main Studio tool launcher. No project data is stored here. */
(() => {
  "use strict";

  const THEME_KEY = "forge-theme";
  const ANDROID_INSTALL_FAB_ID = "forge-android-install-fab";
  const ANDROID_INSTALL_HELP_ID = "forge-android-install-help";

  let deferredPrompt = null;

  function currentProjectId(){return new URLSearchParams(location.search).get("project")||localStorage.getItem("forge-project")||"forge-studio";}
  function hostedMode(){return document.documentElement.classList.contains("forge-hosted");}
  function isAndroid(){return /Android/i.test(navigator.userAgent||"");}
  function isStandalone(){return window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator.standalone===true;}
  function isMainStudio(){return Boolean(document.getElementById("dashboard"));}
  function projectUrl(path="/"){const pathname=path.startsWith("/")?path:`/${path}`;return `${location.origin}${pathname}?project=${encodeURIComponent(currentProjectId())}`;}

  function applyStoredTheme(){try{const saved=localStorage.getItem(THEME_KEY);const theme=saved==="dark"||saved==="light"?saved:(window.matchMedia?.("(prefers-color-scheme: dark)")?.matches?"dark":"light");document.documentElement.dataset.forgeTheme=theme;document.documentElement.style.colorScheme=theme;}catch{}}
  function ensureRoyalHardeningStyles(){if(!isMainStudio()||document.querySelector('link[data-forge-royal-hardening]'))return;const link=document.createElement("link");link.rel="stylesheet";link.href="/forge-royal-hardening.css";link.dataset.forgeRoyalHardening="true";document.head.appendChild(link);}

  function ensureAgentNavigation(){if(!isMainStudio())return;const nav=document.querySelector(".sidebar nav");if(!nav)return;let link=document.getElementById("open-agent-workbench");if(!link){link=document.createElement("a");link.id="open-agent-workbench";link.textContent="Agent Workbench";link.dataset.icon="⚒";const writing=nav.querySelector('[data-route="writing"]');nav.insertBefore(link,writing||nav.firstChild);}link.href=projectUrl("/forge-agent.html");}
  function ensureMediaNavigation(){if(!isMainStudio())return;const nav=document.querySelector(".sidebar nav");if(!nav)return;let link=document.getElementById("open-design-motion");if(!link){link=document.createElement("a");link.id="open-design-motion";link.textContent="Design & Motion";link.dataset.icon="◈";const art=nav.querySelector('[data-route="art"]');nav.insertBefore(link,art||null);}link.href=projectUrl("/forge-media-studio.html");}
  function ensureSeriesNavigation(){if(!isMainStudio())return;const nav=document.querySelector(".sidebar nav");if(!nav)return;let link=document.getElementById("open-series-engine");if(!link){link=document.createElement("a");link.id="open-series-engine";link.textContent="Series Engine";const characters=nav.querySelector('[data-route="characters"]');nav.insertBefore(link,characters||null);}link.href=projectUrl("/series.html");}

  function ensureStudioWorkspaceLauncher(){
    if(document.getElementById("forge-studio-tool-launcher"))return;
    const dashboard=document.getElementById("dashboard");
    if(!dashboard)return;
    const card=document.createElement("article");
    card.id="forge-studio-tool-launcher";
    card.className="card";
    card.innerHTML=`<h3>Main Studio tools</h3><p class="muted">These tools belong to the main K.I.N.G.S. Author's Forge writing, production, and publishing workflow.</p><div class="row"><a class="forge-studio-tool-link" id="open-agent-workbench-dashboard" href="${projectUrl("/forge-agent.html")}">Agent Workbench</a><a class="forge-studio-tool-link" id="open-design-motion-dashboard" href="${projectUrl("/forge-media-studio.html")}">Design & Motion</a><a class="forge-studio-tool-link" id="open-series-engine-dashboard" href="${projectUrl("/series.html")}">Series Engine</a></div>`;
    dashboard.append(card);
    card.querySelectorAll(".forge-studio-tool-link").forEach(link=>Object.assign(link.style,{display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:"44px",padding:"10px 14px",border:"1px solid #20252b",borderRadius:"7px",background:"#20252b",color:"#fff",textDecoration:"none",flex:"1 1 180px"}));
  }

  function loadExtension(name,src){if(document.querySelector(`script[data-forge-extension="${name}"]`))return;const script=document.createElement("script");script.src=src;script.defer=true;script.dataset.forgeExtension=name;document.head.appendChild(script);}
  function ensureStudioExtensions(){if(!isMainStudio())return;if(document.getElementById("art"))loadExtension("image-lab","/forge-image-lab.js");loadExtension("story-architecture","/forge-story-architecture.js");loadExtension("chapter-cards","/forge-chapter-cards.js");loadExtension("chapter-card-workflow","/forge-chapter-card-workflow.js");loadExtension("chapter-card-approval","/forge-chapter-card-approval.js");loadExtension("scene-cards","/forge-scene-cards.js");loadExtension("manuscript-import","/forge-manuscript-import.js");loadExtension("ai-gateways","/forge-ai-gateways.js");loadExtension("model-freedom","/forge-model-freedom.js");loadExtension("forge-recipes","/forge-recipes.js");loadExtension("review-room","/forge-review-room.js");loadExtension("provenance","/forge-provenance.js");loadExtension("brand-studio","/forge-brand-studio.js");loadExtension("royal-ui","/forge-royal-ui.js");}

  function ensureAndroidInstallStyles(){
    if(document.querySelector("style[data-forge-android-install]"))return;
    const style=document.createElement("style");
    style.dataset.forgeAndroidInstall="true";
    style.textContent=`
      #${ANDROID_INSTALL_FAB_ID}{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:calc(18px + env(safe-area-inset-bottom));width:68px;height:68px;border-radius:999px;border:2px solid #d4ad63;background:#20252b;padding:5px;box-shadow:0 10px 28px rgba(0,0,0,.34);z-index:2147483000;display:none;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation}
      #${ANDROID_INSTALL_FAB_ID}[data-visible="true"]{display:flex}
      #${ANDROID_INSTALL_FAB_ID} img{width:54px;height:54px;border-radius:50%;display:block}
      #${ANDROID_INSTALL_FAB_ID}:focus-visible{outline:4px solid #d4ad63;outline-offset:4px}
      #${ANDROID_INSTALL_HELP_ID}{position:fixed;inset:0;z-index:2147483001;display:none;align-items:flex-end;justify-content:center;background:rgba(8,10,12,.68);padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom))}
      #${ANDROID_INSTALL_HELP_ID}[data-visible="true"]{display:flex}
      #${ANDROID_INSTALL_HELP_ID} .forge-install-sheet{width:min(560px,100%);border:1px solid rgba(212,173,99,.7);border-radius:22px 22px 14px 14px;background:#f4f1eb;color:#20252b;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.42)}
      #${ANDROID_INSTALL_HELP_ID} .forge-install-mark{width:58px;height:58px;border-radius:50%;display:block;margin-bottom:12px}
      #${ANDROID_INSTALL_HELP_ID} h2{margin:0 0 8px;font-size:1.35rem}
      #${ANDROID_INSTALL_HELP_ID} p{margin:0 0 12px;line-height:1.45}
      #${ANDROID_INSTALL_HELP_ID} button{min-height:48px;width:100%;font:inherit;font-weight:700;border-radius:10px;border:1px solid #20252b;background:#20252b;color:#fff}
      @media(min-width:700px){#${ANDROID_INSTALL_FAB_ID}{width:72px;height:72px}#${ANDROID_INSTALL_FAB_ID} img{width:58px;height:58px}}
    `;
    document.head.appendChild(style);
  }

  function hideAndroidInstallHelp(){const help=document.getElementById(ANDROID_INSTALL_HELP_ID);if(help)help.dataset.visible="false";}
  function showAndroidInstallHelp(){
    let help=document.getElementById(ANDROID_INSTALL_HELP_ID);
    if(!help){
      help=document.createElement("div");
      help.id=ANDROID_INSTALL_HELP_ID;
      help.setAttribute("role","dialog");
      help.setAttribute("aria-modal","true");
      help.setAttribute("aria-labelledby","forge-install-title");
      help.innerHTML=`<div class="forge-install-sheet"><img class="forge-install-mark" src="/icon-192.svg" alt=""><h2 id="forge-install-title">Put Author's Forge on this device</h2><p>Install Forge once, then open it from the round Forge icon on your Android home screen or app drawer. It launches in its own app window with no Play Store listing required.</p><p><strong>Chrome:</strong> open the browser menu (⋮), then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If Chrome offers the Forge install prompt, the round Forge button will open it directly.</p><button type="button" id="forge-install-help-close">Got it</button></div>`;
      help.addEventListener("click",event=>{if(event.target===help)hideAndroidInstallHelp();});
      document.body.appendChild(help);
      help.querySelector("#forge-install-help-close")?.addEventListener("click",hideAndroidInstallHelp);
    }
    help.dataset.visible="true";
    help.querySelector("button")?.focus();
  }

  function ensureAndroidInstallLauncher(){
    if(!isAndroid()||isStandalone())return;
    ensureAndroidInstallStyles();
    if(document.getElementById(ANDROID_INSTALL_FAB_ID))return;
    const button=document.createElement("button");
    button.id=ANDROID_INSTALL_FAB_ID;
    button.type="button";
    button.setAttribute("aria-label","Install Author's Forge on this Android device");
    button.title="Install Author's Forge";
    button.innerHTML='<img src="/icon-192.svg" alt="">';
    button.addEventListener("click",install);
    document.body.appendChild(button);
    button.dataset.visible="true";
  }

  function ensureUi(){
    applyStoredTheme();
    ensureRoyalHardeningStyles();
    ensureAgentNavigation();
    ensureMediaNavigation();
    ensureSeriesNavigation();
    ensureStudioWorkspaceLauncher();
    ensureStudioExtensions();
    ensureAndroidInstallLauncher();
    if(document.getElementById("pwa-status"))return;
    const host=document.querySelector(".top-actions")||document.querySelector(".topbar")||document.body;
    const status=document.createElement("span");
    status.id="pwa-status";
    status.className="muted";
    status.setAttribute("role","status");
    status.textContent="Preparing Forge app shell…";
    const button=document.createElement("button");
    button.id="install-forge";
    button.type="button";
    button.className="primary";
    button.textContent="Install Forge";
    button.hidden=true;
    button.addEventListener("click",install);
    host.append(button,status);
  }

  const installButton=()=>document.getElementById("install-forge");
  const androidInstallButton=()=>document.getElementById(ANDROID_INSTALL_FAB_ID);
  const status=()=>document.getElementById("pwa-status");
  function setStatus(message){const e=status();if(e)e.textContent=message;}
  function setInstallVisible(visible){const b=installButton();if(b)b.hidden=!visible;const fab=androidInstallButton();if(fab)fab.dataset.visible=visible||(!isStandalone()&&isAndroid())?"true":"false";}

  async function registerServiceWorker(){
    if(!("serviceWorker" in navigator)){setStatus("Browser offline shell unavailable.");return;}
    try{
      const script=hostedMode()?"/sw-hosted.js":"/sw.js";
      const r=await navigator.serviceWorker.register(script,{scope:"/"});
      if(r.waiting)r.waiting.postMessage({type:"SKIP_WAITING"});
      setStatus(navigator.onLine?"Forge shell ready • online":"Forge shell ready • offline");
    }catch(error){setStatus(`Offline shell unavailable: ${error.message}`);}
  }

  async function install(){
    if(!deferredPrompt){
      if(isAndroid())showAndroidInstallHelp();
      else setStatus("Use the browser menu to install Forge when the install prompt is unavailable.");
      return;
    }
    const event=deferredPrompt;
    deferredPrompt=null;
    setInstallVisible(false);
    await event.prompt();
    const choice=await event.userChoice;
    if(choice.outcome==="accepted")setStatus("Forge installed. Tap the Forge icon from your home screen or app drawer.");
    else{setStatus("Install dismissed. Tap the round Forge button whenever you are ready.");setInstallVisible(true);}
  }

  function updateDisplayMode(){
    if(isStandalone()){
      setInstallVisible(false);
      const fab=androidInstallButton();if(fab)fab.remove();
      hideAndroidInstallHelp();
      setStatus(navigator.onLine?"Forge app • online":"Forge app • offline shell");
    }else if(isAndroid()){
      ensureAndroidInstallLauncher();
    }
  }

  applyStoredTheme();
  ensureRoyalHardeningStyles();
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredPrompt=event;ensureAndroidInstallLauncher();setInstallVisible(true);setStatus("Forge is ready to install as an Android app.");});
  window.addEventListener("appinstalled",()=>{deferredPrompt=null;setInstallVisible(false);document.getElementById(ANDROID_INSTALL_FAB_ID)?.remove();hideAndroidInstallHelp();setStatus("Forge installed. Open it from the Forge icon on this device.");});
  window.addEventListener("online",()=>setStatus("Forge shell ready • online"));
  window.addEventListener("offline",()=>setStatus("Forge shell ready • offline"));
  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change",updateDisplayMode);
  window.addEventListener("load",()=>{ensureUi();registerServiceWorker();updateDisplayMode();});
  if(document.readyState!=="loading"){ensureUi();registerServiceWorker();updateDisplayMode();}
})();
