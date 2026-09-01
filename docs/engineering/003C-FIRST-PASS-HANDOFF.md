# 003C First-Pass Handoff — Final Audit Convergence

## Parallel ownership

- **Lane:** forward first pass, Delivery / Recovery / final-release integrity.
- **Stacked on:** 003B canonical Delivery Audit state persistence.
- **Does not modify:** Chromebook-owned Specialized Creation files, Educational Workbook files, Publishing/Promotion files, Project Brain retrieval files, Studio backup/recovery files, or browser shell files.

## Inspection finding

Forge currently carries two legitimate but separate final-release audit contracts:

1. the older `FinalProductAudit`, still used by existing final-product integration and live Studio compatibility paths; and
2. the durable canonical `DeliveryAuditReport`, which participates in project state and recovery validation.

Deleting or silently replacing the legacy contract would be unsafe, but leaving the two systems disconnected means an audit can appear complete at the live final-product boundary without becoming durable canonical project evidence.

## Implemented

`FinalProductAuditService` now preserves `run(...)` unchanged and adds `runAndRecord(...)` which:

1. requires the final audit project to match the target `ProjectState`;
2. creates the existing full 13-category `FinalProductAudit` through the existing domain authority;
3. deterministically maps every legacy category to the canonical Delivery Audit category set, including `characters` → `character`;
4. converts blocking checks to canonical `critical` severity and non-blocking checks to `warning` severity;
5. preserves each check's pass state and message;
6. records the converted evidence through the canonical `DeliveryAuditService` state-persistence path from 003B;
7. returns the legacy result, canonical durable report, and updated project together without mutating the input project.

## Compatibility rule

This block does **not** delete `FinalProductAudit`, rename its public categories, or alter its established status vocabulary. It creates a convergence bridge so existing callers can migrate to durable evidence without an all-at-once breaking rewrite.

## Regression coverage

`test/final-product-delivery-audit-convergence.test.js` proves:

- a complete final-product audit becomes durable canonical Delivery Audit history;
- the legacy `characters` category maps to canonical `character`;
- blocking failures remain blocked after convergence;
- non-blocking failures remain attention-required/attention across both representations;
- cross-project mutation is rejected before any audit history is recorded.

## Verification rule

003C is stacked on 003B. It requires its own exact-head Forge CI after the stack is reconciled onto merged `main`: TypeScript build, full regression/completion/syntax checks, desktop browser acceptance, and Android/mobile acceptance. No source-only completion claim is allowed.

## Next convergence step

After this bridge is verified, the live final-product Studio route can be migrated in a separate coherent block to use `runAndRecord(...)`, preserving its response compatibility while making the audit durable and restart-safe.
