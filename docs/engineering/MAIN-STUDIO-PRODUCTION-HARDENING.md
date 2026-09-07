# Main Studio Production Hardening

Branch: `chief-engineer/main-studio-production-hardening`

## Implemented in this block

- Main Author's Forge Studio is now the default local, Android/LAN, hosted, completion, baseline, unit, browser, and mobile production lane.
- Guided Journal, Educational Workbooks, Specialized Creation, and NFT are explicit optional/all-office lanes and no longer block main-Studio release readiness.
- Hosted main-Studio acceptance proves optional-office routes can be unavailable without crashing the main Studio.
- Cross-office hosted tests are preserved behind an explicit optional-office environment wrapper.
- Forge Core readiness now distinguishes configured AI from operational AI; explicit unhealthy/cooldown-only resources cannot produce a false-ready core.
- Regression tests cover unhealthy/cooldown false-ready behavior.
- Render deployment now prefers the K.I.N.G.S. Responses router while exposing real upstream OmniRoute/9Router configuration slots and an optional direct Forge OmniRoute fallback.
- The main production scope and truthful completion semantics are documented in `docs/MAIN-STUDIO-PRODUCTION-SCOPE.md`.

## Preserved safeguards

- AI proposal review/accept/apply separation.
- stale manuscript target protection.
- character continuity checks.
- author-approved workflow advancement.
- no fabricated AI/provider output.
- no false claim of retailer/social/external-provider completion without real evidence.

## Deliberately not copied from stale PRs

PR #41's old `FileProjectStore` replacement is not copied wholesale because its diff includes a large stale project-schema validation rewrite. Crash-safe save hardening should be reconciled against the current `main` schema after this production-scope branch is validated.

PR #47's generic `authorApproved` governance boolean is not introduced as a second approval system. The current durable proposal ledger and author-control state remain the stronger source of author approval for the main Studio.

## Validation rule

No completion claim is made from source presence. This branch must compile and pass the exact-head GitHub Actions main-Studio unit, browser, hosted, Android/mobile, and WebKit gates before merge.
