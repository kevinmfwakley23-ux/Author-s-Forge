# First Pass 001M — Project Brain Entity Match Policy

## Status

IMPLEMENTED — rebased onto current shared `main`; exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Branch: `first-pass/001m-brain-entity-match-policy`.
- Pull request: #63.
- 001M and 001N are the reserved retrieval-lane blocks.
- Shared `main` already includes 001O lifecycle-snapshot consistency and 001P project-package integrity from the parallel lane.
- Forward retrieval lane after 001N is 001Q state conflicts, 001R authority-window diagnostics, and 001S deterministic retrieval evaluation.

## Research finding

Current authoring-product research exposed a false-positive problem in entity retrieval: names that are also common words can be injected into context accidentally. Novelcrafter's 2026 Codex work added case-sensitive tracking and excluded phrases for that class of error. Forge already had Unicode-aware whole-term matching, so the mechanism was adapted rather than copied.

## Forge improvements

- optional per-query `entityMatchRules` with stable entity IDs;
- author-controlled aliases, optional case sensitivity, and excluded phrases;
- occurrence-aware Unicode word matching;
- excluded phrases suppress only the covered alias occurrence;
- one entity contributes one saliency signal even when multiple aliases match;
- evidence records the entity ID and actual matched alias;
- malformed rules fail closed before retrieval;
- legacy callers remain unchanged when no entity rules are supplied.

## Regression coverage

Focused tests cover ambiguous phrase suppression, valid-occurrence preservation, case-sensitive proper names, aliases, evidence, score non-inflation, deduplication, and malformed runtime policies.

## Verification requirement

Exact-head Forge CI must pass TypeScript build, full tests/completion/syntax gates, desktop browser acceptance, and Android/mobile acceptance before merge.
