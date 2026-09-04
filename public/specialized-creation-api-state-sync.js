(() => {
  "use strict";

  const THEME_KEY="forge-theme";
  function currentTheme(){try{const saved=localStorage.getItem(THEME_KEY);if(saved==="light"||saved==="dark")return saved;}catch{}return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches?"dark":"light";}
  function applyTheme(theme,persist=true){const value=theme==="dark"?"dark":"light";document.documentElement.dataset.forgeTheme=value;document.documentElement.style.colorScheme=value;if(persist){try{localStorage.setItem(THEME_KEY,value);}catch{}}const button=document.querySelector("#sc-royal-theme");if(button){button.textContent=value==="dark"?"☀ Light":"☾ Dark";button.setAttribute("aria-label",`Switch to ${value==="dark"?"light":"dark"} mode`);button.setAttribute("aria-pressed",String(value==="dark"));}}
  function installRoyalSkin(){if(!document.querySelector('link[data-specialized-royal]')){const link=document.createElement("link");link.rel="stylesheet";link.href="/specialized-creation-royal.css";link.dataset.specializedRoyal="true";document.head.appendChild(link);}applyTheme(currentTheme(),false);const actions=document.querySelector(".sc-head .sc-row");if(actions&&!document.querySelector("#sc-royal-theme")){const button=document.createElement("button");button.id="sc-royal-theme";button.type="button";button.addEventListener("click",()=>applyTheme(document.documentElement.dataset.forgeTheme==="dark"?"light":"dark"));actions.appendChild(button);applyTheme(document.documentElement.dataset.forgeTheme,false);}const projectId=new URLSearchParams(location.search).get("project")||localStorage.getItem("forge-project")||"forge-studio";const main=document.querySelector("#main-studio");if(main)main.href=`/?project=${encodeURIComponent(projectId)}`;}

  installRoyalSkin();

  const original=window.forgeSpecializedApi,state=window.forgeSpecializedState;
  if(typeof original!=="function"||!state)return;
  window.forgeSpecializedApi=async (...args)=>{
    const result=await original(...args);
    if(result&&typeof result==="object"&&result.id&&result.mode&&state.current?.id===result.id){
      state.current=result;
      state.document=result.documents?.at?.(-1)||state.document;
      if(state.document&&(!state.surface||!state.document.surfaces?.some(surface=>surface.id===state.surface.id)))state.surface=state.document.surfaces?.[0]||null;
      const modeJson=document.querySelector("#mode-json");
      if(modeJson)modeJson.value=JSON.stringify(result.modeData??{},null,2);
    }
    return result;
  };
})();
