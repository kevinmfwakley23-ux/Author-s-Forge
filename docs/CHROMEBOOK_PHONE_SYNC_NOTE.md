# Chromebook + Phone Build Sync Note

**Date:** 2026-08-31  
**Canonical source:** `main`  
**Active specialized mission:** Mission 059 — Specialized Creation Office

## Coordination rule

Both Chromebook and phone work must treat current `main`, `README.md`, `docs/AUTHORS_FORGE_CANONICAL_ARCHITECTURE.md`, and `docs/MISSION-059-SPECIALIZED-CREATION-OFFICE.md` as authoritative before beginning a build turn.

A device/session must not continue an older mission branch merely because it contains local progress. First compare it with `main`. If it is materially behind or diverged, preserve useful work, then restart the next coherent phase from current `main` or explicitly reconcile the divergence before writing production code.

## Current alignment checkpoint

The earlier `mission-067-live-specialized-creation-office` branch is materially stale relative to current `main` and must not be treated as the active integration base. Current `main` contains the completed Guided Journal Office and the research-locked Mission 059 Specialized Creation contract.

Mission 059A is complete. The next implementation phase is **059B — Shared Specialized Creation trunk**.

Required 059B sequence:

1. inspect/reconcile existing specialized domain, workflow, workspace, production and application contracts;
2. establish one durable project-scoped specialized application facade and restart-safe storage without duplicating Forge Brain/provider infrastructure;
3. connect Project Brain/context, shared provider proposals and asset provenance;
4. define renderer-independent reusable composition-document state;
5. evaluate renderer technology and record an ADR before locking a hard-to-reverse dependency;
6. establish shared production-profile/preflight foundations;
7. verify build/tests, project isolation and restart persistence before progressing to 059C.

## Fast but grounded parallel-work rule

Phone and Chromebook may work quickly in parallel, but each coherent capability should have one active branch/PR owner at a time. Parallel sessions should split by non-overlapping requirement groups or research/verification tasks, then rebase/restart from freshly merged `main` before the next write phase. This prevents both devices from independently modifying the same contracts and creating avoidable conflicts.

Never weaken tests, bypass author-control boundaries, duplicate Brain/provider/storage systems, or count preview-only/fake output as completion.
