import type { VoiceFingerprint } from "./voice-preservation";
import { analyzeVoice, compareVoiceToProfile } from "./voice-preservation";

export const AUTHOR_VOICE_MEMORY_FORMAT_VERSION = 1 as const;

export interface VoiceMemorySample {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly fingerprint: VoiceFingerprint;
  readonly approved: boolean;
  readonly weight: number;
}

export interface AuthorVoiceMemory {
  readonly formatVersion: typeof AUTHOR_VOICE_MEMORY_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly authorId: string;
  readonly samples: readonly VoiceMemorySample[];
  readonly canonicalSampleIds: readonly string[];
  readonly fingerprint: VoiceFingerprint;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VoiceDriftReport {
  readonly distance: number;
  readonly withinProfile: boolean;
  readonly confidence: "low" | "medium" | "high";
  readonly matchedSamples: readonly string[];
  readonly warnings: readonly string[];
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
  const distances = new Map<string, number>();
  const first = approved[0].fingerprint;
  for (const sample of approved) distances.set(sample.fingerprint.narrativeDistance, (distances.get(sample.fingerprint.narrativeDistance) ?? 0) + sample.weight);
  const narrativeDistance = [...distances.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? first.narrativeDistance;
  return { ...result, narrativeDistance: narrativeDistance as VoiceFingerprint["narrativeDistance"], sampleWordCount: approved.reduce((sum, sample) => sum + sample.fingerprint.sampleWordCount, 0) };
}

export function createAuthorVoiceMemory(input: {
  id?: string;
  projectId: string;
  authorId: string;
  samples: readonly { id: string; label: string; text: string; approved?: boolean; weight?: number }[];
  canonicalSampleIds?: readonly string[];
  createdAt?: string;
  updatedAt?: string;
}): AuthorVoiceMemory {
  const samples = input.samples.map((sample) => ({
    id: sample.id,
    label: sample.label,
    text: sample.text,
    fingerprint: analyzeVoice(sample.text).profile,
    approved: sample.approved ?? true,
    weight: sample.weight ?? 1,
  }));
  const fingerprint = aggregate(samples);
  const canonicalSampleIds = [...(input.canonicalSampleIds ?? samples.filter((sample) => sample.approved).map((sample) => sample.id))].filter((id) => samples.some((sample) => sample.id === id));
  return {
    formatVersion: AUTHOR_VOICE_MEMORY_FORMAT_VERSION,
    id: input.id ?? `author-voice-${Date.now()}`,
    projectId: input.projectId,
    authorId: input.authorId,
    samples,
    canonicalSampleIds,
    fingerprint,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export function updateAuthorVoiceMemory(memory: AuthorVoiceMemory, input: {
  addSamples?: readonly { id: string; label: string; text: string; approved?: boolean; weight?: number }[];
  removeSampleIds?: readonly string[];
  canonicalSampleIds?: readonly string[];
}): AuthorVoiceMemory {
  const removed = new Set(input.removeSampleIds ?? []);
  const additions = (input.addSamples ?? []).filter((sample) => !removed.has(sample.id)).map((sample) => ({ id: sample.id, label: sample.label, text: sample.text, fingerprint: analyzeVoice(sample.text).profile, approved: sample.approved ?? true, weight: sample.weight ?? 1 }));
  const samples = [...memory.samples.filter((sample) => !removed.has(sample.id) && !additions.some((added) => added.id === sample.id)), ...additions];
  const fingerprint = aggregate(samples);
  const canonicalSampleIds = [...(input.canonicalSampleIds ?? memory.canonicalSampleIds)].filter((id) => samples.some((sample) => sample.id === id));
  return { ...memory, samples, canonicalSampleIds, fingerprint, updatedAt: new Date().toISOString() };
}

export function assessVoiceDrift(text: string, memory: AuthorVoiceMemory): VoiceDriftReport {
  const comparison = compareVoiceToProfile(text, memory.fingerprint);
  const matchedSamples = memory.samples
    .filter((sample) => sample.approved)
    .map((sample) => ({ id: sample.id, distance: compareVoiceToProfile(text, sample.fingerprint).distance }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((sample) => sample.id);
  const warnings: string[] = [];
  if (comparison.distance > 0.35) warnings.push("Draft voice is materially outside the author's approved voice profile.");
  if (comparison.analysis.profile.narrativeDistance !== memory.fingerprint.narrativeDistance) warnings.push("Narrative distance differs from the canonical author voice profile.");
  if (comparison.analysis.profile.sentenceLengthMean > memory.fingerprint.sentenceLengthMean * 1.35) warnings.push("Sentence length is substantially longer than the author's reference corpus.");
  if (comparison.analysis.profile.sentenceLengthMean < memory.fingerprint.sentenceLengthMean * 0.65) warnings.push("Sentence length is substantially shorter than the author's reference corpus.");
  return { distance: comparison.distance, withinProfile: comparison.withinProfile, confidence: memory.fingerprint.sampleWordCount >= 5000 ? "high" : memory.fingerprint.sampleWordCount >= 1000 ? "medium" : "low", matchedSamples, warnings };
}

export function buildAuthorVoiceContext(memory: AuthorVoiceMemory): string {
  const canonical = memory.samples.filter((sample) => memory.canonicalSampleIds.includes(sample.id));
  return [
    "AUTHOR VOICE MEMORY — canonical reference corpus",
    `Approved samples: ${canonical.length}; reference words: ${memory.fingerprint.sampleWordCount}.`,
    `Narrative distance: ${memory.fingerprint.narrativeDistance}. Sentence length mean: ${memory.fingerprint.sentenceLengthMean.toFixed(1)}.`,
    `Dialogue ratio: ${memory.fingerprint.dialogueRatio.toFixed(2)}. Vocabulary richness: ${memory.fingerprint.vocabularyRichness.toFixed(2)}.`,
    `Description density: ${memory.fingerprint.descriptionDensity.toFixed(2)}. Metaphor density: ${memory.fingerprint.metaphorDensity.toFixed(2)}.`,
    "Treat this as a preservation constraint, not an instruction to imitate another author. Draft in the author's established patterns while preserving canon and meaning.",
  ].join("\n");
}
