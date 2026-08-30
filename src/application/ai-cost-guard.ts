import type { AiGateway, AiGatewayRequest, AiGatewayResponse } from "./ai-gateway";
import type { ContextOptimizationLedger } from "./context-optimization-ledger";
import { estimateTokens } from "./context-optimizer";

export interface AiCostPolicy {
  readonly maxInputTokens?: number;
  readonly maxEstimatedCostUsd?: number;
  readonly inputUsdPerMillionTokens?: number;
  readonly outputUsdPerMillionTokens?: number;
}

export interface AiCostEstimate {
  readonly inputTokens: number;
  readonly estimatedOutputTokens: number;
  readonly estimatedCostUsd: number;
}

export class AiCostGuardError extends Error {
  readonly code = "AI_COST_GUARD_BLOCKED" as const;
  readonly estimate: AiCostEstimate;

  constructor(message: string, estimate: AiCostEstimate) {
    super(message);
    this.name = "AiCostGuardError";
    this.estimate = estimate;
  }
}

function estimateRequest(request: AiGatewayRequest, policy: AiCostPolicy): AiCostEstimate {
  const input = estimateTokens(`${request.system ?? ""}\n${request.user}`);
  const output = Math.max(1, Math.ceil(input * 0.25));
  const inputRate = policy.inputUsdPerMillionTokens ?? 0;
  const outputRate = policy.outputUsdPerMillionTokens ?? 0;
  return {
    inputTokens: input,
    estimatedOutputTokens: output,
    estimatedCostUsd: (input * inputRate + output * outputRate) / 1_000_000,
  };
}

export function estimateAiRequestCost(request: AiGatewayRequest, policy: AiCostPolicy): AiCostEstimate {
  return estimateRequest(request, policy);
}

export function createCostGuardedAiGateway(options: {
  readonly gateway: AiGateway;
  readonly policy: AiCostPolicy;
  readonly ledger?: ContextOptimizationLedger;
  readonly requestId?: () => string;
}): AiGateway {
  const requestId = options.requestId ?? (() => `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  return {
    id: `${options.gateway.id}:cost-guarded`,
    isConfigured: () => options.gateway.isConfigured(),
    async generate(request) {
      const id = requestId();
      const estimate = estimateRequest(request, options.policy);
      const createdAt = new Date().toISOString();

      const recordBlocked = (error: AiCostGuardError): never => {
        options.ledger?.record({
          requestId: id,
          createdAt,
          originalEstimatedTokens: estimate.inputTokens,
          optimizedEstimatedTokens: estimate.inputTokens,
          tokensSaved: 0,
          compressionRatio: 0,
          cache: "not-used",
          retrievedContextCount: 0,
          strategies: ["cost-guard"],
          provider: options.gateway.id,
          model: request.model,
          estimatedRequestCost: estimate.estimatedCostUsd,
          optimizationLatencyMs: 0,
          fallbackReason: error.message,
        });
        throw error;
      };

      if (options.policy.maxInputTokens !== undefined && estimate.inputTokens > options.policy.maxInputTokens) {
        return recordBlocked(new AiCostGuardError(
          `AI request exceeds the configured input-token limit (${estimate.inputTokens} > ${options.policy.maxInputTokens}).`,
          estimate,
        ));
      }

      if (options.policy.maxEstimatedCostUsd !== undefined && estimate.estimatedCostUsd > options.policy.maxEstimatedCostUsd) {
        return recordBlocked(new AiCostGuardError(
          `AI request exceeds the configured estimated-cost limit ($${estimate.estimatedCostUsd.toFixed(6)} > $${options.policy.maxEstimatedCostUsd.toFixed(6)}).`,
          estimate,
        ));
      }

      const started = Date.now();
      const response: AiGatewayResponse = await options.gateway.generate(request);
      options.ledger?.record({
        requestId: id,
        createdAt,
        originalEstimatedTokens: estimate.inputTokens,
        optimizedEstimatedTokens: estimate.inputTokens,
        tokensSaved: 0,
        compressionRatio: 0,
        cache: "not-used",
        retrievedContextCount: 0,
        strategies: ["cost-guard"],
        provider: response.provider,
        model: response.model,
        estimatedRequestCost: estimate.estimatedCostUsd,
        optimizationLatencyMs: Date.now() - started,
      });
      return response;
    },
  };
}
