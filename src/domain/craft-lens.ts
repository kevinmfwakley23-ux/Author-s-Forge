export const CRAFT_LENS_FORMAT_VERSION = 1 as const;
export const CRAFT_LENS_PROPOSAL_EVIDENCE_FORMAT_VERSION = 1 as const;

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

export interface CraftLensProposalEvidence {
  readonly formatVersion: typeof CRAFT_LENS_PROPOSAL_EVIDENCE_FORMAT_VERSION;
  readonly findingId: string;
  readonly dimension: CraftDimension;
  readonly severity: CraftSeverity;
  readonly message: string;
  readonly evidence: string;
  readonly selectedSuggestion: string;
  readonly reportWordCount: number;
  readonly reportSentenceCount: number;
  readonly sourceContentSha256: string;
  readonly analyzedAt: string;
}

export function createCraftLensProposalEvidence(input: {
  readonly report: CraftLensReport;
  readonly findingId: string;
  readonly selectedSuggestion: string;
  readonly sourceContentSha256: string;
  readonly analyzedAt?: string;
}): CraftLensProposalEvidence {
  const finding = input.report.findings.find((item) => item.id === input.findingId);
  if (!finding) throw new Error(`Craft Lens finding "${input.findingId}" was not found in the authoritative analysis.`);
  const selectedSuggestion = input.selectedSuggestion.trim();
  if (!finding.suggestions.includes(selectedSuggestion)) throw new Error(`Craft Lens strategy is not an available suggestion for finding "${finding.id}".`);
  if (!/^[a-f0-9]{64}$/.test(input.sourceContentSha256)) throw new Error("Craft Lens source content hash is invalid.");
  return validateCraftLensProposalEvidence({
    formatVersion: CRAFT_LENS_PROPOSAL_EVIDENCE_FORMAT_VERSION,
    findingId: finding.id,
    dimension: finding.dimension,
    severity: finding.severity,
    message: finding.message,
    evidence: finding.evidence,
    selectedSuggestion,
    reportWordCount: input.report.wordCount,
    reportSentenceCount: input.report.sentenceCount,
    sourceContentSha256: input.sourceContentSha256,
    analyzedAt: input.analyzedAt ?? new Date().toISOString(),
  });
}

export function validateCraftLensProposalEvidence(value: CraftLensProposalEvidence): CraftLensProposalEvidence {
  if (value.formatVersion !== CRAFT_LENS_PROPOSAL_EVIDENCE_FORMAT_VERSION) throw new Error("Unsupported Craft Lens proposal evidence format.");
  if (!value.findingId.trim()) throw new Error("Craft Lens proposal evidence finding id is required.");
  if (!(["clarity", "rhythm", "dialogue", "concision", "sensory"] as readonly string[]).includes(value.dimension)) throw new Error("Craft Lens proposal evidence dimension is invalid.");
  if (!(["info", "watch", "high"] as readonly string[]).includes(value.severity)) throw new Error("Craft Lens proposal evidence severity is invalid.");
  if (!value.message.trim()) throw new Error("Craft Lens proposal evidence message is required.");
  if (!value.evidence.trim()) throw new Error("Craft Lens proposal evidence text is required.");
  if (!value.selectedSuggestion.trim()) throw new Error("Craft Lens proposal evidence selected suggestion is required.");
  if (!Number.isInteger(value.reportWordCount) || value.reportWordCount < 0) throw new Error("Craft Lens proposal evidence word count is invalid.");
  if (!Number.isInteger(value.reportSentenceCount) || value.reportSentenceCount < 0) throw new Error("Craft Lens proposal evidence sentence count is invalid.");
  if (!/^[a-f0-9]{64}$/.test(value.sourceContentSha256)) throw new Error("Craft Lens proposal evidence source content hash is invalid.");
  if (!value.analyzedAt.trim() || Number.isNaN(Date.parse(value.analyzedAt))) throw new Error("Craft Lens proposal evidence analysis timestamp is invalid.");
  return {
    ...value,
    findingId: value.findingId.trim(),
    message: value.message.trim(),
    evidence: value.evidence.trim(),
    selectedSuggestion: value.selectedSuggestion.trim(),
  };
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
