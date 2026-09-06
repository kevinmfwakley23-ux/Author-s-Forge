# K.I.N.G.S. Author's Forge

**KNOWLEDGE • INVESTIGATION • NARRATIVE • GENERATION • SYSTEM**

K.I.N.G.S. Author's Forge is a local-first AI authoring and publishing workplace for taking a project from idea → structured book → canon and characters → writing and editing → illustration and cover → production → market research and promotion → delivery and recovery.

> **Canonical architecture status:** The architecture rules in this README are owner-approved and locked. If an older note, test, branch, environment example, or temporary implementation conflicts with them, this README wins unless the owner explicitly changes the architecture.

The product contract remains [`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md`](AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md). Detailed build history remains in [`docs/BUILD_HISTORY.md`](docs/BUILD_HISTORY.md).

## Architecture Gospel — LOCKED

### K.I.N.G.S. is the brand

The full product identity is **K.I.N.G.S. AUTHOR'S FORGE**. "Author's Forge" and "Forge" are acceptable conversational short names, but K.I.N.G.S. must remain visible in primary UI identity and installable-app identity.

K.I.N.G.S. always means:

**KNOWLEDGE • INVESTIGATION • NARRATIVE • GENERATION • SYSTEM**

The acronym must not be redefined by an individual K.I.N.G.S. application.

### Forge is one product with optional specialist offices

The permanent product is the **Main Forge / Studio**. Specialist offices are optional add-ons that an author may enable or leave disabled.

Current office runtimes are:

| Office | Runtime id | Default local URL |
| --- | --- | --- |
| Main Forge / Studio | `studio` | `http://127.0.0.1:4173` |
| Guided Journal | `journal` | `http://127.0.0.1:4273` |
| Educational Workbooks | `workbooks` | `http://127.0.0.1:4373` |
| Specialized Creation | `specialized` | `http://127.0.0.1:4473` |
| NFT Creation | `nft` | `http://127.0.0.1:4573` |

The offices share K.I.N.G.S. Brain Core code, safety contracts, provider adapters and authorized project/canon formats so improvements can propagate. They do **not** share one live AI brain instance in the modular architecture.

Each enabled office owns an independent runtime brain with its own model broker, provider/model collection, routing health/cooldowns, quota and token accounting, spend policy, provider credentials/endpoints and optional K.I.N.G.S. Responses endpoint. See [`docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md`](docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md).

Authoritative project/canon/voice/research state may still be shared intentionally across offices so continuity is preserved. Shared project knowledge is not the same thing as shared provider credentials or quota pools.

### Forge owns its own intelligence

K.I.N.G.S. Author's Forge is a standalone intelligent application. Normal Forge AI work must **not require the separate K.I.N.G.S. AI application to be online**.

The Forge family supports:

- Project Brain and authoritative project state;
- salient context assembly and token optimization;
- provider/model registries and model brokers;
- OmniRoute integration;
- 9Router integration;
- additional authorized direct providers;
- provider/model health, cooldown, retry and failover;
- quota, cost, quality, latency and reliability policy;
- governed research and provenance;
- tool authorization;
- verification, evidence, recovery and durable state;
- Forge-specific agents, prompts, schemas and workflows.

### Shared Brain Core, independent applications

K.I.N.G.S. AI, K.I.N.G.S. Author's Forge, and K.I.N.G.S. Collector's Kingdom should share reusable K.I.N.G.S. Brain Core modules/contracts where practical so fixes and improvements propagate without copy/paste drift.

They remain independent applications with their own runtime state, domain memory, provider configuration, quotas, policies and specialized workers.

### Provider policy

Every Forge office may independently route work to its strongest appropriate configured resource under owner policy. OmniRoute and 9Router are first-class routing options, followed by other authorized configured providers according to capability, quality, availability, cost, quota, reliability and latency.

Supported provider families include OmniRoute-compatible gateways, 9Router-compatible gateways, OpenAI, Groq, Mistral, Gemini, Anthropic, OpenRouter, local Ollama models and an optional K.I.N.G.S. Responses-compatible endpoint. A provider name existing in code is not proof that it is configured or live.

Local Ollama models remain a last-resort/offline/local fallback rather than the architectural center of Forge.

### Token-limit truth

Forge can and should keep independent broker state and token/quota accounting for every office. That prevents one office from silently consuming another office's configured Forge allowance.

However, duplicating one upstream API key does **not** create extra provider-side tokens. To obtain genuinely separate upstream allowances, the provider must issue separate credentials/accounts/projects/quota allocations. The modular Forge architecture supports that by allowing different credentials for each office.

### Relationship to K.I.N.G.S. AI

The separate K.I.N.G.S. AI application is the master general-purpose engineering/building system. Forge may optionally use K.I.N.G.S. AI for software-engineering missions, cross-app orchestration or explicitly configured model access.

That connection is optional support, not a required dependency for ordinary Forge writing, editing, research, planning, image, production or publishing AI workloads.

### No fake completion

Architecture documentation is not implementation proof. The permanent engineering sequence is:

**Requirement → existing-code audit → correct integration point → build → integrate → unit test → integration test → end-to-end test → real-world proof → complete.**

A file existing, a successful compile, or a printed `SUCCESS` line does not by itself make a feature complete.

## Chief Engineering Standard

**Real working code only.** Production behavior must never present fake AI responses, canned provider answers, fabricated research, simulated success states, placeholder buttons, fake persistence, fake downloads, fabricated image assets, swallowed provider failures or silent author-state mutation as finished capability.

Mocks and test doubles belong only in clearly identified tests. Missing credentials/providers must fail honestly without destroying the author's work.

## Current implementation truth

Forge contains substantial authoring infrastructure: durable manuscript/canon/character state, Project Brain/context services, author-controlled AI proposals, editing, research, production, image/cover work, publishing preparation, recovery, specialized creation, guided journals, educational workbooks, NFT creation and responsive mobile/PWA surfaces.

The modular office-brain boundary is being validated as the private-testing architecture. Historical verified detail belongs in build history and current CI/PR evidence rather than being duplicated as a stale completion wall.

## Private testing first — no public release yet

Before Play Store/public release, use private test artifacts and prove the intended Forge workflows on real devices.

### Chromebook / Linux private runtime

Requirements:

- Node.js **24 LTS** (`.nvmrc` is authoritative);
- npm;
- Chromium/WebKit only when running browser verification locally;
- real provider credentials/endpoints only for capabilities you intend to use.

```bash
nvm install 24
nvm use 24
npm ci
npm run forge:private-test
```

Run only the Main Forge:

```bash
npm run forge:modular:core
```

Choose add-ons explicitly:

```bash
node scripts/start-forge-modular.js --offices=journal,specialized
```

### Android private testing

The current native Android lane is a Tauri 2 APK gateway/client for a real Forge runtime. It is suitable for private UI/workflow testing but is **not** yet proof of a self-contained Android backend.

For trusted-LAN testing of the modular runtime:

```bash
npm run forge:private-test:android
```

The launcher prints the protected Main Studio bootstrap URL. All selected office proxies share that generated access token/cookie, while the actual office processes remain isolated on loopback.

The native APK build is defined by [`.github/workflows/android-native.yml`](.github/workflows/android-native.yml). It compiles an installable APK, verifies it with Android `apksigner`, writes SHA-256 checksums and uploads it as a GitHub Actions artifact. The stable Android application identifier remains `com.authorsforge.app`.

The current APK lane is debug/development signed. Production Play Store signing remains a later release gate after owner acceptance.

## Office-scoped AI configuration

The modular launcher uses this pattern:

```text
FORGE_<OFFICE>_<NORMAL_PROVIDER_VARIABLE>
```

Examples:

```bash
FORGE_STUDIO_OMNIROUTE_BASE_URL="..."
FORGE_STUDIO_OMNIROUTE_API_KEY="..."
FORGE_STUDIO_OMNIROUTE_MODELS="..."
FORGE_STUDIO_OMNIROUTE_TOKEN_QUOTA="..."

FORGE_JOURNAL_OMNIROUTE_BASE_URL="..."
FORGE_JOURNAL_OMNIROUTE_API_KEY="..."
FORGE_JOURNAL_OMNIROUTE_MODELS="..."
FORGE_JOURNAL_OMNIROUTE_TOKEN_QUOTA="..."

FORGE_WORKBOOKS_OPENAI_API_KEY="..."
FORGE_SPECIALIZED_GEMINI_API_KEY="..."
FORGE_NFT_OPENROUTER_API_KEY="..."
```

The same office prefix works with the full provider family and Forge `AI_*` routing variables:

```bash
FORGE_SPECIALIZED_AI_PROVIDER_ORDER="omniroute,9router,openai,groq,mistral,gemini,anthropic,openrouter,ollama,kings"
FORGE_SPECIALIZED_AI_ROUTING_MODE="quality"
```

Global provider credentials are not inherited by modular office children by default. `FORGE_ALLOW_SHARED_AI_FALLBACK=true` exists only as an explicit migration compatibility option.

Do not commit credentials.

## Verification

Core gates:

```bash
npm run build
npm test
npm run test:ai:hermetic
npm run verify
```

Live provider certification remains separate from hermetic routing tests:

```bash
npm run test:ai:live:omniroute
npm run test:ai:live:9router
npm run test:ai:live:ollama
npm run test:ai:live:kings
```

A live-provider test only proves the provider/path it actually executed.

## Canonical references

- [`docs/KINGS_FAMILY_ARCHITECTURE_GOSPEL.md`](docs/KINGS_FAMILY_ARCHITECTURE_GOSPEL.md) — expanded locked family architecture.
- [`docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md`](docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md) — mandatory modular Forge office-brain/model-routing contract.
- [`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md`](AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md) — product contract.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architecture overview.
- [`docs/AUTHORS_FORGE_CANONICAL_ARCHITECTURE.md`](docs/AUTHORS_FORGE_CANONICAL_ARCHITECTURE.md) — architecture detail.
- [`docs/BUILD_HISTORY.md`](docs/BUILD_HISTORY.md) — historical verified capability record.

## Definition of complete

K.I.N.G.S. Author's Forge is complete only when a real author can reliably carry a project through the intended author journey using real durable state, real provider boundaries, explicit author authority, truthful failures, verified production artifacts and the strongest applicable desktop/mobile acceptance paths.

For public Android release, that additionally requires owner acceptance of the private-test build, production signing/store configuration and final exact-head verification.

Until that standard is met, engineering continues.
