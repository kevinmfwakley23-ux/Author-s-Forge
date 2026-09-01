# First Pass 001Q — Project Package JSON Fidelity

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Base capability: merged 001P project-package runtime/integrity boundary.
- Branch: `first-pass/001q-project-package-json-fidelity`.
- Pull request: #70.
- This block is isolated from the active 001M/001N/state-conflict Project Brain retrieval lane.

## Inspection finding

Forge project packages accept `projectState` as runtime `unknown`, but JavaScript JSON serialization can silently discard or coerce values. Undefined/function/symbol object members disappear, non-finite numbers become null, sparse array holes become null, special objects can serialize to a different representation, and BigInt/cycles can throw native errors. `ProjectPackageService.exportSnapshot()` also serialized before the package boundary could validate the state.

## Improvements

- add a reusable strict JSON value-state validator;
- allow null, strings, booleans, finite numbers, canonical arrays and plain objects;
- reject undefined, functions, symbols, BigInt, NaN/Infinity, cycles, sparse arrays, array side-properties, symbol keys, non-enumerable properties, accessors and class/special-object instances;
- run the fidelity check during package create/import validation;
- run it before `exportSnapshot()` stringification so malformed state returns a deliberate Forge validation error;
- preserve valid nested Unicode/array/object state unchanged across export and restore.

## Research basis

OWASP recommends early syntactic and semantic validation for untrusted serialized data. JavaScript's documented JSON behavior makes implicit stringification an insufficient durable-state contract, so Forge validates the value graph before serialization.

## Regression coverage

Focused tests exercise lossy scalar values, non-finite numbers, class instances, accessors, hidden/symbol properties, cycles, sparse/extended arrays, service-level BigInt rejection and valid nested-state round-trip.

## Next block

001R makes the Studio package envelope explicit and validates nested project identity/workspace consistency before a real package-import workflow is allowed to mutate durable state.
