# First Pass 001Y — Lossless Structured Book Version Snapshots

## Status

IMPLEMENTED — exact-head Forge CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Android active parallel block: 001X external project-package backups / PR #79.
- This block does not modify external-storage backup files.
- Branch: `first-pass/001y-lossless-book-version-snapshots`.

## Inspection finding

Mission 025 and the master directive require Draft/Final/Published versions plus Restore, Compare, Rollback, Branch and Merge. The existing `BookSnapshot` stored a flattened manuscript string and chapter-text map while the live Studio manuscript is a structured `WorkspaceBook` containing chapters, scenes, identities, lifecycle, synopses, ordering and timestamps. A destructive rollback from the flattened representation would therefore be lossy while appearing authoritative.

## Improvements

- version format advances to v2 while retaining legacy text compatibility;
- new snapshots can preserve a fully validated `WorkspaceBook`;
- compatibility manuscript/chapter text is derived from the structured snapshot rather than becoming a second authority;
- structured snapshots are defensively cloned and validated through the canonical Studio workspace validator;
- legacy text-only snapshots remain readable/comparable but lossless restore explicitly refuses them;
- structured comparison detects metadata/scene changes even when prose text is unchanged;
- three-way merge supports structured snapshots only when base/current/incoming are all structured;
- mixed legacy/structured merge fails closed;
- conflicting structured edits surface an explicit merge conflict rather than silently choosing a side.

## Regression coverage

Tests cover full WorkspaceBook round-trip, detached-copy safety, legacy compatibility/refusal, structure-only comparison, non-overlapping structured three-way merge, source immutability, conflict detection, mixed-format refusal and cross-book scope rejection.

## Next block

001Z adds the source-informed children's story challenge/topic discovery capability and makes it reachable from typed/voice Forge commands. A later version-management application block can safely expose capture/compare/rollback/branch/merge because snapshots will no longer discard Studio structure.
