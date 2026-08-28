export declare const VOICE_PRESERVATION_FORMAT_VERSION: 1;
export interface VoiceFingerprint {
    readonly sentenceLengthMean: number;
    readonly sentenceLengthMedian: number;
    readonly punctuationRate: number;
    readonly dialogueRatio: number;
    readonly vocabularyRichness: number;
    readonly paragraphLengthMean: number;
    readonly narrativeDistance: "first-person" | "second-person" | "third-person" | "mixed" | "undetermined";
    readonly descriptionDensity: number;
    readonly metaphorDensity: number;
    readonly pacing: number;
    readonly emotionalIntensity: number;
    readonly sampleWordCount: number;
}
export interface VoiceProfile {
    readonly id: string;
    readonly projectId: string;
    readonly authorId: string;
    readonly createdAt: string;
    readonly sampleIds: readonly string[];
    readonly fingerprint: VoiceFingerprint;
}
export interface VoiceAnalysis {
    readonly profile: VoiceFingerprint;
    readonly notes: readonly string[];
    readonly confidence: "low" | "medium" | "high";
}
export interface VoiceRewriteRequest {
    readonly source: string;
    readonly instruction: "preserve-voice" | "more-literary";
    readonly profile: VoiceFingerprint;
}
export declare function analyzeVoice(text: string): VoiceAnalysis;
export declare function createVoiceProfile(input: {
    id?: string;
    projectId: string;
    authorId: string;
    text: string;
    sampleIds?: readonly string[];
    createdAt?: string;
}): VoiceProfile;
export declare function compareVoiceToProfile(text: string, profile: VoiceFingerprint): {
    analysis: VoiceAnalysis;
    distance: number;
    withinProfile: boolean;
};
export declare function buildVoiceRewriteBrief(request: VoiceRewriteRequest): string;
