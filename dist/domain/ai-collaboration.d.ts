export declare const AI_COLLABORATION_FORMAT_VERSION: 1;
export declare const AI_COLLABORATION_MODES: readonly ["co-pilot", "partner", "director", "autonomous", "editor"];
export type AiCollaborationMode = typeof AI_COLLABORATION_MODES[number];
export interface AiCollaborationPolicy {
    readonly mode: AiCollaborationMode;
    readonly authorApprovalRequiredForMajorDecisions: boolean;
    readonly aiMayDraft: boolean;
    readonly aiMayRevise: boolean;
    readonly aiMayExecuteBulkWork: boolean;
    readonly description: string;
}
export declare function createAiCollaborationPolicy(mode: AiCollaborationMode): AiCollaborationPolicy;
export declare function validateAiCollaborationPolicy(p: AiCollaborationPolicy): AiCollaborationPolicy;
