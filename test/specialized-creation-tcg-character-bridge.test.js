import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../dist/domain/character-bible.js";
import { createProject,withProjectCharacters } from "../dist/domain/project.js";
import { createSpecializedOfficeProject,validateSpecializedOfficeProject } from "../dist/domain/specialized-creation-office.js";
import { createTcgGameStarterData,upsertTcgCharacterEvolutionLine } from "../dist/application/specialized-creation-tcg-design.js";
import { buildTcgCharacterContinuityContext,bridgeApprovedTcgStageArtwork } from "../dist/application/specialized-creation-tcg-character-bridge.js";

const profile={name:"Mara",age:31,birthDate:"1995-04-02",physicalAppearance:"Tall with a narrow scar over the left brow",height:"5'10",build:"Lean",hair:"Black",eyes:"Gray",skin:"Olive",clothing:"Weathered charcoal coat",voice:"Low and clipped",speechPatterns:["short sentences"],personality:"Guarded",values:["truth"],fears:["betrayal"],secrets:["the letter"],goals:["find the truth"],motivations:["protect her brother"],relationships:[{characterId:"brother",relationship:"sibling",status:"strained",notes:"trust is damaged"}],history:"Former detective",knowledge:["the case file"],skills:["investigation"],weaknesses:["isolation"],characterArc:"opens up",importantObjects:["old key"],currentEmotionalState:"controlled",currentLocation:"Ogden",currentInjuries:[]};
const character=createCharacter({id:"mara",projectId:"forge-1",profile,now:"2026-09-01T10:00:00.000Z"});
function forge(){return withProjectCharacters(createProject({id:"forge-1",title:"Forge",now:"2026-09-01T10:00:00.000Z"}),[character],"2026-09-01T10:00:00.000Z");}
function specialized(){
  let data=createTcgGameStarterData({gameTitle:"Heartwood TCG",setId:"hw01",setName:"First Grove"});
  data=upsertTcgCharacterEvolutionLine(data,{id:"mara-line",name:"Mara",characterBibleId:"mara",speciesOrArchetype:"Warden",biography:"A guarded warden learning to trust.",stages:[{id:"adult",label:"Adult Warden",stageIndex:0,lifeStage:"adult",ageLabel:"31",description:"Mara at the start of the campaign.",appearance:"Keep the left-brow scar and gray eyes; armor grows from the charcoal-coat silhouette.",strengths:["observation"],weaknesses:["isolation"],magicalPowers:[],physicalPowers:[],territoryIds:[],artworkAssetIds:["asset-1"],approvedArtworkAssetId:"asset-1"}]});
  const base=createSpecializedOfficeProject({id:"tcg-1",forgeProjectId:"forge-1",mode:"trading-card-game",title:"Heartwood TCG",brief:"Build an original card game",now:"2026-09-01T10:00:00.000Z"});
  const project={...base,modeData:data,assets:[{id:"asset-1",projectId:"tcg-1",kind:"artwork",name:"Mara adult approved",uri:"data:image/png;base64,QUJDRA==",mimeType:"image/png",pixelWidth:1024,pixelHeight:1536,source:"generated",sourceReference:"Original Mara adult-stage prompt",provider:"openai",model:"gpt-image-2",requestId:"req-1",approved:true,createdAt:"2026-09-01T10:01:00.000Z"}],updatedAt:"2026-09-01T10:01:00.000Z"};
  validateSpecializedOfficeProject(project);return project;
}

test("TCG generation continuity includes real Character Bible traits",()=>{
  const context=buildTcgCharacterContinuityContext({forgeProject:forge(),specializedProject:specialized(),lineId:"mara-line",stageId:"adult"});
  assert.equal(context.characterId,"mara");assert.match(context.text,/narrow scar over the left brow/);assert.match(context.text,/Gray/);assert.match(context.text,/old key/);assert.equal(context.approvedReferenceAssetUri,undefined);
});

test("approved TCG stage art is promoted into the shared illustration library and design locks",()=>{
  const first=bridgeApprovedTcgStageArtwork({forgeProject:forge(),specializedProject:specialized(),lineId:"mara-line",stageId:"adult",assetId:"asset-1",now:"2026-09-01T10:02:00.000Z"});
  assert.equal(first.bridged,true);assert.equal(first.project.illustrationAssetLibrary.assets.length,1);assert.equal(first.project.illustrationAssetLibrary.characterDesignLocks.length,1);assert.equal(first.project.illustrationAssetLibrary.assets[0].characterId,"mara");assert.equal(first.project.illustrationAssetLibrary.assets[0].approvalStatus,"approved");
  const continuity=buildTcgCharacterContinuityContext({forgeProject:first.project,specializedProject:specialized(),lineId:"mara-line",stageId:"adult"});assert.equal(continuity.approvedReferenceAssetUri,"data:image/png;base64,QUJDRA==");
  const second=bridgeApprovedTcgStageArtwork({forgeProject:first.project,specializedProject:specialized(),lineId:"mara-line",stageId:"adult",assetId:"asset-1",now:"2026-09-01T10:03:00.000Z"});assert.equal(second.project.illustrationAssetLibrary.assets.length,1);assert.equal(second.project.illustrationAssetLibrary.characterDesignLocks.length,1);
});

test("TCG continuity bridge rejects broken Character Bible and project scope links",()=>{
  assert.throws(()=>buildTcgCharacterContinuityContext({forgeProject:createProject({id:"forge-1",title:"Forge"}),specializedProject:specialized(),lineId:"mara-line",stageId:"adult"}),/missing Character Bible entry/);
  assert.throws(()=>bridgeApprovedTcgStageArtwork({forgeProject:forge(),specializedProject:{...specialized(),forgeProjectId:"another-project"},lineId:"mara-line",stageId:"adult",assetId:"asset-1"}),/cannot cross Forge project boundaries/);
});
