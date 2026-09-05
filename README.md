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

### Forge owns its own full brain

K.I.N.G.S. Author's Forge is a standalone intelligent application. Normal Forge AI work must **not require the separate K.I.N.G.S. AI application to be online**.

Forge owns its own full application brain using the same K.I.N.G.S. Brain Core DNA:

- Project Brain and authoritative project state;
- salient context assembly and token optimization;
- provider/model registry and model broker;
- OmniRoute integration;
- 9Router integration;
- additional authorized direct providers;
- provider/model health, cooldown, retry and failover;
- quota, cost, quality, latency and reliability policy;
- governed research and provenance;
- tool authorization;
- verification, evidence, recovery and durable state;
- Forge-specific agents, prompts, schemas and workflows.

Every Forge office uses the same Forge Brain/trunk. Individual offices may specialize prompts and workflows, but they must not create competing provider routers or isolated brains. See [`docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md`](docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md).

### Shared Brain Core, independent applications

K.I.N.G.S. AI, K.I.N.G.S. Author's Forge, and K.I.N.G.S. Collector's Kingdom should share reusable K.I.N.G.S. Brain Core modules/contracts where practical so fixes and improvements propagate without copy/paste drift.

They remain independent applications with their own runtime state, domain memory, provider configuration, quotas, policies and specialized workers.

### Provider policy

Forge should route work to the strongest appropriate configured resource under owner policy. OmniRoute and 9Router are first-class routing options, followed by other authorized configured providers according to capability, quality, availability, cost, quota, reliability and latency.

Local Ollama models are supported as **last-resort/offline/local fallback**. Ollama is not the architectural center of Forge and an Ollama-only test must not redefine normal Forge production architecture.

The current Forge trunk supports configured provider families including OmniRoute-compatible gateways, 9Router-compatible gateways, OpenAI, Groq, Mistral, Gemini, Anthropic, OpenRouter, local Ollama models, and an optional K.I.N.G.S. Responses-compatible endpoint. A provider name existing in code is not proof that it is configured or live.

### Relationship to K.I.N.G.S. AI

The separate K.I.N.G.S. AI application is the master general-purpose engineering/building system. Forge may optionally use K.I.N.G.S. AI for software-engineering missions, cross-app orchestration, or explicitly configured model access.

That connection is **optional support**, not a required dependency for ordinary Forge writing, editing, research, planning, image, production or publishing AI workloads.

### No fake completion

Architecture documentation is not implementation proof. The permanent engineering sequence is:

**Requirement → existing-code audit → correct integration point → build → integrate → unit test → integration test → end-to-end test → real-world proof → complete.**

A file existing, a successful compile, or a printed `SUCCESS` line does not by itself make a feature complete.

## Chief Engineering Standard

**Real working code only.** Production behavior must never present fake AI responses, canned provider answers, fabricated research, simulated success states, placeholder buttons, fake persistence, fake downloads, fabricated image assets, swallowed provider failures, or silent author-state mutation as finished capability.

Mocks and test doubles belong only in clearly identified tests. Missing credentials/providers must fail honestly without destroying the author's work.

## Current implementation truth

Forge already contains substantial independent-brain infrastructure. Its shared AI trunk connects Project Brain/context optimization to the Forge Core Model Broker and real configured providers with health, cooldown, shared quota, usage accounting, timeout-safe transport and failover. This architecture should be extended rather than replaced.

The application also contains durable manuscript/canon/character state, author-controlled AI proposals, editing, research, production, image/cover work, publishing preparation, recovery, specialized creation offices, guided journals, educational workbooks and responsive mobile/PWA surfaces. Historical verified detail belongs in build history and current CI/PR evidence rather than being duplicated as a stale wall in this README.

## Start K.I.N.G.S. Author's Forge

Requirements:

- Node.js **24 LTS** (`.nvmrc` is authoritative);
- npm;
- Chromium/WebKit only for the applicable browser acceptance suites;
- real provider credentials/endpoints only for capabilities you intend to use.

```bash
nvm install 24
nvm use 24
npm ci
npm run forge
```

Main workplaces:

| Workplace | Default local URL |
| --- | --- |
| Main Studio | `http://127.0.0.1:4173` |
| Guided Journal | `http://127.0.0.1:4273` |
| Educational Workbooks | `http://127.0.0.1:4373` |
| Specialized Creation | `http://127.0.0.1:4473` |

For trusted LAN/Android browser access:

```bash
npm run forge:android
```

Android has two real delivery lanes: the responsive installable web/PWA application and the Tauri 2 native APK gateway. The native lane is built by [`.github/workflows/android-native.yml`](.github/workflows/android-native.yml), which compiles an installable APK, verifies it with Android `apksigner`, writes SHA-256 checksums, and uploads the result as a GitHub Actions artifact. The stable Android application identifier remains `com.authorsforge.app` so existing sideloaded installs keep the same application identity. The currently verified APK lane is debug/development signed; production Play Store signing still requires a protected release keystore and release-specific verification. See [`docs/ANDROID_NATIVE_PACKAGE.md`](docs/ANDROID_NATIVE_PACKAGE.md).

## AI routing configuration

Forge discovers only genuinely configured providers. Common routing variables include:

```bash
OMNIROUTE_BASE_URL="..."
OMNIROUTE_MODELS="..."

ROUTER9_BASE_URL="..."
ROUTER9_MODELS="..."

# Optional additional providers
OPENAI_API_KEY="..."
OPENAI_MODELS="..."
GROQ_API_KEY="..."
MISTRAL_API_KEY="..."
GEMINI_API_KEY="..."
ANTHROPIC_API_KEY="..."
OPENROUTER_API_KEY="..."

# Last-resort/local fallback
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODELS="..."

# Soft owner/provider preference; hard capability and safety rules still win.
AI_PROVIDER_ORDER="omniroute,9router,openai,groq,mistral,gemini,anthropic,openrouter,ollama"
```

Do not commit credentials.

## Verification

Core gates:

```bash
npm run build
npm test
npm run test:ai:hermetic
npm run verify
```

Live provider certification is separate from hermetic routing tests:

```bash
npm run test:ai:live:omniroute
npm run test:ai:live:9router
npm run test:ai:live:ollama
npm run test:ai:live:kings
```

A live-provider test only proves the provider/path it actually executed.

## Canonical references

- [`docs/KINGS_FAMILY_ARCHITECTURE_GOSPEL.md`](docs/KINGS_FAMILY_ARCHITECTURE_GOSPEL.md) — expanded locked family architecture.
- [`docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md`](docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md) — mandatory Forge Brain/model routing contract.
- [`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md`](AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md) — product contract.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architecture overview.
- [`docs/AUTHORS_FORGE_CANONICAL_ARCHITECTURE.md`](docs/AUTHORS_FORGE_CANONICAL_ARCHITECTURE.md) — architecture detail.
- [`docs/BUILD_HISTORY.md`](docs/BUILD_HISTORY.md) — historical verified capability record.

## Definition of complete

K.I.N.G.S. Author's Forge is complete only when a real author can reliably carry a project through the intended author journey using real durable state, real provider boundaries, explicit author authority, truthful failures, verified production artifacts and the strongest applicable desktop/mobile acceptance paths.

Until that standard is met, engineering continues.
