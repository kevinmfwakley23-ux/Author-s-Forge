# K.I.N.G.S. Author's Forge — Modular Office Brain and AI Routing Contract

**Status: mandatory owner-approved engineering contract**

## Product shape

K.I.N.G.S. Author's Forge is one product with a permanent **Main Forge / Studio** and optional specialist **office add-ons**. An author may run only the Main Forge or enable any supported office add-on they want.

Current office runtime ids are:

- `studio` — Main Forge / Studio;
- `journal` — Guided Journal Office;
- `workbooks` — Educational Workbook Office;
- `specialized` — Specialized Creation Office;
- `nft` — NFT Creation Office.

Future offices may be added, but they must follow this contract before being presented as operational.

## Shared DNA, independent brains

The offices share reusable K.I.N.G.S. Brain Core **code, contracts, safety rules, project-state formats and provider adapters** so fixes can propagate without copy/paste drift.

They do **not** share one live AI brain instance.

Every enabled office gets its own runtime AI boundary with independent:

- model broker instance;
- configured model/resource collection;
- provider preference order;
- routing health and cooldown state;
- token/quota accounting;
- cost/spend policy;
- semantic/provider cache state held by that office process;
- provider credentials/endpoints;
- optional K.I.N.G.S. Responses endpoint;
- failure/failover telemetry.

Project/canon state may still be shared intentionally through the Forge project store so an author does not have to recreate their book, characters, voice, research or approved canon in every add-on. Sharing authoritative project knowledge is different from sharing a provider quota or live routing brain.

## Office-scoped provider configuration

The modular launcher translates office-prefixed settings into the canonical provider variables inside that office process only.

Pattern:

```text
FORGE_<OFFICE>_<NORMAL_PROVIDER_VARIABLE>
```

Examples:

```text
FORGE_STUDIO_OMNIROUTE_BASE_URL=...
FORGE_STUDIO_OMNIROUTE_API_KEY=...
FORGE_STUDIO_OMNIROUTE_MODELS=...
FORGE_STUDIO_OMNIROUTE_TOKEN_QUOTA=...

FORGE_JOURNAL_OMNIROUTE_BASE_URL=...
FORGE_JOURNAL_OMNIROUTE_API_KEY=...
FORGE_JOURNAL_OMNIROUTE_MODELS=...
FORGE_JOURNAL_OMNIROUTE_TOKEN_QUOTA=...

FORGE_WORKBOOKS_OPENAI_API_KEY=...
FORGE_SPECIALIZED_GEMINI_API_KEY=...
FORGE_NFT_OPENROUTER_API_KEY=...
```

Each office may independently configure the full supported provider family:

- OmniRoute-compatible routing;
- 9Router-compatible routing;
- OpenAI;
- Groq;
- Mistral;
- Gemini;
- Anthropic;
- OpenRouter;
- Ollama/local models;
- optional K.I.N.G.S. Responses-compatible endpoint.

The same pattern applies to `*_MODELS`, `*_MODEL`, provider billing metadata, provider token quota fields and Forge `AI_*` routing/spend policy variables. For example:

```text
FORGE_JOURNAL_AI_PROVIDER_ORDER=omniroute,9router,openai,groq,mistral,gemini,anthropic,openrouter,ollama,kings
FORGE_JOURNAL_AI_ROUTING_MODE=quality
FORGE_JOURNAL_AI_SPEND_POLICY=no-paid-tokens
```

## Token-limit truth boundary

Separate Forge office accounting is real and required, but it cannot manufacture separate upstream provider allowances.

If Studio and Guided Journal both use the **same provider credential/account**, the provider may still enforce one shared account quota even though Forge keeps separate local routing and usage ledgers.

To obtain genuinely separate provider-side allowances, the provider must supply separate credentials/accounts/projects/quota allocations for those offices. Forge supports that architecture by allowing different credentials for every office. It must never tell an author that duplicating one API key creates extra provider tokens.

## No credential leakage between offices

When using `scripts/start-forge-modular.js`, global AI/provider variables are removed from office children by default. Credentials prefixed for one office are also removed from every other office child environment.

This prevents a journal process from silently consuming Studio's OpenAI key or quota, for example.

`FORGE_ALLOW_SHARED_AI_FALLBACK=true` is an explicit migration-only compatibility escape hatch. It is not the target architecture and must not be enabled silently.

## Add-on selection

The legacy unified launcher remains available during migration and regression testing. The modular launcher is the architecture path for private testing and future product packaging.

Run Main Forge only (the normal modular default):

```bash
npm run forge:modular
```

The explicit core-only alias remains available:

```bash
npm run forge:modular:core
```

Choose specific add-ons:

```bash
node scripts/start-forge-modular.js --offices=journal,specialized
```

Or set:

```text
FORGE_ENABLED_OFFICES=journal,workbooks,specialized
```

Run Main Forge plus every current add-on deliberately:

```bash
npm run forge:modular:all
```

Private acceptance intentionally launches every office so the owner can test the complete product:

```bash
npm run forge:private-test
npm run forge:private-test:android
```

For normal trusted-LAN modular operation, `npm run forge:modular:android` still respects the opt-in add-on configuration instead of silently enabling every office.

The Main Forge is always included by the modular launcher; specialist offices are optional add-ons.

## Required execution path inside each office

```text
OFFICE WORKFLOW
      |
      v
SHARED AUTHORITATIVE PROJECT/CANON STATE (only what the workflow is allowed to use)
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

## Non-negotiable rules

1. **One product, modular offices.** Main Forge is permanent; specialist offices are optional add-ons.
2. **Independent live brains.** Each enabled office owns a separate provider/model/routing/quota runtime instance.
3. **Shared knowledge only when intentional.** Project/canon/voice state may be shared to preserve continuity, but provider secrets and quota pools are not implicitly shared.
4. **No fabricated output.** If an office has no eligible real provider/model, it fails clearly.
5. **No silent provider borrowing.** An office may not use another office's credential because its own provider is unavailable.
6. **Separate quota accounting.** Every office tracks its own observed/estimated usage and quota reserve.
7. **Provider-side reality wins.** One upstream account remains one upstream account unless the provider actually supplies independent allowance.
8. **Full provider choice.** Every office may expose OmniRoute, 9Router, OpenAI, Groq, Mistral, Gemini, Anthropic, OpenRouter, Ollama and K.I.N.G.S. Responses when genuinely configured.
9. **Author authority remains separate.** A model route never grants permission to silently mutate author-owned canon/manuscript/state.
10. **No completion by configuration alone.** Each office needs end-to-end proof through its actual UI/workflow and at least one real configured provider path before that path is called live-operational.

## Private-testing release policy

Until owner acceptance is complete:

- no Play Store production claim;
- no public release claim;
- private Linux/Chromebook bundles and debug/development-signed Android APKs are acceptable test artifacts;
- the Android Tauri package is currently a native gateway/client for a real Forge runtime, not proof of a self-contained Android backend;
- release status must distinguish source implementation, automated verification, live-provider certification, device acceptance and production signing.

The public-release gate is owner acceptance that the intended Forge workflows can actually be completed on the target private-test builds, followed by production Android signing/store work and final exact-head verification.
