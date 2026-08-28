export type ContextPayloadKind = "json" | "code" | "diff" | "log" | "text";

export interface ContextPayloadClassification {
  readonly kind: ContextPayloadKind;
  readonly confidence: "high" | "medium" | "low";
}

const CODE_EXTENSIONS = /\.(?:ts|tsx|js|jsx|py|java|go|rs|rb|php|cs|cpp|c|h|swift|kt|sql|sh|yml|yaml|toml|css|html)$/i;

export function classifyContextPayload(content: string, sourceName?: string): ContextPayloadClassification {
  const trimmed = content.trim();

  if (sourceName && /\.diff$|\.patch$/i.test(sourceName) || /^(?:diff --git|@@\s)/m.test(trimmed)) {
    return { kind: "diff", confidence: "high" };
  }

  if (sourceName && CODE_EXTENSIONS.test(sourceName)) {
    return { kind: "code", confidence: "high" };
  }

  try {
    JSON.parse(trimmed);
    return { kind: "json", confidence: "high" };
  } catch {
    // Not JSON; continue with lightweight content signals.
  }

  const lines = trimmed.split(/\r?\n/);
  const logSignals = lines.filter((line) => /\b(?:INFO|DEBUG|WARN|WARNING|ERROR|TRACE|FATAL)\b|^\[\d{4}-\d{2}-\d{2}/i.test(line)).length;
  if (lines.length >= 3 && logSignals / lines.length >= 0.35) {
    return { kind: "log", confidence: "medium" };
  }

  const codeSignals = [
    /\b(?:function|const|let|var|class|interface|import|export|return)\b/,
    /[{};]$/m,
    /=>/,
  ].reduce((score, pattern) => score + (pattern.test(trimmed) ? 1 : 0), 0);
  if (codeSignals >= 2) {
    return { kind: "code", confidence: "medium" };
  }

  return { kind: "text", confidence: "low" };
}
