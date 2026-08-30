# Mission 038 — Provider Cost Guard

## Status
Implemented as a provider-neutral application boundary.

## Added
- deterministic input/output token estimation using the existing Forge estimator;
- configurable maximum input-token guard;
- configurable maximum estimated USD cost guard;
- fail-before-provider-execution behavior when a request exceeds policy;
- explicit `AiCostGuardError` with machine-readable error code and estimate;
- optimization-ledger recording for blocked and allowed requests;
- provider/model attribution and estimated request cost telemetry;
- public exports and regression coverage.

## Design decision
The guard is a composable gateway decorator rather than being embedded into a provider adapter. This preserves the provider boundary and lets the same governance apply to OpenAI, Ollama, OpenAI-compatible gateways, and future K.I.N.G.S.-mediated providers.

The design follows useful cost-governance patterns observed in current AI gateway projects: enforce request budgets before upstream execution and make cost/usage observable. Forge does not import a gateway implementation merely to obtain this behavior.

## Verification contract
The milestone is complete only when the build and test suite pass. Tests verify cost estimation, preflight blocking without provider execution, and successful provider execution with ledger telemetry.
