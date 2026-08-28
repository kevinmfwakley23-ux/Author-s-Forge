import { type VoiceFingerprint, type VoiceProfile } from "../domain/voice-preservation";
export declare class VoicePreservationService {
    private readonly projectId;
    constructor(projectId: string);
    analyze(text: string): import("../domain/voice-preservation").VoiceAnalysis;
    createProfile(input: {
        id?: string;
        authorId: string;
        text: string;
        sampleIds?: readonly string[];
        createdAt?: string;
    }): VoiceProfile;
    compare(text: string, profile: VoiceFingerprint): {
        analysis: import("../domain/voice-preservation").VoiceAnalysis;
        distance: number;
        withinProfile: boolean;
    };
    rewriteBrief(source: string, instruction: "preserve-voice" | "more-literary", profile: VoiceFingerprint): string;
}
