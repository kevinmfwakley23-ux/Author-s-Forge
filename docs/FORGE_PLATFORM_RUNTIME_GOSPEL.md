# K.I.N.G.S. Author's Forge — Platform Runtime Gospel

**Status: owner-approved mandatory architecture**

K.I.N.G.S. Author's Forge must provide complete, independent private-test work environments on both Chromebook/Linux and Android phone/tablet before public release.

## Platform independence

### Chromebook / Linux

The Chromebook/Linux build owns its complete Forge runtime locally:

- Main Forge / Studio;
- every enabled office/add-on;
- durable project/canon/manuscript/character/research/production state;
- one independent live AI brain instance per enabled office;
- office-scoped provider credentials, model registry, routing state, health/cooldowns, token/quota accounting and spend policy;
- local file import/export and production artifacts;
- no dependency on an Android device or another Forge host.

### Android phone / tablet

The Android build must be a complete Forge work environment on the Android device itself. It must **not** require a Chromebook, Linux server, LAN Forge process, hosted Forge URL, Termux, or a second application to provide normal Forge functionality.

The Android application may require internet connectivity for cloud model providers, web research, publishing services, updates or other genuinely online capabilities. That is different from depending on another machine to run Forge.

The Android runtime must locally own:

- Main Forge / Studio UI and application services;
- every enabled office/add-on;
- durable local project/canon/manuscript/character/research/production state;
- one independent live AI brain instance per enabled office;
- office-scoped credential storage;
- provider/model registry and routing;
- routing health/cooldowns and failover evidence;
- office-scoped token/quota accounting and spend policy;
- file import/export/share flows appropriate to Android;
- recovery/backup/export capability;
- device-local settings and office enablement.

A native shell that asks for a Forge server URL is a **gateway client**, not a standalone Android Forge release, and must not be labeled as satisfying this contract.

## One codebase, two complete platform adapters

The target is not two unrelated rewrites. Forge should retain one authoritative product/domain codebase and split platform concerns behind explicit ports/adapters.

```text
                 K.I.N.G.S. AUTHOR'S FORGE PRODUCT CORE
          project/canon/workflow/office contracts + schemas
                              |
                 +------------+------------+
                 |                         |
                 v                         v
       CHROMEBOOK/LINUX ADAPTERS      ANDROID NATIVE ADAPTERS
       Node runtime + filesystem      Tauri/Rust + native storage
       desktop/browser UI             Android WebView/native bridge
       provider HTTP transport        native Rust HTTP transport
       local credential env/store     encrypted device credential vault
```

Node-specific filesystem, HTTP-server, process and crypto dependencies must not remain hidden inside code that is supposed to be platform-neutral. Platform-neutral Forge logic should depend on explicit interfaces for storage, hashing/identity, network transport, clock/UUID, secrets and file access.

## Independent office brains on every platform

Current office ids:

- `studio` — Main Forge / Studio;
- `journal` — Guided Journal Office;
- `workbooks` — Educational Workbook Office;
- `specialized` — Specialized Creation Office;
- `nft` — NFT Creation Office.

Every enabled office on **each platform** receives its own live AI runtime scope with independent:

- model broker;
- model/resource collection;
- provider preference/order;
- routing telemetry;
- health/cooldown state;
- token/quota accounting;
- spend policy;
- request/provider cache where applicable;
- provider credentials/endpoints;
- optional K.I.N.G.S. Responses endpoint;
- failover evidence.

Every office may independently configure:

- OmniRoute;
- 9Router;
- OpenAI;
- Groq;
- Mistral;
- Gemini;
- Anthropic;
- OpenRouter;
- Ollama/local models where the platform can actually run/reach them;
- optional K.I.N.G.S. Responses-compatible endpoint.

Separate Forge-side ledgers do not create additional provider-side allowance. Truly independent upstream pools require separate provider credentials/accounts/projects or provider-managed quota allocations.

## Credentials are platform-local and office-local

Chromebook/Linux credentials and Android credentials are separate by default. Installing Forge on Android must not require copying a Linux environment file or connecting to the Chromebook.

Within one device, one office must not silently borrow another office's credentials. The owner may deliberately configure the same provider key in more than one office, but Forge must still report that the upstream provider may treat that as one shared account quota.

Credential export/import, if added, must be explicit, encrypted and owner-controlled. Plaintext credential synchronization is forbidden.

## App-family option

Forge begins as one complete application containing Main Forge plus optional offices. The architecture must also support publishing selected offices as their own K.I.N.G.S.-branded applications without forking product logic.

Candidate app identities:

| Product | Purpose | Candidate package identity |
| --- | --- | --- |
| K.I.N.G.S. Author's Forge | complete Forge + optional offices | `com.kings.authorsforge` |
| K.I.N.G.S. Guided Journals | standalone Journal Office | `com.kings.authorsforge.journals` |
| K.I.N.G.S. Educational Workbooks | standalone Workbook Office | `com.kings.authorsforge.workbooks` |
| K.I.N.G.S. Specialized Creation | standalone specialized media/cards/comics office | `com.kings.authorsforge.specialized` |
| K.I.N.G.S. NFT Creation | standalone NFT office | `com.kings.authorsforge.nft` |

These package ids are architecture targets and are not release claims. Final public identifiers must be locked before store production signing.

A standalone office app uses the same office module and K.I.N.G.S. Brain Core contracts as the corresponding add-on inside full Forge, but owns its own app sandbox, credentials, brain instances, usage ledgers and settings.

## Android native implementation direction

The existing Tauri 2 shell is the correct native container but the current gateway-only implementation is insufficient. The Android runtime should move backend responsibilities into the native application through Tauri/Rust commands and platform adapters, while retaining the existing Forge UI/product logic wherever practical.

Required native Android adapters include:

1. durable local database/project storage;
2. secure credential vault;
3. native HTTP/provider transport so API keys are not exposed to arbitrary web content;
4. office runtime registry that instantiates one brain scope per enabled office;
5. file import/export/share adapter;
6. native recovery/backup boundary;
7. runtime capability/status surface;
8. no remote Forge URL bootstrap requirement.

## Private-test acceptance gates

### Chromebook/Linux private build may be called ready only when

- exact source commit passes the strongest Forge automated verification;
- private bundle is reproducible and checksum-protected;
- all enabled offices launch locally;
- office brain isolation tests pass;
- owner can import/create/edit/save/reopen/export real projects;
- configured live-provider tests prove the selected provider paths used during acceptance.

### Android private build may be called ready only when

- it installs directly as an APK on the target phone/tablet;
- launch requires no Forge URL and no second-machine runtime;
- projects remain available after process kill/restart/device restart as applicable;
- all enabled offices are accessible on-device;
- each office exposes its own provider configuration and usage/health state;
- at least one real provider path can be independently exercised from each office being accepted;
- file import/export works through Android-native storage/share flows;
- core author workflows pass device-level acceptance;
- the APK signature/checksum are verified.

## Public release gate

No Play Store production claim until owner private acceptance proves the complete intended author journey on the standalone Android build. Production signing, store metadata, privacy/disclosure review and final exact-release verification happen only after that acceptance.
