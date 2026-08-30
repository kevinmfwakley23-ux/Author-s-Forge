import type { VoiceFingerprint } from "./voice-preservation";
import { analyzeVoice, compareVoiceToProfile } from "./voice-preservation";

export const AUTHOR_VOICE_MEMORY_FORMAT_VERSION = 2 as const;

export interface VoiceMemorySample {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly fingerprint: VoiceFingerprint;
  readonly approved: boolean;
  readonly weight: number;
  readonly source: "author" | "approved-manuscript";
  readonly genre?: string;
  readonly purpose?: "prose" | "dialogue" | "description" | "narration" | "other";
}

export interface VoiceDimensionScores {
  readonly sentenceRhythm: number;
  readonly vocabulary: number;
  readonly dialogue: number;
  readonly description: number;
  readonly emotionalIntensity: number;
  readonly narrativeDistance: number;
}

export interface AuthorVoiceMemory {
  readonly formatVersion: typeof AUTHOR_VOICE_MEMORY_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly authorId: string;
  readonly samples: readonly VoiceMemorySample[];
  readonly canonicalSampleIds: readonly string[];
  readonly fingerprint: VoiceFingerprint;
  readonly dimensions: VoiceDimensionScores;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VoiceDriftReport {
  readonly distance: number;
  readonly withinProfile: boolean;
  readonly confidence: "low" | "medium" | "high";
  readonly matchedSamples: readonly string[];
  readonly warnings: readonly string[];
  readonly dimensions: VoiceDimensionScores;
  readonly recommendations: readonly string[];
}

const numericKeys = [
  "sentenceLengthMean", "sentenceLengthMedian", "punctuationRate", "dialogueRatio",
  "vocabularyRichness", "paragraphLengthMean", "descriptionDensity", "metaphorDensity",
  "pacing", "emotionalIntensity",
] as const;

function weightedAverage(values: readonly { value: number; weight: number }[]): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  return totalWeight ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight : 0;
}

function aggregate(samples: readonly VoiceMemorySample[]): VoiceFingerprint {
  if (!samples.length) throw new Error("At least one approved voice sample is required.");
  const approved = samples.filter((sample) => sample.approved && sample.weight > 0);
  if (!approved.length) throw new Error("At least one approved weighted voice sample is required.");
  const result = Object.fromEntries(numericKeys.map((key) => [key, weightedAverage(approved.map((sample) => ({ value: sample.fingerprint[key], weight: sample.weight })))])) as Record<(typeof numericKeys)[number], number>;
  const narrativeDistance = approved.reduce((best, sample) => sample.weight > best.weight ? { value: sample.fingerprint.narrativeDistance, weight: sample.weight } : best, { value: approved[0].fingerprint.narrativeDistance, weight: 0 }).value;
  return { ...result, narrativeDistance: narrativeDistance as VoiceFingerprint["narrativeDistance"], sampleWordCount: approved.reduce((sum, sample) => sum + sample.fingerprint.sampleWordCount, 0) };
}

function dimensions(fingerprint: VoiceFingerprint): VoiceDimensionScores {
  return {
    sentenceRhythm: Math.min(1, fingerprint.sentenceLengthMean / 40),
    vocabulary: Math.min(1, fingerprint.vocabularyRichness),
    dialogue: Math.min(1, fingerprint.dialogueRatio),
    description: Math.min(1, fingerprint.descriptionDensity),
    emotionalIntensity: Math.min(1, fingerprint.emotionalIntensity),
    narrativeDistance: Math.min(1, fingerprint.narrativeDistance === "intimate" ? 0.2 : fingerprint.narrativeDistance === "close" ? 0.4 : fingerprint.narrativeDistance === "objective" ? 0.8 : 0.6),
  };
}

function toSample(sample: { id: string; label: string; text: string; approved?: boolean; weight?: number; source?: "author" | "approved-manuscript"; genre?: string; purpose?: VoiceMemorySample["purpose"] }): VoiceMemorySample {
  return { id: sample.id, label: sample.label, text: sample.text, fingerprint: analyzeVoice(sample.text).profile, approved: sample.approved ?? true, weight: sample.weight ?? 1, source: sample.source ?? "author", genre: sample.genre, purpose: sample.purpose };
}

export function createAuthorVoiceMemory(input: {
  id?: string;
  projectId: string;
  authorId: string;
  samples: readonly { id: string; label: string; text: string; approved?: boolean; weight?: number; source?: "author" | "approved-manuscript"; genre?: string; purpose?: VoiceMemorySample["purpose"] }[];
  canonicalSampleIds?: readonly string[];
  createdAt?: string;
  updatedAt?: string;
}): AuthorVoiceMemory {
  const samples = input.samples.map(toSample);
  const fingerprint = aggregate(samples);
  const canonicalSampleIds = [...(input.canonicalSampleIds ?? samples.filter((sample) => sample.approved).map((sample) => sample.id))].filter((id) => samples.some((sample) => sample.id === id));
  return { formatVersion: AUTHOR_VOICE_MEMORY_FORMAT_VERSION, id: input.id ?? `author-voice-${Date.now()}`, projectId: input.projectId, authorId: input.authorId, samples, canonicalSampleIds, fingerprint, dimensions: dimensions(fingerprint), createdAt: input.createdAt ?? new Date().toISOString(), updatedAt: input.updatedAt ?? new Date().toISOString() };
}

export function updateAuthorVoiceMemory(memory: AuthorVoiceMemory, input: {
  addSamples?: readonly { id: string; label: string; text: string; approved?: boolean; weight?: number; source?: "author" | "approved-manuscript"; genre?: string; purpose?: VoiceMemorySample["purpose"] }[];
  removeSampleIds?: readonly string[];
  canonicalSampleIds?: readonly string[];
}): AuthorVoiceMemory {
  const removed = new Set(input.removeSampleIds ?? []);
  const additions = (input.addSamples ?? []).filter((sample) => !removed.has(sample.id)).map(toSample);
  const samples = [...memory.samples.filter((sample) => !removed.has(sample.id) && !additions.some((added) => added.id === sample.id)), ...additions];
  const fingerprint = aggregate(samples);
  const canonicalSampleIds = [...(input.canonicalSampleIds ?? memory.canonicalSampleIds)].filter((id) => samples.some((sample) => sample.id === id));
  return { ...memory, formatVersion: AUTHOR_VOICE_MEMORY_FORMAT_VERSION, samples, canonicalSampleIds, fingerprint, dimensions: dimensions(fingerprint), updatedAt: new Date().toISOString() };
}

export function assessVoiceDrift(text: string, memory: AuthorVoiceMemory): VoiceDriftReport {
  const comparison = compareVoiceToProfile(text, memory.fingerprint);
  const matchedSamples = memory.samples.filter((sample) => sample.approved).map((sample) => ({ id: sample.id, distance: compareVoiceToProfile(text, sample.fingerprint).distance })).sort((a, b) => a.distance - b.distance).slice(0, 3).map((sample) => sample.id);
  const analysisDimensions = dimensions(comparison.analysis.profile);
  const warnings: string[] = [];
  const recommendations: string[] = [];
  if (comparison.distance > 0.35) { warnings.push("Draft voice is materially outside the author's approved voice profile."); recommendations.push("Revise against the nearest approved voice samples before applying the draft."); }
  if (comparison.analysis.profile.narrativeDistance !== memory.fingerprint.narrativeDistance) { warnings.push("Narrative distance differs from the canonical author voice profile."); recommendations.push("Check POV, narrative intimacy, and internal-thought density."); }
  if (comparison.analysis.profile.sentenceLengthMean > memory.fingerprint.sentenceLengthMean * 1.35) { warnings.push("Sentence length is substantially longer than the author's reference corpus."); recommendations.push("Restore the author's established sentence rhythm where meaning permits."); }
  if (comparison.analysis.profile.sentenceLengthMean < memory.fingerprint.sentenceLengthMean * 0.65) { warnings.push("Sentence length is substantially shorter than the author's reference corpus."); recommendations.push("Restore the author's established sentence rhythm where meaning permits."); }
  if (Math.abs(analysisDimensions.dialogue - memory.dimensions.dialogue) > 0.3) recommendations.push("Check dialogue density against the author's approved corpus.");
  if (Math.abs(analysisDimensions.description - memory.dimensions.description) > 0.3) recommendations.push("Check descriptive density against the author's approved corpus.");
  return { distance: comparison.distance, withinProfile: comparison.withinProfile, confidence: memory.fingerprint.sampleWordCount >= 5000 ? "high" : memory.fingerprint.sampleWordCount >= 1000 ? "medium" : "low", matchedSamples, warnings, dimensions: analysisDimensions, recommendations: [...new Set(recommendations)] };
}

export function buildAuthorVoiceContext(memory: AuthorVoiceMemory): string {
  const canonical = memory.samples.filter((sample) => memory.canonicalSampleIds.includes(sample.id));
  return [
    "AUTHOR VOICE MEMORY — canonical reference corpus",
    `Approved samples: ${canonical.length}; reference words: ${memory.fingerprint.sampleWordCount}.`,
    `Narrative distance: ${memory.fingerprint.narrativeDistance}. Sentence length mean: ${memory.fingerprint.sentenceLengthMean.toFixed(1)}.`,
    `Dialogue ratio: ${memory.fingerprint.dialogueRatio.toFixed(2)}. Vocabulary richness: ${memory.fingerprint.vocabularyRichness.toFixed(2)}.`,
    `Description density: ${memory.fingerprint.descriptionDensity.toFixed(2)}. Metaphor density: ${memory.fingerprint.metaphorDensity.toFixed(2)}.`,
    "Treat this as a preservation constraint, not an instruction to imitate another author. Draft in the author's established patterns while preserving canon, character state, continuity, meaning, and author intent.",
  ].join("\n");
}
