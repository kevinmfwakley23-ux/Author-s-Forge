import { ContextOptimizationService } from "./context-optimization-service";

describe("ContextOptimizationService", () => {
  it("records measurable savings for compressible context", () => {
    const service = new ContextOptimizationService();
    const result = service.optimize({
      requestId: "ctx-1",
      kind: "text",
      text: "alpha   beta\n\nalpha   beta\n\n\n",
    });

    expect(result.fallback).toBe(false);
    expect(result.optimizedEstimatedTokens).toBeLessThanOrEqual(result.originalEstimatedTokens);
    expect(service.getLedger().get("ctx-1")?.tokensSaved).toBe(result.tokensSaved);
  });

  it("fails open to the original context when an optimization would inflate the estimate", () => {
    const service = new ContextOptimizationService();
    const original = "a b";
    const result = service.optimize({ requestId: "ctx-2", kind: "text", text: original });

    expect(result.text.length).toBeLessThanOrEqual(original.length);
    expect(service.getLedger().get("ctx-2")?.optimizedEstimatedTokens).toBeLessThanOrEqual(
      service.getLedger().get("ctx-2")?.originalEstimatedTokens ?? 0,
    );
  });
});
