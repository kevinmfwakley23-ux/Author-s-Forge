import { analyzeVoice, type VoiceFingerprint, type VoiceProfile } from "./voice-preservation";

export const VOICE_MEMORY_FORMAT_VERSION = 1 as const;

export interface VoiceMemorySample {
  readonly id: string;
  readonly text: string;
  readonly approved: boolean;
  readonly weight?: number;
  readonly source?: "manuscript" | "sample" | "revision" | "author-approved";
}

export interface VoiceMemoryProfile {
  readonly formatVersion: typeof VOICE_MEMORY_FORMAT_VERSION;
  readonly profile: VoiceFingerprint;
  readonly sampleIds: readonly string[];
  readonly approvedSampleIds: readonly string[];
  readonly totalSampleWords: number;
  readonly confidence: "low" | "medium" | "high";
}

const weighted = (samples: readonly { fingerprint: VoiceFingerprint; weight: number }[], key: keyof VoiceFingerprint) => {
  const numeric = samples.filter((sample) => typeof sample.fingerprint[key] === "number");
  const denominator = numeric.reduce((sum, sample) => sum + sample.weight, 0);
  return denominator ? numeric.reduce((sum, sample) => sum + Number(sample.fingerprint[key]) * sample.weight, 0) / denominator : 0;
};

const mode = (samples: readonly { fingerprint: VoiceFingerprint; weight: number }[]): VoiceFingerprint["narrativeDistance"] => {
  const scores = new Map<string, number>();
  for (const sample of samples) scores.set(sample.fingerprint.narrativeDistance, (scores.get(sample.fingerprint.narrativeDistance) ?? 0) + sample.weight);
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as VoiceFingerprint["narrativeDistance"] ?? "undetermined";
};

export function buildVoiceMemoryProfile(samples: readonly VoiceMemorySample[]): VoiceMemoryProfile {
  const usable = samples.filter((sample) => sample.approved && sample.text.trim());
  if (!usable.length) throw new Error("At least one approved voice sample is required.");
  const analyzed = usable.map((sample) => ({ sample, fingerprint: analyzeVoice(sample.text).profile, weight: Math.max(1, sample.weight ?? 1) }));
  const totalSampleWords = analyzed.reduce((sum, item) => sum + item.fingerprint.sampleWordCount, 0);
  const profile: VoiceFingerprint = {
    sentenceLengthMean: weighted(analyzed, "sentenceLengthMean"), sentenceLengthMedian: weighted(analyzed, "sentenceLengthMedian"),
    punctuationRate: weighted(analyzed, "punctuationRate"), dialogueRatio: weighted(analyzed, "dialogueRatio"), vocabularyRichness: weighted(analyzed, "vocabularyRichness"),
    paragraphLengthMean: weighted(analyzed, "paragraphLengthMean"), narrativeDistance: mode(analyzed), descriptionDensity: weighted(analyzed, "descriptionDensity"),
    metaphorDensity: weighted(analyzed, "metaphorDensity"), pacing: weighted(analyzed, "pacing"), emotionalIntensity: weighted(analyzed, "emotionalIntensity"), sampleWordCount: totalSampleWords,
  };
  return { formatVersion: VOICE_MEMORY_FORMAT_VERSION, profile, sampleIds: samples.map((sample) => sample.id), approvedSampleIds: usable.map((sample) => sample.id), totalSampleWords, confidence: totalSampleWords >= 5000 ? "high" : totalSampleWords >= 1000 ? "medium" : "low" };
}

export function voiceMemoryToPromptContext(memory: VoiceMemoryProfile): string {
  return [
    "AUTHOR VOICE MEMORY — preserve, do not imitate another named author:",
    `confidence=${memory.confidence}; approvedSamples=${memory.approvedSampleIds.length}; words=${memory.totalSampleWords}`,
    `sentenceLength=${memory.profile.sentenceLengthMean.toFixed(1)}; paragraphLength=${memory.profile.paragraphLengthMean.toFixed(1)}; dialogue=${memory.profile.dialogueRatio.toFixed(2)}`,
    `pacing=${memory.profile.pacing.toFixed(2)}; description=${memory.profile.descriptionDensity.toFixed(2)}; metaphor=${memory.profile.metaphorDensity.toFixed(2)}; emotion=${memory.profile.emotionalIntensity.toFixed(2)}`,
    `narrativeDistance=${memory.profile.narrativeDistance}`,
    "Treat this as a soft stylistic constraint. Canon, scene facts, character decisions, and explicit author instructions outrank voice matching. Never invent facts to satisfy the voice profile.",
  ].join("\n");
}

export function mergeVoiceMemory(existing: VoiceMemoryProfile | undefined, incoming: VoiceMemoryProfile): VoiceMemoryProfile {
  if (!existing) return incoming;
  const total = existing.totalSampleWords + incoming.totalSampleWords;
  const ratio = incoming.totalSampleWords / Math.max(1, total);
  const a = existing.profile, b = incoming.profile;
  const blend = (x: number, y: number) => x * (1 - ratio) + y * ratio;
  return {
    formatVersion: VOICE_MEMORY_FORMAT_VERSION,
    profile: { sentenceLengthMean: blend(a.sentenceLengthMean, b.sentenceLengthMean), sentenceLengthMedian: blend(a.sentenceLengthMedian, b.sentenceLengthMedian), punctuationRate: blend(a.punctuationRate, b.punctuationRate), dialogueRatio: blend(a.dialogueRatio, b.dialogueRatio), vocabularyRichness: blend(a.vocabularyRichness, b.vocabularyRichness), paragraphLengthMean: blend(a.paragraphLengthMean, b.paragraphLengthMean), narrativeDistance: ratio >= 0.5 ? b.narrativeDistance : a.narrativeDistance, descriptionDensity: blend(a.descriptionDensity, b.descriptionDensity), metaphorDensity: blend(a.metaphorDensity, b.metaphorDensity), pacing: blend(a.pacing, b.pacing), emotionalIntensity: blend(a.emotionalIntensity, b.emotionalIntensity), sampleWordCount: total },
    sampleIds: [...new Set([...existing.sampleIds, ...incoming.sampleIds])], approvedSampleIds: [...new Set([...existing.approvedSampleIds, ...incoming.approvedSampleIds])], totalSampleWords: total, confidence: total >= 5000 ? "high" : total >= 1000 ? "medium" : "low",
  };
}

export function createVoiceMemoryFromProfiles(profiles: readonly VoiceProfile[]): VoiceMemoryProfile {
  return buildVoiceMemoryProfile(profiles.map((profile) => ({ id: profile.id, text: JSON.stringify(profile.fingerprint), approved: true })));
}
