import type { ContextPayloadKind } from "./context-payload-classifier";

export interface ContextCompressionResult {
  readonly text: string;
  readonly changed: boolean;
  readonly strategy: readonly string[];
}

function compactText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function compactDuplicateLines(text: string): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of text.split("\n")) {
    const key = line.trim();
    if (!key) {
      result.push("");
      continue;
    }
    if (key.length >= 24 && seen.has(key)) continue;
    if (key.length >= 24) seen.add(key);
    result.push(line);
  }
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Applies only lossless-ish deterministic transformations appropriate for the
 * payload type. Structured/code payloads are deliberately conservative: the
 * compressor never rewrites their syntax or removes lines merely to save
 * tokens. The canonical source remains outside this derived representation.
 */
export function compressContextPayload(kind: ContextPayloadKind, text: string): ContextCompressionResult {
  if (!text.trim()) return { text, changed: false, strategy: ["empty-payload-no-op"] };

  if (kind === "json" || kind === "code" || kind === "diff") {
    const normalized = text.replace(/\r\n?/g, "\n");
    return normalized === text
      ? { text, changed: false, strategy: ["structured-payload-preserved"] }
      : { text: normalized, changed: true, strategy: ["newline-normalization", "structured-payload-preserved"] };
  }

  if (kind === "log") {
    const compacted = compactDuplicateLines(compactText(text));
    return compacted.length < text.length
      ? { text: compacted, changed: true, strategy: ["newline-normalization", "whitespace-compaction", "duplicate-log-line-removal"] }
      : { text, changed: false, strategy: ["log-no-op"] };
  }

  const compacted = compactDuplicateLines(compactText(text));
  return compacted.length < text.length
    ? { text: compacted, changed: true, strategy: ["newline-normalization", "whitespace-compaction", "duplicate-line-removal"] }
    : { text, changed: false, strategy: ["text-no-op"] };
}
