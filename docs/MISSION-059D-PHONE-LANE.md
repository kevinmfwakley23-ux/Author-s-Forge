# Mission 059D — Phone Lane Comic Hardening

**Lane owner:** Phone  
**Inherited base:** PR #38 (`office/specialized/mission-059-complete`)  
**Canonical mission:** `docs/MISSION-059-SPECIALIZED-CREATION-OFFICE.md`

## Coordination boundary

The phone lane owns only Mission 059D comic-specific behavior. The Chromebook lane owns Mission 059B shared Specialized Creation persistence, Project Brain/provider bridges, renderer-independent shared document contracts, generic production profiles/preflight, storage, and renderer evaluation.

This lane does not replace the comic implementation already present in PR #38. It extends and reconciles it.

## Inherited comic capability found in PR #38

- structured issue/page/panel data;
- page/panel composition;
- editable dialogue/caption/SFX composition elements;
- LTR/RTL state helper;
- stable-ID panel reordering;
- configurable comic production profile;
- print PDF generation;
- ordered zero-padded CBZ generation;
- baseline comic API/browser acceptance.

## Shared-base reconciliation — 2026-08-31

Before each continuation, the phone lane rereads current `main` README, the locked canonical architecture, and the Mission 059 contract, then rechecks PR #38 rather than assuming the Chromebook lane is unchanged.

The phone lane originally inherited PR #38 at `bfca1b08d74306e9e77cac97f42de6a5b7c9b492`. While the comic slice was being built, Chromebook advanced the shared branch through compiler and scoped-artifact corrections. The phone branch was repeatedly rebuilt directly on the newer PR #38 head while preserving only phone-owned comic files.

The latest inherited shared head for this work block is `5920897b27abae15b6bd2edd9c6a44cb2c4f574e`. Its final shared correction, `fix(059B): preflight scoped artifacts against authoritative mode context`, keeps scoped artifact bytes limited to selected documents while validating mode-wide requirements against authoritative project context. No comic-specific file was changed by Chromebook during these reconciliations.

The comic authoring layer delegates LTR/RTL mutation to the inherited `setComicReadingDirection` helper instead of duplicating that behavior. This preserves one comic stack and one shared Specialized Creation trunk.

## First hardening slice

`src/application/specialized-creation-comic.ts` adds comic-only semantics without changing the shared trunk:

- renderer-independent normalized panel layout geometry and template references;
- page and panel pacing intent plus page-turn intent;
- pacing summaries with page/panel counts and relative panel area;
- lettering semantics linked to existing structured dialogue/caption/SFX source entries;
- speaker association, tail target/anchor, semantic kind and explicit lettering reading order;
- comic-specific structural preflight for speaker, tail, ordering and geometry anomalies;
- non-destructive panel art candidate/revision asset lists;
- an explicit comic panel context-needs contract for the shared Forge Brain.

## Mission requirements advanced

- SC-COMIC-003
- SC-COMIC-004
- SC-COMIC-005
- SC-COMIC-006
- SC-COMIC-007
- SC-COMIC-008
- SC-COMIC-009
- SC-COMIC-010
- SC-COMIC-011

## Verification evidence

Forge CI #595 (`33467908981`) tested the previous phone head on PR #38 head `c3c2f15e78a614141c6e15e1f27ecc43449258f9`:

- TypeScript build passed;
- all six phone comic regression tests passed;
- the full unit suite reached 398/399 passing;
- the sole failure was shared `specialized-creation-finishing.test.js`, where scoped greeting-card rendering was incorrectly mode-preflighted against only the selected document and therefore reported four `CARD_SURFACE_MISSING` errors.

Chromebook corrected that shared contract in PR #38 at `5920897b27abae15b6bd2edd9c6a44cb2c4f574e`. The phone branch has now been rebased onto that correction. A fresh exact-head canonical CI run is required before this slice is marked verified.

This slice is not Mission 059D completion by itself. Remaining 059D work includes SC-COMIC-012 through SC-COMIC-015: production-profile proof, same-approved-revision PDF/CBZ/high-resolution page-image lineage, full live comic acceptance, and Chromebook/Android human-device verification where applicable.


## Research-backed accessibility hardening — 2026-09-01

Authoritative review of W3C fixed-layout accessibility guidance, EPUB 3.3 reading-order semantics, Amazon Kindle Guided View guidance, KDP print geometry, and Readium CBZ ordering led to these comic-owned improvements:

- deterministic accessible reading sequence derived from explicit panel lettering semantics;
- page, panel description, semantic role, source index, text and speaker retained for downstream fixed-layout accessibility/export work;
- comic preflight warning when dialogue, caption or SFX sources lack explicit reading-order semantics;
- browser acceptance now proves speaker association and normalized balloon-tail anchors survive AI proposal approval, reload and server restart;
- the comic browser journey is now part of the canonical desktop acceptance command instead of an uninvoked standalone script.

W3C guidance makes deterministic reading order and meaningful text alternatives essential for fixed-layout publications. Amazon's current comic guidance continues to emphasize guided panel navigation. Readium documents stable zero-padded CBZ filenames, already proven by the comic artifact tests.

## Exact-head verification and handoff blockers — 2026-09-01

PR #39 head `fb90bcb6418fc075e869de17590449266bbe36ec` synchronized the Chromebook-owned one-line composer correction from PR #38 without modifying its behavior.

Forge CI #632 (`33470731686`):

- TypeScript build: PASS;
- full unit suite: PASS;
- completion audit and syntax checks: PASS;
- core Studio, context, KDP, Guided Journal and baseline Specialized Creation browser journeys: PASS;
- shared Specialized Creation finishing browser journey: reproducible FAIL before the comic journey, timing out after 30 seconds;
- comic browser journey: not reached because the canonical browser command stops at the shared finishing failure;
- Android/mobile acceptance: skipped by CI after the desktop failure.

Two Chromebook-owned shared blockers remain before Mission 059D can be called complete:

1. Stabilize the shared `specialized-creation-finishing-browser-acceptance.js` wait that times out reproducibly on CI.
2. Remove or redesign the shared renderer's 1800-pixel PNG cap so a 6.625-inch US comic profile at 300 DPI can produce at least 1988-pixel-wide high-resolution page images, as required by SC-COMIC-014.

The phone comic slice is ready for Chromebook follow-behind review, but it is not marked PASS — MOVE FORWARD until those shared gates are corrected and the exact-head comic desktop/mobile journey runs.
