import { randomUUID } from "node:crypto";
import { createMemoryRecord } from "../domain/memory";
import type { SpecializedCreationMode } from "../domain/specialized-creation";
import {
  SPECIALIZED_DOCUMENT_FORMAT_VERSION,
  SPECIALIZED_OFFICE_FORMAT_VERSION,
  createSpecializedOfficeProject,
  nextSpecializedStage,
  type ComicData,
  type FlyerData,
  type FoldedCardData,
  type InvitationData,
  type SpecializedArtifactKind,
  type SpecializedAsset,
  type SpecializedDocument,
  type SpecializedModeData,
  type SpecializedOfficeProject,
  type SpecializedProductionProfile,
  type SpecializedProposal,
  type SpecializedRevision,
  type SpecializedSurface,
  type TcgData,
  validateModeData,
  validateSpecializedDocument,
} from "../domain/specialized-creation-office";
import type { FileSpecializedCreationStore } from "../infrastructure/file-specialized-creation-store";
import type { ProjectMemoryStore } from "./project-memory-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { SpecializedCreationProductionEngine, type SpecializedPreflightReport, type SpecializedRenderedArtifact } from "./specialized-creation-production-engine";

export type SpecializedAiGenerator=(request:ProjectAiGenerationRequest)=>Promise<AiGenerationResult>;
export interface SpecializedAiProposalRequest { readonly projectId:string; readonly kind:SpecializedProposal["kind"]; readonly instruction:string; readonly focus?:string; }
export interface SpecializedAiProposalResult { readonly proposal:SpecializedProposal; readonly ai:Pick<AiGenerationResult,"provider"|"model"|"requestId"|"attempts"|"optimization">; }

export class SpecializedCreationOfficeService {
  constructor(
    private readonly store:FileSpecializedCreationStore,
    private readonly memory:ProjectMemoryStore,
    private readonly production=new SpecializedCreationProductionEngine(),
    private readonly ai:SpecializedAiGenerator=generateProjectText,
  ) {}

  list(forgeProjectId:string){return this.store.list(forgeProjectId);}
  get(forgeProjectId:string,id:string){return this.store.get(forgeProjectId,id);}

  async create(input:{id?:string;forgeProjectId:string;mode:SpecializedCreationMode;title:string;brief:string;audience?:string;now?:string}):Promise<SpecializedOfficeProject>{
    const project=createSpecializedOfficeProject({id:input.id?.trim()||`specialized-${randomUUID()}`,forgeProjectId:input.forgeProjectId,mode:input.mode,title:input.title,brief:input.brief,...(input.audience?{audience:input.audience}:{}),...(input.now?{now:input.now}:{})});
    const saved=await this.store.create(project);this.remember(saved,"created",input.now);return saved;
  }

  async setModeData(forgeProjectId:string,id:string,modeData:SpecializedModeData,reason="Author updated structured mode data",now=new Date().toISOString()):Promise<SpecializedOfficeProject>{
    const project=await this.require(forgeProjectId,id);validateModeData(project.mode,modeData);
    const next={...project,modeData:clone(modeData),stage:project.stage==="brief"?"plan":project.stage,updatedAt:now};
    const saved=await this.store.save(next);this.remember(saved,reason,now);return saved;
  }

  async saveDocument(forgeProjectId:string,id:string,document:SpecializedDocument,reason="Author saved composition",now=new Date().toISOString()):Promise<SpecializedOfficeProject>{
    const project=await this.require(forgeProjectId,id);validateSpecializedDocument(document,project);
    const existing=project.documents.find(item=>item.id===document.id);const docs=existing?project.documents.map(item=>item.id===document.id?clone(document):item):[...project.documents,clone(document)];
    const sequence=(project.revisions.filter(r=>r.documentId===document.id).at(-1)?.sequence??0)+1;
    const revision:SpecializedRevision=Object.freeze({id:`${document.id}:r${sequence}`,projectId:project.id,documentId:document.id,sequence,reason:reason.trim()||"Composition saved",actor:"author",document:clone(document),createdAt:now});
    const next={...project,documents:docs,revisions:[...project.revisions,revision],stage:project.stage==="brief"||project.stage==="plan"?"create":project.stage,updatedAt:now};
    const saved=await this.store.save(next);this.remember(saved,reason,now);return saved;
  }

  async createDefaultDocument(forgeProjectId:string,id:string,now=new Date().toISOString()):Promise<SpecializedOfficeProject>{
    const project=await this.require(forgeProjectId,id);const profile=project.productionProfiles[0];if(!profile)throw new Error("Specialized project has no production profile.");
    const document=buildDefaultDocument(project,profile,now);return this.saveDocument(forgeProjectId,id,document,"Created mode-specific composition surfaces",now);
  }

  async addAsset(forgeProjectId:string,id:string,asset:Omit<SpecializedAsset,"projectId"|"createdAt">,now=new Date().toISOString()):Promise<SpecializedOfficeProject>{
    const project=await this.require(forgeProjectId,id);if(project.assets.some(item=>item.id===asset.id))throw new Error(`Specialized asset \"${asset.id}\" already exists.`);const item:SpecializedAsset=Object.freeze({...asset,projectId:project.id,createdAt:now});const next={...project,assets:[...project.assets,item],updatedAt:now};return this.store.save(next);
  }

  async setProductionProfile(forgeProjectId:string,id:string,profile:SpecializedProductionProfile,now=new Date().toISOString()):Promise<SpecializedOfficeProject>{
    const project=await this.require(forgeProjectId,id);const exists=project.productionProfiles.some(item=>item.id===profile.id);const profiles=exists?project.productionProfiles.map(item=>item.id===profile.id?clone(profile):item):[...project.productionProfiles,clone(profile)];return this.store.save({...project,productionProfiles:profiles,updatedAt:now});
  }

  preflight(project:SpecializedOfficeProject,profileId?:string):SpecializedPreflightReport {const profile=selectProfile(project,profileId);return this.production.preflight(project,profile);}

  async render(forgeProjectId:string,id:string,kind:SpecializedArtifactKind,profileId?:string,now=new Date().toISOString()):Promise<{project:SpecializedOfficeProject;artifact:SpecializedRenderedArtifact;preflight:SpecializedPreflightReport}>{
    const project=await this.require(forgeProjectId,id),profile=selectProfile(project,profileId),preflight=this.production.preflight(project,profile,now);if(!preflight.ready)throw new Error(`Production blocked by ${preflight.blocking} preflight error(s).`);
    const rendered=this.production.render(project,profile,kind);const latestRevision=project.revisions.at(-1);if(!latestRevision)throw new Error("Production requires at least one durable composition revision.");
    const record={id:`artifact-${rendered.sha256.slice(0,16)}`,projectId:project.id,revisionId:latestRevision.id,profileId:profile.id,kind,fileName:rendered.fileName,mimeType:rendered.mimeType,byteLength:rendered.byteLength,sha256:rendered.sha256,createdAt:now};
    const next=await this.store.save({...project,artifacts:[...project.artifacts.filter(a=>a.id!==record.id),record],stage:"production",updatedAt:now});this.remember(next,`Rendered ${kind} artifact ${rendered.fileName}`,now);return {project:next,artifact:rendered,preflight};
  }

  async propose(forgeProjectId:string,id:string,request:SpecializedAiProposalRequest,now=new Date().toISOString()):Promise<SpecializedAiProposalResult>{
    const project=await this.require(forgeProjectId,id);if(request.projectId!==forgeProjectId)throw new Error("AI proposal project scope mismatch.");if(!request.instruction.trim())throw new Error("AI proposal instruction is required.");
    const result=await this.ai({memory:this.memory,context:{projectId:forgeProjectId,taskMemoryClasses:["author-memory","project-memory","style-memory","visual-identity","research-memory","decision-memory","production-memory"],relevanceTags:["specialized-creation",project.mode],queryTerms:[project.title,project.brief,request.focus??request.kind],includeWorkingState:true,limit:40},system:"You are the Specialized Creation Office assistant inside Author's Forge. Follow Project Brain context and the author's approved brief. Never invent production-critical personal/event facts. Return only valid JSON. Required text must remain editable structured text, never baked into an image prompt.",user:[`Mode: ${project.mode}`,`Title: ${project.title}`,`Brief: ${project.brief}`,project.audience?`Audience: ${project.audience}`:"",`Proposal kind: ${request.kind}`,`Instruction: ${request.instruction}`,`Current structured mode data: ${JSON.stringify(project.modeData)}`,`Return JSON shaped exactly as {\"summary\":\"short proposal summary\",\"payload\":{...}}.`].filter(Boolean).join("\n"),temperature:request.kind==="layout"?0.5:0.75,maxOutputTokens:5000});
    const parsed=parseObject(result.text);const summary=string(parsed.summary,"AI proposal summary");if(!(parsed.payload&&typeof parsed.payload==="object"))throw new Error("AI proposal payload must be an object.");
    const proposal:SpecializedProposal=Object.freeze({id:`proposal-${randomUUID()}`,projectId:project.id,kind:request.kind,status:"proposed",summary,payload:clone(parsed.payload),provider:result.provider,model:result.model,...(result.requestId?{requestId:result.requestId}:{}),createdAt:now});
    await this.store.save({...project,proposals:[...project.proposals,proposal],updatedAt:now});return {proposal,ai:evidence(result)};
  }

  async approveProposal(forgeProjectId:string,id:string,proposalId:string,apply=false,now=new Date().toISOString()):Promise<SpecializedOfficeProject>{
    const project=await this.require(forgeProjectId,id);const proposal=project.proposals.find(item=>item.id===proposalId);if(!proposal)throw new Error(`Proposal \"${proposalId}\" not found.`);if(proposal.status!=="proposed")throw new Error("Only proposed AI work can be approved.");let next:SpecializedOfficeProject={...project,proposals:project.proposals.map(item=>item.id===proposalId?{...item,status:"approved",reviewedAt:now}:item),stage:project.stage==="brief"?"plan":project.stage,updatedAt:now};
    if(apply&&proposal.kind==="copy"){const payload=proposal.payload as Record<string,unknown>;if(payload.modeData&&typeof payload.modeData==="object"){validateModeData(project.mode,payload.modeData as SpecializedModeData);next={...next,modeData:clone(payload.modeData as SpecializedModeData)};}}
    const saved=await this.store.save(next);this.remember(saved,`Author approved AI proposal ${proposalId}`,now);return saved;
  }

  async rejectProposal(forgeProjectId:string,id:string,proposalId:string,now=new Date().toISOString()):Promise<SpecializedOfficeProject>{const project=await this.require(forgeProjectId,id);if(!project.proposals.some(p=>p.id===proposalId))throw new Error(`Proposal \"${proposalId}\" not found.`);return this.store.save({...project,proposals:project.proposals.map(p=>p.id===proposalId?{...p,status:"rejected",reviewedAt:now}:p),updatedAt:now});}
  async advance(forgeProjectId:string,id:string,now=new Date().toISOString()):Promise<SpecializedOfficeProject>{const project=await this.require(forgeProjectId,id);const stage=nextSpecializedStage(project.stage);const saved=await this.store.save({...project,stage,updatedAt:now});this.remember(saved,`Advanced specialized workflow to ${stage}`,now);return saved;}

  private async require(forgeProjectId:string,id:string):Promise<SpecializedOfficeProject>{const project=await this.store.get(forgeProjectId,id);if(!project)throw new Error(`Specialized project \"${id}\" not found.`);return project;}
  private remember(project:SpecializedOfficeProject,reason:string,now=new Date().toISOString()):void {const id=`specialized:${project.id}:${project.updatedAt.replace(/[^0-9]/g,"")}`;if(this.memory.get(id))return;this.memory.register(createMemoryRecord({id,projectId:project.forgeProjectId,class:"production-memory",authority:"working",summary:`Specialized Creation ${project.mode}: ${project.title}`,content:JSON.stringify({specializedProjectId:project.id,mode:project.mode,stage:project.stage,reason,documentIds:project.documents.map(d=>d.id),artifactIds:project.artifacts.map(a=>a.id)}),provenance:[{kind:"system",reference:"specialized-creation-office",recordedAt:now}],relevanceTags:["specialized-creation",project.mode,project.stage],now}));}
}

function buildDefaultDocument(project:SpecializedOfficeProject,profile:SpecializedProductionProfile,now:string):SpecializedDocument {
  const surfaces:SpecializedSurface[]=[];const base=(id:string,kind:SpecializedSurface["kind"],label:string,order:number):SpecializedSurface=>({id,kind,label,widthInches:profile.widthInches,heightInches:profile.heightInches,bleedInches:profile.bleedInches,safeMarginInches:profile.safeMarginInches,readingOrder:order,elements:[]});
  if(project.mode==="comic-book"){const data=project.modeData as ComicData;const count=Math.max(1,data.pages.length);for(let i=1;i<=count;i++)surfaces.push(base(`page-${i}`,"page",`Page ${i}`,i));}
  else if(project.mode==="greeting-card"||project.mode==="birthday-card"){surfaces.push(base("front","front","Front",1),base("inside-left","inside-left","Inside Left",2),base("inside-right","inside-right","Inside Right",3),base("back","back","Back",4));}
  else if(project.mode==="invitation"){surfaces.push(base("front","front","Invitation",1),base("digital","digital","Digital Share",2));}
  else if(project.mode==="flyer"){surfaces.push(base("flyer","front","Flyer",1),base("digital","digital","Digital Variant",2));}
  else {const data=project.modeData as TcgData;for(const card of data.cards)surfaces.push(base(`card-${card.id}`,"card-front",card.collectorNumber||card.id,surfaces.length+1));if(!surfaces.length)surfaces.push(base("card-template","card-front","Card Template",1));}
  return Object.freeze({formatVersion:SPECIALIZED_DOCUMENT_FORMAT_VERSION,id:`doc-${randomUUID()}`,projectId:project.id,title:`${project.title} Composition`,mode:project.mode,surfaces:Object.freeze(surfaces),styleTokens:Object.freeze({}),createdAt:now,updatedAt:now});
}
function selectProfile(project:SpecializedOfficeProject,id?:string):SpecializedProductionProfile {const profile=id?project.productionProfiles.find(item=>item.id===id):project.productionProfiles[0];if(!profile)throw new Error("Production profile not found.");return profile;}
function parseObject(text:string):Record<string,unknown>{try{const value=JSON.parse(text.trim());if(!value||typeof value!=="object"||Array.isArray(value))throw new Error();return value as Record<string,unknown>;}catch{throw new Error("AI Specialized Creation response was not valid JSON.");}}
function string(value:unknown,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);return value.trim();}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
function evidence(result:AiGenerationResult):Pick<AiGenerationResult,"provider"|"model"|"requestId"|"attempts"|"optimization">{return {provider:result.provider,model:result.model,...(result.requestId?{requestId:result.requestId}:{}),...(result.attempts?{attempts:result.attempts}:{}),...(result.optimization?{optimization:result.optimization}:{})};}
