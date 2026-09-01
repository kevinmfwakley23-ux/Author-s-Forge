export const TCG_LIFE_STAGES=["birth","child","youth","adult","evolved","final-evolution","custom"] as const;
export type TcgLifeStage=typeof TCG_LIFE_STAGES[number];
export const TCG_POWER_KINDS=["magical","physical","passive","support"] as const;
export type TcgPowerKind=typeof TCG_POWER_KINDS[number];

export interface TcgPowerDefinition { readonly id:string; readonly name:string; readonly kind:TcgPowerKind; readonly description:string; readonly rank:number; readonly energyCost?:number; readonly tags:readonly string[]; }
export interface TcgCharacterEvolutionStage {
  readonly id:string;
  readonly label:string;
  readonly stageIndex:number;
  readonly lifeStage:TcgLifeStage;
  readonly ageLabel?:string;
  readonly description:string;
  readonly appearance:string;
  readonly strengths:readonly string[];
  readonly weaknesses:readonly string[];
  readonly magicalPowers:readonly TcgPowerDefinition[];
  readonly physicalPowers:readonly TcgPowerDefinition[];
  readonly territoryIds:readonly string[];
  readonly evolutionRequirement?:string;
  readonly artworkAssetIds:readonly string[];
  readonly approvedArtworkAssetId?:string;
}
export interface TcgCharacterEvolutionLine {
  readonly id:string;
  readonly name:string;
  readonly characterBibleId?:string;
  readonly speciesOrArchetype?:string;
  readonly biography:string;
  readonly stages:readonly TcgCharacterEvolutionStage[];
}
export interface TcgMapPoint { readonly x:number; readonly y:number; }
export interface TcgTerritory {
  readonly id:string;
  readonly name:string;
  readonly description:string;
  readonly biome:string;
  readonly tags:readonly string[];
  readonly center:TcgMapPoint;
  readonly adjacentTerritoryIds:readonly string[];
  readonly characterStageRefs:readonly {characterLineId:string;stageId:string}[];
  readonly resources:readonly string[];
  readonly hazards:readonly string[];
  readonly artworkAssetId?:string;
}
export interface TcgWorldMap {
  readonly id:string;
  readonly name:string;
  readonly description:string;
  readonly artworkAssetId?:string;
  readonly territories:readonly TcgTerritory[];
}
export interface TcgKeywordDefinition { readonly id:string; readonly name:string; readonly reminderText:string; readonly rulesText:string; }
export interface TcgGameFramework {
  readonly premise:string;
  readonly playerGoal:string;
  readonly victoryConditions:readonly string[];
  readonly turnStructure:readonly string[];
  readonly zones:readonly string[];
  readonly resources:readonly string[];
  readonly cardTypes:readonly string[];
  readonly keywords:readonly TcgKeywordDefinition[];
  readonly factions:readonly {id:string;name:string;description:string}[];
  readonly characterLines:readonly TcgCharacterEvolutionLine[];
  readonly worldMaps:readonly TcgWorldMap[];
  readonly designNotes:readonly string[];
}

export function emptyTcgGameFramework():TcgGameFramework{return Object.freeze({premise:"",playerGoal:"",victoryConditions:Object.freeze([]),turnStructure:Object.freeze([]),zones:Object.freeze([]),resources:Object.freeze([]),cardTypes:Object.freeze([]),keywords:Object.freeze([]),factions:Object.freeze([]),characterLines:Object.freeze([]),worldMaps:Object.freeze([]),designNotes:Object.freeze([])});}

export function validateTcgGameFramework(value:TcgGameFramework,requireResolvedReferences=true):void {
  if(!value||typeof value!=="object")throw new Error("TCG game framework must be an object.");
  textArray(value.victoryConditions,"TCG victory conditions");textArray(value.turnStructure,"TCG turn structure");textArray(value.zones,"TCG zones");textArray(value.resources,"TCG resources");textArray(value.cardTypes,"TCG card types");textArray(value.designNotes,"TCG design notes");
  uniqueObjects(value.keywords,"TCG keyword",item=>item.id,item=>{required(item.name,"TCG keyword name");required(item.reminderText,"TCG keyword reminder text");required(item.rulesText,"TCG keyword rules text");});
  uniqueObjects(value.factions,"TCG faction",item=>item.id,item=>{required(item.name,"TCG faction name");required(item.description,"TCG faction description");});
  uniqueObjects(value.characterLines,"TCG character line",line=>line.id,line=>validateCharacterLine(line));
  uniqueObjects(value.worldMaps,"TCG world map",map=>map.id,map=>validateWorldMap(map,value.characterLines,requireResolvedReferences));
  if(requireResolvedReferences){const territoryIds=new Set(value.worldMaps.flatMap(map=>map.territories.map(t=>t.id)));for(const line of value.characterLines)for(const stage of line.stages)for(const territoryId of stage.territoryIds)if(!territoryIds.has(territoryId))throw new Error(`TCG evolution stage "${stage.id}" references missing territory "${territoryId}".`);}
}

export function withTcgCharacterLine(framework:TcgGameFramework,line:TcgCharacterEvolutionLine):TcgGameFramework {validateCharacterLine(line);const exists=framework.characterLines.some(item=>item.id===line.id);const next={...framework,characterLines:Object.freeze(exists?framework.characterLines.map(item=>item.id===line.id?clone(line):item):[...framework.characterLines,clone(line)])};validateTcgGameFramework(next,false);return Object.freeze(next);}
export function withTcgWorldMap(framework:TcgGameFramework,map:TcgWorldMap):TcgGameFramework {const exists=framework.worldMaps.some(item=>item.id===map.id);const next={...framework,worldMaps:Object.freeze(exists?framework.worldMaps.map(item=>item.id===map.id?clone(map):item):[...framework.worldMaps,clone(map)])};validateTcgGameFramework(next,false);return Object.freeze(next);}

function validateCharacterLine(line:TcgCharacterEvolutionLine):void {required(line.id,"TCG character line id");required(line.name,"TCG character line name");required(line.biography,"TCG character biography");if(!Array.isArray(line.stages)||!line.stages.length)throw new Error(`TCG character line "${line.id}" requires at least one evolution stage.`);const ids=new Set<string>(),indexes=new Set<number>();for(const stage of line.stages){required(stage.id,"TCG evolution stage id");required(stage.label,"TCG evolution stage label");required(stage.description,"TCG evolution stage description");required(stage.appearance,"TCG evolution stage appearance");if(ids.has(stage.id))throw new Error(`Duplicate TCG evolution stage "${stage.id}".`);ids.add(stage.id);if(!Number.isInteger(stage.stageIndex)||stage.stageIndex<0)throw new Error(`TCG evolution stage "${stage.id}" index must be a non-negative integer.`);if(indexes.has(stage.stageIndex))throw new Error(`Duplicate TCG evolution stage index ${stage.stageIndex} in "${line.id}".`);indexes.add(stage.stageIndex);if(!TCG_LIFE_STAGES.includes(stage.lifeStage))throw new Error(`Invalid TCG life stage "${stage.lifeStage}".`);textArray(stage.strengths,"TCG strengths");textArray(stage.weaknesses,"TCG weaknesses");textArray(stage.territoryIds,"TCG territory ids");textArray(stage.artworkAssetIds,"TCG artwork asset ids");powerArray(stage.magicalPowers,"magical");powerArray(stage.physicalPowers,"physical");if(stage.approvedArtworkAssetId&&!stage.artworkAssetIds.includes(stage.approvedArtworkAssetId))throw new Error(`Approved artwork for stage "${stage.id}" must be one of its artwork candidates.`);}const ordered=[...line.stages].sort((a,b)=>a.stageIndex-b.stageIndex);for(let i=1;i<ordered.length;i++)if(ordered[i].stageIndex<=ordered[i-1].stageIndex)throw new Error(`TCG evolution stages for "${line.id}" must have deterministic increasing indexes.`);}
function validateWorldMap(map:TcgWorldMap,lines:readonly TcgCharacterEvolutionLine[],requireResolvedReferences:boolean):void {required(map.id,"TCG world map id");required(map.name,"TCG world map name");required(map.description,"TCG world map description");const lineById=new Map(lines.map(line=>[line.id,line]));const ids=new Set<string>();for(const territory of map.territories){required(territory.id,"TCG territory id");required(territory.name,"TCG territory name");required(territory.description,"TCG territory description");required(territory.biome,"TCG territory biome");if(ids.has(territory.id))throw new Error(`Duplicate TCG territory "${territory.id}".`);ids.add(territory.id);point(territory.center,`TCG territory "${territory.id}" center`);textArray(territory.tags,"TCG territory tags");textArray(territory.resources,"TCG territory resources");textArray(territory.hazards,"TCG territory hazards");if(requireResolvedReferences)for(const ref of territory.characterStageRefs){const line=lineById.get(ref.characterLineId);if(!line)throw new Error(`TCG territory "${territory.id}" references missing character line "${ref.characterLineId}".`);if(!line.stages.some(stage=>stage.id===ref.stageId))throw new Error(`TCG territory "${territory.id}" references missing stage "${ref.stageId}".`);}}for(const territory of map.territories)for(const adjacent of territory.adjacentTerritoryIds)if(!ids.has(adjacent))throw new Error(`TCG territory "${territory.id}" references missing adjacent territory "${adjacent}".`);}
function powerArray(values:readonly TcgPowerDefinition[],expected:TcgPowerKind):void {if(!Array.isArray(values))throw new Error(`TCG ${expected} powers must be an array.`);const ids=new Set<string>();for(const power of values){required(power.id,"TCG power id");required(power.name,"TCG power name");required(power.description,"TCG power description");if(ids.has(power.id))throw new Error(`Duplicate TCG power "${power.id}".`);ids.add(power.id);if(power.kind!==expected)throw new Error(`TCG power "${power.id}" must be ${expected}.`);if(!Number.isFinite(power.rank)||power.rank<0)throw new Error(`TCG power "${power.id}" rank must be non-negative.`);if(power.energyCost!==undefined&&(!Number.isFinite(power.energyCost)||power.energyCost<0))throw new Error(`TCG power "${power.id}" energy cost must be non-negative.`);textArray(power.tags,"TCG power tags");}}
function point(value:TcgMapPoint,label:string):void {if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||value.x<0||value.x>1||value.y<0||value.y>1)throw new Error(`${label} must use normalized coordinates from 0 to 1.`);}
function uniqueObjects<T>(values:readonly T[],label:string,id:(value:T)=>string,validate:(value:T)=>void):void {if(!Array.isArray(values))throw new Error(`${label} collection must be an array.`);const ids=new Set<string>();for(const item of values){const value=id(item);required(value,`${label} id`);if(ids.has(value))throw new Error(`Duplicate ${label} "${value}".`);ids.add(value);validate(item);}}
function textArray(values:readonly string[],label:string):void {if(!Array.isArray(values))throw new Error(`${label} must be an array.`);for(const value of values)required(value,`${label} entry`);}
function required(value:string,label:string):void {if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
