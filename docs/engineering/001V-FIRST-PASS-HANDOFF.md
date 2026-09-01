# First Pass 001V — Author-Visible Project Recovery

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Base: 001U live governed package recovery route, merged after Forge CI #731 passed.
- Branch: `first-pass/001v-author-visible-project-recovery`.
- Android second pass should consume this only after the preceding recovery blocks in product order.

## Inspection finding

The Versions & Recovery screen could export the canonical portable package but offered no author-visible way to restore one. That meant the recovery service and live route were technically real yet still incomplete under Forge's functional-truth rule because an author could not reach recovery from the Studio itself.

## Improvements

- adds a dedicated `forge-recovery.js` browser boundary to the existing Versions & Recovery surface;
- uses the standard browser File API to read an author-selected JSON package;
- shows the selected package project/format before mutation;
- requires an acknowledgement checkbox plus a final destructive-action confirmation;
- sends `authorApproved: true` only after those deliberate author actions;
- calls only `POST /api/projects/:projectId/package/restore` and never writes project state locally;
- automatically downloads the rollback package returned by the server before reporting recovery success;
- resets approval/input state after recovery and asks the existing Studio refresh control to reload current durable state;
- rejects an obviously cross-project package in the client for user clarity while retaining server-side validation as the actual authority.

## Research applied

OWASP transaction-authorization guidance reinforces that significant transaction data should be visible to the user while authorization and allowed state transitions remain enforced server-side. MDN's current File/Blob guidance confirms standard file inputs and `Blob.text()`/`File.text()` are broadly supported platform-neutral browser primitives suitable for Chromebook and Android without introducing a native filesystem dependency.

## Verification added

- Node regression verifies the recovery client is loaded, requires deliberate author acknowledgement, calls the governed route and preserves the server rollback package rather than creating another persistence path.
- `scripts/studio-recovery-browser-acceptance.js` starts the real built Studio, selects an actual in-memory JSON file through Playwright, proves an unacknowledged restore cannot mutate state, performs an approved restore, captures/parses the real rollback download, verifies durable restored state, restores the rollback through the same UI, and verifies the later state returns.
- The same browser harness opens the Versions & Recovery surface at a 390×844 Android-sized touch viewport and checks the restore target and horizontal-overflow boundary.
- The recovery harness is part of the canonical `npm run test:browser` CI gate.

## Next block

After exact-head CI and merge, 001W should inspect the next delivery/recovery gap rather than duplicate this flow. Likely targets are recovery audit/history visibility and/or restart/browser acceptance of the restored UI state, based on the canonical product directive and current implementation evidence.
