import type { SpecializedCreationMode } from "./specialized-creation";
import { emptyTcgGameFramework, validateTcgGameFramework, type TcgGameFramework } from "./specialized-creation-tcg-world";

export const SPECIALIZED_OFFICE_FORMAT_VERSION = 1 as const;
export const SPECIALIZED_DOCUMENT_FORMAT_VERSION = 1 as const;
export const SPECIALIZED_PRODUCTION_PROFILE_VERSION = 1 as const;

export type SpecializedStage = "brief" | "plan" | "create" | "review" | "production";
export type SpecializedElementKind = "text" | "image" | "shape" | "line" | "frame" | "background" | "group" | "panel" | "qr";
export type SpecializedTextRole = "title" | "headline" | "subhead" | "body" | "dialogue" | "caption" | "sfx" | "cta" | "details" | "rules" | "flavor" | "legal" | "brand";
export type SpecializedSurfaceKind = "page" | "front" | "inside-left" | "inside-right" | "back" | "details" | "digital" | "card-front" | "card-back" | "sheet";
export type SpecializedArtifactKind = "pdf" | "svg" | "png" | "jpeg" | "cbz" | "json" | "csv";

export interface SpecializedBox { readonly x:number; readonly y:number; readonly width:number; readonly height:number; }
export interface SpecializedStyle {
  readonly fontFamily?: string;
  readonly fontSizePt?: number;
  readonly fontWeight?: "normal" | "bold";
  readonly textAlign?: "left" | "center" | "right";
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidthPt?: number;
  readonly opacity?: number;
}
export interface SpecializedElement {
  readonly id:string;
  readonly kind:SpecializedElementKind;
  readonly role?:SpecializedTextRole | string;
  readonly box:SpecializedBox;
  readonly text?:string;
  readonly assetId?:string;
  readonly locked:boolean;
  readonly zIndex:number;
  readonly rotationDegrees:number;
  readonly style:SpecializedStyle;
  readonly metadata:Readonly<Record<string,string|number|boolean>>;
}
export interface SpecializedSurface {
  readonly id:string;
  readonly kind:SpecializedSurfaceKind;
  readonly label:string;
  readonly widthInches:number;
  readonly heightInches:number;
  readonly bleedInches:number;
  readonly safeMarginInches:number;
  readonly readingOrder:number;
  readonly elements:readonly SpecializedElement[];
}
export interface SpecializedDocument {
  readonly formatVersion:typeof SPECIALIZED_DOCUMENT_FORMAT_VERSION;
  readonly id:string;
  readonly projectId:string;
  readonly title:string;
  readonly mode:SpecializedCreationMode;
  readonly surfaces:readonly SpecializedSurface[];
  readonly styleTokens:Readonly<Record<string,string|number>>;
  readonly createdAt:string;
  readonly updatedAt:string;
}
export interface SpecializedAsset {
  readonly id:string;
  readonly projectId:string;
  readonly kind:"artwork"|"reference"|"logo"|"icon"|"font"|"background"|"template";
  readonly name:string;
  readonly uri:string;
  readonly mimeType?:string;
  readonly pixelWidth?:number;
  readonly pixelHeight?:number;
  readonly source:"author"|"generated"|"imported"|"system";
  readonly sourceReference:string;
  readonly provider?:string;
  readonly model?:string;
  readonly requestId?:string;
  readonly licenseNote?:string;
  readonly approved:boolean;
  readonly createdAt:string;
}
export interface SpecializedProductionProfile {
  readonly formatVersion:typeof SPECIALIZED_PRODUCTION_PROFILE_VERSION;
  readonly id:string;
  readonly label:string;
  readonly widthInches:number;
  readonly heightInches:number;
  readonly bleedInches:number;
  readonly safeMarginInches:number;
  readonly dpi:number;
  readonly colorIntent:"sRGB"|"CMYK";
  readonly artifactKinds:readonly SpecializedArtifactKind[];
  readonly duplex:boolean;
  readonly notes:readonly string[];
}
export interface SpecializedProposal {
  readonly id:string;
  readonly projectId:string;
  readonly kind:"copy"|"layout"|"art-direction"|"revision";
  readonly status:"proposed"|"approved"|"rejected";
  readonly summary:string;
  readonly payload:unknown;
  readonly provider:string;
  readonly model:string;
  readonly requestId?:string;
  readonly createdAt:string;
  readonly reviewedAt?:string;
}
export interface SpecializedRevision {
  readonly id:string;
  readonly projectId:string;
  readonly documentId:string;
  readonly sequence:number;
  readonly reason:string;
  readonly actor:"author"|"system";
  readonly document:SpecializedDocument;
  readonly createdAt:string;
}
export interface SpecializedArtifactRecord {
  readonly id:string;
  readonly projectId:string;
  readonly revisionId:string;
  readonly profileId:string;
  readonly kind:SpecializedArtifactKind;
  readonly fileName:string;
  readonly mimeType:string;
  readonly byteLength:number;
  readonly sha256:string;
  readonly createdAt:string;
}

export interface ComicPanelData { readonly id:string; readonly page:number; readonly order:number; readonly description:string; readonly dialogue:readonly {speaker:string;text:string}[]; readonly captions:readonly string[]; readonly sfx:readonly string[]; readonly assetIds:readonly string[]; }
export interface ComicData { readonly issueTitle:string; readonly issueNumber?:string; readonly readingDirection?:"ltr"|"rtl"; readonly pages:readonly {page:number; pageTurnIntent?:string; panels:readonly ComicPanelData[]}[]; }
export type CardSentimentIntensity="light"|"moderate"|"deep";
export type CardHumorPreference="none"|"light"|"playful"|"bold";
export type BirthdayContext="standard"|"milestone"|"across-distance"|"belated";
export interface FoldedCardData { readonly recipient?:string; readonly relationship?:string; readonly occasion:string; readonly tone:string; readonly milestone?:string; readonly sentimentIntensity?:CardSentimentIntensity; readonly humorPreference?:CardHumorPreference; readonly personalizationFacts?:readonly string[]; readonly explicitFaithLanguage?:string; readonly message:string; readonly signature?:string; }
export interface GreetingCardData extends FoldedCardData { readonly greetingPurpose?:string; }
export interface BirthdayCardData extends FoldedCardData { readonly birthdayContext?:BirthdayContext; readonly distanceContext?:string; readonly belatedContext?:string; }
export type InvitationPrivacyShareIntent="private"|"invite-only"|"shareable"|"public";
export interface InvitationData { readonly eventType:string; readonly primaryNames:readonly string[]; readonly date?:string; readonly startTime?:string; readonly timezone?:string; readonly venue?:string; readonly address?:string; readonly rsvpMethod?:string; readonly rsvpDeadline?:string; readonly dressCode?:string; readonly details?:string; readonly accessibilityNotes?:string; readonly website?:string; readonly qrDestination?:string; readonly privacyShareIntent?:InvitationPrivacyShareIntent; }
export interface FlyerData { readonly objective:string; readonly audience:string; readonly headline:string; readonly subhead?:string; readonly valueProposition?:string; readonly details:string; readonly brandElements?:readonly string[]; readonly trustElements?:readonly string[]; readonly contact?:string; readonly primaryCta:string; readonly destination:string; readonly qrDestination?:string; readonly secondaryActions:readonly string[]; readonly disclaimer?:string; }
export type CardFieldType = "text"|"number"|"boolean"|"enum";
export interface TcgFieldDefinition { readonly key:string; readonly label:string; readonly type:CardFieldType; readonly required:boolean; readonly values?:readonly string[]; }
export interface TcgCardRecord {
  readonly id:string;
  readonly collectorNumber:string;
  readonly fields:Readonly<Record<string,string|number|boolean>>;
  readonly artworkAssetId?:string;
  readonly templateId:string;
  readonly characterLineId?:string;
  readonly evolutionStageId?:string;
  readonly territoryId?:string;
}
export interface TcgData {
  readonly gameTitle:string;
  readonly setId:string;
  readonly setName:string;
  readonly fields:readonly TcgFieldDefinition[];
  readonly cards:readonly TcgCardRecord[];
  readonly templates:readonly {id:string; name:string; parentId?:string; tokens:Readonly<Record<string,string|number>>}[];
  readonly playtestSnapshots:readonly {id:string; createdAt:string; cardIds:readonly string[]; note:string}[];
  readonly gameFramework?:TcgGameFramework;
}
export type SpecializedModeData = ComicData | GreetingCardData | BirthdayCardData | InvitationData | FlyerData | TcgData;

export interface SpecializedOfficeProject {
  readonly formatVersion:typeof SPECIALIZED_OFFICE_FORMAT_VERSION;
  readonly id:string;
  readonly forgeProjectId:string;
  readonly mode:SpecializedCreationMode;
  readonly title:string;
  readonly brief:string;
  readonly audience?:string;
  readonly stage:SpecializedStage;
  readonly modeData:SpecializedModeData;
  readonly documents:readonly SpecializedDocument[];
  readonly assets:readonly SpecializedAsset[];
  readonly proposals:readonly SpecializedProposal[];
  readonly revisions:readonly SpecializedRevision[];
  readonly productionProfiles:readonly SpecializedProductionProfile[];
  readonly artifacts:readonly SpecializedArtifactRecord[];
  readonly createdAt:string;
  readonly updatedAt:string;
}

export function defaultProductionProfile(mode:SpecializedCreationMode):SpecializedProductionProfile {
  const common={formatVersion:SPECIALIZED_PRODUCTION_PROFILE_VERSION,bleedInches:0.125,safeMarginInches:0.25,dpi:300,colorIntent:"sRGB" as const,duplex:false,notes:[] as string[]};
  if(mode==="comic-book") return Object.freeze({...common,id:"comic-standard",label:"Comic 6.625 × 10.25",widthInches:6.625,heightInches:10.25,artifactKinds:["pdf","cbz","svg","png"] as SpecializedArtifactKind[]});
  if(mode==="greeting-card"||mode==="birthday-card") return Object.freeze({...common,id:"folded-5x7",label:"Folded 5 × 7",widthInches:5,heightInches:7,duplex:true,artifactKinds:["pdf","svg","png"] as SpecializedArtifactKind[]});
  if(mode==="invitation") return Object.freeze({...common,id:"invitation-5x7",label:"Invitation 5 × 7",widthInches:5,heightInches:7,artifactKinds:["pdf","svg","png"] as SpecializedArtifactKind[]});
  if(mode==="flyer") return Object.freeze({...common,id:"flyer-letter",label:"US Letter Flyer",widthInches:8.5,heightInches:11,artifactKinds:["pdf","svg","png","jpeg"] as SpecializedArtifactKind[]});
  return Object.freeze({...common,id:"tcg-poker",label:"Poker card 2.5 × 3.5",widthInches:2.5,heightInches:3.5,duplex:true,artifactKinds:["pdf","svg","png","json","csv"] as SpecializedArtifactKind[]});
}

export function emptyModeData(mode:SpecializedCreationMode):SpecializedModeData {
  if(mode==="comic-book") return Object.freeze({issueTitle:"",readingDirection:"ltr",pages:[]}) as ComicData;
  if(mode==="greeting-card") return Object.freeze({occasion:"general",tone:"warm",sentimentIntensity:"moderate",humorPreference:"none",personalizationFacts:[],message:""}) as GreetingCardData;
  if(mode==="birthday-card") return Object.freeze({occasion:"birthday",tone:"warm",sentimentIntensity:"moderate",humorPreference:"light",personalizationFacts:[],birthdayContext:"standard",message:""}) as BirthdayCardData;
  if(mode==="invitation") return Object.freeze({eventType:"event",primaryNames:[],privacyShareIntent:"invite-only"}) as InvitationData;
  if(mode==="flyer") return Object.freeze({objective:"",audience:"",headline:"",details:"",brandElements:[],trustElements:[],primaryCta:"",destination:"",secondaryActions:[]}) as FlyerData;
  return Object.freeze({gameTitle:"",setId:"",setName:"",fields:[],cards:[],templates:[],playtestSnapshots:[],gameFramework:emptyTcgGameFramework()}) as TcgData;
}

export function createSpecializedOfficeProject(input:{id:string;forgeProjectId:string;mode:SpecializedCreationMode;title:string;brief:string;audience?:string;now?:string}):SpecializedOfficeProject {
  required(input.id,"Specialized project id");required(input.forgeProjectId,"Forge project id");required(input.title,"Specialized project title");required(input.brief,"Specialized project brief");
  const now=input.now??new Date().toISOString();
  return Object.freeze({formatVersion:SPECIALIZED_OFFICE_FORMAT_VERSION,id:input.id.trim(),forgeProjectId:input.forgeProjectId.trim(),mode:input.mode,title:input.title.trim(),brief:input.brief.trim(),...(input.audience?.trim()?{audience:input.audience.trim()}:{}),stage:"brief",modeData:emptyModeData(input.mode),documents:[],assets:[],proposals:[],revisions:[],productionProfiles:[defaultProductionProfile(input.mode)],artifacts:[],createdAt:now,updatedAt:now});
}

export function validateSpecializedOfficeProject(project:SpecializedOfficeProject):void {
  if(project.formatVersion!==SPECIALIZED_OFFICE_FORMAT_VERSION) throw new Error("Unsupported Specialized Creation office format.");
  required(project.id,"Specialized project id");required(project.forgeProjectId,"Forge project id");required(project.title,"Specialized project title");required(project.brief,"Specialized project brief");
  const documentIds=new Set<string>();for(const document of project.documents){validateSpecializedDocument(document,project);if(documentIds.has(document.id))throw new Error(`Duplicate specialized document id "${document.id}".`);documentIds.add(document.id);}
  const assetIds=new Set<string>();for(const asset of project.assets){if(asset.projectId!==project.id)throw new Error("Specialized asset belongs to another project.");if(assetIds.has(asset.id))throw new Error(`Duplicate specialized asset id "${asset.id}".`);assetIds.add(asset.id);}
  const revisionIds=new Set<string>();for(const revision of project.revisions){if(revision.projectId!==project.id)throw new Error("Specialized revision belongs to another project.");if(revisionIds.has(revision.id))throw new Error(`Duplicate specialized revision id "${revision.id}".`);revisionIds.add(revision.id);}
  const profileIds=new Set<string>();for(const profile of project.productionProfiles){validateProductionProfile(profile);if(profileIds.has(profile.id))throw new Error(`Duplicate production profile id "${profile.id}".`);profileIds.add(profile.id);}
  validateModeData(project.mode,project.modeData);
}

export function validateSpecializedDocument(document:SpecializedDocument,project?:SpecializedOfficeProject):void {
  if(document.formatVersion!==SPECIALIZED_DOCUMENT_FORMAT_VERSION)throw new Error("Unsupported specialized document format.");required(document.id,"Document id");required(document.projectId,"Document project id");required(document.title,"Document title");if(project&&(document.projectId!==project.id||document.mode!==project.mode))throw new Error("Specialized document scope mismatch.");
  const surfaceIds=new Set<string>();for(const surface of document.surfaces){required(surface.id,"Surface id");if(surfaceIds.has(surface.id))throw new Error(`Duplicate surface id "${surface.id}".`);surfaceIds.add(surface.id);positive(surface.widthInches,"Surface width");positive(surface.heightInches,"Surface height");if(surface.bleedInches<0||surface.safeMarginInches<0)throw new Error("Surface bleed/safe margin cannot be negative.");const elementIds=new Set<string>();for(const element of surface.elements){required(element.id,"Element id");if(elementIds.has(element.id))throw new Error(`Duplicate element id "${element.id}".`);elementIds.add(element.id);validateBox(element.box);if(element.kind==="text"&&!element.text?.trim())throw new Error(`Text element "${element.id}" requires text.`);}}
}

export function validateProductionProfile(profile:SpecializedProductionProfile):void {if(profile.formatVersion!==SPECIALIZED_PRODUCTION_PROFILE_VERSION)throw new Error("Unsupported production profile version.");required(profile.id,"Production profile id");positive(profile.widthInches,"Production width");positive(profile.heightInches,"Production height");if(profile.bleedInches<0||profile.safeMarginInches<profile.bleedInches)throw new Error("Invalid bleed/safe margin.");if(!Number.isInteger(profile.dpi)||profile.dpi<72)throw new Error("Production DPI must be an integer of at least 72.");if(!profile.artifactKinds.length)throw new Error("Production profile requires artifacts.");}

export function validateModeData(mode:SpecializedCreationMode,data:SpecializedModeData):void {
  if(mode==="comic-book"){
    const comic=data as ComicData;if(comic.readingDirection!==undefined&&comic.readingDirection!=="ltr"&&comic.readingDirection!=="rtl")throw new Error("Comic reading direction must be ltr or rtl.");const pages=new Set<number>();const panelIds=new Set<string>();for(const page of comic.pages){if(!Number.isInteger(page.page)||page.page<1)throw new Error("Comic page number must be positive.");if(pages.has(page.page))throw new Error(`Duplicate comic page ${page.page}.`);pages.add(page.page);const orders=new Set<number>();for(const panel of page.panels){required(panel.id,"Comic panel id");if(panelIds.has(panel.id))throw new Error(`Duplicate comic panel id "${panel.id}".`);panelIds.add(panel.id);if(panel.page!==page.page)throw new Error("Comic panel page mismatch.");if(!Number.isInteger(panel.order)||panel.order<1)throw new Error("Comic panel order must be a positive integer.");if(orders.has(panel.order))throw new Error(`Duplicate comic panel order ${panel.order} on page ${page.page}.`);orders.add(panel.order);}}return;
  }
  if(mode==="invitation"){const invite=data as InvitationData;if(!invite.eventType.trim())throw new Error("Invitation event type is required.");if(invite.privacyShareIntent&&!(["private","invite-only","shareable","public"] as const).includes(invite.privacyShareIntent))throw new Error("Invitation privacy/share intent is invalid.");return;}
  if(mode==="flyer"){const flyer=data as FlyerData;if(flyer.secondaryActions.length>20)throw new Error("Flyer secondary action list is unreasonable.");for(const value of flyer.brandElements??[])required(value,"Flyer brand element");for(const value of flyer.trustElements??[])required(value,"Flyer trust element");return;}
  if(mode==="trading-card-game"){
    const tcg=data as TcgData;if(tcg.gameFramework)validateTcgGameFramework(tcg.gameFramework);const fields=new Set<string>();for(const field of tcg.fields){required(field.key,"TCG field key");required(field.label,"TCG field label");if(fields.has(field.key))throw new Error(`Duplicate TCG field "${field.key}".`);fields.add(field.key);if(field.type==="enum"&&(!field.values?.length||new Set(field.values).size!==field.values.length))throw new Error(`Enum TCG field "${field.key}" requires unique allowed values.`);}
    const templates=new Map<string,{id:string;name:string;parentId?:string;tokens:Readonly<Record<string,string|number>>}>();for(const template of tcg.templates){required(template.id,"TCG template id");required(template.name,"TCG template name");if(templates.has(template.id))throw new Error(`Duplicate TCG template "${template.id}".`);templates.set(template.id,template);}for(const template of tcg.templates){if(template.parentId&&!templates.has(template.parentId))throw new Error(`TCG template "${template.id}" references missing parent "${template.parentId}".`);if(template.parentId===template.id)throw new Error(`TCG template "${template.id}" cannot inherit itself.`);assertNoTemplateCycle(template.id,templates);}
    const characterLines=new Map(tcg.gameFramework?.characterLines.map(line=>[line.id,line])??[]),territoryIds=new Set(tcg.gameFramework?.worldMaps.flatMap(map=>map.territories.map(territory=>territory.id))??[]);
    const ids=new Set<string>(),numbers=new Set<string>();for(const card of tcg.cards){required(card.id,"TCG card id");required(card.collectorNumber,"TCG collector number");required(card.templateId,"TCG card template id");if(ids.has(card.id))throw new Error(`Duplicate TCG card id "${card.id}".`);if(numbers.has(card.collectorNumber))throw new Error(`Duplicate collector number "${card.collectorNumber}".`);if(!templates.has(card.templateId))throw new Error(`Card "${card.id}" references missing template "${card.templateId}".`);if(card.evolutionStageId&&!card.characterLineId)throw new Error(`Card "${card.id}" evolution stage requires character-line lineage.`);if(card.characterLineId){const line=characterLines.get(card.characterLineId);if(!line)throw new Error(`Card "${card.id}" references missing character line "${card.characterLineId}".`);if(card.evolutionStageId&&!line.stages.some(stage=>stage.id===card.evolutionStageId))throw new Error(`Card "${card.id}" references missing evolution stage "${card.evolutionStageId}".`);}if(card.territoryId&&!territoryIds.has(card.territoryId))throw new Error(`Card "${card.id}" references missing territory "${card.territoryId}".`);ids.add(card.id);numbers.add(card.collectorNumber);for(const field of tcg.fields){const value=card.fields[field.key];if(field.required&&(value===undefined||value===null||String(value).trim()==="")throw new Error(`Card "${card.id}" missing required field "${field.key}".`);if(value!==undefined&&value!==null)validateTcgFieldValue(card.id,field,value);}}
    return;
  }
  const card=data as FoldedCardData;if(!card.occasion.trim()||!card.tone.trim())throw new Error("Card occasion and tone are required.");if(card.sentimentIntensity&&!(["light","moderate","deep"] as const).includes(card.sentimentIntensity))throw new Error("Card sentiment intensity is invalid.");if(card.humorPreference&&!(["none","light","playful","bold"] as const).includes(card.humorPreference))throw new Error("Card humor preference is invalid.");for(const fact of card.personalizationFacts??[])required(fact,"Card personalization fact");if(mode==="birthday-card"){const birthday=data as BirthdayCardData;if(birthday.birthdayContext&&!(["standard","milestone","across-distance","belated"] as const).includes(birthday.birthdayContext))throw new Error("Birthday context is invalid.");}
}

export function nextSpecializedStage(stage:SpecializedStage):SpecializedStage {const order:SpecializedStage[]=["brief","plan","create","review","production"];return order[Math.min(order.length-1,order.indexOf(stage)+1)];}
function assertNoTemplateCycle(id:string,templates:ReadonlyMap<string,{parentId?:string}>):void{const seen=new Set<string>();let current:string|undefined=id;while(current){if(seen.has(current))throw new Error(`TCG template inheritance cycle includes "${current}".`);seen.add(current);current=templates.get(current)?.parentId;}}
function validateTcgFieldValue(cardId:string,field:TcgFieldDefinition,value:string|number|boolean):void{if(field.type==="text"&&typeof value!=="string")throw new Error(`Card "${cardId}" field "${field.key}" must be text.`);if(field.type==="number"&&(typeof value!=="number"||!Number.isFinite(value)))throw new Error(`Card "${cardId}" field "${field.key}" must be a finite number.`);if(field.type==="boolean"&&typeof value!=="boolean")throw new Error(`Card "${cardId}" field "${field.key}" must be boolean.`);if(field.type==="enum"&&(typeof value!=="string"||!field.values?.includes(value)))throw new Error(`Card "${cardId}" field "${field.key}" must be one of: ${(field.values??[]).join(", ")}.`);}
function required(value:string,label:string):void{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);}function positive(value:number,label:string):void{if(!Number.isFinite(value)||value<=0)throw new Error(`${label} must be positive.`);}function validateBox(box:SpecializedBox):void{if(![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<0||box.height<0)throw new Error("Invalid composition element box.");}
