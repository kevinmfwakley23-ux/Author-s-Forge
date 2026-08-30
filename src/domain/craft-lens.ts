export const CRAFT_LENS_FORMAT_VERSION = 1 as const;

export type CraftDimension = "clarity" | "rhythm" | "dialogue" | "concision" | "sensory";
export type CraftSeverity = "info" | "watch" | "high";

export interface CraftFinding {
  readonly id: string;
  readonly dimension: CraftDimension;
  readonly severity: CraftSeverity;
  readonly message: string;
  readonly evidence: string;
  readonly suggestions: readonly string[];
}

export interface CraftLensReport {
  readonly formatVersion: typeof CRAFT_LENS_FORMAT_VERSION;
  readonly wordCount: number;
  readonly sentenceCount: number;
  readonly findings: readonly CraftFinding[];
}

export function analyzeCraft(text: string): CraftLensReport {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const words = normalized ? normalized.split(/\s+/u).filter(Boolean) : [];
  const sentences = normalized.split(/[.!?]+(?:\s+|$)/u).map((s) => s.trim()).filter(Boolean);
  const dialogueMatches = normalized.match(/[“"][^”"]*[”"]/gu) ?? [];
  const passiveMatches = normalized.match(/\b(?:was|were|been|being|is|are|be)\s+(?:\w+ed|\w+en)\b/giu) ?? [];
  const longSentences = sentences.filter((sentence) => sentence.split(/\s+/u).length > 35);
  const findings: CraftFinding[] = [];
  if (longSentences.length) findings.push({ id: "clarity-long-sentences", dimension: "clarity", severity: longSentences.length >= 3 ? "high" : "watch", message: `${longSentences.length} sentence${longSentences.length === 1 ? "" : "s"} exceed 35 words.`, evidence: longSentences.slice(0, 2).join(" / "), suggestions: ["Split at a natural beat.", "Check whether each clause advances the same thought."] });
  if (passiveMatches.length) findings.push({ id: "clarity-passive", dimension: "clarity", severity: passiveMatches.length >= 5 ? "watch" : "info", message: `${passiveMatches.length} possible passive constructions detected.`, evidence: passiveMatches.slice(0, 5).join(", "), suggestions: ["Confirm the passive voice is intentional.", "Prefer an active construction when the actor matters."] });
  if (sentences.length >= 5 && dialogueMatches.length === 0) findings.push({ id: "dialogue-none", dimension: "dialogue", severity: "info", message: "No quoted dialogue detected in this passage.", evidence: "The selected passage contains no detected dialogue spans.", suggestions: ["Keep the passage dialogue-free if that serves the scene.", "If characters are present, consider whether a spoken beat would sharpen conflict."] });
  const dialogueRatio = normalized.length ? dialogueMatches.join(" ").length / normalized.length : 0;
  if (dialogueRatio > 0.65) findings.push({ id: "dialogue-heavy", dimension: "dialogue", severity: "watch", message: "Dialogue occupies most of this passage.", evidence: `${Math.round(dialogueRatio * 100)}% of characters are inside detected dialogue spans.`, suggestions: ["Check for action or reaction beats between exchanges.", "Make sure dialogue carries subtext rather than exposition alone."] });
  if (words.length >= 100 && new Set(words.map((word) => word.toLowerCase().replace(/[^a-z']/g, "")).filter(Boolean)).size / words.length < 0.42) findings.push({ id: "concision-repetition", dimension: "concision", severity: "watch", message: "Vocabulary variety is unusually concentrated for this passage.", evidence: "Unique normalized word ratio is below 42%.", suggestions: ["Inspect repeated modifiers and sentence openings.", "Keep deliberate repetition; remove accidental echoes."] });
  if (words.length >= 100 && !/\b(?:smell|scent|taste|tasted|heard|hear|sound|felt|feel|touch|saw|see|look|light|dark|warm|cold|rough|soft)\b/i.test(normalized)) findings.push({ id: "sensory-light", dimension: "sensory", severity: "info", message: "No obvious sensory cue was detected.", evidence: "The passage lacks common sensory anchor terms.", suggestions: ["Add sensory detail only where it changes the reader's experience.", "Use a concrete physical detail instead of an abstract adjective when useful."] });
  if (sentences.length >= 6) {
    const lengths = sentences.map((sentence) => sentence.split(/\s+/u).length);
    const mean = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    const variance = lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length;
    if (Math.sqrt(variance) < 5) findings.push({ id: "rhythm-flat", dimension: "rhythm", severity: "watch", message: "Sentence lengths are unusually uniform.", evidence: `Sentence-length standard deviation is ${Math.sqrt(variance).toFixed(1)} words.`, suggestions: ["Vary sentence length around important beats.", "Preserve uniform rhythm when it is an intentional voice choice."] });
  }
  return { formatVersion: CRAFT_LENS_FORMAT_VERSION, wordCount: words.length, sentenceCount: sentences.length, findings };
}
