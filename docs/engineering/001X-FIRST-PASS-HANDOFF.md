# 001X First-Pass Handoff — Durable External Project-Package Backups

## Parallel ownership

- **Lane:** first pass, backup/application boundary.
- **Depends on:** 001W external-storage namespace integrity, now merged on `main`.
- **Does not modify:** Studio package recovery route/client or Project Brain retrieval/state-conflict files.

## Inspection finding

Forge had canonical portable project packages plus external-storage ports, but no application workflow connected the durable ProjectState store to external storage. The abstraction could move bytes; it could not create, enumerate, validate, preview, or safely delete actual Forge project backups.

## Implemented

`ProjectPackageBackupService`:

1. loads an existing canonical project from `FileProjectStore`;
2. validates the Studio workspace and exports the complete hardened Studio package;
3. generates timestamp + backup-id + safe project package object names;
4. refuses an existing backup key instead of overwriting it;
5. serializes and writes through the project-scoped `ExternalStorageService`;
6. returns/list backups with project-relative keys that round-trip directly into preview/delete;
7. lists only `.forge-project.json` objects under `backups/`;
8. previews with fatal UTF-8 decode, package integrity checks, project identity checks, and Studio-envelope checks without durable mutation;
9. deletes only validated backup objects.

## Fail-closed boundaries

Missing projects, cross-project bindings, malformed timestamps/ids, duplicate keys, unsafe paths, corrupt/tampered archives, cross-project archives, and arbitrary non-backup preview/delete requests are rejected.

## Real persistence evidence

Tests use both the in-memory provider and `LocalFileStorageProvider`. The filesystem test writes a real backup file, creates fresh provider/store/service instances, lists the persisted backup, and validates/imports it again after that restart-like boundary.

## Verification

PR #79 is now based directly on merged 001W `main`. Merge only after a fresh exact-head Forge CI passes TypeScript build, full tests/completion/syntax, desktop browser acceptance including the real recovery flow, and Android/mobile acceptance.

## Next first-pass block

001Y will make this backup workflow reachable through the real Studio using a project-scoped configured backup vault while preserving existing author-approved package recovery as the only restore mutation authority.
