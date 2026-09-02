export const RHYME_STORYTELLING_FORMAT_VERSION = 1 as const;

export const RHYME_CRAFT_MODES = Object.freeze([
  "playful-bouncy",
  "whimsical-conversational",
  "gentle-musical",
  "narrative-ballad",
  "custom",
] as const);
export type RhymeCraftMode = (typeof RHYME_CRAFT_MODES)[number];

export interface RhymeLineAnalysis {
  readonly lineNumber: number;
  readonly text: string;
  readonly syllables: number;
  readonly endWord: string;
  readonly rhymeKey: string;
  readonly scheme: string;
  readonly syllableDeltaFromMean: number;
}

export interface RhymeStoryAnalysis {
  readonly formatVersion: typeof RHYME_STORYTELLING_FORMAT_VERSION;
  readonly mode: RhymeCraftMode;
  readonly lineCount: number;
  readonly nonBlankLineCount: number;
  readonly meanSyllables: number;
  readonly syllableRange: readonly [number, number];
  readonly cadenceConsistency: number;
  readonly endRhymeCoverage: number;
  readonly coupletRhymeCoverage: number;
  readonly detectedScheme: string;
  readonly lines: readonly RhymeLineAnalysis[];
  readonly strengths: readonly string[];
  readonly warnings: readonly string[];
  readonly recommendations: readonly string[];
}

export function analyzeRhymeStory(text: string, mode: RhymeCraftMode = "gentle-musical"): RhymeStoryAnalysis {
  if (!RHYME_CRAFT_MODES.includes(mode)) throw new Error(`Unsupported rhyme craft mode "${String(mode)}".`);
  if (typeof text !== "string" || !text.trim()) throw new Error("Rhyme story text is required.");
  if (text.length > 120_000) throw new Error("Rhyme story text exceeds the 120,000 character analysis limit.");

  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");
  const sourceLines = rawLines.map((line, index) => ({ lineNumber: index + 1, text: line.trim() })).filter((line) => line.text.length > 0);
  if (!sourceLines.length) throw new Error("Rhyme story must contain at least one non-blank line.");

  const syllables = sourceLines.map((line) => countLineSyllables(line.text));
  const mean = average(syllables);
  const min = Math.min(...syllables);
  const max = Math.max(...syllables);
  const keys = sourceLines.map((line) => rhymeKey(lastWord(line.text)));
  const schemeLabels = rhymeScheme(keys);
  const rhymeCounts = new Map<string, number>();
  for (const key of keys) if (key) rhymeCounts.set(key, (rhymeCounts.get(key) ?? 0) + 1);
  const rhymingLines = keys.filter((key) => key && (rhymeCounts.get(key) ?? 0) > 1).length;
  const coupletPairs = Math.floor(sourceLines.length / 2);
  let rhymingCouplets = 0;
  for (let i = 0; i + 1 < keys.length; i += 2) if (keys[i] && keys[i] === keys[i + 1]) rhymingCouplets += 1;
  const meanDeviation = average(syllables.map((value) => Math.abs(value - mean)));
  const cadenceConsistency = clamp01(1 - meanDeviation / Math.max(4, mean));
  const endRhymeCoverage = sourceLines.length ? rhymingLines / sourceLines.length : 0;
  const coupletRhymeCoverage = coupletPairs ? rhymingCouplets / coupletPairs : 0;

  const lines: RhymeLineAnalysis[] = sourceLines.map((line, index) => ({
    lineNumber: line.lineNumber,
    text: line.text,
    syllables: syllables[index],
    endWord: lastWord(line.text),
    rhymeKey: keys[index],
    scheme: schemeLabels[index],
    syllableDeltaFromMean: round2(syllables[index] - mean),
  }));

  const strengths: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (cadenceConsistency >= 0.84) strengths.push("Line lengths are rhythmically consistent for read-aloud delivery.");
  else if (cadenceConsistency < 0.62) warnings.push("Line syllable counts vary enough to create noticeable cadence breaks when read aloud.");
  if (endRhymeCoverage >= 0.75) strengths.push("End rhyme is sustained across most of the verse.");
  else if (endRhymeCoverage < 0.4) warnings.push("Many line endings do not participate in a repeated rhyme family.");
  if (coupletRhymeCoverage >= 0.7) strengths.push("Couplet rhyme is strong and predictable.");
  if (max - min >= 8) warnings.push(`The widest line-length spread is ${max - min} syllables (${min}–${max}), which may disrupt musical flow.`);
  if (sourceLines.some((line, index) => syllables[index] > 18)) warnings.push("Some lines exceed 18 estimated syllables and may feel crowded in a picture-book read aloud.");

  const target = modeGuidance(mode);
  recommendations.push(...target);
  if (cadenceConsistency < 0.78) recommendations.push("Read pairs of lines aloud and trim or expand stressed phrases until their spoken beats feel intentionally matched.");
  if (endRhymeCoverage < 0.65) recommendations.push("Strengthen rhyme families where rhyme is intended, but prefer a natural near-rhyme over distorted grammar or filler wording.");
  if (coupletRhymeCoverage < 0.5 && mode === "gentle-musical") recommendations.push("For a musical picture-book cadence, test AABB couplets or repeated couplet clusters before using a looser scheme.");
  recommendations.push("Protect story meaning, character voice, emotional truth, and natural syntax before forcing a rhyme.");

  return {
    formatVersion: RHYME_STORYTELLING_FORMAT_VERSION,
    mode,
    lineCount: rawLines.length,
    nonBlankLineCount: sourceLines.length,
    meanSyllables: round2(mean),
    syllableRange: [min, max],
    cadenceConsistency: round3(cadenceConsistency),
    endRhymeCoverage: round3(endRhymeCoverage),
    coupletRhymeCoverage: round3(coupletRhymeCoverage),
    detectedScheme: schemeLabels.join(""),
    lines,
    strengths,
    warnings,
    recommendations: [...new Set(recommendations)],
  };
}

export function estimateSyllables(word: string): number {
  const cleaned = normalizeWord(word);
  if (!cleaned) return 0;
  if (cleaned.length <= 3) return 1;
  const exceptionalZero = /(?:es|ed)$/i.test(cleaned) && !/(?:ted|ded|ses|zes|ches|shes)$/i.test(cleaned);
  let working = cleaned;
  if (/e$/.test(working) && !/(?:le|ye)$/.test(working)) working = working.slice(0, -1);
  const groups = working.match(/[aeiouy]+/g)?.length ?? 1;
  return Math.max(1, groups - (exceptionalZero ? 1 : 0));
}

export function rhymeKey(word: string): string {
  const cleaned = normalizeWord(word);
  if (!cleaned) return "";
  const matches = [...cleaned.matchAll(/[aeiouy]+/g)];
  if (!matches.length) return cleaned.slice(-3);
  const last = matches[matches.length - 1];
  const start = last.index ?? Math.max(0, cleaned.length - 3);
  const previous = matches.length > 1 && cleaned.length - start <= 2 ? (matches[matches.length - 2].index ?? start) : start;
  return cleaned.slice(previous);
}

function countLineSyllables(line: string): number {
  return line.split(/\s+/).map((word) => estimateSyllables(word)).reduce((total, value) => total + value, 0);
}

function lastWord(line: string): string {
  const words = line.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  return normalizeWord(words.at(-1) ?? "");
}

function normalizeWord(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z]/g, "");
}

function rhymeScheme(keys: readonly string[]): string[] {
  const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const seen = new Map<string, string>();
  let next = 0;
  return keys.map((key, index) => {
    if (!key) return "-";
    const existing = seen.get(key);
    if (existing) return existing;
    const label = next < labels.length ? labels[next] : `X${index + 1}`;
    next += 1;
    seen.set(key, label);
    return label;
  });
}

function modeGuidance(mode: RhymeCraftMode): string[] {
  switch (mode) {
    case "playful-bouncy": return ["Favor a buoyant, strongly stressed read-aloud pulse, playful sound patterns, controlled repetition, and inventive but understandable language."];
    case "whimsical-conversational": return ["Allow looser line lengths and conversational surprises while keeping the rhyme natural, emotionally clear, and easy to perform aloud."];
    case "gentle-musical": return ["Favor smooth couplets or short rhyme clusters, warm musical phrasing, and consistent line balance suitable for picture-book narration."];
    case "narrative-ballad": return ["Prioritize forward story movement, recurring rhythmic anchors, and stanza-level rhyme patterns that can carry longer narrative passages."];
    case "custom": return ["Use the author's stated rhyme scheme, cadence, audience, and story constraints as the primary craft target."];
  }
}

const average = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
