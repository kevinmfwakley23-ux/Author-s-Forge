# First Pass 001Z — Lossless Structured Book Version Snapshots

## Status

IMPLEMENTED — exact-head Forge CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Android backup work is merged through 001Y and remains canonical trunk truth.
- This block starts from that merged backup-vault `main` and does not modify backup/storage files.
- Branch: `first-pass/001z-lossless-book-version-snapshots`.

## Inspection finding

Mission 025 and the master directive require Draft/Final/Published versions plus Restore, Compare, Rollback, Branch and Merge. The existing snapshot stored only flattened manuscript/chapter text while the live Studio manuscript is a structured WorkspaceBook with chapters, scenes, identities, lifecycle, synopses, ordering and timestamps. Destructive rollback from the old snapshot would therefore discard Studio structure.

## Improvements

- advances the book-version format to v2 while retaining legacy text compatibility;
- new snapshots preserve a fully validated WorkspaceBook;
- compatibility text is derived from structured state rather than becoming a second authority;
- structured snapshots are defensively cloned and validated through the canonical Studio workspace validator;
- legacy text-only snapshots remain readable/comparable but lossless restoration explicitly refuses them;
- comparison detects structural/metadata changes even when prose is unchanged;
- three-way merge accepts structured snapshots only when base/current/incoming are all structured;
- mixed legacy/structured merges fail closed;
- conflicting edits surface explicit merge conflicts instead of silent choice.

## Regression coverage

Full WorkspaceBook round-trip, clone safety, legacy compatibility/refusal, metadata-only changes, non-overlapping three-way merge, source immutability, conflict detection, mixed-format refusal and cross-book scope rejection.

## Next block

002A adds source-informed children's story challenge/topic discovery through the typed/voice Command Center, capped at 100 topics and explicitly separated from clinical diagnosis.
