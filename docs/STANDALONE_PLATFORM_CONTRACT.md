# K.I.N.G.S. Author's Forge — Standalone Platform Contract

**Status: mandatory owner/private-test release contract**

## Owner requirement

Author's Forge ships as **one complete Forge**. Main Forge / Studio, Guided Journal, Educational Workbooks, Specialized Creation and NFT Creation are attached and enabled by default. Engineering-only subset launch controls may remain for diagnostics and targeted tests, but they do not define the shipped product.

Chromebook/Linux and Android phone/tablet are separate, complete work environments. Android must not require a Chromebook, Linux container, Termux, LAN companion, hosted Forge gateway, or second machine to provide normal Forge functionality.

Internet access is still required when an author chooses an internet AI provider, GitHub, web research, cloud sync, or another online service. That is not a companion-runtime dependency: the application itself remains the authoritative runtime on the device.

## Platform instances

Every installation owns a unique platform instance. Platform instances do not silently share credentials, token accounting, runtime health, project files, or office process state.

Examples:

- Chromebook/Linux instance: local application runtime + local project/state storage + local office brains.
- Android instance: application-owned native runtime + application-owned project/state storage + local office brains.

Cross-device synchronization may be added, but it must be explicit, authenticated, conflict-aware, and optional. Sync must never be required for either installation to open, edit, save, route AI work, or use any Forge office.

## Office independence

The authoritative office registry is `config/forge-office-products.json`.

Every shipped office gets its **own live brain instance** with separate:

- model broker;
- discovered/configured model collection;
- provider order and routing policy;
- health/failure/cooldown state;
- Forge-side token and quota accounting;
- spend policy and budget state;
- credential namespace;
- provider endpoints;
- request/failure telemetry;
- optional K.I.N.G.S. Responses endpoint.

An office may independently configure:

- OmniRoute;
- 9Router;
- OpenAI;
- Groq;
- Mistral;
- Gemini;
- Anthropic;
- OpenRouter;
- Ollama-compatible endpoint;
- K.I.N.G.S. Responses.

The same provider may therefore be configured differently in Main Studio, Guided Journal, Workbooks, Specialized Creation, and NFT Creation.

### Provider quota truth

Forge-side separation prevents one office from accidentally consuming another office's **local** accounting pool. It cannot manufacture separate upstream allowance from one provider account.

Genuinely independent provider-side token pools require separate provider credentials/accounts/projects/quota allocations where the provider enforces quota at that level.

## Credential boundaries

### Chromebook/Linux

Office secrets use the existing `FORGE_<OFFICE>_<PROVIDER_SETTING>` boundary and must be loaded only into that office process. The modular launcher removes unrelated office secrets from every child process.

### Android

Android credentials are stored in an application-owned encrypted Stronghold vault namespace per office and provider. Plaintext API keys must not be stored in WebView localStorage, project JSON, logs, screenshots, crash reports, or the normal project/provider-metadata stores.

Canonical secret namespace:

```text
office/<office-id>/provider/<provider-id>/<credential-name>
```

The current native implementation uses the concrete API-key key shape:

```text
office/journal/provider/openai/api_key
office/studio/provider/omniroute/api_key
office/specialized/provider/kings/api_key
```

Provider metadata stores only non-secret configuration plus whether a secret exists. The encrypted vault is unlocked by an owner-supplied password and restored into the matching office broker. Device-level secure-storage acceptance remains required before standalone release acceptance.

## Android architecture

The old native APK gateway that asks for another Forge URL is **not** the standalone Android product.

The standalone Android product must contain:

1. the Forge UI/assets;
2. application-owned durable project storage;
3. application-owned office runtime state;
4. native/provider HTTP transport;
5. secure office-scoped credential storage;
6. office-scoped routing/broker/quota state;
7. the project/canon/governance services required by the UI;
8. import/export and backup operations permitted by Android;
9. all required office workflows installed in that package.

A remote Forge endpoint may later be offered as optional sync/remote-compute access. It cannot be a prerequisite for normal operation.

### Native foundations already implemented in source

The current Android migration branch contains real implementation for:

- five attached/enabled native office brains, each with a distinct runtime ID, broker ID and credential namespace;
- independent model collection, spend policy, provider health, cooldown and Forge-side token/quota state per office;
- native HTTP provider execution for OmniRoute, 9Router, OpenAI, Groq, Mistral, Gemini, Anthropic, OpenRouter, Ollama and K.I.N.G.S. Responses;
- durable device-local project create/update/get/list/delete operations using Tauri Store with explicit persistence;
- encrypted Stronghold API-key persistence with separate non-secret provider metadata;
- secure provider restore/removal into the correct office broker;
- a native workbench surface for device-local projects, encrypted provider setup/restore and real native office-brain text generation;
- a standalone source gate that refuses to label the package complete while the full-runtime readiness flag is false.

These are foundations, not full Forge parity. `STANDALONE_ANDROID_RUNTIME_READY` must remain false until the full workflow and device gates pass.

### Why Android cannot simply reuse the current desktop Node sidecar

Tauri's current Node-sidecar guidance is desktop-only. Therefore Android standalone must use an embedded mobile runtime strategy rather than pretending the desktop sidecar works on Android. The production choices are:

- native Rust/Kotlin implementation behind the same Forge contracts; or
- a separately validated embedded mobile JavaScript runtime that can execute the required Forge backend safely and passes the same acceptance suite.

The current branch is building the native Rust/Tauri path. No runtime strategy is accepted merely because it launches. Route/state/provider parity must be proven.

## Chromebook/Linux distribution

The private-test Linux download must be usable without requiring the owner to install Node manually. The release workflow packages the verified Forge build together with Node 24 runtimes for supported Linux architectures and a launch script.

Normal product startup launches **all five current offices**. Each office remains an independent process for AI brain/routing/quota isolation. Engineering-only subset flags may exist for diagnostics but are not the normal product path.

## Future separate K.I.N.G.S. apps

Every office is also an application-boundary candidate. The registry therefore includes stable office ids and candidate standalone application ids.

If an office is promoted into its own K.I.N.G.S.-branded application later:

- its office id does not change;
- its brain/routing/quota contract does not change;
- its project/canon interchange format does not change;
- its provider credentials remain private to that app installation unless the author explicitly imports/syncs them;
- shared core code is consumed as a package/library, not copied and allowed to drift.

This future option does not change the complete Author's Forge rule: the main Author's Forge product includes every current office.

## Release gates

### Chromebook/Linux full-private-test gate

Required before artifact is labeled full private test:

- exact-source build/tests/browser/mobile acceptance green;
- self-contained runtime included;
- normal launcher starts Main Studio + Guided Journal + Workbooks + Specialized Creation + NFT Creation;
- each office launches as an independent process;
- office credential isolation tests green;
- real project save/reload verified;
- at least one real configured provider path certified separately when credentials are available.

### Android full-private-test gate

Required before artifact is labeled full Android Forge:

- APK installs and signature verifies;
- app starts with no Forge URL/companion-runtime requirement;
- project create/save/close/restart/reload occurs on the Android-owned runtime;
- all five shipped offices open without a Chromebook/server companion;
- each office has a distinct live runtime/broker/quota state object;
- office secrets persist through secure device-local encrypted storage and do not leak into normal metadata/project storage;
- provider requests originate from the Android-owned runtime;
- required Forge API/workflow parity manifest is complete;
- Main Forge project/canon/manuscript/AI/editing/research/image/cover/production/publishing/recovery workflows have on-device implementations and acceptance tests;
- Guided Journal, Workbooks, Specialized Creation and NFT workflows have on-device implementations and acceptance tests;
- Android import/export/share and recovery/backup paths pass;
- airplane-mode tests prove local project editing/storage still works while online-only features fail honestly;
- real-device acceptance passes on phone and tablet form factors;
- at least one real configured provider path is certified from the device;
- only then may the standalone readiness flag become true and a signed/checksummed standalone private-test APK be emitted.

Until these gates pass, an Android APK may be described only by what it actually is (for example, standalone-runtime development build). It must not be called the full Android Forge.

## Truth rules

- Source code present is not the same as device proof.
- CI green is not the same as live-provider certification.
- An APK that installs is not automatically the complete Forge.
- A remote URL client is not standalone.
- A local Forge quota ledger does not create additional upstream provider quota.
- No readiness flag may be changed solely to make a release workflow green.
- No feature may be declared complete because its configuration or data type exists; actual workflow behavior and persistence must be proven.
