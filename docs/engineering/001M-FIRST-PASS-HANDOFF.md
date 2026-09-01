# First Pass 001M — Project Brain Entity Match Policy

## Status

IMPLEMENTED — exact-head CI pending.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Android owns 001H–001J; this block does not modify Android's 001J relationship-context files.
- Branch: `first-pass/001m-brain-entity-match-policy`.
- Pull request: #63.
- Base: merged 001L `main` commit `0501cc08c5f30e4e99a8e18c39edafdf3735e9be`.
- Rebased implementation commit before this handoff record: `a5b86ced224d09b7544d44134b63fa52e0789f12`.

## Research finding

Current authoring-product research exposed a concrete false-positive problem in entity/Codex retrieval: names that are also common words can be injected into context accidentally. Novelcrafter's 2026 Codex work added case-sensitive tracking and excluded phrases to address that class of error.

Forge already had Unicode-aware whole-term matching, so the useful mechanism was adapted rather than copied.

## Forge improvements

- optional per-query `entityMatchRules` with stable entity IDs;
- one or more author-controlled aliases per entity;
- optional case-sensitive matching;
- optional excluded phrases for ambiguous occurrences;
- occurrence-aware exclusions: an excluded phrase suppresses only the alias occurrence it contains, not a legitimate occurrence elsewhere in the same memory;
- one entity contributes one saliency signal even if several aliases match, preventing alias-count score inflation;
- selection evidence records both the entity ID and the alias that caused selection;
- rule shape, IDs, aliases, booleans, exclusions, length limits, and duplicate IDs fail closed before retrieval;
- legacy Project Brain callers remain unchanged when no entity rules are supplied.

## Regression coverage

Focused tests cover:

- `May I` false-positive suppression while preserving a real `May Parker` occurrence;
- case-sensitive proper-name matching;
- multiple aliases with one scoring contribution;
- alias evidence;
- case-policy-aware alias deduplication;
- malformed runtime entity policies.

## Architecture constraints

This remains deterministic, project-scoped, provider-neutral, bounded by existing Project Brain result limits, and independent of external graph/vector infrastructure. Entity matching cannot promote or mutate canon.

## Verification requirement

Before merge, exact-head Forge CI must pass TypeScript build, full tests/completion/syntax gates, desktop browser acceptance, and Android/mobile acceptance.

## Next research direction

Inspect the latest combined Brain after Android 001J integration before choosing 001N. Current research suggests hybrid temporal/entity/relationship scoring is promising, but Forge should add it only if it can remain explicit, deterministic, explainable, and local-first.
