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
      +--> provider/account quota reserve
      +--> optional model-specific quota reserve
      +--> observed token usage balance
      +--> health / cooldown / failure state
      +--> latency
      +--> cost-routing policy
      |
      v
SHARED TIMEOUT-SAFE PROVIDER TRANSPORT
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
7. **Provider quota is shared.** A provider/account allowance applies once across every model behind that provider. It must never disappear merely because multiple models are configured and must never be copied as independent quota to each model.
8. **Provider-side output limits match the broker reservation.** The same `maxOutputTokens` reservation must be propagated to the provider request when its protocol supports a generation ceiling. Ollama uses `options.num_predict`; OpenAI-compatible gateways use `max_tokens`; OpenAI Responses uses `max_output_tokens`; Anthropic uses `max_tokens`; Gemini uses `maxOutputTokens`.
9. **Every inference request is bounded.** Text-provider network calls go through the shared provider transport and receive an AbortSignal-backed timeout. A hung provider cannot hold a Forge generation forever.
10. **Timeout/network failure is failover evidence.** Transport timeouts and transient network failures are classified retryable so the broker can cool down the failed resource and attempt a distinct eligible real resource.
11. **Rotate before failure.** Accumulated accounted token usage biases otherwise eligible work toward less-used models. Forge does not intentionally drain one model to zero before considering another.
12. **Hard safety overrides preference.** Preferred provider/model order cannot override capability requirements, context/output limits, exhausted or protected quota, active cooldown, unhealthy state, or spend policy.
13. **Retry only real alternatives.** Retry/failover moves through distinct eligible configured resources and records every failed attempt. It never retries into a fake implementation.
14. **Cooldown is shared state.** Retryable rate-limit/network/overload/timeout failures create routing cooldown state so subsequent work can bypass a temporarily unhealthy resource.
15. **Author approval remains separate.** Model routing does not grant authority to mutate canon, manuscript, activity libraries, publishing metadata or other author-owned creative state.
16. **Office completion requires evidence.** An AI-enabled office is not complete until its production path proves Brain context → optimization → Core routing → real provider boundary → observable evidence → author-controlled application.

## Current configured provider families

Forge's canonical resource discovery can expose configured resources for:

- OmniRoute-compatible gateways;
- 9Router-compatible gateways;
- K.I.N.G.S. only when an explicit Responses-compatible endpoint exists;
- OpenAI;
- Ollama/local models;
- Groq;
- Mistral;
- Gemini;
- Anthropic;
- OpenRouter.

A provider is not considered configured merely because its name exists in code. Required endpoint/credential/model configuration must be present for the resource to enter the live broker.

K.I.N.G.S. owner/orchestration endpoints are not assumed to be generic text-generation endpoints. `KINGS_AI_RESPONSES_URL` must identify an actual Responses-compatible `/responses` endpoint before K.I.N.G.S. enters the Forge text broker.

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

OmniRoute may use its documented router-managed `auto` model when no explicit OmniRoute model is supplied. Forge does **not** invent a universal `auto` model for 9Router; 9Router requires a real configured/discovered model or combo.

For explicit per-model capability, per-model quota, cost, health or cooldown metadata, use `AI_MODEL_RESOURCES_JSON`. Explicit resource entries are accepted only when the underlying provider itself is genuinely configured.

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

## Provider/account quota configuration

Provider-prefixed quota variables represent **one account/provider pool**, regardless of the number of configured models:

```text
OMNIROUTE_TOKEN_QUOTA
OMNIROUTE_USED_TOKENS
OMNIROUTE_REMAINING_TOKENS
OMNIROUTE_QUOTA_RESET_AT
```

Equivalent quota fields are supported for `ROUTER9`, `KINGS_AI`, `OPENAI`, `OLLAMA`, `GROQ`, `MISTRAL`, `GEMINI`, `ANTHROPIC`, and `OPENROUTER` when those providers are genuinely configured.

Cost fields remain model/resource metadata unless explicit provider-specific pricing logic says otherwise:

```text
*_INPUT_COST_PER_MILLION
*_OUTPUT_COST_PER_MILLION
```

The broker tracks provider/account quota separately from model telemetry. Runtime usage from every model linked to the same `quotaScope` is aggregated once against the shared provider allowance. Explicit model-specific quota in `AI_MODEL_RESOURCES_JSON` remains an additional independent constraint.

`AI_QUOTA_SAFETY_FRACTION` controls the protected quota fraction. The default live safety fraction is `0.10` when no valid override is supplied.

## Provider transport and cancellation

`AI_PROVIDER_TIMEOUT_MS` controls the normal text-inference timeout for the shared provider transport.

- default: `120000` ms;
- minimum accepted value: `1000` ms;
- maximum accepted value: `600000` ms;
- invalid configured values fail closed instead of silently becoming an unbounded request.

K.I.N.G.S. may use `KINGS_AI_TIMEOUT_MS` as a provider-specific override; otherwise it inherits the shared timeout.

The transport combines a caller cancellation signal with its timeout signal when both exist. Timeout and transient network failures are explicit retryable transport errors. Deliberate caller cancellation is not automatically retried.

## Routing and spend configuration

`AI_ROUTING_MODE` supports:

- `economy` — default; prefer capable lower-cost resources while preserving safety;
- `balanced` — reduce the strength of cost preference;
- `quality` — favor richer capabilities after hard eligibility/safety filters.

`AI_PROVIDER_ORDER` remains a soft provider preference list. It is intentionally not a command to exhaust the first provider.

The durable owner control remains authoritative for spend policy. Live certification never silently changes it into paid/unrestricted operation.

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

## Hermetic integration versus live certification

Mocked provider responses remain valuable, but they are not called live certification.

The hermetic AI suite is:

```text
npm run test:ai:hermetic
```

It proves deterministic Forge behavior such as:

- timeout classification;
- retry/failover logic;
- OpenAI-compatible URL construction;
- output-budget propagation;
- Ollama `num_predict` propagation;
- provider usage accounting;
- model rotation;
- shared provider quota protection.

It deliberately replaces network responses and therefore does **not** certify external provider compatibility.

Real endpoint smoke tests are explicit, opt-in commands:

```text
npm run test:ai:live:omniroute
npm run test:ai:live:9router
npm run test:ai:live:ollama
npm run test:ai:live:kings
```

They require `AI_LIVE_SMOKE=1`. The runner isolates the requested provider so success cannot come from silent fallback to a different provider. It sends a very small real generation request, requires non-empty returned content, verifies the selected provider and configured model resource, and reports request/usage/quota evidence when exposed.

Live smoke tests preserve spend protection. Their default live-test policy is `no-paid-tokens`. A paid/gateway-managed test must be deliberately authorized by accurate billing classification or by explicitly setting `AI_LIVE_SPEND_POLICY`. `unrestricted` is never chosen automatically.

Because endpoint credentials, local Ollama availability, and external router behavior are machine/environment facts, repository CI cannot truthfully certify them without those real dependencies. A green hermetic suite is necessary but is not a substitute for live provider certification.

## Resource-selection order

Before scoring, Forge removes resources that cannot safely perform the task because of:

- unhealthy state;
- active cooldown;
- insufficient context window;
- insufficient output capacity;
- missing required reasoning/vision/tool/streaming/creative/instruction capability;
- configured hard cost ceilings;
- exhausted model-specific quota;
- exhausted shared provider/account quota;
- a request that would violate either quota reserve;
- active spend policy restrictions.

Among remaining resources, the broker considers provider/model preference, health, recent failures, latency, accumulated token usage, remaining quota ratio, cost and task capabilities. This means preference never converts into deliberate exhaustion.

## Future-office gate

Any new office that introduces AI generation must answer all of these before completion:

- Where is its Project Brain query assembled?
- Which shared Core routing instance executes the request?
- What task/capability requirements are declared?
- How are context and output budgets bounded and propagated to the provider?
- How is provider/account quota reserve protected across multiple models?
- Which timeout/cancellation boundary protects the network request?
- How are provider/model attempts and token usage exposed?
- What happens when every eligible real resource fails?
- Which state remains proposal-only until author approval?
- Which hermetic tests prove routing behavior?
- Which optional live smoke proves the real provider contract?

If those questions do not have real implemented answers, the office is not complete.
