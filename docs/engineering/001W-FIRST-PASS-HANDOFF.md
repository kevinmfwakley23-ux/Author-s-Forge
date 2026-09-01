# 001W First-Pass Handoff — External Storage Namespace Integrity

## Parallel ownership

- **Lane:** first pass, storage/provider boundary.
- **Trunk dependency:** merged 001V author-visible project recovery.
- **Does not modify:** Studio recovery route/client files or Project Brain retrieval/state-conflict files.

## Improvements

- frozen runtime allowlist for storage provider IDs;
- runtime validation for provider IDs, project IDs, storage bindings, and relative object keys;
- rejection of traversal, absolute paths, backslashes, control characters, dot/empty/whitespace-padded segments, and trailing separators;
- safe downloadable Forge package filenames;
- project-scoped put/get/list/delete through `ExternalStorageService`;
- segment-aware listing so similarly named project namespaces cannot bleed together;
- direct local-file storage now uses the same reject-not-normalize key contract as the shared provider-neutral service;
- provider `delete` is exposed through the same scoped application boundary.

## Regression coverage

`test/external-storage-namespace-integrity.test.js` covers runtime provider/project/binding validation, malicious path forms, downloadable filenames, project namespace isolation, delete, and proof that rejected suffixes never reach a provider.

## Verification

This block starts from the merged author-visible recovery trunk. Merge only after exact-head Forge CI passes build, full tests/completion/syntax, desktop browser acceptance (including recovery), and Android/mobile acceptance.
