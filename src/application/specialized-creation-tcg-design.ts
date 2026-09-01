import type { TcgCardRecord,TcgData,TcgFieldDefinition } from "../domain/specialized-creation-office";
import { emptyTcgGameFramework,validateTcgGameFramework,withTcgCharacterLine,withTcgWorldMap,type TcgCharacterEvolutionLine,type TcgGameFramework,type TcgWorldMap } from "../domain/specialized-creation-tcg-world";

export type TcgDataWithFramework=TcgData;

export function tcgGameFramework(data:TcgData):TcgGameFramework {const framework=data.gameFramework??emptyTcgGameFramework();validateTcgGameFramework(framework,false);return clone(framework);}
export function setTcgGameFramework(data:TcgData,framework:TcgGameFramework):TcgDataWithFramework {validateTcgGameFramework(framework,false);return Object.freeze({...clone(data),gameFramework:clone(framework)});}
export function upsertTcgCharacterEvolutionLine(data:TcgData,line:TcgCharacterEvolutionLine):TcgDataWithFramework {return setTcgGameFramework(data,withTcgCharacterLine(tcgGameFramework(data),line));}
export function upsertTcgWorldMap(data:TcgData,map:TcgWorldMap):TcgDataWithFramework {return setTcgGameFramework(data,withTcgWorldMap(tcgGameFramework(data),map));}

export function addTcgEvolutionArtworkCandidate(data:TcgData,input:{lineId:string;stageId:string;assetId:string}):TcgDataWithFramework {
  const framework=tcgGameFramework(data),line=framework.characterLines.find(item=>item.id===input.lineId);if(!line)throw new Error(`TCG character line "${input.lineId}" not found.`);const stage=line.stages.find(item=>item.id===input.stageId);if(!stage)throw new Error(`TCG evolution stage "${input.stageId}" not found.`);const assetId=required(input.assetId,"TCG artwork asset id");const nextStage={...stage,artworkAssetIds:Object.freeze(stage.artworkAssetIds.includes(assetId)?[...stage.artworkAssetIds]:[...stage.artworkAssetIds,assetId])};const nextLine={...line,stages:Object.freeze(line.stages.map(item=>item.id===stage.id?nextStage:item))};return upsertTcgCharacterEvolutionLine(data,nextLine);
}
export function lockTcgEvolutionArtwork(data:TcgData,input:{lineId:string;stageId:string;assetId:string}):TcgDataWithFramework {
  let next=addTcgEvolutionArtworkCandidate(data,input);const framework=tcgGameFramework(next),line=framework.characterLines.find(item=>item.id===input.lineId)!,stage=line.stages.find(item=>item.id===input.stageId)!;const locked={...stage,approvedArtworkAssetId:input.assetId};const nextLine={...line,stages:Object.freeze(line.stages.map(item=>item.id===stage.id?locked:item))};next=upsertTcgCharacterEvolutionLine(next,nextLine);return next;
}
export function setTcgWorldMapArtwork(data:TcgData,input:{mapId:string;assetId:string}):TcgDataWithFramework {const framework=tcgGameFramework(data),map=framework.worldMaps.find(item=>item.id===input.mapId);if(!map)throw new Error(`TCG world map "${input.mapId}" not found.`);return upsertTcgWorldMap(data,{...map,artworkAssetId:required(input.assetId,"TCG map artwork asset id")});}

export function createTcgGameStarterData(input:{gameTitle:string;setId:string;setName:string}):TcgDataWithFramework {
  const fields:readonly TcgFieldDefinition[]=Object.freeze([
    {key:"name",label:"Name",type:"text",required:true},
    {key:"type",label:"Type",type:"text",required:true},
    {key:"evolutionStage",label:"Evolution stage",type:"text",required:false},
    {key:"rules",label:"Rules / abilities",type:"text",required:true},
    {key:"strengths",label:"Strengths",type:"text",required:false},
    {key:"weaknesses",label:"Weaknesses",type:"text",required:false},
    {key:"territory",label:"Territory",type:"text",required:false},
  ]);
  return Object.freeze({gameTitle:required(input.gameTitle,"TCG game title"),setId:required(input.setId,"TCG set id"),setName:required(input.setName,"TCG set name"),fields,cards:Object.freeze([]),templates:Object.freeze([{id:"character-base",name:"Character Base",tokens:Object.freeze({frame:"character",accent:"#333333"})},{id:"territory-base",name:"Territory Base",tokens:Object.freeze({frame:"territory",accent:"#555555"})}]),playtestSnapshots:Object.freeze([]),gameFramework:emptyTcgGameFramework()});
}

export function createCharacterEvolutionCards(data:TcgData,input:{lineId:string;templateId:string;collectorPrefix?:string}):TcgDataWithFramework {
  const framework=tcgGameFramework(data),line=framework.characterLines.find(item=>item.id===input.lineId);if(!line)throw new Error(`TCG character line "${input.lineId}" not found.`);if(!data.templates.some(template=>template.id===input.templateId))throw new Error(`TCG template "${input.templateId}" not found.`);
  const existingIds=new Set(data.cards.map(card=>card.id)),existingNumbers=new Set(data.cards.map(card=>card.collectorNumber)),prefix=(input.collectorPrefix?.trim()||line.id.replace(/[^A-Za-z0-9]/g,"").slice(0,4).toUpperCase()||"EV");
  const created:TcgCardRecord[]=[];for(const stage of [...line.stages].sort((a,b)=>a.stageIndex-b.stageIndex)){
    const id=`evolution-${line.id}-${stage.id}`;if(existingIds.has(id))throw new Error(`Evolution card "${id}" already exists.`);const collectorNumber=`${prefix}-${String(stage.stageIndex+1).padStart(2,"0")}`;if(existingNumbers.has(collectorNumber))throw new Error(`Collector number "${collectorNumber}" already exists.`);
    const fields:Record<string,string|number|boolean>={};for(const field of data.fields){const value=fieldValue(field.key,line,stage);if(value!==undefined)fields[field.key]=coerceForField(field,value);else if(field.required)throw new Error(`Cannot derive required TCG field "${field.key}" for evolution card ${stage.label}. Add a supported field or provide the card manually.`);}
    created.push(Object.freeze({id,collectorNumber,fields:Object.freeze(fields),...(stage.approvedArtworkAssetId?{artworkAssetId:stage.approvedArtworkAssetId}:{}),templateId:input.templateId,characterLineId:line.id,evolutionStageId:stage.id}));existingIds.add(id);existingNumbers.add(collectorNumber);
  }
  return Object.freeze({...clone(data),cards:Object.freeze([...data.cards,...created]),gameFramework:framework});
}

export function createTerritoryCards(data:TcgData,input:{mapId:string;templateId:string;collectorPrefix?:string}):TcgDataWithFramework {
  const framework=tcgGameFramework(data),map=framework.worldMaps.find(item=>item.id===input.mapId);if(!map)throw new Error(`TCG world map "${input.mapId}" not found.`);if(!data.templates.some(template=>template.id===input.templateId))throw new Error(`TCG template "${input.templateId}" not found.`);const prefix=input.collectorPrefix?.trim()||"MAP",created:TcgCardRecord[]=[],existingIds=new Set(data.cards.map(card=>card.id)),existingNumbers=new Set(data.cards.map(card=>card.collectorNumber));
  for(const [index,territory] of map.territories.entries()){const id=`territory-${map.id}-${territory.id}`,collectorNumber=`${prefix}-${String(index+1).padStart(2,"0")}`;if(existingIds.has(id))throw new Error(`Territory card "${id}" already exists.`);if(existingNumbers.has(collectorNumber))throw new Error(`Collector number "${collectorNumber}" already exists.`);const fields:Record<string,string|number|boolean>={};for(const field of data.fields){const key=field.key.toLowerCase();let value:string|undefined;if(key==="name"||key==="title")value=territory.name;else if(key==="type"||key==="subtype")value="Territory";else if(key==="rules"||key==="rulestext")value=[territory.description,territory.resources.length?`Resources: ${territory.resources.join(", ")}`:"",territory.hazards.length?`Hazards: ${territory.hazards.join(", ")}`:""].filter(Boolean).join(" ");else if(key==="territory"||key==="location")value=territory.name;else if(key==="strengths")value=territory.resources.join(", ");else if(key==="weaknesses")value=territory.hazards.join(", ");if(value!==undefined)fields[field.key]=coerceForField(field,value);else if(field.required)throw new Error(`Cannot derive required TCG field "${field.key}" for territory card ${territory.name}.`);}
    created.push(Object.freeze({id,collectorNumber,fields:Object.freeze(fields),...(territory.artworkAssetId?{artworkAssetId:territory.artworkAssetId}:map.artworkAssetId?{artworkAssetId:map.artworkAssetId}:{}),templateId:input.templateId,territoryId:territory.id}));existingIds.add(id);existingNumbers.add(collectorNumber);
  }
  return Object.freeze({...clone(data),cards:Object.freeze([...data.cards,...created]),gameFramework:framework});
}

function fieldValue(key:string,line:TcgCharacterEvolutionLine,stage:TcgCharacterEvolutionLine["stages"][number]):string|number|boolean|undefined {switch(key.toLowerCase()){case"name":case"title":return `${line.name} — ${stage.label}`;case"type":case"subtype":return line.speciesOrArchetype?`${line.speciesOrArchetype} · ${stage.lifeStage}`:stage.lifeStage;case"evolutionstage":case"stage":return stage.label;case"age":return stage.ageLabel;case"description":case"flavor":case"flavortext":return stage.description;case"strengths":return stage.strengths.join(", ");case"weaknesses":return stage.weaknesses.join(", ");case"magicalpowers":return stage.magicalPowers.map(power=>power.name).join(", ");case"physicalpowers":return stage.physicalPowers.map(power=>power.name).join(", ");case"territory":case"location":return stage.territoryIds.join(", ");case"rules":case"rulestext":return [...stage.magicalPowers,...stage.physicalPowers].map(power=>`${power.name}: ${power.description}`).concat(stage.evolutionRequirement?[`Evolves when: ${stage.evolutionRequirement}`]:[]).join(" ");default:return undefined;}}
function coerceForField(field:TcgFieldDefinition,value:string|number|boolean):string|number|boolean {if(field.type==="text")return String(value);if(field.type==="number"){const number=typeof value==="number"?value:Number(value);if(!Number.isFinite(number))throw new Error(`Derived value for "${field.key}" is not numeric.`);return number;}if(field.type==="boolean")return typeof value==="boolean"?value:String(value).toLowerCase()==="true";if(field.type==="enum"){const text=String(value);if(!field.values?.includes(text))throw new Error(`Derived value "${text}" is not allowed for enum field "${field.key}".`);return text;}return value;}
function required(value:string,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);return value.trim();}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
