export const DEFAULT_AI_PROVIDER_TIMEOUT_MS = 120_000;
export const MIN_AI_PROVIDER_TIMEOUT_MS = 1_000;
export const MAX_AI_PROVIDER_TIMEOUT_MS = 600_000;

export class AiProviderTransportError extends Error {
  readonly code: "AI_PROVIDER_TIMEOUT" | "AI_PROVIDER_CANCELLED" | "AI_PROVIDER_NETWORK";
  readonly retryable: boolean;

  constructor(code: AiProviderTransportError["code"], message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "AiProviderTransportError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface ProviderFetchOptions {
  readonly timeoutMs?: number;
  readonly label?: string;
}

/**
 * Canonical network boundary for AI inference providers.
 *
 * Every provider request receives a bounded AbortSignal. A caller-supplied
 * signal is combined with the timeout signal instead of being replaced.
 * Timeouts and transport failures are normalized so the execution fallback
 * layer can make an explicit retry/failover decision.
 */
export async function providerFetch(
  input: string | URL | Request,
  init: RequestInit = {},
  options: ProviderFetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? readAiProviderTimeoutMs(process.env.AI_PROVIDER_TIMEOUT_MS);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const callerSignal = init.signal;
  const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
  const label = options.label?.trim() || "AI provider";

  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (callerSignal?.aborted && !timeoutSignal.aborted) {
      throw new AiProviderTransportError("AI_PROVIDER_CANCELLED", `${label} request was cancelled.`, false, { cause: error });
    }
    if (timeoutSignal.aborted) {
      throw new AiProviderTransportError("AI_PROVIDER_TIMEOUT", `${label} request timed out after ${timeoutMs}ms.`, true, { cause: error });
    }
    throw new AiProviderTransportError("AI_PROVIDER_NETWORK", `${label} network request failed: ${errorMessage(error)}`, true, { cause: error });
  }
}

export function readAiProviderTimeoutMs(value: string | undefined): number {
  if (!value?.trim()) return DEFAULT_AI_PROVIDER_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_AI_PROVIDER_TIMEOUT_MS || parsed > MAX_AI_PROVIDER_TIMEOUT_MS) {
    throw new Error(`AI_PROVIDER_TIMEOUT_MS must be an integer from ${MIN_AI_PROVIDER_TIMEOUT_MS} to ${MAX_AI_PROVIDER_TIMEOUT_MS}.`);
  }
  return parsed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}
