(() => {
  "use strict";
  const $=selector=>document.querySelector(selector),state=()=>window.forgeSpecializedState;
  let zoom=1,resizeSession=null,refreshQueued=false;

  function ensureToolbar(){
    if($("#sc-view-tools"))return;
    const canvasWrap=$(".sc-canvas-wrap");if(!canvasWrap)return;
    const bar=document.createElement("div");bar.id="sc-view-tools";bar.className="sc-row";bar.setAttribute("aria-label","Composition view tools");
    bar.innerHTML='<strong>View</strong><button type="button" data-zoom="0.75">75%</button><button type="button" data-zoom="1">100%</button><button type="button" data-zoom="1.25">125%</button><button type="button" id="sc-zoom-fit">Fit</button><output id="sc-zoom-status" aria-live="polite">100%</output><span class="sc-muted">Zoom changes only the view. Arrow keys nudge the selected unlocked element; Shift+Arrow uses a finer step.</span>';
    canvasWrap.before(bar);
    bar.addEventListener("click",event=>{const button=event.target.closest?.("[data-zoom]");if(button){zoom=Number(button.dataset.zoom)||1;applyZoom();}else if(event.target.closest?.("#sc-zoom-fit")){fitZoom();}});
  }

  function fitZoom(){const svg=$("#composition-svg"),wrap=$(".sc-canvas-wrap");if(!svg||!wrap)return;const baseWidth=Number(svg.dataset.baseDisplayWidth||svg.getAttribute("width")||600);const available=Math.max(200,wrap.clientWidth-32);zoom=Math.min(1,available/baseWidth);applyZoom();}
  function applyZoom(){const svg=$("#composition-svg");if(!svg)return;const baseWidth=Number(svg.dataset.baseDisplayWidth||svg.getAttribute("width")||600),baseHeight=Number(svg.dataset.baseDisplayHeight||svg.getAttribute("height")||800);svg.dataset.baseDisplayWidth=String(baseWidth);svg.dataset.baseDisplayHeight=String(baseHeight);svg.style.width=`${Math.max(1,baseWidth*zoom)}px`;svg.style.height=`${Math.max(1,baseHeight*zoom)}px`;svg.style.maxWidth="none";const output=$("#sc-zoom-status");if(output)output.value=`${Math.round(zoom*100)}%`;document.querySelectorAll("#sc-view-tools [data-zoom]").forEach(button=>button.setAttribute("aria-pressed",String(Math.abs(Number(button.dataset.zoom)-zoom)<0.001)));}

  function selectedElement(){const s=state();return s?.surface?.elements?.find(element=>element.id===s.selectedElementId)||null;}
  function syncSemantics(){const s=state(),svg=$("#composition-svg");if(!s||!svg)return;svg.querySelectorAll("[data-element]").forEach(node=>{node.setAttribute("role","button");node.setAttribute("aria-pressed",String(node.dataset.element===s.selectedElementId));node.setAttribute("aria-keyshortcuts","Enter Space ArrowUp ArrowDown ArrowLeft ArrowRight");});drawResizeHandle();}

  function selectThroughLayer(id){const button=[...document.querySelectorAll("[data-element-select]")].find(candidate=>candidate.dataset.elementSelect===id);button?.click();queueRefresh();}
  function selectCanvasElement(event){if(event.target.closest?.("[data-resize-handle]"))return;const node=event.target.closest?.("[data-element]");if(!node)return;const id=node.dataset.element;if(id&&state()?.selectedElementId!==id)selectThroughLayer(id);}
  function nudgeElement(event,id){const s=state(),element=s?.surface?.elements?.find(item=>item.id===id);if(!element||element.locked)return;const step=event.shiftKey?0.01:0.05,form=$("#element-form");if(!form)return;let x=Number(form.elements.x.value),y=Number(form.elements.y.value);if(event.key==="ArrowLeft")x=Math.max(0,x-step);if(event.key==="ArrowRight")x+=step;if(event.key==="ArrowUp")y=Math.max(0,y-step);if(event.key==="ArrowDown")y+=step;form.elements.x.value=x.toFixed(2);form.elements.y.value=y.toFixed(2);form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));queueRefresh();}

  function drawResizeHandle(){
    const svg=$("#composition-svg"),element=selectedElement();
    if(!svg)return;
    const handles=[...svg.querySelectorAll("[data-resize-handle]")];
    if(!element||element.locked){handles.forEach(node=>node.remove());return;}
    let handle=handles.find(node=>node.getAttribute("data-resize-handle")===element.id)||null;
    handles.forEach(node=>{if(node!==handle)node.remove();});
    if(!handle){
      handle=document.createElementNS("http://www.w3.org/2000/svg","rect");
      handle.setAttribute("data-resize-handle",element.id);
      handle.setAttribute("rx","3");
      handle.setAttribute("fill","#2463d4");
      handle.setAttribute("stroke","#ffffff");
      handle.setAttribute("stroke-width","2");
      handle.setAttribute("role","slider");
      handle.setAttribute("tabindex","0");
      handle.style.cursor="nwse-resize";
      handle.style.touchAction="none";
      svg.append(handle);
    }
    const scale=96,size=16;
    handle.setAttribute("x",String((element.box.x+element.box.width)*scale-size/2));
    handle.setAttribute("y",String((element.box.y+element.box.height)*scale-size/2));
    handle.setAttribute("width",String(size));
    handle.setAttribute("height",String(size));
    handle.setAttribute("aria-label",`Resize ${element.role||element.kind}`);
  }

  function clientToSvg(clientX,clientY){const svg=$("#composition-svg"),point=svg.createSVGPoint();point.x=clientX;point.y=clientY;return point.matrixTransform(svg.getScreenCTM().inverse());}
  function beginResize(event){const handle=event.target.closest?.("[data-resize-handle]");if(!handle)return;const element=selectedElement(),form=$("#element-form");if(!element||!form)return;const point=clientToSvg(event.clientX,event.clientY);resizeSession={id:element.id,startX:point.x,startY:point.y,width:element.box.width,height:element.box.height,pointerId:event.pointerId};event.preventDefault();event.stopPropagation();window.addEventListener("pointermove",moveResize,{passive:false});window.addEventListener("pointerup",endResize,{once:true});window.addEventListener("pointercancel",endResize,{once:true});}
  function moveResize(event){if(!resizeSession||event.pointerId!==resizeSession.pointerId)return;const point=clientToSvg(event.clientX,event.clientY),form=$("#element-form");if(!form)return;const width=Math.max(0.1,resizeSession.width+(point.x-resizeSession.startX)/96),height=Math.max(0.1,resizeSession.height+(point.y-resizeSession.startY)/96);form.elements.width.value=width.toFixed(2);form.elements.height.value=height.toFixed(2);event.preventDefault();}
  function endResize(event){if(!resizeSession||event.pointerId!==resizeSession.pointerId)return;window.removeEventListener("pointermove",moveResize);const form=$("#element-form");resizeSession=null;form?.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));queueRefresh();}

  function keyboard(event){const elementNode=event.target.closest?.("[data-element]"),handle=event.target.closest?.("[data-resize-handle]");if(handle&&["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].includes(event.key)){event.preventDefault();const form=$("#element-form");if(!form)return;const delta=event.shiftKey?0.01:0.05;if(event.key==="ArrowRight")form.elements.width.value=(Math.max(.1,Number(form.elements.width.value)+delta)).toFixed(2);if(event.key==="ArrowLeft")form.elements.width.value=(Math.max(.1,Number(form.elements.width.value)-delta)).toFixed(2);if(event.key==="ArrowDown")form.elements.height.value=(Math.max(.1,Number(form.elements.height.value)+delta)).toFixed(2);if(event.key==="ArrowUp")form.elements.height.value=(Math.max(.1,Number(form.elements.height.value)-delta)).toFixed(2);form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));queueRefresh();return;}if(!elementNode)return;const id=elementNode.dataset.element;if(event.key==="Enter"||event.key===" "){event.preventDefault();selectThroughLayer(id);return;}if(["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].includes(event.key)){event.preventDefault();if(state()?.selectedElementId!==id){selectThroughLayer(id);return;}nudgeElement(event,id);}}

  function queueRefresh(){if(refreshQueued)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;const svg=$("#composition-svg");if(svg&&!svg.dataset.baseDisplayWidth){svg.dataset.baseDisplayWidth=svg.getAttribute("width")||"600";svg.dataset.baseDisplayHeight=svg.getAttribute("height")||"800";}applyZoom();syncSemantics();});}
  function observeCanvas(){const svg=$("#composition-svg");if(!svg)return;svg.addEventListener("pointerdown",selectCanvasElement,true);svg.addEventListener("pointerdown",beginResize,true);svg.addEventListener("keydown",keyboard);new MutationObserver(()=>queueRefresh()).observe(svg,{childList:true,subtree:true});}

  ensureToolbar();observeCanvas();window.addEventListener("forge:specialized-ready",()=>{const svg=$("#composition-svg");if(svg){svg.dataset.baseDisplayWidth=svg.getAttribute("width")||"600";svg.dataset.baseDisplayHeight=svg.getAttribute("height")||"800";}queueRefresh();});window.addEventListener("resize",()=>{if(innerWidth<=720)fitZoom();});queueRefresh();
})();