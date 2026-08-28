export type ContextPayloadKind = "json" | "code" | "diff" | "log" | "text";

export interface ContextPayloadClassification {
  readonly kind: ContextPayloadKind;
  readonly confidence: number;
  readonly reason: string;
}

const CODE_MARKERS = [/^\s*(import|export|const|let|var|function|class|interface|type)\b/m, /=>/, /[{}]\s*$/m];
const DIFF_MARKERS = [/^diff --git /m, /^@@\s+-\d+/m, /^\+\+\+ /m, /^--- /m];
const LOG_MARKERS = [/\b(INFO|WARN|WARNING|ERROR|DEBUG|TRACE)\b/, /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/m, /\b(stack trace|exception|stderr|stdout)\b/i];

export function classifyContextPayload(content: string): ContextPayloadClassification {
  const value = content.trim();
  if (!value) return { kind: "text", confidence: 1, reason: "empty-or-whitespace payload" };

  try {
    const parsed = JSON.parse(value);
    if (parsed !== null && (typeof parsed === "object" || Array.isArray(parsed))) {
      return { kind: "json", confidence: 1, reason: "valid JSON object or array" };
    }
  } catch {
    // Continue with heuristic classification for non-JSON payloads.
  }

  if (DIFF_MARKERS.some((marker) => marker.test(value))) {
    return { kind: "diff", confidence: 0.98, reason: "diff patch markers detected" };
  }
  if (LOG_MARKERS.filter((marker) => marker.test(value)).length >= 2) {
    return { kind: "log", confidence: 0.9, reason: "multiple log/diagnostic markers detected" };
  }
  if (CODE_MARKERS.filter((marker) => marker.test(value)).length >= 2) {
    return { kind: "code", confidence: 0.85, reason: "multiple source-code markers detected" };
  }
  return { kind: "text", confidence: 0.75, reason: "no higher-confidence structured payload markers detected" };
}
