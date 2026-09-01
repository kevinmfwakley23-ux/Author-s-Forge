import { join } from "node:path";
import { FileProjectStore } from "../infrastructure/file-project-store";
import type { FileSpecializedCreationStore } from "../infrastructure/file-specialized-creation-store";
import type { ProjectMemoryStore } from "./project-memory-store";
import type { SpecializedCreationOfficeService } from "./specialized-creation-office-service";
import { SpecializedCreationAiAssetService } from "./specialized-creation-ai-assets";
import { SpecializedCreationTcgAiService,type TcgAiProposalScope } from "./specialized-creation-tcg-ai";
import { buildTcgCharacterContinuityContext,bridgeApprovedTcgStageArtwork } from "./specialized-creation-tcg-character-bridge";
import { createCharacterEvolutionCards,createTerritoryCards,setTcgGameFramework,tcgGameFramework,upsertTcgCharacterEvolutionLine,upsertTcgWorldMap } from "./specialized-creation-tcg-design";
import { validateTcgGameFramework,type TcgCharacterEvolutionLine,type TcgGameFramework,type TcgWorldMap } from "../domain/specialized-creation-tcg-world";
import { validateModeData,type SpecializedOfficeProject,type TcgData } from "../domain/specialized-creation-office";

export interface SpecializedTcgHttpResult {readonly status:number;readonly body:unknown;readonly memoryMayHaveChanged:boolean;}
export async function handleSpecializedTcgAction(input:{tail:string;method?:string;body:Record<string,unknown>;forgeProjectId:string;specializedProjectId:string;current:SpecializedOfficeProject;office:SpecializedCreationOfficeService;store:FileSpecializedCreationStore;memory:ProjectMemoryStore}):Promise<SpecializedTcgHttpResult|undefined>{
  if(input.current.mode!=="trading-card-game"&&!input.tail.startsWith("tcg/"))return undefined;
  const data=input.current.modeData as TcgData,aiAssets=new SpecializedCreationAiAssetService(input.store,input.memory),tcgAi=new SpecializedCreationTcgAiService(input.store,input.memory),ok=(status:number,body:unknown,memoryMayHaveChanged=false):SpecializedTcgHttpResult=>({status,body,memoryMayHaveChanged});
  if(input.tail==="tcg/framework"&&input.method==="GET")return ok(200,tcgGameFramework(data));
  if(input.tail==="tcg/framework"&&input.method==="PUT"){const framework=object(input.body.framework,"framework") as unknown as TcgGameFramework;const next=setTcgGameFramework(data,framework),saved=await input.office.setModeData(input.forgeProjectId,input.specializedProjectId,next,"Author updated TCG game framework");return ok(200,saved,true);}
  if(input.tail==="tcg/framework/validate"&&input.method==="POST"){const framework=(input.body.framework&&typeof input.body.framework==="object"?input.body.framework:tcgGameFramework(data)) as TcgGameFramework;try{validateTcgGameFramework(framework,true);return ok(200,{ready:true,issues:[]});}catch(error){return ok(200,{ready:false,issues:[error instanceof Error?error.message:String(error)]});}}
  if(input.tail==="tcg/character-line"&&input.method==="PUT"){const line=object(input.body.line,"line") as unknown as TcgCharacterEvolutionLine,next=upsertTcgCharacterEvolutionLine(data,line),saved=await input.office.setModeData(input.forgeProjectId,input.specializedProjectId,next,"Author updated TCG character evolution line");return ok(200,saved,true);}
  if(input.tail==="tcg/world-map"&&input.method==="PUT"){const map=object(input.body.map,"map") as unknown as TcgWorldMap,next=upsertTcgWorldMap(data,map),saved=await input.office.setModeData(input.forgeProjectId,input.specializedProjectId,next,"Author updated TCG world map");return ok(200,saved,true);}
  if(input.tail==="tcg/evolution-cards"&&input.method==="POST"){const next=createCharacterEvolutionCards(data,{lineId:required(input.body.lineId,"lineId"),templateId:required(input.body.templateId,"templateId"),...(typeof input.body.collectorPrefix==="string"?{collectorPrefix:input.body.collectorPrefix}: {})});const saved=await input.office.setModeData(input.forgeProjectId,input.specializedProjectId,next,"Generated card records from approved TCG evolution line");return ok(201,saved,true);}
  if(input.tail==="tcg/territory-cards"&&input.method==="POST"){const next=createTerritoryCards(data,{mapId:required(input.body.mapId,"mapId"),templateId:required(input.body.templateId,"templateId"),...(typeof input.body.collectorPrefix==="string"?{collectorPrefix:input.body.collectorPrefix}: {})});const saved=await input.office.setModeData(input.forgeProjectId,input.specializedProjectId,next,"Generated card records from TCG territory map");return ok(201,saved,true);}
  if(input.tail==="tcg/import/json"&&input.method==="POST"){const imported=object(input.body.data,"data") as unknown as TcgData;validateModeData("trading-card-game",imported);const saved=await input.office.setModeData(input.forgeProjectId,input.specializedProjectId,imported,"Imported validated TCG JSON data");return ok(200,saved,true);}
  if(input.tail==="tcg/ai/propose"&&input.method==="POST"){const scope=tcgScope(input.body.scope);const result=await tcgAi.propose({forgeProjectId:input.forgeProjectId,specializedProjectId:input.specializedProjectId,scope,instruction:required(input.body.instruction,"instruction"),...(typeof input.body.focusId==="string"&&input.body.focusId.trim()?{focusId:input.body.focusId.trim()}: {})});return ok(201,result);}
  const proposal=input.tail.match(/^tcg\/ai\/proposals\/([^/]+)\/(approve|reject)$/);if(proposal&&input.method==="POST"){const proposalId=decodeURIComponent(proposal[1]);const saved=proposal[2]==="approve"?await tcgAi.approveAndApply({forgeProjectId:input.forgeProjectId,specializedProjectId:input.specializedProjectId,proposalId}):await tcgAi.reject({forgeProjectId:input.forgeProjectId,specializedProjectId:input.specializedProjectId,proposalId});return ok(200,saved,true);}
  if(input.tail==="tcg/art/stage/generate"&&input.method==="POST"){
    const lineId=required(input.body.lineId,"lineId"),stageId=required(input.body.stageId,"stageId"),forgeProject=await requireForgeProject(input.forgeProjectId),continuity=buildTcgCharacterContinuityContext({forgeProject,specializedProject:input.current,lineId,stageId});
    const requestedStyle=typeof input.body.styleDirection==="string"&&input.body.styleDirection.trim()?input.body.styleDirection.trim():"";
    const styleDirection=["CHARACTER CONTINUITY CONSTRAINT",continuity.text,requestedStyle?`AUTHOR ART DIRECTION\n${requestedStyle}`:""].filter(Boolean).join("\n\n");
    const result=await aiAssets.generateTcgStageArtwork({forgeProjectId:input.forgeProjectId,specializedProjectId:input.specializedProjectId,lineId,stageId,styleDirection});return ok(201,{...result,continuity:{characterId:continuity.characterId,hasApprovedVisualReference:Boolean(continuity.approvedReferenceAssetUri)}});
  }
  if(input.tail==="tcg/art/stage/approve"&&input.method==="POST"){
    const lineId=required(input.body.lineId,"lineId"),stageId=required(input.body.stageId,"stageId"),assetId=required(input.body.assetId,"assetId");
    const saved=await aiAssets.approveTcgStageArtwork({forgeProjectId:input.forgeProjectId,specializedProjectId:input.specializedProjectId,lineId,stageId,assetId}),forgeProject=await requireForgeProject(input.forgeProjectId),bridge=bridgeApprovedTcgStageArtwork({forgeProject,specializedProject:saved,lineId,stageId,assetId});
    if(bridge.bridged)await projectStore().save(bridge.project);
    return ok(200,{project:saved,continuity:{bridged:bridge.bridged,illustrationAssetId:bridge.illustrationAssetId,designLockId:bridge.designLockId,reason:bridge.reason}});
  }
  if(input.tail==="tcg/art/map/generate"&&input.method==="POST"){const result=await aiAssets.generateTcgWorldMapArtwork({forgeProjectId:input.forgeProjectId,specializedProjectId:input.specializedProjectId,mapId:required(input.body.mapId,"mapId"),...(typeof input.body.styleDirection==="string"?{styleDirection:input.body.styleDirection}: {})});return ok(201,result);}
  if(input.tail==="tcg/art/map/approve"&&input.method==="POST"){const saved=await aiAssets.approveTcgWorldMapArtwork({forgeProjectId:input.forgeProjectId,specializedProjectId:input.specializedProjectId,mapId:required(input.body.mapId,"mapId"),assetId:required(input.body.assetId,"assetId")});return ok(200,saved);}
  if(input.tail==="tcg/assets/approval"&&input.method==="POST"){const saved=await aiAssets.setAssetApproval({forgeProjectId:input.forgeProjectId,specializedProjectId:input.specializedProjectId,assetId:required(input.body.assetId,"assetId"),approved:input.body.approved===true});return ok(200,saved);}
  return undefined;
}
function projectStore():FileProjectStore{return new FileProjectStore(process.env.FORGE_DATA_DIR?.trim()||join(process.cwd(),".forge-data"));}
async function requireForgeProject(id:string){const project=await projectStore().load(id);if(!project)throw new Error(`Forge project "${id}" not found for TCG character continuity.`);return project;}
function tcgScope(value:unknown):TcgAiProposalScope{if(value==="game-framework"||value==="character-line"||value==="world-map"||value==="balance-review")return value;throw new Error("TCG AI scope must be game-framework, character-line, world-map, or balance-review.");}
function required(value:unknown,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);return value.trim();}
function object(value:unknown,label:string):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(`${label} object is required.`);return value as Record<string,unknown>;}
