# Author's Forge — Model Freedom + Multi-Model Ensemble

Status: implemented foundation on `chief/android-ps5-web-runtime`; exact-head CI/device verification remains separate from implementation status.

Date: 2026-09-04

## Product rule

Author's Forge must maximize AI choice without making quality dependent on price.

A free, local, subscription-covered, affordable, metered, premium, or router-managed model may participate when it satisfies the owner's current policy and task requirements. No model earns permission to bypass canon, author voice, continuity, the Editing Office, proposal review, or stale-write protection because it costs more.

Likewise, an inexpensive model is not rejected merely because it is inexpensive. Forge evaluates its actual output.

## Current supported provider families

The shared Forge AI boundary currently supports:

- OmniRoute;
- 9Router;
- K.I.N.G.S.;
- Ollama;
- Groq;
- Mistral;
- Gemini;
- Anthropic;
- OpenRouter;
- OpenAI.

Router-backed providers can expose many downstream models without Forge hard-coding every model name. The Model Freedom console can also load a provider's live model catalog where the provider exposes one, and the owner can add additional model IDs without replacing the existing configured pool.

### Current ecosystem observations

These numbers are external service state, not Forge guarantees, and can change:

- OpenRouter's public pricing page observed on 2026-09-04 advertises 400+ models and 70+ providers on paid plans, plus 25+ free models on its Free plan: https://openrouter.ai/pricing
- OpenRouter's `openrouter/free` router observed on 2026-09-04 describes a zero-token-price route over currently available free models: https://openrouter.ai/openrouter/free/providers
- LiteLLM documents a unified interface to 100+ LLMs, retry/fallback routing, spend tracking and budgets: https://docs.litellm.ai/

Forge should continue favoring open provider boundaries and router compatibility over vendor lock-in.

## Model Freedom settings

Durable owner settings live in `.forge-data/ai-model-options.json` and are applied across Forge runtimes.

Current controls:

- additional provider/model IDs;
- optional owner-declared billing classification;
- exact `provider/model` no-spend trust entries;
- coordinated ensemble enabled/disabled;
- maximum parallel workers: 1–8;
- minimum quality/judge score: 70–100;
- optional whole-ensemble estimated dollar ceiling.

These augment existing provider configuration and model pinning. They do not replace it.

## Spend safety

Forge preserves three different cost controls because they solve different problems.

### 1. Owner spend policy

- `no-paid-tokens`
- `budgeted`
- `unrestricted`

`no-paid-tokens` remains the strictest setting.

### 2. Per-request estimated cost ceiling

The existing AI owner control can limit an individual paid request when budgeted routing is active.

### 3. Whole-ensemble estimated cost ceiling

A multi-model request can perform more than one provider call. An optional ensemble ceiling therefore reserves budget across the worst-case planned call count:

- parallel workers;
- one synthesis call when multiple real workers survive;
- continuity judge;
- voice judge.

The total ceiling is conservatively divided into a per-call ceiling. If the general owner mode is unrestricted but the owner explicitly sets an ensemble dollar ceiling, Forge uses budgeted eligibility inside that ensemble so the ceiling remains meaningful. `no-paid-tokens` is never relaxed by an ensemble dollar ceiling.

Free/local/no-spend models remain eligible under the same quality requirements.

## No-spend trust is explicit

Router billing can change and a remote route's model name alone does not prove that it will consume no paid credits.

Therefore:

- Ollama and K.I.N.G.S. retain their known-local defaults;
- a remote model may be labelled by the owner for information;
- declaring a remote model `free`, `subscription`, or `local` does **not** by itself make it eligible under No Paid Tokens;
- the exact `provider/model` must also be placed in the owner's no-spend trust list before Forge treats that remote override as a no-spend resource.

The Studio warns the owner that this is their explicit declaration and should be used only when the provider account confirms the route is no-spend.

This protects model choice without pretending Forge can know external account billing that it cannot observe.

## Multi-model writing pipeline

The ensemble is code-orchestrated, not an uncontrolled group chat.

Current pipeline:

1. **Project Brain assembly** — existing `AiWritingStudioService` assembles canon, characters, relationships, timeline, research, author voice, unresolved threads, Chapter Card and Scene Card context.
2. **Eligible-model planning** — `AiModelBroker` + `AiFederation` filter by health, spend policy, quota reserve, task capabilities, configured provider order and owner choices.
3. **Diverse fan-out** — Forge selects different providers first, then additional models as capacity remains.
4. **Parallel candidate generation** — independent candidates run concurrently with `Promise.allSettled`.
5. **Provider quality floor** — every candidate has already passed the shared provider-neutral Forge quality contract; the ensemble then applies the owner-selected minimum quality score.
6. **Truthful diversity check** — Forge deduplicates by the **actual** provider/model that completed each request. If several assigned workers all fail over to the same real model, Forge reports one model and `single` mode. It never fabricates a multi-model team.
7. **Synthesis** — only when more than one distinct real model survives. The synthesis prompt explicitly states that Project Brain, canon and author constraints outrank model consensus.
8. **Continuity anti-drift judge** — a separate continuity request checks canon, chronology, relationships, character state, POV/tense and author intent.
9. **Voice anti-drift judge** — a separate voice-preservation request checks narrative distance, cadence, emotional meaning, dialogue/description balance and generic-model-style drift.
10. **Editing Office** — the deterministic ten-role editor runs developmental, continuity, line, copy, proofreading, structural, dialogue, pacing, character and genre analysis.
11. **Fail closed** — judge execution/parsing failures, quality-floor failures, or blocking Editing Office findings prevent the candidate from entering the manuscript proposal workflow.
12. **Durable pending proposal** — a passing result is handed back through the existing AI Writing Studio and shared proposal ledger.
13. **Existing anti-drift evidence** — the canonical writing path attaches Author Voice drift measurements and character-continuity profile hashes where available.
14. **Author review** — AI output remains separate from manuscript state.
15. **Separate Apply** — only an accepted proposal can be applied, and Apply rechecks the scene's SHA-256 revision plus character-continuity evidence before mutation.

## Why code-controlled orchestration

Current OpenAI Agents SDK orchestration guidance describes running independent agents in parallel as useful for speed and evaluator loops as useful when a generated result must meet explicit criteria. It also notes that code orchestration provides more deterministic control over speed, cost and performance: https://openai.github.io/openai-agents-python/multi_agent/

That matches Forge's author-governance requirements better than allowing a free-form agent conversation to decide its own quality rules.

## Why not naive model voting

Creative work has no guarantee that majority agreement equals canon fidelity or author voice. Three models can agree on the same plausible but false invention.

Forge therefore treats model consensus as evidence, never authority. Canon and author-approved project truth outrank voting. Synthesis receives candidates, but anti-drift judges and the Editing Office evaluate the synthesized result independently.

## Existing Forge advantages reused by the ensemble

The ensemble deliberately reuses instead of replacing:

- Project Brain retrieval;
- authoritative/working memory boundaries;
- Author Voice Memory;
- character continuity evidence;
- Chapter Cards;
- Scene Cards;
- provider quality contract;
- spend/quota routing;
- proposal ledger;
- author review;
- stale scene SHA protection;
- Editing Office;
- provenance architecture.

There is only one manuscript authority path.

## Studio UX

`public/forge-model-freedom.js` adds:

### Provider & Settings

- Model Freedom panel;
- model provider selector;
- live provider catalog loading;
- custom model ID entry;
- billing classification;
- explicit no-spend trust control;
- 1–8 worker ensemble width;
- quality floor;
- optional total ensemble budget;
- current runtime resource visibility.

### Writing Desk

`Run Multi-Model Forge` submits the selected book/chapter/scene and normal Forge writing task through `/api/projects/:projectId/ai/ensemble-writing`.

The result surface shows:

- single vs parallel truth;
- actual participating providers/models;
- quality scores;
- fallback disclosure;
- synthesis provider/model;
- continuity judge score;
- voice judge score;
- Editing Office finding/blocking counts;
- spend guard information;
- pending proposal ID.

It does not auto-apply.

## Next advanced improvement: learned best-value routing

The next high-leverage evolution should measure real Forge outcomes per provider/model/task rather than assuming a static global ranking.

Recommended durable telemetry:

- provider/model;
- task;
- billing class;
- latency;
- provider quality score;
- continuity judge score;
- voice judge score;
- Editing Office blocking count;
- author accepted/rejected proposal outcome;
- stale proposal outcome;
- estimated/actual token usage and cost when available.

After a statistically meaningful number of observations, Forge can recommend or softly prefer models that have demonstrated the best author-specific quality/cost/latency tradeoff. Automatic preference must require a minimum evidence count and must remain subordinate to explicit owner pins and spend policy.

This creates a stronger goal than "use the biggest model": **use the least expensive eligible model or model team that repeatedly clears this author's actual quality bar.**

## Future provider expansion

Do not solve provider diversity by endlessly adding one hard-coded vendor switch at a time.

The preferred architecture is:

1. preserve native adapters where a provider has meaningfully different APIs;
2. preserve OmniRoute, 9Router and OpenRouter broad model access;
3. add a governed generic OpenAI-compatible gateway registry after Forge has a proper secrets/key storage boundary;
4. support external gateways such as LiteLLM through that registry without requiring a Forge code release for each downstream provider;
5. add owner-controlled provider policy constraints such as privacy/retention, latency, region, zero-data-retention and price priority where the upstream provider exposes trustworthy metadata.

Never persist raw provider API keys in ordinary project JSON.

## Verification truth

Implementation, test coverage, CI execution, signed release, and device verification are separate states.

This document records the architecture and code implemented on the branch. It does not claim exact-head CI or device verification while the repository's GitHub runner is failing before recording executable job steps.
