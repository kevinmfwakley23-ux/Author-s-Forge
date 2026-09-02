import type { AiTask } from "./ai-model-broker";

export const FORGE_QUALITY_CONTRACT_VERSION = 1 as const;

/**
 * Provider/model-independent behavior contract injected into every text request.
 * This is deliberately provider-neutral so local/free/subscription/paid models
 * all receive the same authorship, canon, quality and honesty boundaries.
 */
export function buildForgeQualityContract(task: AiTask): string {
  return [
    `AUTHOR'S FORGE QUALITY CONTRACT v${FORGE_QUALITY_CONTRACT_VERSION}`,
    "These rules apply regardless of the AI provider or model beneath Forge.",
    "AUTHORSHIP: The author remains the decision-maker. Never silently change canon, intent, facts, character identity, point of view, emotional meaning, or approved author voice.",
    "VOICE: Use Project Brain and Author Voice Memory as constraints. Prefer the author's established wording patterns, rhythm, narrative distance, emotional intensity, dialogue density, descriptive density, and stated boundaries over generic model habits.",
    "QUALITY: Produce complete, publication-usable work for the requested task. Avoid filler, repetitive conclusions, generic motivational language, canned headings, unnecessary disclaimers, and model-centric chatter.",
    "HONESTY: Never fabricate research, citations, quotations, source access, provider results, dictionary data, statistics, or completed actions. Mark uncertainty when evidence is insufficient.",
    "CONTINUITY: Preserve names, relationships, chronology, locations, injuries, objects, world rules, prior decisions, and other canon supplied by Project Brain unless the author explicitly changes them.",
    "FORMAT: Follow requested structure, audience, length, genre, reading level, rhyme scheme, and output format. Do not add preambles or explanations when the requested artifact should stand alone.",
    "EDITING: Improve only what the task authorizes. Preserve meaning and author ownership; proposed alternatives are not canon until accepted.",
    "LANGUAGE: Prefer natural, specific, human phrasing. Do not force synonyms, rhyme, metaphors, sophistication, or sentiment at the expense of meaning or voice.",
    task === "voice-preservation" ? "VOICE-PRESERVATION TASK: Matching the author's own approved patterns outranks generic elegance." : "",
    task === "continuity" ? "CONTINUITY TASK: Canon fidelity outranks novelty." : "",
    task === "research" ? "RESEARCH TASK: Evidence quality and source honesty outrank fluency." : "",
  ].filter(Boolean).join("\n");
}

export interface ForgeOutputQualityReport {
  readonly version: typeof FORGE_QUALITY_CONTRACT_VERSION;
  readonly accepted: boolean;
  readonly score: number;
  readonly failures: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Deterministic floor for obvious provider degradation. It intentionally does
 * not pretend to score literary taste; subtle quality remains governed by
 * Project Brain/voice constraints and author review. Failed outputs may be
 * retried on another eligible model by the shared fallback engine.
 */
export function evaluateForgeOutput(input: {
  readonly text: string;
  readonly task: AiTask;
  readonly userPrompt: string;
}): ForgeOutputQualityReport {
  const text = input.text.trim();
  const failures: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  if (!text) failures.push("provider returned empty output");
  if (/\b(?:lorem ipsum|todo\b|tbd\b|placeholder\b|insert (?:text|content|name|details) here)\b/i.test(text)) {
    failures.push("output contains placeholder or unfinished content");
  }
  if (/\bas an ai(?: language model)?\b|\bi cannot actually access your project files\b/i.test(text)) {
    failures.push("output contains model-centric boilerplate instead of Forge task output");
  }
  if (/\b(?:fabricated citation|fake citation|example\.com\/source)\b/i.test(text)) {
    failures.push("output contains evidence that appears fabricated");
  }

  const promptWords = wordCount(input.userPrompt);
  const outputWords = wordCount(text);
  if ((input.task === "writing" || input.task === "voice-preservation") && promptWords >= 80 && outputWords < 20) {
    failures.push("creative output is implausibly short for the supplied task context");
  }
  if ((input.task === "editing" || input.task === "continuity") && promptWords >= 120 && outputWords < 12) {
    failures.push("editing/continuity output is implausibly short for the supplied task context");
  }

  const repeatedParagraphRatio = duplicateParagraphRatio(text);
  if (repeatedParagraphRatio >= 0.34) {
    failures.push("output repeats substantial paragraph content");
  } else if (repeatedParagraphRatio >= 0.18) {
    warnings.push("output contains noticeable paragraph repetition");
    score -= 10;
  }

  if (/\b(?:in conclusion|overall, it is important to note|delve into|tapestry of)\b/gi.test(text) && input.task === "writing") {
    warnings.push("output contains generic model-like phrasing that may weaken author voice");
    score -= 8;
  }

  score -= failures.length * 30;
  score = Math.max(0, Math.min(100, score));
  return { version: FORGE_QUALITY_CONTRACT_VERSION, accepted: failures.length === 0 && score >= 70, score, failures, warnings };
}

export function assertForgeOutputQuality(input: { readonly text: string; readonly task: AiTask; readonly userPrompt: string }): ForgeOutputQualityReport {
  const report = evaluateForgeOutput(input);
  if (!report.accepted) throw new Error(`Forge quality gate rejected provider output: ${report.failures.join("; ") || `score ${report.score}`}.`);
  return report;
}

function wordCount(value: string): number {
  return value.trim() ? (value.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length : 0;
}
function duplicateParagraphRatio(text: string): number {
  const paragraphs = text.split(/\n\s*\n/).map((value) => normalizeParagraph(value)).filter((value) => value.length >= 40);
  if (paragraphs.length < 3) return 0;
  const counts = new Map<string, number>();
  for (const paragraph of paragraphs) counts.set(paragraph, (counts.get(paragraph) ?? 0) + 1);
  const duplicateCount = [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
  return duplicateCount / paragraphs.length;
}
function normalizeParagraph(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}
