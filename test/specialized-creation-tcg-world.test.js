const test=require('node:test');
const assert=require('node:assert/strict');
const {emptyTcgGameFramework,validateTcgGameFramework,withTcgCharacterLine,withTcgWorldMap}=require('../dist/domain/specialized-creation-tcg-world.js');
const {createTcgGameStarterData,upsertTcgCharacterEvolutionLine,upsertTcgWorldMap,createCharacterEvolutionCards,tcgGameFramework}=require('../dist/application/specialized-creation-tcg-design.js');

const line={
  id:'ember-line',name:'Ember',characterBibleId:'character-ember',speciesOrArchetype:'Fire guardian',biography:'A guardian whose power matures with responsibility.',
  stages:[
    {id:'ember-birth',label:'Sparkborn',stageIndex:0,lifeStage:'birth',ageLabel:'newborn',description:'A tiny ember spirit.',appearance:'Small glowing fox-like spirit.',strengths:['agility'],weaknesses:['water'],magicalPowers:[{id:'warmth',name:'Warmth',kind:'magical',description:'Creates a protective warmth.',rank:1,tags:['fire']}],physicalPowers:[{id:'dash',name:'Dash',kind:'physical',description:'A quick evasive movement.',rank:1,tags:['speed']}],territoryIds:['cinder-nest'],evolutionRequirement:'Protect an ally.',artworkAssetIds:['asset-birth'],approvedArtworkAssetId:'asset-birth'},
    {id:'ember-youth',label:'Flareling',stageIndex:1,lifeStage:'youth',ageLabel:'young',description:'Learns to shape flame.',appearance:'Lean flame-tailed guardian.',strengths:['speed','focus'],weaknesses:['ice'],magicalPowers:[{id:'flare',name:'Flare',kind:'magical',description:'Projects a focused flame.',rank:2,tags:['fire']}],physicalPowers:[{id:'pounce',name:'Pounce',kind:'physical',description:'Leaps across obstacles.',rank:2,tags:['mobility']}],territoryIds:['ember-field'],evolutionRequirement:'Master Flare.',artworkAssetIds:['asset-youth'],approvedArtworkAssetId:'asset-youth'},
    {id:'ember-final',label:'Solar Guardian',stageIndex:2,lifeStage:'final-evolution',ageLabel:'mature',description:'The completed guardian form.',appearance:'Armored radiant guardian with a solar mane.',strengths:['leadership','fire mastery'],weaknesses:['void magic'],magicalPowers:[{id:'solar-crown',name:'Solar Crown',kind:'magical',description:'Creates a radiant defensive field.',rank:5,tags:['fire','defense']}],physicalPowers:[{id:'guardian-strike',name:'Guardian Strike',kind:'physical',description:'A powerful close-range strike.',rank:4,tags:['combat']}],territoryIds:['sun-citadel'],artworkAssetIds:['asset-final'],approvedArtworkAssetId:'asset-final'},
  ]
};
const map={id:'forge-world',name:'Forge World',description:'Three connected territories.',territories:[
  {id:'cinder-nest',name:'Cinder Nest',description:'Birthplace of ember spirits.',biome:'volcanic nursery',tags:['fire'],center:{x:.15,y:.75},adjacentTerritoryIds:['ember-field'],characterStageRefs:[{characterLineId:'ember-line',stageId:'ember-birth'}],resources:['ember crystal'],hazards:['ash storm']},
  {id:'ember-field',name:'Ember Field',description:'Training plains.',biome:'heated grassland',tags:['training'],center:{x:.48,y:.5},adjacentTerritoryIds:['cinder-nest','sun-citadel'],characterStageRefs:[{characterLineId:'ember-line',stageId:'ember-youth'}],resources:['flare grass'],hazards:['fire gusts']},
  {id:'sun-citadel',name:'Sun Citadel',description:'Seat of mature guardians.',biome:'mountain fortress',tags:['capital'],center:{x:.82,y:.18},adjacentTerritoryIds:['ember-field'],characterStageRefs:[{characterLineId:'ember-line',stageId:'ember-final'}],resources:['solar ore'],hazards:['high winds']},
]};

test('TCG framework preserves character progression and canonical map locations',()=>{
  let framework=emptyTcgGameFramework();framework=withTcgCharacterLine(framework,line);framework=withTcgWorldMap(framework,map);validateTcgGameFramework(framework,true);
  assert.deepEqual(framework.characterLines[0].stages.map(stage=>stage.lifeStage),['birth','youth','final-evolution']);
  assert.equal(framework.worldMaps[0].territories.find(t=>t.id==='sun-citadel').characterStageRefs[0].stageId,'ember-final');
});

test('draft TCG framework permits unresolved world links while production validation rejects them',()=>{
  const bad={...line,stages:line.stages.map((stage,index)=>index?stage:{...stage,territoryIds:['missing-place']})};
  const draft=withTcgCharacterLine(emptyTcgGameFramework(),bad);
  assert.doesNotThrow(()=>validateTcgGameFramework(draft));
  const framework={...draft,worldMaps:[map]};
  assert.throws(()=>validateTcgGameFramework(framework,true),/missing territory/);
});

test('character evolution line deterministically becomes one card per life stage with locked approved art',()=>{
  let data=createTcgGameStarterData({gameTitle:'Forge Realms',setId:'FR1',setName:'First Spark'});data=upsertTcgCharacterEvolutionLine(data,line);data=upsertTcgWorldMap(data,map);data=createCharacterEvolutionCards(data,{lineId:'ember-line',templateId:'character-base',collectorPrefix:'EMB'});
  assert.equal(data.cards.length,3);assert.deepEqual(data.cards.map(card=>card.collectorNumber),['EMB-01','EMB-02','EMB-03']);assert.equal(data.cards[2].artworkAssetId,'asset-final');assert.match(String(data.cards[2].fields.rules),/Solar Crown/);assert.match(String(data.cards[0].fields.territory),/cinder-nest/);assert.equal(tcgGameFramework(data).characterLines[0].characterBibleId,'character-ember');
});
