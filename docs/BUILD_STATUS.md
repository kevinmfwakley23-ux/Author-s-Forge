# Author's Forge — Build Status

**Status date:** 2026-09-11  
**Canonical branch:** `main`  
**Scope of this status:** K.I.N.G.S. Author's Forge Main Studio. Optional offices such as Guided Journals, Workbooks, Specialized Creation, and NFT creation are deliberately outside the Main Studio completion gate.

## Current production condition

Author's Forge is now a real integrated authoring application rather than a UI prototype. The Main Studio has durable project/manuscript state, Project Brain context, canon and character memory, author-voice support, research, architecture/planning, AI-assisted writing and editing, explicit proposal review/application, visual and cover production, manuscript production, KDP-oriented preflight, publishing preparation, promotion tooling, recovery, PWA/mobile behavior, and a native Android packaging workflow.

The repository's production rule remains strict: a file, label, mock response, or green isolated unit test is not enough to claim a working capability. Production paths must preserve durable state, real provider boundaries, author authority, truthful failure, and executable acceptance evidence.

## AI execution truth

The shared Forge AI boundary is real-provider-only. Main Studio AI calls route through the configured broker/provider boundary and do not fabricate generated content when no provider is available.

Configured provider families supported by the current runtime include:

- OmniRoute;
- 9Router;
- K.I.N.G.S. Responses-compatible endpoint;
- local Ollama;
- Groq;
- Mistral;
- Gemini;
- Anthropic;
- OpenRouter;
- OpenAI;
- registered OpenAI-compatible gateways.

Provider selection is capability-, quota-, health-, model-, and spend-policy-aware. The default owner policy is intentionally `no-paid-tokens`; metered or unknown routes require an explicit owner decision through the Forge AI controls before they can spend money. This is a safety control, not a fake fallback. If no eligible configured provider can satisfy a request, Forge fails explicitly.

Real paid-provider account success cannot be proven by public CI because credentials are intentionally excluded from the repository. Live provider certification remains a secret-backed runtime test and must not be replaced by a mock claim.

## Main author journey

The Main Studio completion scope is:

1. create or restore a durable project;
2. develop concept, architecture, story map, canon, characters, series state, and scene/chapter plans;
3. write manually or request governed AI writing assistance;
4. review proposals before authoritative manuscript mutation;
5. edit with source/revision protection and author control;
6. create/manage visual assets and cover direction;
7. produce a final cover artifact with durable evidence rather than treating a design preview as a publishable file;
8. run manuscript production and publishing/KDP readiness checks;
9. prepare metadata, positioning, promotion, and performance tracking;
10. preserve recovery/portable project state across sessions and supported devices.

## Final-cover production truth

The production release path now distinguishes a cover plan or preview from a verified final cover artifact. Release evidence includes the cover artifact service/routes, durable artifact vault, SHA-256-bound evidence, format/dimension metadata, source-asset linkage, and the live cover-production client. Production and publishing gates must reject missing or invalid required cover evidence rather than silently treating a preview as final output.

The final cleanup gate also requires these cover-production sources and compiled artifacts to remain present and non-empty, and Main Studio CI performs a direct JavaScript syntax check on the cover-production client.

## Verification contract

Use the repository-native commands:

```bash
npm ci
npm run runtime:check
npm run verify
```

`npm run verify` is the strongest Main Studio repository gate. It must continue to execute:

- the Main Studio regression suite;
- built-artifact baseline validation;
- the Main Studio completion/integrity gate;
- desktop/browser acceptance;
- mobile acceptance.

The completion gate now verifies that this execution contract has not been quietly weakened. It also requires the AI routing/writing integration evidence and verified final-cover production surface. A completion message therefore means **ready for executed verification**, not "external retailer publication already happened" or "every paid provider account was live-tested without credentials."

## Canonical CI

The repository maintains three important production verification surfaces on `main`:

- **Canonical Forge Verification** — installs the locked dependencies, validates the Node runtime contract, installs browser engines, and runs `npm run verify`;
- **Forge Main Studio CI** — runs Main Studio regression, baseline/completion gates, syntax checks, browser acceptance, and mobile acceptance;
- **Forge Android Native APK** — validates the native Android packaging path separately from the PWA/web path.

Before this final cleanup branch was opened, all three workflows were green on the exact then-current `main` head. Any merge after that point must earn fresh exact-head CI evidence again; previous green runs are not inherited as proof for changed code.

## Android, PWA, and Chromebook condition

Android is no longer described as PWA-only. The repository has both:

- a responsive/installable PWA/mobile web surface with guarded service-worker behavior; and
- a native Android APK build workflow.

Chromebook/Linux remains a supported development/runtime path. Device-specific installation, signing, permissions, network reachability, and real secret-backed provider execution still require the actual target environment; repository CI cannot truthfully manufacture those external conditions.

## Secret and configuration hygiene

Local provider credentials belong in `.env` or equivalent secret injection and are git-ignored. Example environment files remain commit-safe. Do not commit live API keys, signing keys, keystores, or provider secrets to prove a test.

## What is not being claimed

This status does **not** claim that:

- a retailer such as Amazon KDP has accepted or published a particular book;
- a paid AI provider account succeeded without a live credential-backed call;
- Android store signing/distribution has occurred merely because the APK workflow builds;
- optional offices outside Main Studio are complete because Main Studio is green.

Those are separate external or product-scope proofs.

## Release-readiness rule

Author's Forge Main Studio is release-ready only when the exact candidate head is green under the required repository workflows and the intended deployment environment has the necessary real credentials/configuration. If the source changes after a green run, verification must run again on the new head.

No test may be deleted, bypassed, converted to a placeholder, or weakened merely to make a completion score or workflow turn green.
