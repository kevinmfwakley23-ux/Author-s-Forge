# Author's Forge

**Author's Forge** is a local-first author workplace for taking books from idea to finished, edited, illustrated, produced, and publication-ready material.

It is intended to support children's books, memoir, psychological thrillers, guided journals, comic books, training manuals, novels, and future long-form projects without replacing the author's authority.

## Canonical Product Directive — READ THIS FIRST

**`AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md` is the canonical product contract.** It is checked into this repository and is the engineering source of truth.

The directive defines the complete target: concept → architecture → canon → characters → timeline → research → manuscript → editing → illustrations → cover → formatting → metadata → positioning → marketing → publishing preparation → portable archive/recovery. It explicitly calls for hierarchical memory, anti-drift controls, relationship-aware memory, voice input, five AI collaboration modes, a Book Genome, real provider boundaries, and an author-controlled publishing workflow.

The final product standard is not a feature list. It is a complete working path from story concept through architecture, canon, character system, timeline, research, manuscript, editing, illustrations, cover, formatting, metadata, positioning, promotion, publishing preparation, and portable project state.

## Chief engineering standard

The lead engineering responsibility for this repository is to turn the directive into a **real working author workplace**, not a mission gallery or collection of promises.

Non-negotiable rules:

- real implementation only;
- real provider calls only;
- real persistence only;
- no fake AI responses;
- no fake image generation;
- no placeholder controls presented as completed features;
- no dead navigation;
- no silent canon mutation;
- no weakening or deleting tests to make the build green;
- major autonomous actions must be observable, reversible, attributable, and author-controlled.

A green unit-test suite is **not** proof that Forge works. A capability is complete only when it is reachable from Studio, reads/writes durable project state, survives reload/restart, participates in downstream workflows, reports real errors, and has end-to-end regression coverage.

### The Green-Test Trap — Permanent Engineering Rule

Forge has previously reached an apparently perfect green test state while the actual Studio experience still contained controls that went nowhere and features that were represented in the interface without being genuinely usable. **That failure mode is explicitly rejected.**

A test that proves an internal function works does not prove the corresponding product feature works. A rendered button is not an implementation. A route existing is not proof that the route performs the promised operation. A mocked provider response is not a real provider integration. A generated-looking card, panel, status message, or result is not evidence that the underlying workflow exists.

From this point forward, every feature claim must be verified across the complete chain:

```text
VISIBLE CONTROL
      ↓
USER ACTION
      ↓
REAL EVENT HANDLER
      ↓
REAL APPLICATION SERVICE
      ↓
REAL SERVER / ROUTE
      ↓
REAL DOMAIN OPERATION
      ↓
REAL PROVIDER OR LOCAL ENGINE
      ↓
REAL PERSISTED STATE / ARTIFACT
      ↓
VISIBLE RESULT
      ↓
RELOAD / RESTART RECOVERY
```

If any link is missing, the feature is **not complete**, regardless of how many tests are green.

### Required functional verification levels

Every meaningful Studio capability must be verified at the strongest applicable level:

1. **Static verification** — control, route, module, and wiring actually exist.
2. **Unit/domain verification** — business rules behave correctly.
3. **Server/HTTP verification** — the real application route accepts the real request and returns the real result or actionable error.
4. **Browser/UI verification** — the visible control can actually be used and reaches the intended workflow.
5. **Persistence verification** — state is written to the real project source of truth.
6. **Reload/restart verification** — the result survives application reload and server restart where durability is promised.
7. **Provider verification** — configured external providers are actually called; unavailable providers fail honestly.
8. **Artifact verification** — promised files/results are real, valid, reusable outputs rather than placeholders.
9. **End-to-end workflow verification** — the feature participates in the larger author workflow instead of existing as an isolated mission island.

The acceptance rule is **the lowest failed level**, not the highest passed level.

## Continuous Discovery & README Ledger

The README is part of the engineering continuity system. **Whenever a meaningful discovery is made about repository state, product progress, environment capability, verification gaps, integration needs, or an observed failure mode, record it here before the work is considered complete.**

Each discovery note should answer, as applicable:

- what was discovered;
- what evidence produced the discovery;
- what it means for Forge;
- what remains to be built or verified;
- what environment/tooling is required;
- what acceptance evidence will prove it is truly complete.

This ledger exists so a future engineering session can resume from the actual state of the project rather than relying on memory, assumptions, or a green test count.

### Current Engineering Discoveries — 2026-08-27

- **Green tests alone are insufficient.** The repository currently reports 125 passing tests, but that result must not be treated as product-level proof. The Studio must be exercised through its actual controls and workflows.
- **The Studio contains many visible controls.** Current inspection found 37 buttons, 11 forms, and 19 route/navigation links in `public/index.html`. Their presence establishes UI surface area, not completion.
- **Client/server wiring exists in several places.** `public/app.js`, `public/forge-command-center.js`, and `public/forge-workbench.js` contain real event handlers and API-call paths. These still require functional browser execution verification rather than source inspection alone.
- **The repository is currently on `feature/reference-image-pipeline`, not `main`.** Local branch history contains the reference-image work while `origin/main` has newer platform/documentation commits. A fast-forward pull from `main` is therefore expected to fail until the branch divergence is deliberately reconciled.
- **The local working tree contains generated/untracked output.** Current inspection showed `.forge-data/`, `dist/`, and `package-lock.json` as untracked, plus local modifications to `public/app.js` and `src/application/illustration-reference-pipeline.ts`. These must be handled deliberately; generated state must not be mistaken for source-of-truth product implementation.
- **The development environment is Chromebook Linux with Node 24.19.0 and npm 11.17.0.** No supported browser executable was found through the checked Linux command names (`google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser`, `chrome`). Therefore browser verification cannot be claimed from that Linux shell inspection alone.
- **A real-browser acceptance harness is now part of the repository.** `scripts/studio-browser-acceptance.js` launches the real Studio server, drives the actual rendered DOM through Chrome DevTools Protocol, exercises all declared navigation routes, creates a project/book/chapter/scene, saves manuscript content, verifies reload persistence, verifies honest AI failure without a configured provider, and checks health. It intentionally exits non-zero when no browser executable is available rather than producing a false green result.
- **Browser acceptance is exposed as `npm run test:browser`.** It is intentionally separate from `npm test` because the normal regression suite must remain runnable in environments without a browser, while the browser gate must fail honestly when a browser is required but unavailable. Set `FORGE_BROWSER_EXECUTABLE` when Chrome/Chromium is installed at a non-standard path.
- **The package scripts now distinguish regression testing from real-browser acceptance.** `npm test` remains the deterministic build/unit/integration suite; `npm run test:browser` is the real rendered-application acceptance gate.
- **The package script change and browser harness were committed directly to `feature/reference-image-pipeline`.** They still require the branch to be deliberately reconciled with `main` before integration.
- **The product must not be declared complete because a button, page, API expression, or test exists.** The actual user journey must be proven from visible interaction through durable result.
- **Static Studio control wiring is now regression-tested.** A dedicated test requires all 37 current static buttons to have a route, form submission boundary, or client-side handler reference; all 11 forms must be present in client wiring; all declared routes must map to real `data-view` sections; and dynamic scene controls must have executable handlers. This is a guard against accidentally reintroducing visibly present but unwired controls. It does not replace real browser execution.

### Discovery workflow — mandatory going forward

At the end of every meaningful engineering checkpoint:

```text
DISCOVERY / CHANGE
      ↓
EVIDENCE
      ↓
README LEDGER UPDATE
      ↓
IMPLEMENTATION
      ↓
FUNCTIONAL VERIFICATION
      ↓
RECORD REMAINING GAPS
      ↓
COMMIT
```

A newly discovered limitation is not bad news to hide. It is required engineering knowledge. **Forge records gaps honestly so they can be fixed.**

## Current integrated Studio

The Studio is one static application surface rather than a dynamically injected collection of disconnected screens. Its intended workflow is:

```text
AUTHOR
  ↓
TYPED / VOICE COMMAND
  ↓
PROJECT + BOOK BINDER
  ↓
ARCHITECTURE
  ↓
CANON / CHARACTERS / WORLD / TIMELINE / RESEARCH / VOICE
  ↓
WRITING DESK + PROJECT BRAIN
  ↓
EDITORIAL ANALYSIS
  ↓
VISUAL / ILLUSTRATION / COVER
  ↓
BOOK GENOME + DOWNSTREAM IMPACT
  ↓
MARKETING
  ↓
DOCX / PDF / EPUB PRODUCTION
  ↓
13-CATEGORY DELIVERY AUDIT
  ↓
PORTABLE PROJECT PACKAGE
```

The integrated surface includes the implemented foundations for durable project, manuscript, memory, character, visual, research, editing, production, provider, audit, and Studio workflows. **Each surface remains subject to the functional verification standard above before it may be described as production-complete.**

No button is considered complete merely because it exists in HTML. Every control must terminate in a real state transition, provider operation, calculation, artifact, navigation action, or explicit actionable error.

## Real provider boundaries

### AI writing
Forge supports real provider-backed generation through:

- OpenAI: `OPENAI_API_KEY` + explicit `OPENAI_MODEL`.
- Local Ollama: `OLLAMA_BASE_URL` + explicit `OLLAMA_MODEL`.

If neither provider is configured, generation fails explicitly. Forge does not fabricate an answer.

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="your-enabled-model"
```

or:

```bash
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export OLLAMA_MODEL="your-installed-model"
```

### Real image generation
Illustration generation uses the configured OpenAI image provider. Without `OPENAI_API_KEY`, the Studio reports the missing configuration instead of showing fake output.

## Voice as a first-class input

The directive requires voice for idea capture, story planning, editing commands, research requests, character creation, scene direction, and revision instructions while preserving the original transcription.

Forge's Chromebook path uses Chrome `SpeechRecognition` / `webkitSpeechRecognition`. The command center keeps the original transcript in an editable command field and routes the instruction through the same real project/AI boundary used by typed commands.

## Development commands

```bash
npm install
npm run build
npm test
npm run check
npm run studio
npm run test:browser
```

Then open:

`http://127.0.0.1:4173`

For browser acceptance on a machine with a non-standard Chrome/Chromium location:

```bash
FORGE_BROWSER_EXECUTABLE=/path/to/chrome npm run test:browser
```

## Verification gate

```text
BUILD
  +
REGRESSION TESTS
  +
STUDIO STARTUP
  +
REAL ROUTE EXECUTION
  +
VISIBLE CONTROL EXECUTION
  +
VOICE / TYPED COMMAND EXECUTION
  +
PERSISTENCE
  +
RESTART RECOVERY
  +
REAL PROVIDER BOUNDARIES
  +
ARTIFACT VALIDATION
  +
AUTHOR APPROVAL
  +
END-TO-END WORKFLOW
```

The mission modules remain valuable domain machinery, but they are not separate products. The engineering objective is one coherent ProjectState, one manuscript workflow, one visual workflow, one production path, one memory boundary, and one Studio.

**Mission tests prove domain behavior. End-to-end Studio workflows prove the product. Both are required.**

## Status

`main` remains the production integration baseline. The active engineering line is focused on converting the directive into a dependable private author workplace and eliminating dead-end UI, disconnected mission islands, and unverified feature claims.
