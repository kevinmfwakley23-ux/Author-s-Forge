# K.I.N.G.S. Family Architecture Gospel — Author's Forge

**Status: LOCKED / OWNER-APPROVED**

**Brand:** K.I.N.G.S. = **KNOWLEDGE • INVESTIGATION • NARRATIVE • GENERATION • SYSTEM**

This document records non-negotiable architecture for **K.I.N.G.S. Author's Forge**. If an older note, test, branch, environment example, temporary integration, or future coding session conflicts with this document, this document wins unless the owner explicitly changes it.

## Identity

The product name presented to users is **K.I.N.G.S. AUTHOR'S FORGE**. "Author's Forge" may be used conversationally as a short name, but the K.I.N.G.S. brand must remain visible in primary product identity, installable-app identity, and major entry surfaces.

## Independent brain

K.I.N.G.S. Author's Forge is a standalone intelligent application. It does **not** require the separate K.I.N.G.S. AI application to be online for normal writing, editing, research, image, planning, publishing, or other AI workloads.

Forge owns its own full application brain built from the same K.I.N.G.S. Brain Core DNA:

- Project Brain and authoritative project state;
- context selection and token optimization;
- provider/model registry;
- OmniRoute integration;
- 9Router integration;
- additional authorized direct providers;
- health, cooldown, retry and failover;
- quota, cost, quality, reliability and latency policy;
- research and provenance;
- tool governance;
- verification and recovery;
- author-specific agents, prompts, schemas and workflows.

## Shared core, not copy/paste drift

K.I.N.G.S. AI, K.I.N.G.S. Author's Forge, and K.I.N.G.S. Collector's Kingdom should share reusable K.I.N.G.S. Brain Core modules/contracts where practical. They must not become three unrelated copies of provider-routing and governance logic that silently diverge.

Each app still owns its own runtime state, configuration, domain memory, provider accounts/quotas, policies and specialized workers.

## Provider policy

Normal Forge work should use the strongest appropriate configured route under owner policy. OmniRoute and 9Router are first-class routing options, followed by other authorized configured providers according to capability, quality, availability, cost, quota, latency and reliability.

Local Ollama models are supported as **last-resort/offline/local fallback**, not as the architectural center of Forge and not as the gate that determines whether normal Forge AI is operational.

## Relationship to K.I.N.G.S. AI

The separate K.I.N.G.S. AI application remains the master general-purpose engineering/building system. Forge may optionally call K.I.N.G.S. AI for software-engineering missions, cross-app orchestration, or explicitly configured model access, but that connection is optional support rather than a required dependency for Forge's ordinary AI operation.

A K.I.N.G.S. AI provider may enter Forge's model broker only when a real compatible endpoint is explicitly configured. Owner/orchestration endpoints must never be misrepresented as generic inference endpoints.

## Existing Forge routing contract

`docs/FORGE_AI_TRUNK_ROUTING_CONTRACT.md` remains mandatory and complementary to this gospel: all Forge offices share one Forge Brain/model-broker trunk rather than creating office-specific provider stacks.

## Completion rule

Architecture documentation is not implementation proof. A capability is complete only when the real product path executes it, state/evidence is preserved where required, failures are truthful, and the strongest applicable tests pass.
