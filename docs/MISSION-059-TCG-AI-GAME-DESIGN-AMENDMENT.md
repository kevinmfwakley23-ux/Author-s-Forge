# Mission 059 TCG AI Game-Design Amendment

Status: **CANONICAL REQUIREMENT AMENDMENT — 2026-09-01**

This amendment extends Mode F of `docs/MISSION-059-SPECIALIZED-CREATION-OFFICE.md`. It does **not** add a seventh Specialized Creation mode and does not turn Author's Forge into an online TCG rules simulator. It defines the authoring, canon, AI, illustration, worldbuilding, card-generation and production capabilities required for a professional trading-card-game creation environment.

## Research basis

The implementation adopts general, non-proprietary patterns rather than cloning any commercial game:

- explicit evolution/state progression, informed by published tabletop card-game evolution patterns;
- structured game concepts, objects, zones, keywords and turn structure rather than prose-only rules notes;
- data/layout separation so game canon and card truth survive template/art changes;
- approved character visual references and design locks for consistent generated art;
- normalized map coordinates and territory adjacency stored as canonical data, not baked into artwork;
- descriptive statistics plus human playtesting rather than false claims of automatic balance proof;
- accessible map/card semantics where color is never the only carrier of critical information.

## SC-TCG-AI-001 — Shared Forge AI only

TCG creation SHALL use the shared Forge Brain, shared text-provider pool, shared illustration/image-generation boundary and shared project memory. It SHALL NOT create a second TCG-only AI silo.

## SC-TCG-AI-002 — Full game framework assistance

AI SHALL be able to propose a structured game framework containing premise, player goal, victory conditions, turn structure, zones, resources, card types, keywords, factions and design notes. Generated framework changes remain proposals until author approval.

## SC-TCG-AI-003 — Character Bible linkage

A TCG character line SHALL be able to reference an existing Forge Character Bible record. Character identity, history, personality, strengths, weaknesses, visual traits and canon SHALL be retrievable from shared project truth rather than independently reinvented in card data.

## SC-TCG-AI-004 — Character evolution lines

Forge SHALL support ordered, stable-ID character progression from early-life/birth forms through intermediate forms to a final evolution where the author chooses such a progression. Each stage SHALL support:

- life-stage/evolution label and deterministic order;
- age/life-stage description where author-defined;
- detailed character description and appearance;
- strengths and weaknesses;
- magical powers;
- physical powers;
- evolution/unlock requirement where applicable;
- canonical territory/location references;
- multiple artwork candidates;
- one explicitly approved/locked artwork candidate.

The data model SHALL NOT require every original game to use the same number or names of stages.

## SC-TCG-AI-005 — Evolution card generation

Forge SHALL be able to deterministically create one or more card records from an approved character evolution line while preserving character-line/stage identity. Regeneration SHALL not silently overwrite hand-authored cards.

## SC-TCG-AI-006 — Character-consistent image generation

AI image generation SHALL consume approved character visual identity/design locks and the selected evolution-stage description. It SHALL generate artwork separately from production-critical typography. Generated images SHALL retain provider/model/request provenance and SHALL remain unapproved candidates until author approval.

## SC-TCG-AI-007 — Design locks

Authors SHALL be able to lock an approved visual design for a character/evolution stage. Subsequent AI art requests SHALL prefer approved master/turnaround/style references and SHALL preserve immutable identity traits unless the author intentionally changes canon.

## SC-TCG-AI-008 — Powers and capabilities

Character stages SHALL support structured magical powers, physical powers, passive/support capabilities, rank/strength metadata, costs where used, descriptions and tags. Forge MAY suggest mechanics and wording but SHALL not silently redefine approved character canon or game rules.

## SC-TCG-AI-009 — Strengths and weaknesses

Strengths and weaknesses SHALL remain structured character/game data and MAY feed card rules, AI design suggestions, matchup analysis and playtest review. Forge SHALL distinguish narrative/canon traits from mechanical effects instead of assuming they are identical.

## SC-TCG-AI-010 — World and territory maps

TCG projects SHALL support one or more structured world maps containing stable-ID territories, descriptions, biome/theme, resources, hazards, adjacency and normalized map positions. Map artwork is a projection/asset; territory truth remains structured data.

## SC-TCG-AI-011 — Character location on maps

Territories SHALL be able to reference specific character evolution stages, and stages SHALL be able to reference canonical territories. Forge SHALL validate broken references. AI SHALL be able to use this information when proposing lore, card art, encounters, factions and territory cards.

## SC-TCG-AI-012 — AI map assistance

AI SHALL be able to propose world-map structure, territory names/descriptions, adjacency, factions, resources, hazards and character placement. Generated map art SHALL not become the sole source of location truth.

## SC-TCG-AI-013 — Territory cards

Forge SHOULD support deterministic generation of territory/location cards from approved map data and reusable TCG templates without duplicating map truth into unrelated records.

## SC-TCG-AI-014 — Rules-document assistance

AI SHALL be able to help construct and revise the author-facing game rules/reference documentation from the approved structured framework. The system MAY model concepts needed for authoring and validation but Mission 059 still does not authorize a full digital game simulator or matchmaking engine.

## SC-TCG-AI-015 — Mechanics and balance assistance

AI MAY propose mechanics, costs, stats, keywords, rarity/distribution and counterplay. Forge SHALL present such output as design assistance, preserve evidence, run deterministic consistency/statistics checks where possible and explicitly require human playtesting before claiming balance.

## SC-TCG-AI-016 — Real image provider boundary

Image creation SHALL call a real configured provider and SHALL fail honestly if no provider is configured. Fake image URLs, placeholder generated bytes or simulated provider success are forbidden.

## SC-TCG-AI-017 — Image provenance

Every generated TCG artwork/map asset SHALL preserve at least provider, model, request evidence when exposed by the provider, prompt/source reference, creation time and author approval state.

## SC-TCG-AI-018 — Original-IP guardrail

AI prompts and built-in templates SHALL not instruct models to duplicate protected commercial TCG frames, logos, named proprietary characters or copyrighted card art. User-owned/original canon and appropriately licensed/public-domain references may be used according to Forge provenance rules.

## SC-TCG-AI-019 — Accessible map projection

Important territory distinctions in editor/map projections SHOULD use labels, boundaries or symbols in addition to color. Critical graphical UI information SHOULD follow WCAG-informed non-text contrast guidance where applicable.

## SC-TCG-AI-020 — Acceptance journey

Acceptance SHALL prove at minimum:

1. create a TCG project and structured game framework;
2. link/create a character evolution line with multiple stages including an early-life stage and final evolution;
3. assign powers, strengths, weaknesses and territories;
4. create a structured world map and validate territory adjacency/location references;
5. call a real configured image provider for a character/map candidate or fail truthfully when none is configured;
6. preserve generated-art provenance and require author approval before locking/using it as approved character art;
7. generate evolution cards from the character line;
8. render the cards with approved artwork through shared production;
9. create a playtest snapshot and export set/card data and print artifacts;
10. restart/reload without losing character progression, map truth, approvals, assets, cards or artifact lineage.

Mission 059 is not complete until these requirements are represented in the final verification matrix together with SC-TCG-001 through SC-TCG-014.
