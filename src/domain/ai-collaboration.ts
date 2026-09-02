export const AI_COLLABORATION_FORMAT_VERSION = 1 as const;
export const AI_COLLABORATION_MODES = ["co-pilot","partner","director","autonomous","editor"] as const;
export type AiCollaborationMode = typeof AI_COLLABORATION_MODES[number];
export type AiCollaborationCapability = "draft" | "revise" | "bulk-work";
export type AiCollaborationAuthority = "author-requested" | "autonomous";
export interface AiCollaborationPolicy { readonly mode: AiCollaborationMode; readonly authorApprovalRequiredForMajorDecisions: boolean; readonly aiMayDraft: boolean; readonly aiMayRevise: boolean; readonly aiMayExecuteBulkWork: boolean; readonly description: string; }
const policies: Record<AiCollaborationMode,Omit<AiCollaborationPolicy,"mode">>={
 "co-pilot":{authorApprovalRequiredForMajorDecisions:true,aiMayDraft:true,aiMayRevise:true,aiMayExecuteBulkWork:false,description:"Author does most of the writing; Forge assists."},
 partner:{authorApprovalRequiredForMajorDecisions:true,aiMayDraft:true,aiMayRevise:true,aiMayExecuteBulkWork:true,description:"Author and Forge alternate work."},
 director:{authorApprovalRequiredForMajorDecisions:true,aiMayDraft:true,aiMayRevise:true,aiMayExecuteBulkWork:true,description:"Author directs at a high level; Forge performs most work."},
 autonomous:{authorApprovalRequiredForMajorDecisions:true,aiMayDraft:true,aiMayRevise:true,aiMayExecuteBulkWork:true,description:"Author approves major decisions; Forge performs bulk project work."},
 editor:{authorApprovalRequiredForMajorDecisions:true,aiMayDraft:false,aiMayRevise:true,aiMayExecuteBulkWork:false,description:"Forge primarily analyzes and improves existing work."}
};
export function createAiCollaborationPolicy(mode:AiCollaborationMode):AiCollaborationPolicy { if(!AI_COLLABORATION_MODES.includes(mode)) throw new Error(`Unsupported AI collaboration mode "${mode}".`); return Object.freeze({mode,...policies[mode]}); }
export function validateAiCollaborationPolicy(p:AiCollaborationPolicy):AiCollaborationPolicy { return createAiCollaborationPolicy(p.mode); }
export function resolveAiCollaborationPolicy(policy:AiCollaborationPolicy|undefined):AiCollaborationPolicy{return policy===undefined?createAiCollaborationPolicy("co-pilot"):validateAiCollaborationPolicy(policy);}
export function collaborationCapabilityAllowed(policy:AiCollaborationPolicy|undefined,capability:AiCollaborationCapability,authority:AiCollaborationAuthority="autonomous"):boolean{if(authority==="author-requested")return true;const resolved=resolveAiCollaborationPolicy(policy);if(capability==="draft")return resolved.aiMayDraft;if(capability==="revise")return resolved.aiMayRevise;return resolved.aiMayExecuteBulkWork;}
export function assertAiCollaborationCapability(policy:AiCollaborationPolicy|undefined,capability:AiCollaborationCapability,operation:string,authority:AiCollaborationAuthority="autonomous"):AiCollaborationPolicy{const resolved=resolveAiCollaborationPolicy(policy);if(collaborationCapabilityAllowed(resolved,capability,authority))return resolved;const label=typeof operation==="string"&&operation.trim()?operation.trim():"this AI operation";throw new Error(`Collaboration mode "${resolved.mode}" does not allow autonomous ${label}. The author can still request that work explicitly.`);}
