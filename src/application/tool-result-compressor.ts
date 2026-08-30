export interface ToolResultCompressionInput {
  readonly command?: string;
  readonly text: string;
  readonly maxLines?: number;
}

export interface ToolResultCompressionResult {
  readonly text: string;
  readonly changed: boolean;
  readonly originalLines: number;
  readonly outputLines: number;
  readonly strategy: readonly string[];
}

const MACHINE_SAFE = /```[\s\S]*```|^\s*[\[{].*[\]}]\s*$/m;
const IMPORTANT = /\b(error|errors|failed|failure|fatal|exception|warning|warn|passed|pass|test|tests|assert|panic|traceback|conflict|rejected)\b/i;

/**
 * Conservative RTK-style reduction for derived shell/build/test/git output.
 * Structured payloads and fenced code are returned byte-for-byte.
 */
export function compressToolResult(input: ToolResultCompressionInput): ToolResultCompressionResult {
  const text = input.text;
  const lines = text.split(/\r?\n/);
  if (!text.trim() || MACHINE_SAFE.test(text)) {
    return { text, changed: false, originalLines: lines.length, outputLines: lines.length, strategy: ['protected-output-no-op'] };
  }

  const command = input.command?.trim().toLowerCase() ?? '';
  const maxLines = Number.isInteger(input.maxLines) && (input.maxLines as number) > 0 ? input.maxLines as number : 240;
  const seen = new Set<string>();
  const retained: string[] = [];

  for (const line of lines) {
    const normalized = line.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      if (retained[retained.length - 1] !== '') retained.push('');
      continue;
    }
    const repetitive = normalized.length >= 32 && seen.has(normalized);
    if (!repetitive) {
      if (normalized.length >= 32) seen.add(normalized);
      retained.push(line);
      continue;
    }
    if (IMPORTANT.test(normalized)) retained.push(line);
  }

  let output = retained.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const outputLines = output ? output.split('\n') : [];

  if (outputLines.length > maxLines) {
    const important = outputLines.filter((line) => IMPORTANT.test(line));
    const headCount = Math.max(20, Math.floor(maxLines * 0.2));
    const tailCount = Math.max(20, maxLines - headCount - Math.min(important.length, 80) - 1);
    const head = outputLines.slice(0, headCount);
    const tail = outputLines.slice(Math.max(headCount, outputLines.length - tailCount));
    const middle = important.slice(0, Math.min(80, maxLines - head.length - tail.length - 1));
    output = [...head, `[Forge compressed ${outputLines.length - head.length - tail.length - middle.length} low-value ${command || 'tool'} output lines]`, ...middle, ...tail].join('\n');
  }

  const changed = output.length < text.length;
  return {
    text: changed ? output : text,
    changed,
    originalLines: lines.length,
    outputLines: changed ? output.split('\n').length : lines.length,
    strategy: changed ? ['rtk-style-command-aware-filter', 'duplicate-line-reduction', 'important-diagnostic-preservation'] : ['tool-output-no-gain'],
  };
}
