import { randomUUID } from "node:crypto";
import {
  SPECIALIZED_DOCUMENT_FORMAT_VERSION,
  SPECIALIZED_PRODUCTION_PROFILE_VERSION,
  type ComicData,
  type ComicPanelData,
  type SpecializedArtifactKind,
  type SpecializedDocument,
  type SpecializedElement,
  type SpecializedOfficeProject,
  type SpecializedProductionProfile,
  type SpecializedSurface,
  type TcgData,
} from "../domain/specialized-creation-office";

export type ComicReadingDirection = "ltr" | "rtl";
export type DuplexFlip = "long-edge" | "short-edge";

export interface ComicProductionData extends ComicData { readonly readingDirection?: ComicReadingDirection; }

export function setComicReadingDirection(data:ComicData,direction:ComicReadingDirection):ComicProductionData {
  if(direction!=="ltr"&&direction!=="rtl") throw new Error("Unsupported comic reading direction.");
  return Object.freeze({...data,readingDirection:direction});
}

export function reorderComicPanels(data:ComicData,pageNumber:number,panelIds:readonly string[]):ComicProductionData {
  const extended=data as ComicProductionData;
  const page=data.pages.find(item=>item.page===pageNumber);if(!page)throw new Error(`Comic page ${pageNumber} not found.`);
  if(panelIds.length!==page.panels.length||new Set(panelIds).size!==panelIds.length)throw new Error("Comic reorder must contain every panel exactly once.");
  const byId=new Map(page.panels.map(panel=>[panel.id,panel]));
  const panels:readonly ComicPanelData[]=Object.freeze(panelIds.map((id,index)=>{const panel=byId.get(id);if(!panel)throw new Error(`Comic reorder references unknown panel \"${id}\".`);return Object.freeze({...panel,order:index+1});}));
  return Object.freeze({...data,...(extended.readingDirection?{readingDirection:extended.readingDirection}:{}),pages:Object.freeze(data.pages.map(item=>item.page===pageNumber?Object.freeze({...item,panels}):item))});
}

export function foldedCardImpositionProfile(base:SpecializedProductionProfile):SpecializedProductionProfile {
  return Object.freeze({...base,formatVersion:SPECIALIZED_PRODUCTION_PROFILE_VERSION,id:`${base.id}-flat`,label:`${base.label} — flat imposed`,widthInches:base.widthInches*2,heightInches:base.heightInches,duplex:true,notes:Object.freeze([...base.notes,"Flat folded-card imposition: outside back|front, inside left|right; vertical center fold."])});
}

export function createFoldedCardImpositionDocument(project:SpecializedOfficeProject,source:SpecializedDocument,now=new Date().toISOString()):SpecializedDocument {
  if(project.mode!=="greeting-card"&&project.mode!=="birthday-card")throw new Error("Fold imposition requires greeting-card or birthday-card mode.");
  const base=project.productionProfiles[0];if(!base)throw new Error("Fold imposition requires a base production profile.");
  const profile=foldedCardImpositionProfile(base),front=findSurface(source,"front"),back=findSurface(source,"back"),insideLeft=findSurface(source,"inside-left"),insideRight=findSurface(source,"inside-right");
  const outside=imposeTwo("imposed-outside","page","Outside — back | front",profile,back,front);
  const inside=imposeTwo("imposed-inside","page","Inside — left | right",profile,insideLeft,insideRight);
  return Object.freeze({formatVersion:SPECIALIZED_DOCUMENT_FORMAT_VERSION,id:`imposition-${project.id}-${randomUUID()}`,projectId:project.id,title:`${project.title} Fold Imposition`,mode:project.mode,surfaces:Object.freeze([outside,inside]),styleTokens:Object.freeze({...source.styleTokens}),createdAt:now,updatedAt:now});
}

export function tcgSheetProfile(base:SpecializedProductionProfile,duplexFlip:DuplexFlip="long-edge"):SpecializedProductionProfile {
  const artifactKinds:readonly SpecializedArtifactKind[]=Object.freeze(["pdf","svg","png"]);
  return Object.freeze({formatVersion:SPECIALIZED_PRODUCTION_PROFILE_VERSION,id:`${base.id}-sheet-${duplexFlip}`,label:`TCG Letter Sheet — ${duplexFlip}`,widthInches:8.5,heightInches:11,bleedInches:0,safeMarginInches:0.25,dpi:base.dpi,colorIntent:base.colorIntent,artifactKinds,duplex:true,notes:Object.freeze([`3×3 imposed poker-card sheet; duplex flip ${duplexFlip}; back sheet mirrors columns for registration.`])});
}

export function createTcgSheetDocument(project:SpecializedOfficeProject,source:SpecializedDocument,duplexFlip:DuplexFlip="long-edge",now=new Date().toISOString()):SpecializedDocument {
  if(project.mode!=="trading-card-game")throw new Error("TCG sheet requires trading-card-game mode.");
  const base=project.productionProfiles[0];if(!base)throw new Error("TCG sheet requires a base production profile.");
  const data=project.modeData as TcgData,cardSurfaces=source.surfaces.filter(surface=>surface.kind==="card-front");if(!cardSurfaces.length)throw new Error("TCG sheet requires rendered card fronts.");
  const profile=tcgSheetProfile(base,duplexFlip),surfaces:SpecializedSurface[]=[];
  for(let start=0;start<cardSurfaces.length;start+=9){const group=cardSurfaces.slice(start,start+9);surfaces.push(sheetSurface(`sheet-front-${Math.floor(start/9)+1}`,`Sheet Front ${Math.floor(start/9)+1}`,profile,group,false));surfaces.push(sheetSurface(`sheet-back-${Math.floor(start/9)+1}`,`Sheet Back ${Math.floor(start/9)+1}`,profile,group,true,data.gameTitle||project.title));}
  return Object.freeze({formatVersion:SPECIALIZED_DOCUMENT_FORMAT_VERSION,id:`tcg-sheet-${project.id}-${randomUUID()}`,projectId:project.id,title:`${project.title} Printable Sheets`,mode:project.mode,surfaces:Object.freeze(surfaces),styleTokens:Object.freeze({...source.styleTokens}),createdAt:now,updatedAt:now});
}

export function versionProductionProfile(profile:SpecializedProductionProfile,input:Partial<Omit<SpecializedProductionProfile,"formatVersion"|"id">>,version:number):SpecializedProductionProfile {
  if(!Number.isInteger(version)||version<2)throw new Error("Production profile version must be an integer of at least 2.");
  return Object.freeze({...profile,...input,formatVersion:SPECIALIZED_PRODUCTION_PROFILE_VERSION,id:`${profile.id}-v${version}`,label:input.label??`${profile.label} v${version}`,notes:Object.freeze([...(input.notes??profile.notes),`Derived from ${profile.id}; profile revision ${version}.`])});
}

function findSurface(document:SpecializedDocument,kind:SpecializedSurface["kind"]):SpecializedSurface {const surface=document.surfaces.find(item=>item.kind===kind);if(!surface)throw new Error(`Folded card source is missing ${kind} surface.`);return surface;}
function imposeTwo(id:string,kind:SpecializedSurface["kind"],label:string,profile:SpecializedProductionProfile,left:SpecializedSurface,right:SpecializedSurface):SpecializedSurface {const w=profile.widthInches/2,leftElements=left.elements.map(element=>cloneOffset(element,0)),rightElements=right.elements.map(element=>cloneOffset(element,w));const fold:SpecializedElement=Object.freeze({id:`${id}-fold`,kind:"shape",role:"fold-guide",box:Object.freeze({x:w-0.005,y:0,width:0.01,height:profile.heightInches}),locked:true,zIndex:9999,rotationDegrees:0,style:Object.freeze({fill:"#999999",opacity:0.35}),metadata:Object.freeze({productionGuide:true})});return Object.freeze({id,kind,label,widthInches:profile.widthInches,heightInches:profile.heightInches,bleedInches:profile.bleedInches,safeMarginInches:profile.safeMarginInches,readingOrder:id.includes("outside")?1:2,elements:Object.freeze([...leftElements,...rightElements,fold])});}
function cloneOffset(element:SpecializedElement,offsetX:number):SpecializedElement{return Object.freeze({...element,id:`imposed-${offsetX}-${element.id}`,box:Object.freeze({...element.box,x:element.box.x+offsetX}),style:Object.freeze({...element.style}),metadata:Object.freeze({...element.metadata})});}
function sheetSurface(id:string,label:string,profile:SpecializedProductionProfile,cards:readonly SpecializedSurface[],back:boolean,backLabel="Author's Forge TCG"):SpecializedSurface {const cardW=2.5,cardH=3.5,gapX=0.1,gapY=0.1,totalW=cardW*3+gapX*2,totalH=cardH*3+gapY*2,startX=(profile.widthInches-totalW)/2,startY=(profile.heightInches-totalH)/2,elements:SpecializedElement[]=[];cards.forEach((card,index)=>{const row=Math.floor(index/3),visualCol=index%3,col=back?2-visualCol:visualCol,x=startX+col*(cardW+gapX),y=startY+row*(cardH+gapY);if(back){elements.push(Object.freeze({id:`${id}-back-${index}`,kind:"shape",role:"card-back",box:Object.freeze({x,y,width:cardW,height:cardH}),locked:true,zIndex:index,rotationDegrees:0,style:Object.freeze({fill:"#222222",stroke:"#000000",strokeWidthPt:0.5}),metadata:Object.freeze({duplexBack:true,sourceSurfaceId:card.id})}));elements.push(Object.freeze({id:`${id}-back-label-${index}`,kind:"text",role:"brand",box:Object.freeze({x:x+0.2,y:y+1.45,width:cardW-0.4,height:0.4}),text:backLabel,locked:true,zIndex:100+index,rotationDegrees:0,style:Object.freeze({fontFamily:"Arial",fontSizePt:8,textAlign:"center",fill:"#ffffff"}),metadata:Object.freeze({sourceSurfaceId:card.id})}));}else{for(const element of card.elements){const sx=cardW/card.widthInches,sy=cardH/card.heightInches;elements.push(Object.freeze({...element,id:`${id}-${card.id}-${element.id}`,box:Object.freeze({x:x+element.box.x*sx,y:y+element.box.y*sy,width:element.box.width*sx,height:element.box.height*sy}),style:Object.freeze({...element.style}),metadata:Object.freeze({...element.metadata,sourceSurfaceId:card.id})}));}}});return Object.freeze({id,kind:"sheet",label,widthInches:profile.widthInches,heightInches:profile.heightInches,bleedInches:0,safeMarginInches:profile.safeMarginInches,readingOrder:Number(id.match(/(\d+)$/)?.[1]??1)*2-(back?0:1),elements:Object.freeze(elements)});}
