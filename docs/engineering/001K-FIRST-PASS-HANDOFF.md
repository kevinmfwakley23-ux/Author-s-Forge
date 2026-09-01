# First Pass 001K — Brain Runtime/Type Single-Source Contract

## Status

READY FOR ANDROID REVIEW after merge and fresh post-rebase CI.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Android currently owns 001H–001J; this block intentionally does not modify those files.
- Branch: `first-pass/001k-memory-runtime-single-source`.
- Pull request: #61.
- Rebased parent: merged 001G `main` commit `4dcbc2c490e5cb12927f12c219cd7b3674989328`.
- Rebased implementation commit: `791e0df7b8488608425b3e25f18b3cf836ceac59`.

## Inspection finding

The canonical memory module maintained TypeScript union declarations separately from the runtime memory class and authority allowlists. A future change could therefore update compile-time types without updating runtime validation or update runtime validation without updating TypeScript. The exported arrays were also only compile-time readonly and remained mutable JavaScript arrays.

## Improvements

- `MEMORY_CLASSES` is a frozen literal tuple and `MemoryClass` is derived from it.
- `MEMORY_AUTHORITIES` is a frozen literal tuple and `MemoryAuthority` is derived from it.
- provenance kinds use the same single-source model through `MEMORY_PROVENANCE_KINDS` and `MemoryProvenanceKind`.
- the three canonical runtime allowlists are frozen so JavaScript consumers cannot mutate Forge's memory contract at runtime.
- `isMemoryClass`, `isMemoryAuthority`, and `isMemoryProvenanceKind` validate against the canonical runtime values.
- focused regression coverage proves canonical membership, runtime immutability, and fail-closed record validation.

## Verification evidence

Before the 001G merge moved `main`, Forge CI #685 / run `33483834877` passed on the exact 001K implementation head `e3f34a87fba9edf7d044bf24a0753b35f7cfd32b`:

- TypeScript build passed;
- 400/400 tests passed;
- completion/evidence report passed at 100%;
- syntax gates passed;
- desktop browser acceptance passed;
- Android/mobile browser acceptance passed.

The implementation was then rebased without modification onto merged 001G. A fresh post-rebase CI run is required before merge; prior green evidence is retained but is not treated as a substitute.

## Next block

001L hardens `createMemoryRecord` as a true runtime trust boundary so malformed JavaScript/JSON input produces deliberate Forge validation errors rather than accidental property/method exceptions. It is already isolated on `first-pass/001l-memory-create-runtime-boundary` and does not overlap Android's 001H–001J files.
