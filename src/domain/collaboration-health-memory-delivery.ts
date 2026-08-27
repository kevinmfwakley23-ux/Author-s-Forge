export const AI_COLLABORATION_FORMAT_VERSION = 1 as const;
export const AI_COLLABORATION_MODES = ["co-pilot","partner","director","autonomous","editor"] as const;
export type AiCollaborationMode = typeof AI_COLLABORATION_MODES[number];
export type CollaborationPolicy = Readonly<{ mode: AiCollaborationMode; authorApprovalRequired: boolean; aiWorkShare: "low"|"balanced"|"high"; editingFocus: boolean }>;
export const collaborationPolicy = (mode: AiCollaborationMode): CollaborationPolicy => {
  switch(mode){
    case "co-pilot": return {mode,authorApprovalRequired:true,aiWorkShare:"low",editingFocus:false};
    case "partner": return {mode,authorApprovalRequired:true,aiWorkShare:"balanced",editingFocus:false};
    case "director": return {mode,authorApprovalRequired:true,aiWorkShare:"high",editingFocus:false};
    case "autonomous": return {mode,authorApprovalRequired:true,aiWorkShare:"high",editingFocus:false};
    case "editor": return {mode,authorApprovalRequired:true,aiWorkShare:"balanced",editingFocus:true};
  }
};

export const PROJECT_HEALTH_FORMAT_VERSION = 1 as const;
export type ProjectHealth = Readonly<{ projectId:string; bookCompletionPercent:number; chaptersComplete:number; chaptersTotal:number; wordCount:number; wordTarget:number; canonConflicts:{critical:number;minor:number}; unresolvedPlotThreads:number; characters:number; locations:number; researchSources:number; illustrations:number; coverStatus:string; marketingCompletionPercent:number; publishingReadinessPercent:number; generatedAt:string }>;
const pct=(n:number)=>Math.max(0,Math.min(100,n));
export function createProjectHealth(input:Omit<ProjectHealth,"generatedAt">&{generatedAt?:string}):ProjectHealth{
 if(!input.projectId) throw new Error("Project health requires a project id.");
 for(const n of [input.bookCompletionPercent,input.chaptersComplete,input.chaptersTotal,input.wordCount,input.wordTarget,input.canonConflicts.critical,input.canonConflicts.minor,input.unresolvedPlotThreads,input.characters,input.locations,input.researchSources,input.illustrations]) if(!Number.isInteger(n)||n<0) throw new Error("Project health counts must be non-negative integers.");
 if(input.chaptersComplete>input.chaptersTotal||input.wordCount>input.wordTarget) throw new Error("Project health completion cannot exceed its target.");
 return Object.freeze({...input,bookCompletionPercent:pct(input.bookCompletionPercent),marketingCompletionPercent:pct(input.marketingCompletionPercent),publishingReadinessPercent:pct(input.publishingReadinessPercent),generatedAt:input.generatedAt??new Date().toISOString()});
}

export const RELATIONSHIP_MEMORY_FORMAT_VERSION = 1 as const;
export type MemoryRelationship = Readonly<{ id:string; projectId:string; subject:string; predicate:string; object:string; context:string; sourceId:string; sourceLocation:string; relevance:string; createdAt:string }>;
export function createMemoryRelationship(input:Omit<MemoryRelationship,"createdAt">&{createdAt?:string}):MemoryRelationship{
 for(const k of ["id","projectId","subject","predicate","object","context","sourceId","sourceLocation","relevance"] as const) if(!input[k].trim()) throw new Error(`Relationship memory ${k} is required.`);
 return Object.freeze({...input,createdAt:input.createdAt??new Date().toISOString()});
}

export const DELIVERY_AUDIT_FORMAT_VERSION = 1 as const;
export const DELIVERY_AUDIT_KINDS = ["canon","continuity","timeline","character","pov","style","grammar","formatting","research","artwork","cover","metadata","publishing"] as const;
export type DeliveryAuditKind=typeof DELIVERY_AUDIT_KINDS[number];
export type DeliveryAuditResult=Readonly<{kind:DeliveryAuditKind;passed:boolean;critical:boolean;message:string}>;
export type DeliveryAuditReport=Readonly<{projectId:string;results:readonly DeliveryAuditResult[];readyForAuthorApproval:boolean;generatedAt:string}>;
export function createDeliveryAuditReport(projectId:string,results:readonly DeliveryAuditResult[],generatedAt=new Date().toISOString()):DeliveryAuditReport{
 if(!projectId.trim()) throw new Error("Delivery audit requires a project id.");
 const seen=new Set<DeliveryAuditKind>(); for(const r of results){if(seen.has(r.kind))throw new Error(`Duplicate delivery audit kind: ${r.kind}.`);seen.add(r.kind);}
 const complete=DELIVERY_AUDIT_KINDS.every(k=>seen.has(k));
 const ready=complete&&results.every(r=>r.passed&&!r.critical);
 return Object.freeze({projectId,results:[...results],readyForAuthorApproval:ready,generatedAt});
}
