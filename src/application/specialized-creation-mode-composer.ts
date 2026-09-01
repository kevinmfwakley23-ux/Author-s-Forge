import { randomUUID } from "node:crypto";
import {
  SPECIALIZED_DOCUMENT_FORMAT_VERSION,
  type ComicData,
  type FlyerData,
  type FoldedCardData,
  type InvitationData,
  type SpecializedDocument,
  type SpecializedElement,
  type SpecializedOfficeProject,
  type SpecializedProductionProfile,
  type SpecializedSurface,
  type TcgData,
  type TcgCardRecord,
} from "../domain/specialized-creation-office";

export interface TcgSetStatistics { readonly cardCount:number; readonly byTemplate:Readonly<Record<string,number>>; readonly numeric:Readonly<Record<string,{min:number;max:number;average:number}>>; readonly categorical:Readonly<Record<string,Readonly<Record<string,number>>>>; }

export function composeSpecializedProject(project:SpecializedOfficeProject,profile:SpecializedProductionProfile=project.productionProfiles[0]!,now=new Date().toISOString()):SpecializedDocument {
  if(!profile)throw new Error("Composition requires a production profile.");
  const surfaces=project.mode==="comic-book"?comicSurfaces(project.modeData as ComicData,profile):project.mode==="greeting-card"||project.mode==="birthday-card"?foldedCardSurfaces(project.modeData as FoldedCardData,profile,project.mode):project.mode==="invitation"?invitationSurfaces(project.modeData as InvitationData,profile):project.mode==="flyer"?flyerSurfaces(project.modeData as FlyerData,profile):tcgSurfaces(project.modeData as TcgData,profile);
  return Object.freeze({formatVersion:SPECIALIZED_DOCUMENT_FORMAT_VERSION,id:`doc-${project.id}-${randomUUID()}`,projectId:project.id,title:`${project.title} Composition`,mode:project.mode,surfaces:Object.freeze(surfaces),styleTokens:Object.freeze({fontBody:"Arial",fontDisplay:"Arial",primary:"#111111",accent:"#555555"}),createdAt:now,updatedAt:now});
}

export function reflowDocument(document:SpecializedDocument,widthInches:number,heightInches:number,now=new Date().toISOString()):SpecializedDocument {
  if(!Number.isFinite(widthInches)||widthInches<=0||!Number.isFinite(heightInches)||heightInches<=0)throw new Error("Reflow dimensions must be positive.");
  return Object.freeze({...document,id:`${document.id}-reflow-${randomUUID()}`,title:`${document.title} — ${widthInches}×${heightInches}`,surfaces:Object.freeze(document.surfaces.map(surface=>{const sx=widthInches/surface.widthInches,sy=heightInches/surface.heightInches;return Object.freeze({...surface,id:`${surface.id}-reflow`,widthInches,heightInches,elements:Object.freeze(surface.elements.map(element=>Object.freeze({...element,box:Object.freeze({x:element.box.x*sx,y:element.box.y*sy,width:element.box.width*sx,height:element.box.height*sy})})))});})),createdAt:now,updatedAt:now});
}

export function tcgSetStatistics(data:TcgData):TcgSetStatistics {
  const byTemplate:Record<string,number>={},numeric:Record<string,number[]>={},categorical:Record<string,Record<string,number>>={};
  for(const card of data.cards){byTemplate[card.templateId]=(byTemplate[card.templateId]??0)+1;for(const [key,value] of Object.entries(card.fields)){if(typeof value==="number"){(numeric[key]??=[]).push(value);}else{const text=String(value);const map=categorical[key]??={};map[text]=(map[text]??0)+1;categorical[key]=map;}}}
  return Object.freeze({cardCount:data.cards.length,byTemplate:Object.freeze(byTemplate),numeric:Object.freeze(Object.fromEntries(Object.entries(numeric).map(([key,values])=>[key,{min:Math.min(...values),max:Math.max(...values),average:values.reduce((a,b)=>a+b,0)/values.length}]))),categorical:Object.freeze(Object.fromEntries(Object.entries(categorical).map(([key,value])=>[key,Object.freeze(value)])))});
}

export function addTcgPlaytestSnapshot(data:TcgData,note:string,now=new Date().toISOString()):TcgData {return Object.freeze({...data,playtestSnapshots:Object.freeze([...data.playtestSnapshots,Object.freeze({id:`snapshot-${randomUUID()}`,createdAt:now,cardIds:Object.freeze(data.cards.map(card=>card.id)),note:note.trim()})])});}

export function resolveTcgTemplateTokens(data:TcgData,templateId:string):Readonly<Record<string,string|number>> {const byId=new Map(data.templates.map(t=>[t.id,t]));const seen=new Set<string>();const chain=[] as NonNullable<ReturnType<typeof byId.get>>[];let current=byId.get(templateId);while(current){if(seen.has(current.id))throw new Error("TCG template inheritance cycle detected.");seen.add(current.id);chain.unshift(current);current=current.parentId?byId.get(current.parentId):undefined;}if(!chain.length)throw new Error(`TCG template \"${templateId}\" not found.`);return Object.freeze(Object.assign({},...chain.map(t=>t.tokens)));}

function comicSurfaces(data:ComicData,p:SpecializedProductionProfile):SpecializedSurface[]{const pages=data.pages.length?data.pages:[{page:1,panels:[]}];return pages.map(page=>{const panels=[...page.panels].sort((a,b)=>a.order-b.order),count=Math.max(1,panels.length),cols=count<=2?1:2,rows=Math.ceil(count/cols),gap=0.12,safe=p.safeMarginInches,usableW=p.widthInches-safe*2-gap*(cols-1),usableH=p.heightInches-safe*2-gap*(rows-1),pw=usableW/cols,ph=usableH/rows;const elements:SpecializedElement[]=[];panels.forEach((panel,index)=>{const col=index%cols,row=Math.floor(index/cols),x=safe+col*(pw+gap),y=safe+row*(ph+gap);elements.push(shape(`panel-${panel.id}`,x,y,pw,ph,index,"panel",panel.description));let ty=y+0.12;for(const caption of panel.captions){elements.push(text(`caption-${panel.id}-${ty}`,"caption",caption,x+0.12,ty,pw-0.24,0.45,9,100+index));ty+=0.5;}for(const line of panel.dialogue){elements.push(text(`dialogue-${panel.id}-${ty}`,"dialogue",`${line.speaker}: ${line.text}`,x+0.12,ty,pw-0.24,0.55,9,200+index));ty+=0.6;}for(const sfx of panel.sfx){elements.push(text(`sfx-${panel.id}-${ty}`,"sfx",sfx,x+0.2,y+ph-0.55,pw-0.4,0.4,14,300+index));}});return surface(`page-${page.page}`,"page",`Page ${page.page}`,p,page.page,elements);});}

function foldedCardSurfaces(data:FoldedCardData,p:SpecializedProductionProfile,mode:string):SpecializedSurface[]{const recipient=data.recipient?.trim(),front=mode==="birthday-card"?(data.milestone?.trim()?`Happy ${data.milestone.trim()} Birthday${recipient?`, ${recipient}`:""}`:`Happy Birthday${recipient?`, ${recipient}`:""}`):(recipient?`For ${recipient}`:"Thinking of You");return [surface("front","front","Front",p,1,[text("front-title","headline",front,0.5,1.2,p.widthInches-1,1.4,24,1)]),surface("inside-left","inside-left","Inside Left",p,2,[]),surface("inside-right","inside-right","Inside Right",p,3,[text("inside-message","body",data.message||"Write your message here.",0.55,0.8,p.widthInches-1.1,p.heightInches-1.6,14,1),...(data.signature?[text("signature","body",data.signature,0.55,p.heightInches-1.1,p.widthInches-1.1,0.5,12,2)]:[])]),surface("back","back","Back",p,4,[text("back-brand","brand","Created in Author's Forge",0.5,p.heightInches-0.8,p.widthInches-1,0.3,8,1)])];}

function invitationSurfaces(data:InvitationData,p:SpecializedProductionProfile):SpecializedSurface[]{
  const names=data.primaryNames.join(" & ")||"Event Invitation",when=[data.date,data.startTime,data.timezone].filter(Boolean).join(" • "),where=[data.venue,data.address].filter(Boolean).join(" • "),rsvp=data.rsvpMethod?`RSVP: ${data.rsvpMethod}${data.rsvpDeadline?` by ${data.rsvpDeadline}`:""}`:"";
  const elements:SpecializedElement[]=[text("invite-type","subhead",data.eventType,0.5,0.55,p.widthInches-1,0.42,12,1),text("invite-names","headline",names,0.45,1.15,p.widthInches-0.9,1.05,24,2)];
  let y=2.45;if(when){elements.push(text("invite-when","details",when,0.5,y,p.widthInches-1,0.55,11,3));y+=0.65;}if(where){elements.push(text("invite-where","details",where,0.5,y,p.widthInches-1,0.7,11,4));y+=0.78;}if(data.dressCode){elements.push(text("invite-dress","details",`Dress: ${data.dressCode}`,0.5,y,p.widthInches-1,0.42,10,5));y+=0.5;}if(data.details){elements.push(text("invite-details","body",data.details,0.5,y,p.widthInches-1,0.72,10,6));y+=0.82;}if(data.accessibilityNotes){elements.push(text("invite-accessibility","details",data.accessibilityNotes,0.5,y,p.widthInches-1,0.55,9,7));}
  if(rsvp)elements.push(text("invite-rsvp","cta",rsvp,0.5,p.heightInches-1.36,p.widthInches-(data.qrDestination?1.9:1),0.55,10,8));
  if(data.website)elements.push(text("invite-website","details",data.website,0.5,p.heightInches-0.72,p.widthInches-(data.qrDestination?1.9:1),0.28,8,9));
  if(data.qrDestination)elements.push(qr("invite-qr",data.qrDestination,p.widthInches-1.25,p.heightInches-1.3,0.75,0.75,10));
  return [surface("invitation","front","Invitation",p,1,elements),surface("digital","digital","Digital Share",p,2,elements.map(e=>({...e,id:`digital-${e.id}`})))];
}

function flyerSurfaces(data:FlyerData,p:SpecializedProductionProfile):SpecializedSurface[]{
  const elements:SpecializedElement[]=[text("flyer-headline","headline",data.headline||"Headline",0.6,0.62,p.widthInches-1.2,0.85,26,1)];let y=1.55;
  if(data.subhead){elements.push(text("flyer-subhead","subhead",data.subhead,0.6,y,p.widthInches-1.2,0.55,15,2));y+=0.68;}
  if(data.valueProposition){elements.push(text("flyer-value","subhead",data.valueProposition,0.6,y,p.widthInches-1.2,0.8,14,3));y+=0.92;}
  elements.push(text("flyer-details","details",data.details||"Details",0.6,y,p.widthInches-1.2,Math.max(1.1,p.heightInches-y-4.2),11,4));
  const brands=[...(data.brandElements??[]),...(data.trustElements??[])].join(" • ");if(brands)elements.push(text("flyer-trust","brand",brands,0.6,p.heightInches-3.02,p.widthInches-1.2,0.45,9,5));
  elements.push(text("flyer-cta","cta",data.primaryCta||"Call to action",0.6,p.heightInches-2.42,p.widthInches-(data.qrDestination?2.15:1.2),0.55,17,6));
  elements.push(text("flyer-destination","details",data.destination||"Destination",0.6,p.heightInches-1.76,p.widthInches-(data.qrDestination?2.15:1.2),0.34,9,7));
  if(data.contact)elements.push(text("flyer-contact","details",data.contact,0.6,p.heightInches-1.34,p.widthInches-(data.qrDestination?2.15:1.2),0.32,9,8));
  if(data.disclaimer)elements.push(text("flyer-disclaimer","legal",data.disclaimer,0.6,p.heightInches-0.88,p.widthInches-1.2,0.34,7,9));
  if(data.qrDestination)elements.push(qr("flyer-qr",data.qrDestination,p.widthInches-1.52,p.heightInches-2.25,0.9,0.9,10));
  return [surface("flyer","front","Print Flyer",p,1,elements),surface("digital","digital","Digital Variant",p,2,elements.map(e=>({...e,id:`digital-${e.id}`})))];
}

function tcgSurfaces(data:TcgData,p:SpecializedProductionProfile):SpecializedSurface[]{return (data.cards.length?data.cards:[{id:"template",collectorNumber:"000",fields:{name:"Card Template"},templateId:data.templates[0]?.id??"default"} as TcgCardRecord]).map((card,index)=>{let tokens:Readonly<Record<string,string|number>>={};try{tokens=resolveTcgTemplateTokens(data,card.templateId);}catch{}const name=String(card.fields.name??card.fields.title??card.id),rules=String(card.fields.rules??card.fields.rulesText??"").trim(),type=String(card.fields.type??"").trim();const elements:SpecializedElement[]=[shape(`frame-${card.id}`,0.12,0.12,p.widthInches-0.24,p.heightInches-0.24,0,"layout",String(tokens.frame??"default")),text(`name-${card.id}`,"title",name,0.25,0.22,p.widthInches-0.5,0.38,11,20)];if(type)elements.push(text(`type-${card.id}`,"subhead",type,0.25,0.62,p.widthInches-0.5,0.25,7,21));if(card.artworkAssetId)elements.push(image(`art-${card.id}`,card.artworkAssetId,0.25,0.92,p.widthInches-0.5,1.25,10,{cardId:card.id,...(card.characterLineId?{characterLineId:card.characterLineId}:{}),...(card.evolutionStageId?{evolutionStageId:card.evolutionStageId}:{}),...(card.territoryId?{territoryId:card.territoryId}:{})}));if(rules)elements.push(text(`rules-${card.id}`,"rules",rules,0.25,card.artworkAssetId?2.24:1.1,p.widthInches-0.5,card.artworkAssetId?0.68:1.7,7,30));elements.push(text(`number-${card.id}`,"details",card.collectorNumber,0.25,p.heightInches-0.34,p.widthInches-0.5,0.18,6,40));return surface(`card-${card.id}`,"card-front",`${card.collectorNumber} ${name}`,p,index+1,elements);});}

function surface(id:string,kind:SpecializedSurface["kind"],label:string,p:SpecializedProductionProfile,order:number,elements:readonly SpecializedElement[]):SpecializedSurface{return Object.freeze({id,kind,label,widthInches:p.widthInches,heightInches:p.heightInches,bleedInches:p.bleedInches,safeMarginInches:p.safeMarginInches,readingOrder:order,elements:Object.freeze(elements.map(element=>Object.freeze({...element,box:Object.freeze({...element.box}),style:Object.freeze({...element.style}),metadata:Object.freeze({...element.metadata})})))});}
function text(id:string,role:string,value:string,x:number,y:number,width:number,height:number,size:number,z:number):SpecializedElement{return Object.freeze({id,kind:"text",role,box:Object.freeze({x,y,width,height}),text:value,locked:false,zIndex:z,rotationDegrees:0,style:Object.freeze({fontFamily:"Arial",fontSizePt:size,fill:"#111111"}),metadata:Object.freeze({})});}
function image(id:string,assetId:string,x:number,y:number,width:number,height:number,z:number,metadata:Readonly<Record<string,string|number|boolean>>={}):SpecializedElement{return Object.freeze({id,kind:"image",role:"artwork",box:Object.freeze({x,y,width,height}),assetId,locked:false,zIndex:z,rotationDegrees:0,style:Object.freeze({}),metadata:Object.freeze({...metadata,fit:"cover"})});}
function shape(id:string,x:number,y:number,width:number,height:number,z:number,role:string,note:string):SpecializedElement{return Object.freeze({id,kind:"shape",role,box:Object.freeze({x,y,width,height}),locked:false,zIndex:z,rotationDegrees:0,style:Object.freeze({fill:"#f4f4f4",stroke:"#222222",strokeWidthPt:1}),metadata:Object.freeze({note})});}
function qr(id:string,destination:string,x:number,y:number,width:number,height:number,z:number):SpecializedElement{return Object.freeze({id,kind:"qr",role:"details",box:Object.freeze({x,y,width,height}),locked:false,zIndex:z,rotationDegrees:0,style:Object.freeze({fill:"#ffffff",stroke:"#111111"}),metadata:Object.freeze({destination,quietZoneModules:4})});}
