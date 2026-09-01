# First Pass 001Q — Deterministic Project Brain Retrieval Evaluation

## Status

IMPLEMENTED — exact-head CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Branch: `first-pass/001q-brain-retrieval-evaluation`.
- Stacked after 001P.
- This completes the current four-block forward batch 001N–001Q after the 001M reconciliation block.

## Research finding

Current RAG evaluation systems such as Ragas distinguish retrieval quality from generation quality and provide ID-based context recall, allowing a retriever to be measured against known reference document IDs without using an evaluator LLM. This is a strong fit for Forge because memories already have durable IDs and author-controlled authority.

## Forge improvements

- add `evaluateProjectBrainRetrieval(...)` as a deterministic application-level evaluation boundary;
- each case supplies the real `ProjectBrainQuery`, expected memory IDs, and optional forbidden memory IDs;
- evaluation executes the production Project Brain assembler rather than a parallel mock retriever;
- per-case results preserve selected IDs, retrieved/missing expected IDs, retrieved forbidden IDs, expected recall, forbidden leak rate, and pass/fail status;
- report-level metrics aggregate expected-memory recall and forbidden-memory leak rate across all cases;
- evaluation uses memory IDs only and does not require an LLM judge, embeddings, or provider credentials;
- case IDs and memory ID sets are runtime validated, bounded, deduplicated, and cannot mark the same memory as both expected and forbidden;
- existing entity-match, authority, temporal, saliency, and limit semantics are evaluated exactly as production retrieval uses them.

## Regression coverage

Focused tests cover perfect ID recall, missing expected memory under a tight limit, forbidden/stale-memory leakage, entity plus point-in-time query compatibility, empty/invalid cases, contradictory expected/forbidden IDs, and duplicate case IDs.

## Architecture constraints

- no LLM-as-judge dependency;
- no fabricated quality score;
- deterministic and CI-suitable;
- provider-neutral and local-first;
- evaluation executes the real Project Brain retrieval implementation;
- expected and forbidden IDs remain explicit test truth supplied by engineers/authors rather than inferred canon.

## Verification requirement

Before merge, exact-head Forge CI must pass TypeScript build, all unit/completion/syntax gates, desktop browser acceptance, and Android/mobile browser acceptance.
