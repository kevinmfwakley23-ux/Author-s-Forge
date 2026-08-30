# Mission 041 — Evidence-Aware Launch Campaign

## Objective

Extend Author's Forge from book positioning into an author-controlled promotion workflow without turning market research, AI inference, or creative copy into unsupported commercial claims.

## Delivered

- typed launch campaign contract;
- channel-aware campaign assets;
- evidence references on promotional assets;
- confidence labels for market claims;
- explicit campaign objective, audience, and reader promise;
- author approval gate before scheduling;
- deterministic scheduling transition;
- default commercial-safety guardrails;
- rejection of assets referencing missing evidence;
- public API exports;
- regression tests.

## Research decision

Current 2026 publishing workflows increasingly emphasize a single path from manuscript through cover, metadata, launch assets, and promotion instead of forcing authors to stitch together separate applications. The useful idea adopted here is the workflow continuity, not any vendor's claims or implementation. Forge keeps evidence, provenance, author approval, and project state as the governing boundaries.

## Safety

Forge does not promise sales, rankings, reviews, clicks, revenue, or commercial outcomes. Market observations and inferences remain labeled. An asset cannot be scheduled until the author explicitly approves it.

## Next integration

Connect the campaign model to Studio's Marketing surface and persistent project state, then generate campaign assets from the Book Positioning Report and Book Genome while retaining evidence links and approval history.
