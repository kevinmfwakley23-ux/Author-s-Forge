(() => {
  "use strict";
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
  if(!document.querySelector('script[data-forge-extension="brand-kit"]')){
    const script=document.createElement("script");script.src="/specialized-brand-kit.js";script.defer=true;script.dataset.forgeExtension="brand-kit";document.head.appendChild(script);
  }
})();
