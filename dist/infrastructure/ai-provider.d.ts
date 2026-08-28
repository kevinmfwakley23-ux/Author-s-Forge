export interface AiGenerationRequest {
    readonly system: string;
    readonly user: string;
    readonly temperature?: number;
    readonly maxOutputTokens?: number;
}
export interface AiGenerationResult {
    readonly provider: "openai" | "ollama";
    readonly model: string;
    readonly text: string;
    readonly requestId?: string;
}
export declare function generateText(request: AiGenerationRequest): Promise<AiGenerationResult>;
