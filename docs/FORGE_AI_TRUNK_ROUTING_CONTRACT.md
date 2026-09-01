# Author's Forge — Shared AI Trunk and Token Conservation Contract

**Status: mandatory engineering contract**

Every Author's Forge office that uses AI must connect to the same Forge Brain/trunk services. An office may define task-specific prompts, schemas, validation and approval workflows, but it must not create a second provider router, a second quota ledger, a fake provider fallback, or an isolated project-memory brain.

## Required execution path

```text
OFFICE / WORKFLOW
      |
      v
PROJECT BRAIN + AUTHORITATIVE PROJECT STATE
      |
      v
SALIENT CONTEXT ASSEMBLY
      |
      v
CONTEXT / TOKEN OPTIMIZER
      |
      v
FORGE CORE MODEL BROKER
      |
      +--> capability eligibility
      +--> context/output capacity
      +--> quota reserve
      +--> observed token usage balance
      +--> health / cooldown / failure state
      +--> latency
      +--> cost-routing policy
      |
      v
REAL CONFIGURED PROVIDER + MODEL
      |
      v
PROVIDER USAGE / FAILURE EVIDENCE
      |
      v
SHARED ROUTING STATE + AUTHOR-REVIEWABLE RESULT
```

## Non-negotiable rules

1. **One trunk.** AI-enabled offices consume Project Brain and the shared Forge Core routing boundary. No office-specific provider stacks.
2. **No fabricated output.** If no real eligible provider/model is available, Forge fails clearly. It does not substitute canned text or pretend a request succeeded.
3. **Context is selective.** Sending an entire manuscript/project by default is forbidden. Project Brain retrieval supplies relevant state and the context optimizer may compress eligible payloads before dispatch.
4. **Token savings are labeled truthfully.** `optimization.tokensSaved` is an estimate derived from Forge's context estimator. It is not represented as provider-billed usage.
5. **Provider usage is preferred evidence.** When a provider returns token counts, Forge records those counts as provider usage. If a provider supplies no token counts, routing accounting is explicitly labeled `estimated`.
6. **Quota reserve includes output.** Eligibility protects the expected input plus output token budget and a configurable safety reserve before a request is dispatched.
7. **Rotate before failure.** Accumulated accounted token usage biases otherwise eligible work toward less-used models. Forge does not intentionally drain one model to zero before considering another.
8. **Hard safety overrides preference.** Preferred provider/model order cannot override capability requirements, context/output limits, exhausted or protected quota, active cooldown, or unhealthy state.
9. **Retry only real alternatives.** Retry/failover moves through distinct eligible configured resources and records every failed attempt. It never retries into a fake implementation.
10. **Cooldown is shared state.** Retryable rate-limit/network/overload failures create routing cooldown state so subsequent work can bypass a temporarily unhealthy resource.
11. **Author approval remains separate.** Model routing does not grant authority to mutate canon, manuscript, activity libraries, publishing metadata or other author-owned creative state.
12. **Office completion requires evidence.** An AI-enabled office is not complete until its production path proves Brain context → optimization → Core routing → real provider boundary → observable evidence → author-controlled application.

## Current configured provider families

Forge's canonical resource discovery can expose configured resources for:

- OmniRoute-compatible gateways;
- 9Router-compatible gateways;
- K.I.N.G.S.;
- OpenAI;
- Ollama/local models.

A provider is not considered configured merely because its name exists in code. Required endpoint/credential/model configuration must be present for the resource to enter the live broker.

## Multiple models

Forge supports comma-separated model pools where a provider can execute more than one model:

```text
OMNIROUTE_MODELS=model-a,model-b
ROUTER9_MODELS=model-a,model-b
KINGS_AI_MODELS=model-a,model-b
OPENAI_MODELS=model-a,model-b
OLLAMA_MODELS=model-a,model-b
```

The legacy singular `*_MODEL` variables remain supported when only one model is configured.

For explicit per-model capability, quota, cost, health or cooldown metadata, use `AI_MODEL_RESOURCES_JSON`. Explicit resource entries are accepted only when the underlying provider itself is genuinely configured.

Example shape:

```json
[
  {
    "provider": "openai",
    "model": "example-model",
    "quotaLimit": 1000000,
    "usedTokens": 250000,
    "estimatedInputCostPerMillion": 1.0,
    "estimatedOutputCostPerMillion": 4.0,
    "capabilities": {
      "contextWindow": 128000,
      "maxOutputTokens": 16000,
      "reasoning": true,
      "instructionFollowing": true
    }
  }
]
```

Values above are only an example schema. Production quota/cost/capability values must come from actual provider/account/model configuration and must not be copied from the example as facts.

## Quota and routing configuration

Single-resource provider configurations can seed quota/cost metadata with provider-prefixed environment values such as:

```text
OPENAI_TOKEN_QUOTA
OPENAI_USED_TOKENS
OPENAI_REMAINING_TOKENS
OPENAI_QUOTA_RESET_AT
OPENAI_INPUT_COST_PER_MILLION
OPENAI_OUTPUT_COST_PER_MILLION
```

Equivalent prefixes are supported for `OMNIROUTE`, `ROUTER9`, `KINGS_AI`, and `OLLAMA`.

`AI_QUOTA_SAFETY_FRACTION` controls the protected quota fraction. The default live safety fraction is `0.10` when no valid override is supplied.

`AI_ROUTING_MODE` supports:

- `economy` — default; prefer capable lower-cost resources while preserving safety;
- `balanced` — reduce the strength of cost preference;
- `quality` — favor richer capabilities after hard eligibility/safety filters.

`AI_PROVIDER_ORDER` remains a soft provider preference list. It is intentionally not a command to exhaust the first provider.

## Context accounting

Two separate measurements must remain visible:

### Estimated optimization

```text
originalEstimatedTokens
optimizedEstimatedTokens
tokensSaved
compressionRatio
strategy
```

These values describe Forge's local estimate of context reduction.

### Runtime accounting

```text
accountedTokens
usageSource = provider | estimated | cache
```

When provider usage is available, `accountedTokens` uses the provider-reported total. When unavailable, Forge uses an estimate and says so. A cache hit accounts zero new provider tokens for that cached response.

## Resource-selection order

Before scoring, Forge removes resources that cannot safely perform the task because of:

- unhealthy state;
- active cooldown;
- insufficient context window;
- insufficient output capacity;
- missing required reasoning/vision/tool/streaming/creative/instruction capability;
- configured hard cost ceilings;
- exhausted quota;
- a request that would violate the pre-exhaustion quota reserve.

Among remaining resources, the broker considers provider/model preference, health, recent failures, latency, accumulated token usage, remaining quota ratio, cost and task capabilities. This means preference never converts into deliberate exhaustion.

## Educational Workbook adoption

The Educational Workbook Office is required to follow this contract. Its AI Activity Builder:

- assembles Project Brain context;
- uses the shared live provider/model broker;
- reports estimated context savings separately from actual/estimated runtime usage;
- stores generated activities as durable pending proposals;
- requires explicit author approval before those exact stored activities enter the reusable activity library;
- rejects malformed scored answers and invented author-required standards identifiers;
- retains provider/model evidence with proposal history.

## Future-office gate

Any new office that introduces AI generation must answer all of these before completion:

- Where is its Project Brain query assembled?
- Which shared Core routing instance executes the request?
- What task/capability requirements are declared?
- How are context and output budgets bounded?
- How is quota reserve protected?
- How are provider/model attempts and token usage exposed?
- What happens when every eligible real resource fails?
- Which state remains proposal-only until author approval?
- Which automated and browser/device tests prove the complete path?

If those questions do not have real implemented answers, the office is not complete.
