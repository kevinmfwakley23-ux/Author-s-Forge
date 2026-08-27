# Mission 018 — KDP Market Intelligence

## Scope

Provide an evidence-backed, provider-neutral market-intelligence boundary for KDP-oriented research covering genres, subgenres, niches, category structures, competing/comparable titles, publication frequency, reader expectations, pricing, cover conventions, title conventions, keyword opportunities, emerging niches, and underserved niches.

## Implementation

- `src/domain/kdp-market-intelligence.ts` defines validated evidence, signals, comparable-title observations, and bounded opportunity assessments.
- `src/application/kdp-market-intelligence.ts` defines the provider boundary and service orchestration.
- Project state persists validated market-intelligence reports without crossing project boundaries.
- `src/index.ts` exports the complete Mission 018 public API.
- `test/kdp-market-intelligence.test.js` covers creation, evidence grounding, non-guarantee enforcement, and project persistence.

## Honesty Boundary

Research observations and analytical signals are kept distinct from opportunity assessment. The assessment may use bounded language such as `promising`, but every report carries a required disclaimer that market intelligence is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance.

The static provider exists only for deterministic acceptance testing. It is not presented as live marketplace data. Real marketplace/research providers must implement the explicit provider interface and supply source-backed evidence.

## Verification

Linux remains the verification authority. Mission 018 is complete when the full repository verification suite passes.
