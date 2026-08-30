export type ProposalDiffKind = "equal" | "added" | "removed";

export interface ProposalDiffLine {
  readonly kind: ProposalDiffKind;
  readonly text: string;
  readonly oldLine?: number;
  readonly newLine?: number;
}

export interface ProposalDiffSummary {
  readonly lines: readonly ProposalDiffLine[];
  readonly added: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly changed: boolean;
}

/**
 * Produces a deterministic, line-oriented diff for review surfaces.
 * It is deliberately presentation-only: it never mutates manuscript state.
 */
export function diffProposalText(original: string, proposed: string): ProposalDiffSummary {
  const oldLines = splitLines(original);
  const newLines = splitLines(proposed);
  const table: number[][] = Array.from({ length: oldLines.length + 1 }, () => Array<number>(newLines.length + 1).fill(0));

  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      table[i][j] = oldLines[i] === newLines[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const lines: ProposalDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      lines.push({ kind: "equal", text: oldLines[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      lines.push({ kind: "removed", text: oldLines[i], oldLine: i + 1 });
      i += 1;
    } else {
      lines.push({ kind: "added", text: newLines[j], newLine: j + 1 });
      j += 1;
    }
  }
  while (i < oldLines.length) {
    lines.push({ kind: "removed", text: oldLines[i], oldLine: i + 1 });
    i += 1;
  }
  while (j < newLines.length) {
    lines.push({ kind: "added", text: newLines[j], newLine: j + 1 });
    j += 1;
  }

  const added = lines.filter((line) => line.kind === "added").length;
  const removed = lines.filter((line) => line.kind === "removed").length;
  const unchanged = lines.length - added - removed;
  return Object.freeze({ lines, added, removed, unchanged, changed: added > 0 || removed > 0 });
}

function splitLines(value: string): string[] {
  if (!value) return [];
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}
