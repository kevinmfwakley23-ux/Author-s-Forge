import type { CompressionInput, CompressionResult } from './compression-engine.js';

const TOKEN_DIVISOR = 4;

function estimate(text: string): number {
  return Math.ceil(text.length / TOKEN_DIVISOR);
}

function compactShellOutput(text: string): string {
  const lines = text.split(/\r?\n/);
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    const normalized = line.trim();
    if (!normalized) continue;
    if (/^(?:npm warn|pnpm warn|warning:)/i.test(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    kept.push(line);
  }

  return kept.join('\n');
}

export class ToolResultCompressor {
  compress(input: CompressionInput): CompressionResult {
    if (input.target !== 'tool_results') {
      return {
        text: input.text,
        changed: false,
        estimatedInputTokens: estimate(input.text),
        estimatedOutputTokens: estimate(input.text),
        reason: 'target-not-supported',
      };
    }

    // Never rewrite structured payloads or fenced code in this conservative stage.
    if (/^\s*[\[{]/.test(input.text) || /```/.test(input.text)) {
      return {
        text: input.text,
        changed: false,
        estimatedInputTokens: estimate(input.text),
        estimatedOutputTokens: estimate(input.text),
        reason: 'structured-or-code-protected',
      };
    }

    const text = compactShellOutput(input.text);
    const inputTokens = estimate(input.text);
    const outputTokens = estimate(text);

    // Fail open when compaction does not materially reduce the payload.
    if (outputTokens >= inputTokens) {
      return {
        text: input.text,
        changed: false,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: inputTokens,
        reason: 'no-measurable-savings',
      };
    }

    return {
      text,
      changed: text !== input.text,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
    };
  }
}
