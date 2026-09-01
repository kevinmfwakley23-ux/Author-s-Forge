# ADR-059-001 — Specialized Creation composition renderer

**Status:** Accepted for Mission 059

## Context

Mission 059 needs durable renderer-independent composition, Chromebook/Android interaction, deterministic production output, Unicode-capable editable source, low dependency risk on ARM Linux, and testable headless rendering. A canvas framework must not become project truth.

## Decision

Use the Mission 059 structured `SpecializedDocument` as authoritative state. Use **native SVG** as the first interactive/vector projection because it is browser-native, touch/DOM testable, serializable, supports Unicode text, shapes, images and grouping, and works without an architecture-defining third-party runtime. Use a separate server production engine for PDF, PNG/CBZ and data artifacts. Editor zoom/pan is view state only and never changes source geometry.

## Consequences

- No Fabric/Konva dependency is required for the initial office.
- SVG is a projection, not stored truth.
- Required copy stays structured text and is available to accessible/editor semantics.
- More advanced freeform illustration tools can be evaluated later without migrating the canonical document model.
- PDF text uses the production engine's supported font path; SVG remains the Unicode-capable vector source when a PDF font cannot represent a codepoint.

## Alternatives

- Fabric.js: capable, but would add a substantial mutable canvas object model and serialization coupling.
- Konva: capable and touch-oriented, but similarly risks coupling project truth to a canvas scene graph.
- Browser-only Canvas 2D: insufficient as authoritative/editable vector representation.

## Evidence

Mission 059 research register: professional DTP separation of document state and render/export; browser SVG standards; Chromebook/Android first-class constraints; Forge's existing dependency-light architecture.
