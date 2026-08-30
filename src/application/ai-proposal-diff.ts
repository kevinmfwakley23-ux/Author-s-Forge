import { createHash } from "node:crypto";

export const AI_PROPOSAL_DIFF_FORMAT_VERSION = 1 as const;

export type AiProposalDiffLineKind = "unchanged" | "added" | "removed";

export interface AiProposalDiffLine {
  readonly kind: AiProposalDiffLineKind;
  readonly text: string;
  readonly lineNumber?: number;
  readonly proposedLineNumber?: number;
}

export interface AiProposalDiff {
  readonly formatVersion: typeof AI_PROPOSAL_DIFF_FORMAT_VERSION;
  readonly baseSha256: string;
  readonly proposedSha256: string;
  readonly changed: boolean;
  readonly baseCharacters: number;
  readonly proposedCharacters: number;
  readonly baseWords: number;
  readonly proposedWords: number;
  readonly addedLines: number;
  readonly removedLines: number;
  readonly unchangedLines: number;
  readonly lines: readonly AiProposalDiffLine[];
}

/**
 * Creates a deterministic, review-oriented diff for an AI proposal without mutating
 * manuscript state. The source and proposed hashes make the review artifact bindable
 * to the exact text the author saw.
 */
export function createAiProposalDiff(baseContent: string, proposedContent: string): AiProposalDiff {
  if (typeof baseContent !== "string" || typeof proposedContent !== "string") throw new Error("AI proposal diff content must be strings.");

  const baseLines = splitLines(baseContent);
  const proposedLines = splitLines(proposedContent);
  const lines = lcsDiff(baseLines, proposedLines);
  const addedLines = lines.filter((line) => line.kind === "added").length;
  const removedLines = lines.filter((line) => line.kind === "removed").length;
  const unchangedLines = lines.filter((line) => line.kind === "unchanged").length;

  return {
    formatVersion: AI_PROPOSAL_DIFF_FORMAT_VERSION,
    baseSha256: sha256(baseContent),
    proposedSha256: sha256(proposedContent),
    changed: baseContent !== proposedContent,
    baseCharacters: baseContent.length,
    proposedCharacters: proposedContent.length,
    baseWords: countWords(baseContent),
    proposedWords: countWords(proposedContent),
    addedLines,
    removedLines,
    unchangedLines,
    lines,
  };
}

function splitLines(value: string): string[] {
  if (!value) return [];
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function lcsDiff(base: readonly string[], proposed: readonly string[]): AiProposalDiffLine[] {
  const rows = base.length + 1;
  const cols = proposed.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = base.length - 1; i >= 0; i -= 1) {
    for (let j = proposed.length - 1; j >= 0; j -= 1) {
      table[i][j] = base[i] === proposed[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const result: AiProposalDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < base.length && j < proposed.length) {
    if (base[i] === proposed[j]) {
      result.push({ kind: "unchanged", text: base[i], lineNumber: i + 1, proposedLineNumber: j + 1 });
      i += 1;
      j += 1;
      continue;
    }
    if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ kind: "removed", text: base[i], lineNumber: i + 1 });
      i += 1;
    } else {
      result.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 });
      j += 1;
    }
  }
  while (i < base.length) {
    result.push({ kind: "removed", text: base[i], lineNumber: i + 1 });
    i += 1;
  }
  while (j < proposed.length) {
    result.push({ kind: "added", text: proposed[j], proposedLineNumber: j + 1 });
    j += 1;
  }
  return result;
}
