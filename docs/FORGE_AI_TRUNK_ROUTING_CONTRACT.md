# K.I.N.G.S. Author's Forge — Office Brain and AI Routing Contract

**Status: mandatory owner-approved engineering contract**

## Product shape

K.I.N.G.S. Author's Forge ships as **one complete product with every current side office attached and available by default**.

Current runtime offices:

- `studio` — Main Forge / Studio;
- `journal` — Guided Journal Office;
- `workbooks` — Educational Workbook Office;
- `specialized` — Specialized Creation Office;
- `nft` — NFT Creation Office.

These are not optional product add-ons in the shipped Forge. Engineering-only subset launch controls may remain for diagnostics, migration and targeted tests, but normal product startup includes the complete office set.

Future offices may be added, but they must satisfy this contract before being included in the shipped product.

The same office-brain contract applies independently on every supported work environment, including Chromebook/Linux and standalone Android phone/tablet. See `FORGE_PLATFORM_RUNTIME_GOSPEL.md` and `STANDALONE_PLATFORM_CONTRACT.md`.

## One Forge, separate live brains

The offices share reusable K.I.N.G.S. Brain Core code, contracts, safety rules, project-state formats, approved project/canon/voice knowledge and provider adapters so fixes propagate without copy/paste drift.

They **do not share one live AI brain instance**.

Every attached office owns an independent runtime AI boundary with its own:

- model broker instance;
- configured model/resource collection;
- provider preference order;
- routing health and cooldown state;
- token/quota accounting;
- cost/spend policy;
- provider/cache state held by that office runtime;
- provider credentials/endpoints;
- optional K.I.N.G.S. Responses endpoint;
- failure/failover telemetry.

Shared author-approved project/canon/voice state is allowed so the author does not have to recreate a book, characters, research or canon in each office. Shared authoritative knowledge is not the same thing as a shared provider credential, live broker or quota ledger.

## Office-scoped provider configuration

### Chromebook/Linux

The complete Forge launcher starts every office, but each office receives only its own AI/provider configuration.

Pattern:

```text
FORGE_<OFFICE>_<NORMAL_PROVIDER_VARIABLE>
```

Examples:

```text
FORGE_STUDIO_OMNIROUTE_BASE_URL=...
FORGE_STUDIO_OMNIROUTE_API_KEY=...
FORGE_STUDIO_OPENAI_API_KEY=...

FORGE_JOURNAL_OMNIROUTE_BASE_URL=...
FORGE_JOURNAL_OMNIROUTE_API_KEY=...
FORGE_JOURNAL_OPENAI_API_KEY=...

FORGE_WORKBOOKS_GROQ_API_KEY=...
FORGE_SPECIALIZED_GEMINI_API_KEY=...
FORGE_NFT_OPENROUTER_API_KEY=...
```

Global AI/provider variables are removed from office children by default. Credentials scoped to one office are not exposed to another office.

`FORGE_ALLOW_SHARED_AI_FALLBACK=true` is a migration-only compatibility escape hatch and must never be enabled silently.

### Android

Standalone Android must provide the same logical office isolation using device-local native configuration and secure credential storage. It must not depend on a Chromebook, LAN Forge server, Termux or hosted Forge URL for normal operation.

The UI may expose friendly provider setup rather than environment-variable names, but the effective runtime rule is identical: provider credentials, routing state and usage state belong to one office scope.

## Supported provider families per office

Every office can independently configure:

- OmniRoute-compatible routing;
- 9Router-compatible routing;
- OpenAI;
- Groq;
- Mistral;
- Gemini;
- Anthropic;
- OpenRouter;
- Ollama/local models where the platform can genuinely run or reach them;
- optional K.I.N.G.S. Responses-compatible endpoint.

The same isolation applies to model lists, billing metadata, provider token quota fields and Forge routing/spend policy.

Example:

```text
FORGE_JOURNAL_AI_PROVIDER_ORDER=omniroute,9router,openai,groq,mistral,gemini,anthropic,openrouter,ollama,kings
FORGE_JOURNAL_AI_ROUTING_MODE=quality
FORGE_JOURNAL_AI_SPEND_POLICY=no-paid-tokens
```

## Token-limit truth boundary

Separate Forge office accounting is real and required, but it cannot manufacture separate upstream provider allowances.

If Studio and Guided Journal use the same provider credential/account, that provider may enforce one shared upstream allowance even though Forge keeps separate local routing and usage ledgers.

To obtain genuinely independent provider-side allowances, the provider must supply separate credentials/accounts/projects/quota allocations for those offices. Forge supports that architecture by allowing different credentials for every office and must never claim that duplicating one API key creates extra provider tokens.

## Normal startup behavior

Normal product startup launches the complete office set:

```bash
npm run forge:modular
```

This means:

```text
studio + journal + workbooks + specialized + nft
```

`--core`, `--offices=<list>` and `FORGE_ENABLED_OFFICES` may remain for engineering diagnostics and targeted testing. They do not define the shipped product shape.

## Required execution path inside each office

```text
OFFICE WORKFLOW
      |
      v
AUTHORIZED SHARED PROJECT / CANON / VOICE STATE
      |
      v
OFFICE-SPECIFIC PROJECT BRAIN QUERY / CONTEXT ASSEMBLY
      |
      v
CONTEXT / TOKEN OPTIMIZER
      |
      v
THAT OFFICE'S MODEL BROKER + QUOTA / HEALTH / COST STATE
      |
      v
REAL CONFIGURED PROVIDER + MODEL FOR THAT OFFICE
      |
      v
PROVIDER USAGE / FAILURE EVIDENCE
      |
      v
THAT OFFICE'S ROUTING TELEMETRY + AUTHOR-REVIEWABLE RESULT
```

The execution contract is platform-neutral. Linux may realize it through separate processes; Android may realize it through separate native runtime state and provider transport. The isolation requirements are the same.

## Non-negotiable rules

1. **One complete Forge.** Every current side office is attached and enabled by default.
2. **Independent live brains.** Each office owns a separate provider/model/routing/quota runtime instance on each platform.
3. **Shared knowledge only when intentional.** Project/canon/voice state may be shared; provider secrets and live quota pools are not implicitly shared.
4. **No fabricated output.** If an office has no eligible real provider/model, it fails clearly.
5. **No silent provider borrowing.** An office may not use another office's credential because its own provider is unavailable.
6. **Separate Forge-side quota accounting.** Every office tracks its own observed/estimated usage and reserve.
7. **Provider-side reality wins.** One upstream account remains one upstream account unless the provider actually supplies independent allowance.
8. **Full provider choice.** Every office may expose OmniRoute, 9Router, OpenAI, Groq, Mistral, Gemini, Anthropic, OpenRouter, Ollama and K.I.N.G.S. Responses when genuinely configured and technically available.
9. **Author authority remains separate.** A model route never grants permission to silently mutate author-owned canon/manuscript/state.
10. **No completion by configuration alone.** Each office needs end-to-end proof through its actual workflow and real configured provider path before being called live-operational.
11. **Platform independence is required.** Standalone Android may not rely on Chromebook/Linux or a hosted Forge runtime for normal operation.
12. **No gateway-as-standalone claim.** A native client that asks for another Forge server URL is not a complete Android Forge runtime.
13. **Future app separation stays possible.** An office may later become its own K.I.N.G.S.-branded app, but that must preserve its office brain boundary and not weaken the complete Forge product.

## Private-testing release policy

Until owner acceptance is complete:

- no Play Store production claim;
- no public release claim;
- private Chromebook/Linux bundles are acceptable only after exact-head verification;
- an Android APK is acceptable as a standalone Forge private-test build only after it owns its normal Forge runtime, local persistence and all attached office brains on-device;
- a gateway-style APK is migration infrastructure only and must not be labeled as satisfying standalone Android acceptance;
- release status must distinguish source implementation, automated verification, live-provider certification, device acceptance and production signing.

The public-release gate is owner acceptance that the intended Forge workflows can actually be completed independently on Chromebook/Linux and standalone Android private-test builds, followed by production signing/store work and final exact-head verification.
