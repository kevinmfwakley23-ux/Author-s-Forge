# First Pass 001S — Deterministic Project Brain Retrieval Evaluation

## Status

IMPLEMENTED — exact-head CI required after reconciliation with current `main`.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Branch: `first-pass/001s-brain-retrieval-evaluation`.
- Stacked after corrected 001R authority-window diagnostics.
- This capability was initially labeled 001Q during concurrent work and was relabeled before integration so 001Q can unambiguously own state-conflict safety.

## Research finding

Current RAG evaluation systems such as Ragas distinguish retrieval quality from generation quality and provide ID-based context recall, allowing a retriever to be measured against known reference document IDs without using an evaluator LLM. Forge memories already have durable IDs and explicit author authority, making this a strong local-first evaluation pattern.

## Forge improvements

- add `evaluateProjectBrainRetrieval(...)` as a deterministic application-level evaluation boundary;
- each case supplies the real `ProjectBrainQuery`, expected memory IDs, and optional forbidden memory IDs;
- evaluation executes the production Project Brain assembler rather than a mock retriever;
- per-case results preserve selected IDs, retrieved/missing expected IDs, retrieved forbidden IDs, expected recall, forbidden leak rate, and pass/fail status;
- report-level metrics aggregate expected-memory recall and forbidden-memory leak rate;
- evaluation uses memory IDs only and requires no LLM judge, embeddings, or provider credentials;
- case IDs and memory ID sets are runtime validated, bounded, deduplicated, and cannot mark the same memory as both expected and forbidden;
- entity-match, authority, temporal, saliency, and result-limit semantics are measured exactly as production retrieval uses them.

## Regression coverage

Focused tests cover perfect ID recall, missing expected memory under a tight limit, forbidden/stale-memory leakage, entity plus point-in-time query compatibility, empty/invalid cases, contradictory expected/forbidden IDs, and duplicate case IDs.

## Architecture constraints

- no LLM-as-judge dependency;
- no fabricated quality score;
- deterministic and CI-suitable;
- provider-neutral and local-first;
- expected/forbidden IDs remain explicit test truth rather than inferred canon.

## Verification requirement

Reconcile onto current `main`, then require exact-head Forge CI: TypeScript build, all unit/completion/syntax gates, desktop browser acceptance, and Android/mobile browser acceptance.
