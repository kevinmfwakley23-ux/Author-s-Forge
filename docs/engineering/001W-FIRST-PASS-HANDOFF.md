# 001W First-Pass Handoff — Durable External Project-Package Backups

## Ownership

- **Lane:** first pass, parallel to Chromebook live-recovery work.
- **Depends on:** 001V external-storage namespace integrity.
- **Does not modify:** `src/studio-server.ts`, live package restore routing, Project Brain retrieval/state-conflict files, or Chromebook 001U.

## Inspection finding

Forge already had a portable project package boundary and a generic external-storage abstraction, but no application service connected those pieces to the canonical durable project store. External storage could move arbitrary bytes; it could not yet create, enumerate, validate, preview, or safely delete real Forge project backups.

## Implemented

`ProjectPackageBackupService` now:

1. loads an existing canonical project from `FileProjectStore`;
2. validates/normalizes the Studio workspace;
3. creates the complete hardened Studio package through `ProjectPackageService`;
4. serializes and writes the archive through project-scoped `ExternalStorageService`;
5. gives each backup a timestamp + backup-id + safe `.forge-project.json` object name so same-instant backups do not overwrite one another;
6. lists only Forge backup objects under `backups/`;
7. previews a stored backup with fatal UTF-8 decoding, package integrity validation, project-id validation, and Studio-envelope validation without mutating durable state;
8. deletes only validated Forge backup objects and cannot delete arbitrary project storage objects.

## Fail-closed boundaries

Backup operations reject missing projects, cross-project storage bindings, malformed timestamps or backup ids, unsafe object keys, corrupt/tampered packages, cross-project packages, and non-backup object deletion/preview attempts.

## Regression coverage

`test/project-package-backup.test.js` covers real project backup/preview, unique same-instant backups, Forge-only listing, missing/cross-project/malformed input, tampered and cross-project archives, and scoped deletion while unrelated stored objects remain intact.

## Verification gate

Do not merge until the exact branch head passes Forge CI: TypeScript build, complete unit/completion/syntax suite, desktop browser acceptance, and Android/mobile acceptance.
