# MISSION 059 — SPECIALIZED CREATION OFFICE

**Status:** RESEARCH LOCKED — IMPLEMENTATION MAY BEGIN ONLY AGAINST THIS CONTRACT  
**Research lock date:** 2026-08-31 (America/Denver)  
**Canonical parent:** `docs/AUTHORS_FORGE_CANONICAL_ARCHITECTURE.md`  
**Progress ledger:** `README.md`  
**Office boundary:** 09 Specialized Creation  

---

## 1. Mission purpose

Mission 059 turns the existing Specialized Creation foundations into one professional, durable, author-controlled creation workplace for exactly six product modes:

1. **Comic books**
2. **Greeting cards**
3. **Birthday cards**
4. **Invitations**
5. **Flyers**
6. **Trading card game cards**

The mission exists to prevent implementation drift. It is not a brainstorm. It is the build contract for this office.

Every implementation PR under Mission 059 MUST identify the requirement IDs it satisfies, the evidence used to justify significant workflow/production decisions, and the verification performed. Features outside this contract require an explicit mission amendment or ADR before implementation.

Guided journals are **not** part of this mission. The Guided Journal Office is already a separate completed office.

---

## 2. Non-negotiable Forge architecture rules

The locked canonical architecture remains authoritative.

### SC-ARCH-001 — One Forge Brain

The Specialized Creation Office SHALL consume the existing Forge Brain, Project Brain, durable project memory, author voice, research, provider routing, failover, governance, approvals, recovery, shared artifact contracts, PWA/device foundations and production services. It SHALL NOT create a second memory system, provider pool, AI gateway or project database.

### SC-ARCH-002 — Preserve working trunk capabilities

Existing working Forge services SHALL be reused or extended rather than duplicated merely to make the office look self-contained.

### SC-ARCH-003 — One office, mode adapters

The six creation modes SHALL share a common specialized-creation trunk for persistence, versioning, assets, composition, approvals, Brain/AI access, production profiles, preflight and artifacts. Mode-specific behavior SHALL be implemented as explicit mode schemas/workflows/adapters, not six unrelated applications.

### SC-ARCH-004 — Durable model is renderer-independent

The canonical project/document model SHALL be serializable structured state independent of Fabric.js, Konva, SVG DOM, Canvas, PDF libraries or any other renderer. A browser canvas SHALL never become the authoritative source of project truth.

### SC-ARCH-005 — Separate content, layout, assets and production

Forge SHALL preserve four distinct concerns:

- **content/data** — words, fields, structured game/event/story data;
- **layout/composition** — surfaces, pages, panels, coordinates, hierarchy, styles;
- **assets** — artwork, references, logos, icons, backgrounds, fonts and provenance;
- **production** — trim, bleed, safe area, DPI, color intent, imposition and export artifacts.

This separation is required for editing, reflow, alternate sizes, regeneration, accessibility, printer profiles, versioning and recovery.

### SC-ARCH-006 — Required text remains editable text

Required copy SHALL remain editable text/vector content through the production pipeline. AI image generation SHALL NOT be relied upon to render required comic dialogue, card messages, invitation details, flyer calls-to-action, TCG rules text, legal copy, names, dates, addresses or other production-critical text.

### SC-ARCH-007 — Provider/profile independence

Printer and platform requirements SHALL be represented as production profiles. The office SHALL NOT hard-code one print vendor as the universal truth. Defaults may be supplied, but projects must retain physical dimensions and production intent independent of a vendor.

---

## 3. Existing implementation that must be preserved and reconciled

Mission 059 begins with real foundations already present in `main`. These are source material, not disposable prototypes:

- `src/domain/specialized-creation.ts`
  - exact six canonical modes;
  - specialized project identity/status;
  - bleed/safe margin/DPI/color-profile foundation.
- `src/domain/specialized-creation-workflows.ts`
  - shared workflow stages: **brief → plan → create → review → production**.
- `src/domain/specialized-creation-workspace.ts`
  - structured assets, documents, elements and mode-supported roles.
- `src/domain/specialized-creation-production.ts`
  - mode-aware production artifact kinds.
- `src/application/specialized-creation.ts`
  - workspace creation, role validation and asset/document operations.
- existing specialized-creation regression tests.

Implementation SHALL first inspect and reconcile these contracts. No rewrite is authorized merely because a new mission document exists.

---

## 4. Research method and evidence hierarchy

Research for this mission deliberately combines professional standards, production guidance, mature open-source systems and established creator workflows.

When sources conflict, implementation decisions should prefer evidence in roughly this order:

1. **formal/industry specifications and platform requirements**;
2. **official professional production documentation**;
3. **mature open-source implementations with real users**;
4. **established professional creator/printer workflows**;
5. **commercial-product workflow observations**;
6. **unverified blog/opinion material only as supporting evidence**.

No external application is a blueprint to clone. Forge adopts proven principles and rebuilds them around its own durable Brain, provenance, approval, recovery and cross-office architecture.

---

## 5. Research adoption ledger

This ledger separates practices we are adopting from technologies that still require evaluation.

| Area | Evidence / precedent | Mission decision |
|---|---|---|
| Requirements discipline | NASA requirements management + verification matrix | **ADOPT:** uniquely identified SHALL requirements, source/evidence, verification method and bidirectional traceability. |
| Architectural decisions | ADR community/AWS/Fowler practices | **ADOPT:** context → decision → consequences; important changes are superseded/amended, not silently rewritten. |
| Professional print | Adobe InDesign/Acrobat print-production guidance, professional printer specs | **ADOPT:** trim/bleed/safe zones, font/image preflight, PDF production checks, page boxes, output profiles and warnings. |
| Composition state | Professional DTP + modern graphics editors | **ADOPT:** structured document model separate from interactive renderer and final renderer. |
| Comics | MoMA sequential-art guidance, professional lettering guidance, comic printer specs | **ADOPT:** panel rhythm, explicit reading order, separate editable lettering, page-turn awareness, print safe areas. |
| CBZ | PRONOM + reader/publishing documentation | **ADOPT:** CBZ as ordered ZIP image package, stable zero-padded filenames, optional metadata. |
| Folded cards | professional folded-card printer setup guidance | **ADOPT:** explicit four-surface model, fold/orientation awareness, flat-size production dimensions, fold preview and test/preflight. |
| Card messaging | Hallmark writing guidance | **ADOPT:** recipient relationship, occasion, tone and specific personalization as structured author inputs. |
| Invitations | Greenvelope/Shutterfly/The Knot event wording practice | **ADOPT:** structured host/event/date/time/location/RSVP hierarchy and missing-information validation. |
| Flyers | Figma/Adobe/UF communication-design guidance | **ADOPT:** goal-first hierarchy, headline → key value/details → single primary CTA, whitespace/readability checks and digital variants. |
| QR codes | DENSO WAVE QR specification guidance | **ADOPT:** preserve quiet zone/module integrity and add scan-oriented preflight when QR is used. |
| TCG authoring | Squib + Magic Set Editor | **ADOPT concepts:** data/layout separation, templates, batch generation, set-level checks/statistics and reproducible playtest output. Do not adopt proprietary game assets. |
| Interactive editor | Fabric.js / Konva / native SVG | **EVALUATE:** no dependency is locked until Mission 059B technology gate proves touch, serialization, export fidelity, headless rendering and bundle suitability. |
| PDF generation | pdf-lib + existing Forge PDF infrastructure | **EVALUATE/EXTEND:** Unicode font embedding, vector text/shapes, images, page boxes and deterministic output must be proven. |
| SVG rasterization | resvg-js or equivalent | **EVALUATE:** only if it improves deterministic PNG/JPEG production across Node/browser targets. |

---

## 6. Shared canonical data model

The exact TypeScript shape may evolve through implementation, but the following conceptual boundaries are locked.

```text
SpecializedCreationProject
  ├─ identity / mode / title / status
  ├─ CreativeBrief
  ├─ WorkflowState
  ├─ RevisionHistory
  ├─ ApprovalState
  ├─ SpecializedDocument[]
  │    ├─ Surface/Page[]
  │    │    ├─ Element[]
  │    │    │    ├─ structured content
  │    │    │    ├─ geometry
  │    │    │    ├─ style tokens
  │    │    │    └─ asset references
  │    │    └─ reading/fold/page order metadata
  │    └─ mode-specific structured data
  ├─ AssetReference[]
  ├─ Template/StyleToken references
  ├─ ProductionProfile
  ├─ PreflightReport[]
  ├─ AIProposal[]
  └─ ProductionArtifact[]
```

### SC-CORE-001 — Durable persistence

All authoritative specialized projects, documents, revisions, approvals, assets/asset references, production profiles and export metadata SHALL survive process restart and browser reload.

### SC-CORE-002 — Project scoping

Every specialized record SHALL be project-scoped and SHALL reject cross-project references unless a future explicit shared-library contract permits them.

### SC-CORE-003 — Revisions instead of silent destructive mutation

Meaningful content/layout changes SHALL produce durable revision lineage or an equivalent auditable history. AI SHALL never silently overwrite approved state.

### SC-CORE-004 — Stable identifiers

Projects, documents, pages/surfaces, panels, elements, assets, templates, card records and production artifacts SHALL use stable IDs so downstream references survive reordering.

### SC-CORE-005 — Deterministic ordering

Page, panel, surface, layer, card and export ordering SHALL be explicit and deterministic.

### SC-CORE-006 — Shared asset provenance

Assets SHALL retain origin/provenance sufficient to distinguish author upload, Forge generation, imported reference, licensed asset and system-generated derivative. Generated assets SHALL retain provider/model/request evidence when available.

### SC-CORE-007 — Author approval boundary

AI-generated copy, layout recommendations and structured content SHALL remain proposals until the author explicitly applies/approves them where they would alter authoritative project content.

---

## 7. Forge Brain and AI integration requirements

### SC-BRAIN-001 — Shared Project Brain

Every AI-assisted specialized workflow SHALL use the shared Project Brain/context boundary rather than receiving an isolated manually assembled prompt dump.

### SC-BRAIN-002 — Mode-relevant context

Context assembly SHALL be capability-aware. Examples:

- comic work may request characters, visual identities, locations, continuity, dialogue/voice and story state;
- greeting/birthday card work may request author-approved recipient/project facts and style direction;
- invitations may request event facts and visual identity;
- flyers may request brand, offer/event, audience, marketing and visual identity;
- TCG may request game/set rules, terminology, card schema, art direction and set consistency.

### SC-AI-001 — Shared providers/failover

Text AI SHALL use the existing Forge provider pool/routing/failover. Image generation SHALL use the shared Forge visual/provider boundary. No specialized-only provider stack is authorized.

### SC-AI-002 — Honest failure

If no real provider is configured or a provider fails, Forge SHALL report an actionable error. It SHALL NOT fabricate AI output.

### SC-AI-003 — Proposal evidence

AI proposals SHALL retain provider/model/request/provenance evidence available from the shared provider boundary.

### SC-AI-004 — No automatic canon/brand/rule mutation

AI output SHALL NOT silently change canon, character identity, event facts, brand identity, game rules, set schemas or approved copy.

### SC-AI-005 — Structured generation validation

Where AI is asked for structured page plans, card records, invitation fields, panel scripts or other machine-consumed structures, output SHALL be schema-validated before it can enter a proposal or authoritative state.

### SC-AI-006 — Regeneration is scoped

Forge SHALL support regeneration/revision at the smallest sensible unit—e.g. one comic panel description, one card message, one invitation wording block, one flyer section or one TCG card—without forcing unrelated approved content to change.

---

## 8. Shared visual-composition requirements

### SC-COMP-001 — Renderer evaluation gate

Before adopting Fabric.js, Konva, native SVG or another interactive composition dependency, Mission 059B SHALL document and test:

- permissive license suitability;
- Chromebook browser support;
- Android touch/drag/resize behavior;
- keyboard/accessibility behavior;
- deterministic serialization round-trip;
- text metrics and multiline handling;
- clipping/masks/groups/transforms;
- high-resolution export behavior;
- headless Node rendering path or clean separation from production renderer;
- SVG/vector interoperability;
- bundle/runtime impact;
- testability under Playwright.

The chosen renderer is an implementation detail beneath the canonical document model.

### SC-COMP-002 — Core element types

The shared composition model SHALL support, at minimum:

- text blocks;
- raster images;
- vector shapes;
- lines/dividers;
- frames/masks/crops;
- groups;
- backgrounds;
- optional QR/barcode-like generated graphics where the product mode permits them;
- mode-specific elements such as comic balloons/panels or TCG stat/rule fields.

### SC-COMP-003 — Layering and locking

Elements SHALL have explicit z-order. Author controls SHALL support selection, move, resize where applicable, hide/show, lock/unlock and delete with undo/revision protection.

### SC-COMP-004 — Geometry in physical-aware units

Canonical geometry SHALL be capable of deterministic conversion to production dimensions. The system SHALL avoid storing only viewport pixels as production truth.

### SC-COMP-005 — Templates are data

Templates SHALL be structured reusable layouts/style-token references rather than copied opaque screenshots. User templates SHALL be versionable and reusable without mutating existing documents.

### SC-COMP-006 — Style tokens

Reusable typography, spacing, color, stroke, corner, frame and related design tokens SHOULD be available so sets/suites stay consistent and can be revised systematically.

### SC-COMP-007 — Non-destructive image placement

Cropping/scaling/positioning SHALL reference the original asset non-destructively whenever possible.

### SC-COMP-008 — Live production guides

The editor SHALL visibly support trim, bleed and safe-area guides where relevant, with ability to preview without guides.

### SC-COMP-009 — Reflow/variant architecture

Alternate output sizes SHALL derive from the same content/data where practical. Forge SHALL not require authors to re-enter core copy for every digital/print variant.

---

## 9. Shared production and preflight requirements

### SC-PROD-001 — Physical production profile

Each export SHALL bind to an explicit production profile containing at minimum physical size, bleed, safe area, output resolution, color intent/profile where supported, reading/fold/duplex direction where relevant and allowed artifact formats.

### SC-PROD-002 — Production artifacts are real bytes

A capability is not complete because a browser preview looks correct. Production paths SHALL produce real downloadable artifacts with deterministic metadata such as MIME type, dimensions/page count, byte length and digest where appropriate.

### SC-PROD-003 — Print and digital variants

Modes SHALL produce the formats appropriate to their use cases, including print PDF plus supported PNG/JPEG/SVG/CBZ/data variants defined by the mode contract.

### SC-PROD-004 — Font handling

Production-critical text SHALL use fonts that can be legally and technically embedded/rendered. Preflight SHALL detect missing/unavailable fonts. Unicode-capable text SHALL not be silently degraded to unsupported standard-font encodings.

### SC-PROD-005 — Image resolution

Preflight SHALL determine effective raster resolution at placed size and warn/block according to the selected production profile. A nominal source DPI field alone is not sufficient.

### SC-PROD-006 — Bleed/safe validation

Preflight SHALL detect important content outside the safe area and insufficient full-bleed coverage where an element is intended to bleed.

### SC-PROD-007 — Text overflow

Overset/clipped production-critical text SHALL be detected before export approval.

### SC-PROD-008 — Page/surface boxes

PDF production SHOULD explicitly preserve correct media/trim/bleed intent where the chosen PDF pipeline supports it.

### SC-PROD-009 — QR validation

Where a QR code is used, Forge SHALL preserve required quiet-zone/module integrity, adequate contrast and sufficient physical module size. The office SHOULD provide a decode/test verification step before final approval.

### SC-PROD-010 — Printer/platform profiles

Profiles SHALL be selectable/versioned. Vendor-specific requirements may be added without changing canonical document content.

### SC-PROD-011 — Production approval

Final production export SHALL record the document revision and production profile used so an artifact can be traced back to its source state.

---

# 10. MODE A — COMIC BOOKS

Comic production is sequential storytelling plus structured script, visual composition, lettering and multi-page production. It is not merely a stack of AI-generated images.

## 10.1 Comic canonical workflow

```text
Comic brief
  → issue/book plan
  → pages
  → panel layouts
  → panel beats / shot / characters / setting
  → dialogue / captions / SFX
  → art direction + assets/generation
  → editable lettering
  → page review / continuity / reading order
  → issue-level review
  → print PDF + digital package/CBZ
```

### SC-COMIC-001 — Structured hierarchy

Comic documents SHALL model issue/book → page → panel → content/lettering elements with stable identifiers and explicit order.

### SC-COMIC-002 — Script remains structured

Panel descriptions, dialogue, captions and sound effects SHALL remain editable structured data connected to their panels rather than being lost inside flattened art.

### SC-COMIC-003 — Reading direction

A comic SHALL declare reading direction/order rules (at minimum LTR and RTL capability in the data model). Panel and lettering order SHALL be deterministic and reviewable.

### SC-COMIC-004 — Panel geometry

Pages SHALL support panel frames, gutters, spanning/irregular arrangements where technically supported, reordering and layout templates. The system SHALL preserve panel IDs when geometry changes.

### SC-COMIC-005 — Pacing awareness

The planning surface SHOULD expose page/panel counts and relative panel size/order so authors can intentionally control rhythm, emphasis and page turns rather than treating each illustration independently.

### SC-COMIC-006 — Page-turn/reveal metadata

Forge SHOULD allow pages/panels to be marked for reveal, splash, transition or other pacing intent so Brain/AI suggestions can respect page-turn storytelling.

### SC-COMIC-007 — Separate lettering layer

Dialogue balloons, captions and SFX SHALL be editable composition elements separate from artwork. Production-critical lettering SHALL not be generated as pixels inside panel art.

### SC-COMIC-008 — Balloon semantics

Speech balloons SHOULD retain speaker association, tail target/anchor and reading order. Captions/SFX SHALL retain distinct semantic roles.

### SC-COMIC-009 — Lettering preflight

Comic preflight SHALL detect at least text overflow, missing/ambiguous required speaker/tail association where applicable, elements outside safe bounds and reading-order anomalies that can be determined structurally.

### SC-COMIC-010 — Visual continuity

Comic art generation/selection SHALL be able to consume approved character visual identities, locations, props and style direction from Forge rather than reinventing them panel by panel.

### SC-COMIC-011 — Art versions

Each panel/page SHALL support multiple candidate/revision assets without silently deleting prior approved assets.

### SC-COMIC-012 — Print profile

Comic production SHALL support configurable trim/bleed/safe profiles, including common US comic dimensions as presets only—not universal hard-coded requirements.

### SC-COMIC-013 — CBZ

CBZ export SHALL package ordered page images using stable zero-padded filenames. Optional `ComicInfo.xml` or equivalent metadata MAY be included through a documented metadata contract.

### SC-COMIC-014 — Comic artifacts

At minimum, the completed comic path SHALL prove real print PDF and CBZ generation from the same approved comic document; high-resolution page image export SHALL also be supported.

### SC-COMIC-015 — Comic acceptance journey

Browser acceptance SHALL prove: create comic → add/reorder pages/panels → create/approve structured text → attach/generate art → letter a panel → render page → export PDF/CBZ → reload/restart without losing ordering/content/assets.

---

# 11. MODE B — GREETING CARDS

Greeting cards are folded multi-surface products with recipient/occasion-driven messaging and print/digital output.

### SC-GREET-001 — Four-surface model

Folded cards SHALL model **front, inside-left/top, inside-right/bottom and back** as explicit logical surfaces even when a selected physical fold/orientation maps them differently in the flat production file.

### SC-GREET-002 — Fold/orientation model

The production profile SHALL describe fold direction/orientation and flat size. Preview SHALL make front/back/inside relationships understandable before export.

### SC-GREET-003 — Structured message brief

Greeting message assistance SHALL accept explicit author inputs such as occasion, recipient relationship, desired tone, sentiment intensity, humor preference, personalization facts and closing/signature intent.

### SC-GREET-004 — Sensitive preferences are explicit

Religious/faith language, health conditions, identity traits or other sensitive recipient attributes SHALL NOT be inferred by the office. They may be used only when explicitly supplied by the author for the requested content.

### SC-GREET-005 — Message surfaces

The document SHOULD distinguish front hook/headline from inside message and closing/signature so AI or layout changes can be scoped.

### SC-GREET-006 — Fold safety

Preflight SHALL check critical text/art against fold, trim and safe areas and SHALL preview the imposed flat layout.

### SC-GREET-007 — Greeting artifacts

The mode SHALL support print PDF and high-quality share/preview image export.

### SC-GREET-008 — Greeting acceptance journey

Acceptance SHALL prove: brief → personalized copy proposal → author approval → four-surface composition → fold preview → print preflight → PDF/image export → restart persistence.

---

# 12. MODE C — BIRTHDAY CARDS

Birthday cards share the folded-card composition/production trunk but require a distinct content model rather than being an alias for generic greeting cards.

### SC-BDAY-001 — Birthday-specific brief

Birthday assistance SHALL support recipient relationship, age/milestone when author-supplied, tone, humor, sentiment, distance/belated context where relevant and explicit personalization facts.

### SC-BDAY-002 — Milestone handling

Milestone/age references SHALL be author-controlled and SHALL never be guessed.

### SC-BDAY-003 — Tone families

The system SHOULD support author-selectable direction such as short/simple, heartfelt, funny, milestone, across-distance, belated and other non-sensitive tone families without forcing formulaic copy.

### SC-BDAY-004 — Shared fold engine

Birthday cards SHALL reuse the same four-surface/fold/production engine as greeting cards while preserving birthday-specific content schema/workflows.

### SC-BDAY-005 — Birthday acceptance journey

Acceptance SHALL prove a birthday-specific brief changes the proposal/workflow meaningfully while all card fold/preflight/export/restart guarantees remain intact.

---

# 13. MODE D — INVITATIONS

Invitations are structured event-information products. Accuracy and hierarchy are as important as visual design.

### SC-INV-001 — Event schema

Invitation projects SHALL support structured fields for at least:

- event type;
- host(s)/honoree(s)/primary names;
- date;
- start time and timezone where relevant;
- venue name;
- location/address;
- RSVP method;
- RSVP deadline where applicable;
- optional dress code;
- optional additional details;
- optional accessibility/logistics notes;
- optional website/QR destination;
- privacy/share intent.

### SC-INV-002 — Required-information validation

Forge SHALL warn when core event information required by the chosen invitation type is missing. It SHALL not invent dates, times, addresses or RSVP details.

### SC-INV-003 — Hierarchy

The editor/template model SHALL distinguish primary event identity/names from date/time/location, supporting details and RSVP/CTA so visual hierarchy can be checked and reflowed.

### SC-INV-004 — Suite support

The model SHALL be capable of a coordinated invitation suite (main invitation plus details/RSVP or digital companion surfaces) without duplicating core event facts into unrelated unlinked records.

### SC-INV-005 — Single event truth

Changing a structured event fact SHOULD propagate to linked suite surfaces that display that fact, subject to author review where necessary.

### SC-INV-006 — Digital/print variants

The mode SHALL support print-ready output and a phone-friendly digital/share variant derived from the same event truth.

### SC-INV-007 — QR

If an invitation uses QR for RSVP/details, QR preflight requirements apply and the human-readable destination SHOULD remain available in project state.

### SC-INV-008 — Invitation acceptance journey

Acceptance SHALL prove structured event entry → wording proposal → author approval → suite layout → fact correction propagates → print/digital export → missing-field/QR preflight → restart persistence.

---

# 14. MODE E — FLYERS

Flyers are goal-driven visual communication products. The office must help authors preserve hierarchy and one clear action rather than merely place arbitrary text boxes.

### SC-FLYER-001 — Communication brief

Flyer projects SHALL capture objective, audience, primary message/headline, value/offer/event, core details, brand/trust elements, primary CTA, contact/destination and optional legal/disclaimer content.

### SC-FLYER-002 — One primary CTA

The structured model SHALL identify one primary CTA. Secondary actions may exist but preflight SHOULD warn when multiple equally prominent competing CTAs undermine the selected goal.

### SC-FLYER-003 — Hierarchy roles

Elements SHOULD carry semantic roles such as headline, subhead/value, details, CTA, contact, disclaimer and brand so layout analysis is not based only on raw coordinates.

### SC-FLYER-004 — Hierarchy/readability checks

Preflight SHOULD identify risks such as overly dense copy, tiny critical text, low contrast, CTA buried below lower-priority content and key event/contact details missing.

### SC-FLYER-005 — Variant/reflow system

The same flyer content SHOULD be reusable across common print and digital aspect ratios via templates/reflow—not destructive manual duplication of the source content.

### SC-FLYER-006 — QR and destinations

QR/URL/phone destinations SHALL remain structured and editable, with QR preflight when used.

### SC-FLYER-007 — Flyer artifacts

The mode SHALL support print PDF and high-resolution PNG/JPEG digital variants; SVG MAY be supported when the document can be represented safely.

### SC-FLYER-008 — Flyer acceptance journey

Acceptance SHALL prove: goal/audience brief → AI copy/layout proposal → approval → composition → alternate size/variant → hierarchy/QR/print preflight → PDF/image export → restart persistence.

---

# 15. MODE F — TRADING CARD GAME CARDS

The TCG mode is a data-driven card/set authoring system. It is **not** a clone of Magic, Pokémon, Yu-Gi-Oh! or any other proprietary game and is not a full digital rules engine.

### SC-TCG-001 — Game/set/card separation

The model SHALL distinguish:

- game or rules context;
- set/expansion metadata;
- reusable card schemas/types;
- reusable visual templates/style tokens;
- individual card records;
- artwork/assets;
- production/export configuration.

### SC-TCG-002 — Extensible card schema

Authors SHALL be able to define custom card fields/types without Forge hard-coding one commercial game's mechanics. Typed custom fields SHOULD support useful validation.

### SC-TCG-003 — Common card identity fields

The shared card model SHOULD support conventional optional fields such as stable ID, collector/card number, title/name, type/subtype, rarity, rules text, flavor text, costs/stats, tags, set symbol/branding references, front/back configuration and artwork reference while allowing custom fields.

### SC-TCG-004 — Data/layout separation

Card data SHALL remain separate from frame/template geometry and styles so an entire set can be re-rendered when a template changes.

### SC-TCG-005 — Data import/export

The mode SHALL support structured JSON export/import and SHOULD support CSV import/export for flat card datasets where schema compatibility permits it.

### SC-TCG-006 — Batch generation

Forge SHALL render/export sets deterministically from card data + template + assets without requiring each card to be manually rebuilt.

### SC-TCG-007 — Template inheritance

Templates/style tokens SHALL support DRY set-wide consistency. A frame/type variant SHOULD override only what differs from its parent/default template.

### SC-TCG-008 — Text fitting

Rules/flavor/stat text overflow SHALL be detected. Any auto-fit behavior must remain deterministic, bounded and visible to the author rather than silently shrinking text below acceptable production limits.

### SC-TCG-009 — Set consistency checks

Set-level analysis SHALL detect at minimum duplicate/missing IDs or collector numbers, required-field gaps, template mismatch, missing artwork, text overflow and production issues.

### SC-TCG-010 — Set statistics are descriptive, not a balance oracle

Forge MAY compute distributions/outliers for costs, stats, types, rarity and other numeric/schema fields to assist design review. It SHALL NOT claim mathematical statistics alone prove gameplay balance. Human playtesting remains required.

### SC-TCG-011 — Playtest snapshots

Authors SHALL be able to create versioned set snapshots suitable for playtesting so later edits can be compared against a known test build.

### SC-TCG-012 — Individual and sheet exports

The mode SHALL support individual card images and imposed printable sheets. Duplex front/back output SHALL have explicit alignment/orientation rules when enabled.

### SC-TCG-013 — IP safety

Forge SHALL NOT bundle copyrighted/trademarked commercial card frames, icons, logos, proprietary rule text or unlicensed fonts merely to mimic existing games. Templates shipped with Forge must be original/generic or appropriately licensed.

### SC-TCG-014 — TCG acceptance journey

Acceptance SHALL prove: define schema/template → import/create multiple cards → batch render → detect set inconsistency/overflow → create playtest snapshot → update shared template → entire set re-renders without data loss → export individual cards + sheet + data → restart persistence.

---

## 16. Accessibility, readability and device behavior

### SC-UX-001 — Chromebook and Android first-class

The live office SHALL be usable on supported Chromebook and Android browser/PWA environments. Touch targets, dragging, resizing, scrolling, selection and dialogs must be acceptance-tested rather than assumed.

### SC-UX-002 — No horizontal app failure

Phone-sized acceptance SHALL guard against unusable document/editor chrome overflow. The canvas/work area may pan/zoom intentionally, but the application shell and critical controls must remain operable.

### SC-UX-003 — Keyboard and screen-reader semantics

Important non-canvas controls SHALL use semantic HTML and keyboard-operable patterns. The durable model's semantic roles should support accessible labels/descriptions even when the visual composition is canvas-rendered.

### SC-UX-004 — Contrast/readability assistance

For digital/share outputs and editor warnings, Forge SHOULD provide WCAG-informed contrast/readability checks. These checks are advisory where artistic print use differs, but critical information must not become unreadable without warning.

### SC-UX-005 — Zoom independent of source geometry

Editor zoom/pan SHALL not mutate production geometry.

---

## 17. Security, privacy, licensing and provenance

### SC-GOV-001 — Asset provenance

Author uploads, generated images, imported logos/fonts/templates and external references SHALL retain source metadata sufficient for later auditing.

### SC-GOV-002 — No license laundering

Forge SHALL not treat an imported/generated asset as commercially cleared merely because it can technically be exported.

### SC-GOV-003 — Sensitive facts are author supplied

The AI assistant SHALL not infer sensitive recipient/event/person attributes as personalization facts. If such information is intentionally provided by the author, it remains governed project context.

### SC-GOV-004 — External links/QR review

External destinations encoded in QR/link elements SHALL be visible in editable project state and final review/preflight.

### SC-GOV-005 — Generated-content attribution

Provider/model/request evidence SHALL be retained for generated assets/copy where the shared provider system exposes it.

---

## 18. Explicit non-goals / anti-drift fence

Mission 059 does **not** authorize:

- building a second Forge Brain or provider system;
- guided-journal functionality;
- a wholesale Studio UI redesign;
- cloning Adobe Photoshop, Illustrator, InDesign or Canva feature-for-feature;
- building a full digital comic reader/storefront;
- building printer ordering/e-commerce/fulfillment;
- building a complete RSVP hosting platform;
- building a full TCG rules simulator, matchmaking service or online game engine;
- bundling commercial TCG intellectual property;
- a general-purpose CAD/vector-illustration application unrelated to the six modes;
- replacing working Cover, Art, Project Brain, Production or Vault systems without an evidence-backed architectural need;
- browser-only state presented as durable functionality;
- fake AI/image responses or preview-only exports presented as production artifacts.

Any proposal crossing this fence requires a mission amendment or separate future mission.

---

## 19. Mission 059 phased engineering sequence

Implementation is intentionally phased to keep changes reviewable and stop scope drift.

### 059A — Research lock and traceability foundation — **THIS DOCUMENT**

Deliverables:

- research/adoption ledger;
- canonical requirements with IDs;
- no-drift rules;
- source register;
- verification matrix structure;
- README linkage.

**No production code is required for 059A.**

### 059B — Shared Specialized Creation trunk

Deliverables:

- reconcile existing domain/workspace/workflow/production models;
- durable project/workspace/revision/proposal storage;
- project-scoped application facade;
- Project Brain hydration/persistence bridge;
- shared provider/AI proposal integration;
- asset provenance/library bridge;
- renderer technology evaluation ADR;
- reusable composition document contract;
- generic production-profile/preflight foundation.

Completion gate: build/tests + restart persistence + no duplicate Brain/provider/storage stack.

### 059C — Shared composition + production editor

Deliverables:

- live composition surface;
- text/image/shape/group/frame primitives;
- layers/locking/order;
- trim/bleed/safe guides;
- templates/style tokens;
- zoom/pan independent from source geometry;
- deterministic preview and production rendering;
- Unicode-capable text/font path;
- real PDF/PNG/JPEG/SVG path as supported;
- browser + Android touch acceptance.

### 059D — Comic Book vertical slice

Deliver all SC-COMIC requirements, real Studio workflow and PDF/CBZ acceptance.

### 059E — Greeting + Birthday Card vertical slices

Build one shared fold/surface engine with separate greeting and birthday content schemas. Deliver all SC-GREET and SC-BDAY requirements.

### 059F — Invitation vertical slice

Deliver event schema, suite/fact propagation, print/digital outputs and all SC-INV requirements.

### 059G — Flyer vertical slice

Deliver hierarchy/CTA model, variant/reflow behavior, print/digital output and all SC-FLYER requirements.

### 059H — TCG vertical slice

Deliver schema/template/data separation, batch generation, set checks/statistics, snapshots, sheets and all SC-TCG requirements.

### 059I — Cross-mode production hardening

Deliver:

- common preflight report UX;
- production profiles/versioning;
- effective-resolution checks;
- font/overflow/bleed/safe-area checks;
- QR checks where used;
- artifact lineage/digests;
- regression fixtures for all mode outputs.

### 059J — Office integration and completion

Deliver:

- one coherent Specialized Creation workplace entry point;
- guided next-step workflow state;
- links/bridges to Art/Illustration, Cover/Production/Promotion where applicable;
- Chromebook + Android full journeys;
- README progress update;
- final verification matrix with every MUST/SHALL requirement resolved;
- mission completion record.

The office is not complete while a mode exists only as a domain object or preview. Every mode requires a real live creation → review → production path.

---

## 20. PR and branch discipline — no-drift enforcement

### SC-PROC-001 — Requirement-linked PRs

Every Mission 059 PR description SHALL list requirement IDs addressed, for example:

```text
Mission: 059D
Requirements: SC-COMIC-001, SC-COMIC-002, SC-COMIC-007, SC-PROD-007
Evidence: MoMA sequential-art research; professional lettering research
Verification: unit + application + browser acceptance
```

### SC-PROC-002 — One coherent phase/capability per PR

Do not mix unrelated mode work, UI redesign, marketing features or cross-Forge refactors into a specialized capability PR unless the dependency is required to satisfy listed Mission 059 requirements.

### SC-PROC-003 — Existing-code inspection first

Before adding a new service or model, the implementation notes SHALL identify the existing Forge service/model checked for reuse.

### SC-PROC-004 — ADR trigger

Create an ADR before merging a significant decision that is hard to reverse, including:

- interactive renderer choice;
- durable document serialization format;
- PDF/font/rendering engine change;
- color-management approach;
- cross-office asset-storage change;
- major schema migration;
- new third-party runtime dependency with substantial product impact.

ADR format: **Context → Decision → Consequences → Alternatives → Evidence → Status**.

### SC-PROC-005 — Mission amendments are explicit

Do not silently rewrite requirements after implementation begins. Material scope/requirement changes SHALL add an entry to the Mission Amendment Log with reason/evidence and mark superseded requirements clearly.

### SC-PROC-006 — No gold plating

A feature with no parent requirement/evidence SHALL not be promoted into the active build merely because it seems useful. Record it as a future candidate unless the mission is explicitly amended.

### SC-PROC-007 — Verification before progression

A phase cannot be marked complete until its required unit/application/browser/device evidence is green. A later phase may begin only when dependencies are stable enough not to force duplication.

---

## 21. Verification and traceability matrix

Every requirement marked SHALL/MUST is expected to end with traceable evidence. The matrix SHALL be updated during implementation.

| Requirement family | Primary verification | Final evidence expected |
|---|---|---|
| SC-ARCH-* | architecture/code review + tests | no duplicate Brain/provider/storage; renderer-independent model proven |
| SC-CORE-* | unit + restart/application tests | durable scoped state, stable IDs, revisions, approvals |
| SC-BRAIN-* / SC-AI-* | application + provider-boundary tests | real Project Brain context, evidence, honest failures, author approval |
| SC-COMP-* | unit + browser | serialization round-trip, layers/templates/guides, touch/desktop editor |
| SC-PROD-* | artifact tests + preflight + browser | real bytes, dimensions/page counts/digests, warnings/errors, download |
| SC-COMIC-* | domain + browser + artifact | complete comic PDF/CBZ journey |
| SC-GREET-* | domain + browser + artifact | complete four-surface folded-card journey |
| SC-BDAY-* | domain + browser + artifact | birthday-specific content + folded production journey |
| SC-INV-* | domain + browser + artifact | structured event/suite + print/digital journey |
| SC-FLYER-* | domain + browser + artifact | hierarchy/variant + print/digital journey |
| SC-TCG-* | domain + batch/artifact + browser | set/template/data/snapshot/sheet journey |
| SC-UX-* | Playwright desktop/mobile | Chromebook-class desktop + Android touch/overflow acceptance |
| SC-GOV-* | domain/application tests | provenance, sensitive-data discipline, external destination review |
| SC-PROC-* | PR/mission review | requirement-linked changes and explicit ADR/amendment history |

### Definition of verified

- **Domain verified:** deterministic contracts and validation are tested.
- **Application verified:** real durable services/routes/state transitions/artifacts/errors are tested.
- **Human/device verified:** the rendered workplace works through a real browser at desktop and phone/touch sizes.
- **Production verified:** exported artifact bytes and relevant physical/document properties are validated, not merely visually previewed.

---

## 22. Final office completion gate

Mission 059 is complete only when all of the following are true:

1. all six canonical modes have live usable workflows;
2. all modes persist through restart/reload;
3. Project Brain and shared AI/provider boundaries are used without duplication;
4. AI changes remain author-controlled proposals;
5. assets retain provenance;
6. composition state is renderer-independent and versioned;
7. print-critical text remains editable and renders through a Unicode-capable production path;
8. real production artifacts are generated for every mode;
9. production profiles, trim/bleed/safe rules and preflight are operational;
10. comic PDF + CBZ path is verified;
11. greeting/birthday fold surfaces and print path are verified;
12. invitation event truth + print/digital path is verified;
13. flyer hierarchy/variant + print/digital path is verified;
14. TCG schema/template/batch/snapshot/sheet path is verified;
15. desktop browser acceptance passes;
16. Android touch/mobile acceptance passes;
17. full existing Forge regression suite remains green;
18. README and verification matrix reflect actual status;
19. no placeholder control or fake provider/artifact is counted as complete;
20. outstanding deviations are either resolved or explicitly documented as future scope rather than hidden.

---

## 23. Research source register

Sources are recorded for engineering traceability. Forge adopts practices, not copyrighted implementation or branded product assets.

### Mission / architecture discipline

- Architecture Decision Records community — https://adr.github.io/
- AWS Prescriptive Guidance: ADR process — https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html
- Martin Fowler: Architecture Decision Record — https://martinfowler.com/articles/architecture-decision-record.html
- NASA Systems Engineering Handbook: Requirements Management — https://www.nasa.gov/reference/6-2-requirements-management/
- NASA Requirements Verification Matrix — https://www.nasa.gov/reference/appendix-d-requirements-verification-matrix/

### Print / layout / preflight

- Adobe InDesign: Produce print-ready PDF files — https://helpx.adobe.com/indesign/desktop/print/print-production-and-file-creation/produce-print-ready-pdf-files.html
- Adobe Acrobat: Print Production tools — https://helpx.adobe.com/acrobat/using/print-production-tools-overview-acrobat.html
- MOO Greeting Card design guidelines — https://www.moo.com/us/greeting-cards/design-guidelines
- W3C WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- DENSO WAVE QR Code essentials — https://www.qrcode.com/en/howto/code.html

### Comics

- MoMA Magazine: How to Make Comics — https://www.moma.org/magazine/articles/634
- Todd Klein: Balloon Placement — https://kleinletters.com/BalloonPlacement.html
- Printkeg comic printing guide — https://www.printkeg.com/blogs/tips/how-to-self-publish-indie-comic-printing-guide
- PRONOM: Comic Book Archive/CBZ identification — https://www.nationalarchives.gov.uk/pronom/
- Panels file requirements — https://docs.panels.store/publishing/file-requirements/

### Greeting / birthday cards

- Hallmark birthday wishes guidance — https://ideas.hallmark.com/articles/birthday-ideas/birthday-wishes/
- Hallmark card/letter writing guidance — https://ideas.hallmark.com/articles/card-ideas/sending-cards-and-letters-our-best-advice-and-ideas/
- PrintsWell folded-card print setup — https://printswell.freshdesk.com/support/solutions/articles/156000377609-creating-print-files-for-folded-cards
- CatPrint folded greeting-card setup — https://www.blog.catprint.com/post/setting-up-your-greeting-card-file-for-printing

### Invitations

- Greenvelope invitation wording guidance — https://www.greenvelope.com/resources/wedding-invitation-wording
- Shutterfly invitation wording guidance — https://www.shutterfly.com/ideas/wedding-invitation-wording/
- The Knot invitation wording / essential information guidance — https://www.theknot.com/content/standard-wedding-invitation-wording

### Flyers / visual communication

- Figma Resource Library: flyer design — https://www.figma.com/resource-library/how-to-design-a-flyer/
- Adobe Express visual communication guide — https://www.adobe.com/express/learn/blog/guide-to-visual-communication
- University of Florida IFAS: Anatomy of a Flyer — https://blogs.ifas.ufl.edu/ifascomm/2022/12/15/anatomy-of-a-flyer/

### Trading-card systems

- Squib — https://github.com/andymeneely/squib
- Magic Set Editor 2 — https://github.com/twanvl/MagicSetEditor2
- BoardGamesMaker card print specifications — https://www.boardgamesmaker.com/print/2-5x3-5-custom-poker-size-round-corner-cards.html
- The Game Crafter DPI/print guidance — https://help.thegamecrafter.com/article/33-dpi-dots-per-inch

### Candidate composition/rendering technology — evaluation only

- Fabric.js — https://github.com/fabricjs/fabric.js
- Konva — https://github.com/konvajs/konva
- pdf-lib — https://github.com/Hopding/pdf-lib
- resvg-js — https://github.com/thx/resvg-js

---

## 24. Mission amendment log

Material changes after this research lock are appended here rather than silently changing build intent.

| Amendment | Date | Requirement(s) | Reason / evidence | Status |
|---|---|---|---|---|
| Initial research lock | 2026-08-31 | Mission 059 | Extensive pre-build research and anti-drift requirement requested before Specialized Creation implementation | ACTIVE |

---

## 25. Chief-engineer working rule

At the start of every Specialized Creation build turn:

1. read the current `README.md` progress tracker;
2. read this Mission 059 contract;
3. inspect the existing implementation for the active requirement IDs;
4. implement only the next coherent capability needed by the active phase;
5. verify it at the required levels;
6. record progress/evidence;
7. continue to the next requirement only when the previous dependency is real and stable.

**Build fast, but never build untracked. Preserve working systems, follow evidence, keep the author in control, and make every completed checkmark mean something real.**
