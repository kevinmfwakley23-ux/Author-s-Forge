# Missions 025–028 — Versioning, Author Control, Series, and Voice

## Mission 025 — Book Version Control

Forge stores immutable book snapshots with explicit draft/final/published labels. Snapshots retain manuscript and chapter state, support comparison by chapter, restoration, named branches, and three-way merges with explicit conflict detection. A merge never mutates its source snapshots.

## Mission 026 — Author Control System

Forge distinguishes `ai-suggestion`, `ai-draft`, `author-approved`, `canon-locked`, and `author-override`. Author overrides and canon locks are durable decisions scoped to the project and target. The latest author-controlled state is resolvable and cannot be silently replaced by an AI recommendation.

## Mission 027 — Series Engine

A series contains books plus shared characters, world rules, visual identities, locations, terminology, history, unresolved threads, and a cross-book timeline. Series state is project-scoped and validates that timeline events reference books belonging to the series.

## Mission 028 — Voice Preservation

Voice analysis measures sentence length, punctuation, dialogue ratio, vocabulary richness, paragraph length, narrative distance, description density, metaphor use, pacing, and emotional intensity. A reusable fingerprint can be compared with new text and converted into a provider-facing rewrite brief. The system does not replace the author's voice with a generic style and does not request imitation of named living authors.

All four systems are provider-neutral, durable project state, and exposed through the public package API. They are analytical or derived systems: canonical author decisions remain authoritative.
