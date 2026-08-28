import { type AiCollaborationMode, type AiCollaborationPolicy } from "../domain/ai-collaboration";
export declare class AiCollaborationService {
    select(mode: AiCollaborationMode): AiCollaborationPolicy;
}
