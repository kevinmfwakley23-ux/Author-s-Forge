# Mission 033 — Durable Project Restore

## Objective

Turn the existing validated portable project snapshot boundary into a durable restore application service that can safely write a recovered project back into local Forge storage.

## Scope

- validate the canonical Forge project package before restore;
- require an explicit target project id;
- reject cross-project restores;
- validate the portable project root and project metadata identity;
- validate the optional Studio workspace before persistence;
- persist the recovered project through the existing atomic file store;
- verify that the restored project can be loaded after persistence;
- return an attributable restore result without claiming UI completion.

## Non-goals

- browser upload UI;
- cloud storage integration;
- automatic overwrite policy;
- silent merge of two project states.

Those remain separate integration work and must not be implied by this mission.

## Acceptance

1. A valid v2 project snapshot restores to durable local storage.
2. A restored Studio workspace survives a store reload.
3. A package addressed to another project is rejected before persistence.
4. Persistence is followed by a load-back verification.
5. Existing project-package and project-store tests remain green.

## Engineering boundary

The project package remains the portable source artifact. The local project store remains the durable source of truth. Restore is an explicit, validated state transition and never silently changes author canon.
