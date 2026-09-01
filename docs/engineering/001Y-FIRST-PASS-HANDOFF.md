# 001Y First-Pass Handoff — Live Studio Backup Vault

## Scope

- **Lane:** Codex first pass.
- **Depends on:** merged 001X durable project-package backups.
- **Does not replace:** existing author-approved `/package/restore` recovery authority.

## Inspection finding

001X established real durable project backups but left the capability at the application/library boundary. Forge's functional-truth rule requires major capabilities to terminate through the real Studio rather than remaining unreachable infrastructure.

## Implemented

- add `StudioProjectBackupVault` as the Studio-facing orchestration boundary;
- persist backups through `LocalFileStorageProvider` in a dedicated vault root (`FORGE_BACKUP_DIR`, default `.forge-backups`);
- keep project state under `FORGE_DATA_DIR` and backup packages under a separate recovery namespace;
- expose live Studio HTTP operations for create, list, preview, restore, and delete;
- preview validates package integrity without mutation;
- restore requires explicit author approval and delegates mutation to the existing reversible `StudioProjectRecoveryService`;
- delete requires explicit author approval and validates the backup before removal;
- preserve the existing Forge package format and project-scoped storage binding rather than inventing a second backup representation.

## Live route coverage

`test/studio-project-backup-vault-route.test.js` drives the compiled real Studio server and verifies:

1. project creation and baseline durable state;
2. a real backup file written outside the project data directory;
3. listing and non-mutating preview;
4. refused restore without author approval leaves current state unchanged;
5. approved restore returns a rollback package and replaces durable project state;
6. backup listing survives a full Studio server restart;
7. refused delete without author approval leaves the backup intact;
8. approved delete removes the durable backup file.

## Verification gate

Merge only after exact-head Forge CI passes TypeScript build, full regression/completion checks, desktop browser acceptance including the existing recovery workflow, and Android/mobile acceptance.

## Next

After this block is verified, the next first-pass work should surface backup creation/list/preview/restore/delete in the author-visible Versions & Recovery workbench without weakening the server-side author-approval gates.
