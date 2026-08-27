import {createAiCollaborationPolicy,type AiCollaborationMode,type AiCollaborationPolicy} from "../domain/ai-collaboration";
export class AiCollaborationService { select(mode:AiCollaborationMode):AiCollaborationPolicy{return createAiCollaborationPolicy(mode);} }
