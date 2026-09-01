import { IllustrationAssetLibraryService } from "./illustration-asset-library";
import { withProjectIllustrationAssetLibrary,type ProjectState } from "../domain/project";
import type { SpecializedOfficeProject,TcgData } from "../domain/specialized-creation-office";
import { tcgGameFramework } from "./specialized-creation-tcg-design";

export interface TcgCharacterContinuityContext {
  readonly characterId?:string;
  readonly text:string;
  readonly approvedReferenceAssetUri?:string;
}
export interface TcgCharacterBridgeResult {
  readonly project:ProjectState;
  readonly bridged:boolean;
  readonly illustrationAssetId?:string;
  readonly designLockId?:string;
  readonly reason?:"character-line-not-linked";
}

/**
 * Resolve the real Character Bible state that should constrain generation for a
 * TCG evolution stage. A design-lock URI is exposed separately so an image
 * provider can use the approved image as an actual visual reference rather than
 * pretending that an opaque asset id supplies visual memory.
 */
export function buildTcgCharacterContinuityContext(input:{forgeProject:ProjectState;specializedProject:SpecializedOfficeProject;lineId:string;stageId:string}):TcgCharacterContinuityContext {
  assertScope(input.forgeProject,input.specializedProject);
  const {line,stage}=requireStage(input.specializedProject,input.lineId,input.stageId);
  if(!line.characterBibleId)return Object.freeze({text:"No shared Character Bible identity is linked to this TCG character line. Preserve only the evolution-stage canon supplied by the TCG project."});
  const character=input.forgeProject.characters?.find(item=>item.id===line.characterBibleId);
  if(!character)throw new Error(`TCG character line "${line.id}" references missing Character Bible entry "${line.characterBibleId}".`);
  const profile=character.profile;
  const parts=[
    `SHARED CHARACTER BIBLE — ${profile.name} (${character.id})`,
    `Canonical physical appearance: ${profile.physicalAppearance}`,
    `Height/build: ${profile.height}; ${profile.build}`,
    `Hair/eyes/skin: ${profile.hair}; ${profile.eyes}; ${profile.skin}`,
    `Canonical clothing language: ${profile.clothing}`,
    `Important identity objects: ${profile.importantObjects.join(", ")||"none specified"}`,
    `Character arc: ${profile.characterArc}`,
    `Current canonical location: ${profile.currentLocation}`,
    `TCG stage being illustrated: ${stage.label} (${stage.lifeStage}). Stage-specific age, body development, clothing, powers, injuries, or other explicit evolution changes may differ from the base profile. Preserve stable identity markers unless the stage canon explicitly changes them.`,
  ];
  let approvedReferenceAssetUri:string|undefined;
  if(input.forgeProject.illustrationAssetLibrary){
    const library=new IllustrationAssetLibraryService();library.restore(input.forgeProject.illustrationAssetLibrary);
    const locked=library.resolveCharacterDesign(input.forgeProject.metadata.id,character.id);
    if(locked?.approvalStatus==="approved")approvedReferenceAssetUri=locked.assetUri;
  }
  return Object.freeze({characterId:character.id,text:parts.join("\n"),...(approvedReferenceAssetUri?{approvedReferenceAssetUri}: {})});
}

/** Register an author-approved TCG stage image in the shared illustration library. */
export function bridgeApprovedTcgStageArtwork(input:{forgeProject:ProjectState;specializedProject:SpecializedOfficeProject;lineId:string;stageId:string;assetId:string;now?:string}):TcgCharacterBridgeResult {
  assertScope(input.forgeProject,input.specializedProject);
  const {line,stage}=requireStage(input.specializedProject,input.lineId,input.stageId);
  if(!line.characterBibleId)return Object.freeze({project:input.forgeProject,bridged:false,reason:"character-line-not-linked"});
  const character=input.forgeProject.characters?.find(item=>item.id===line.characterBibleId);
  if(!character)throw new Error(`TCG character line "${line.id}" references missing Character Bible entry "${line.characterBibleId}".`);
  const asset=input.specializedProject.assets.find(item=>item.id===input.assetId);
  if(!asset)throw new Error(`Specialized asset "${input.assetId}" not found.`);
  if(!asset.approved)throw new Error("Only author-approved TCG artwork can enter the shared Illustration Asset Library.");
  if(stage.approvedArtworkAssetId!==asset.id)throw new Error(`TCG stage "${stage.id}" does not lock specialized asset "${asset.id}" as its approved artwork.`);
  const library=new IllustrationAssetLibraryService();
  if(input.forgeProject.illustrationAssetLibrary)library.restore(input.forgeProject.illustrationAssetLibrary);
  const illustrationAssetId=`tcg-${input.specializedProject.id}-${asset.id}`;
  if(!library.get(illustrationAssetId))library.create({
    id:illustrationAssetId,projectId:input.forgeProject.metadata.id,bookId:input.specializedProject.id,chapterId:line.id,sceneId:stage.id,
    characterId:character.id,locationId:stage.territoryIds[0]??"tcg-unassigned",prompt:asset.sourceReference,
    references:[{id:`source-${asset.id}`,uri:`specialized://${input.specializedProject.id}/assets/${asset.id}`,label:`TCG approved ${stage.label} source`,kind:"source",notes:"Author-approved Specialized Creation artwork promoted into the shared illustration library."}],
    style:"TCG character evolution design",generationSettings:Object.freeze({provider:asset.provider??asset.source,model:asset.model??"unknown",requestId:asset.requestId??"unknown",specializedAssetId:asset.id,evolutionStageId:stage.id}),
    approvalStatus:"approved",assetUri:asset.uri,date:asset.createdAt,now:input.now??new Date().toISOString(),
  });
  const designLockId=`tcg-lock-${input.specializedProject.id}-${line.id}-${stage.id}-${asset.id}`;
  if(!library.listCharacterDesignLocks(input.forgeProject.metadata.id).some(lock=>lock.id===designLockId))library.lockCharacterDesign({id:designLockId,projectId:input.forgeProject.metadata.id,seriesId:input.specializedProject.id,characterId:character.id,assetId:illustrationAssetId,effectiveAt:input.now??new Date().toISOString(),reason:`Author approved ${line.name} — ${stage.label} as the current TCG character design reference.`});
  const project=withProjectIllustrationAssetLibrary(input.forgeProject,library.toPortableState(input.forgeProject.metadata.id),input.now??new Date().toISOString());
  return Object.freeze({project,bridged:true,illustrationAssetId,designLockId});
}

function requireStage(project:SpecializedOfficeProject,lineId:string,stageId:string){
  if(project.mode!=="trading-card-game")throw new Error("TCG character continuity requires trading-card-game mode.");
  const framework=tcgGameFramework(project.modeData as TcgData),line=framework.characterLines.find(item=>item.id===lineId);if(!line)throw new Error(`TCG character line "${lineId}" not found.`);
  const stage=line.stages.find(item=>item.id===stageId);if(!stage)throw new Error(`TCG evolution stage "${stageId}" not found.`);return{line,stage};
}
function assertScope(forgeProject:ProjectState,specializedProject:SpecializedOfficeProject):void {if(specializedProject.forgeProjectId!==forgeProject.metadata.id)throw new Error("TCG continuity bridge cannot cross Forge project boundaries.");}
