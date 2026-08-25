# Author's Forge — Canonical Architecture

## 1. Architectural Boundary

Author's Forge is the product application. K.I.N.G.S. is the external intelligence/workforce platform that may power autonomous or assisted tasks. Forge must remain functional as a product even when K.I.N.G.S. is unavailable.

## 2. Product Layers

### Presentation Layer

The user-facing workspace for projects, books, chapters, research, characters, worlds, illustrations, covers, editing, publishing, and marketing.

### Application Layer

Coordinates user actions, project commands, workflows, permissions, autosave, checkpointing, and integrations.

### Domain Layer

Contains canonical book/project concepts: Project, Book, Series, Chapter, Scene, Character, Location, Timeline, Canon Rule, Style Profile, Research Source, Illustration Identity, Manuscript Version, Publishing Package, Marketing Campaign, and Journal Question Set.

### Intelligence Layer

Provides model routing, context assembly, generation, critique, summarization, planning, editing, research synthesis, and multimodal tasks. This layer may use K.I.N.G.S. or other model providers through explicit adapters.

### Memory Layer

Stores durable project knowledge and retrieval indexes. Memory must distinguish authoritative canon from notes, drafts, research, hypotheses, generated alternatives, and user-supplied references.

### Verification Layer

Protects continuity, factuality, formatting, style consistency, character identity, timeline integrity, manuscript completeness, and publishing readiness.

### Integration Layer

Handles K.I.N.G.S., web research providers, model providers, image-generation providers, image-editing tools, external storage, export formats, and future publishing/marketing services.

## 3. Canonical Project Model

A portable Forge project must contain everything required to resume work without relying on hidden process state. It should include project metadata, authoritative canon, memories, source records, manuscript versions, visual identity records, configuration, task/checkpoint state, and artifact references.

## 4. Long-Form Writing Architecture

Long manuscripts must not depend on one giant prompt or one model context. The system should assemble context from durable project memory, chapter/scene plans, canon rules, relevant prior text, style profiles, character state, timeline state, research references, and current task instructions. Every generated unit should be checked against continuity and style constraints before promotion.

## 5. Visual Continuity Architecture

Characters, locations, costumes, props, eras, palettes, camera/style references, and other visual attributes should be saved as structured visual identities. Generated images can reference these identities so a series retains recognizable visual continuity.

## 6. Research Architecture

Research must be source-aware. Store the source URL/reference, retrieval date, extracted claims, confidence/verification state, project relevance, and relationship to canon. The system should distinguish research evidence from narrative invention.

## 7. Reliability Architecture

All significant operations should support checkpointing, resumable workflows, deterministic project persistence, failure diagnostics, bounded retries, and human review gates where appropriate.

## 8. Security Boundary

Generated content never receives unrestricted filesystem authority. File operations, external tools, network access, and project writes must pass explicit authorization boundaries.

## 9. Mission-Based Development

The application is built through small missions. Every mission has scope, dependencies, acceptance criteria, verification, and a durable checkpoint. Dependent missions do not proceed on unverified state.
