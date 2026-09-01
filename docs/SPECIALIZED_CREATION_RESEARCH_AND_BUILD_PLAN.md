# Specialized Creation Office — Research & Build Plan

**Status:** RESEARCH GATE / IMPLEMENTATION HOLD  
**Mission:** 067  
**Scope:** comic books, greeting cards, birthday cards, invitations, flyers, and trading-card-game cards only. Guided journals remain a separate office.

## Why this document exists

No serious Mission 067 implementation should proceed from a generic canvas or a feature checklist. The office must be built from proven production workflows, provider requirements, accessibility principles, and the strongest patterns found in professional creative software.

The current Forge foundation already identifies the six canonical modes and a shared brief → plan → create → review → production lifecycle. It also has shared asset/document roles and a production contract. This research refines those foundations instead of replacing them.

## Executive architecture decision

**Do not build six isolated mini-apps.** Build one durable Specialized Creation platform with:

1. a shared document/composition engine;
2. reusable assets, templates, layers, guides, typography, snapping, alignment, history, approval and export;
3. target/provider-specific production profiles;
4. mode-specific semantic models and tools;
5. preflight before export;
6. immutable approved versions and author-controlled changes.

Greeting cards, birthday cards, invitations and flyers can share most of the composition engine. Comics and TCG cards require deeper semantic sub-models, but should still reuse the same geometry, asset, typography, versioning, export and preflight infrastructure.

This follows the locked Forge architecture: offices consume shared trunk capabilities and must not create competing brains, persistence systems or production systems.

---

# 1. Shared production/design engine

## Adopt

### Constraint-first documents

A document must know its physical/digital target before layout begins:

- trim width/height;
- orientation;
- bleed;
- safe area;
- folds or gutters;
- DPI/PPI requirement;
- color-space/provider profile;
- front/back/page/segment semantics;
- export target;
- provider-specific marks/rules.

Adobe's commercial-print guidance treats bleed as part of document setup and notes that 0.125 in / 3 mm is typical while explicitly requiring provider-specific verification. Print-ready workflows should preflight missing fonts, low-resolution images, overset text, bleed and color settings before PDF creation.

### Semantic document model, not flattened screenshots

Persist editable objects:

- text;
- images/artwork;
- vector shapes;
- lines/borders;
- panels/frames;
- masks/crops;
- groups;
- guides;
- QR/barcode objects where appropriate;
- mode-specific objects such as comic balloons or TCG stat fields.

Every element needs a stable ID, bounds, z-order, transforms, lock state, visibility, styling and provenance. A rendered PNG/PDF is an artifact, never the source of truth.

### Layer/object operations

Required shared editing behaviors:

- select/multi-select;
- move/resize/rotate;
- align/distribute;
- snap-to-grid/guides/objects;
- group/ungroup;
- lock/unlock;
- hide/show;
- duplicate;
- copy/paste;
- ordering/front/back;
- undo/redo using durable commands or revisions;
- exact numeric position/size controls;
- keyboard and touch-safe controls.

### Template system

Templates must be structured, versioned documents with:

- target dimensions;
- named zones;
- editable/locked objects;
- mode metadata;
- provider profile compatibility;
- optional semantic placeholders;
- thumbnail/preview;
- provenance and version.

Never bake trim guides or printer templates into exported artwork.

### Asset library

Reuse Forge's existing approved visual identities and project assets. Add specialized tags/roles rather than cloning files into every document. Assets need source/provenance, dimensions/resolution, approval status and usage references.

### Proofing and approval

Workflow:

**brief → plan → create → review → preflight → explicit approval → export**

An approved production revision is immutable. Editing after approval creates a new revision and invalidates that revision's production approval until it passes preflight again.

### Production profiles instead of universal assumptions

A critical research finding is that providers conflict. For example, DriveThruCards expects CMYK deck PDFs and PDF/X-1a:2003, while The Game Crafter accepts RGB PNG/JPG card images. Therefore Forge must never hard-code one global rule such as “all print output is CMYK.”

Use named profiles containing:

- accepted file formats;
- color mode/profile;
- DPI;
- bleed/safe area;
- trim/component size;
- marks policy;
- font policy;
- page/file ordering;
- transparency policy;
- ink coverage limits where applicable;
- size limits;
- provider-specific warnings.

A generic commercial-print profile can provide conservative defaults, but final validation is against the selected provider profile.

### Accessibility/readability

For screen/digital output and as a strong readability advisory for print designs, use WCAG-style contrast analysis. Normal text should target 4.5:1 and large text 3:1. The design engine should warn—not silently rewrite—when important copy has poor contrast, extreme small size or text overflow.

---

# 2. Comic Book function

## Proven workflow patterns

Clip Studio Paint demonstrates the mature comic workflow pattern: multi-page project management, panel/frame tools, speech balloons, a story editor that can manage dialogue across pages, reusable page layouts, page overview, and separate webtoon/scroll workflows. Its creation guidance recommends thumbnailing panel composition and speech placement before final art so reading flow and important visual areas are protected.

### Forge comic model

**Comic project → issue/episode → page or scroll segment → panel → content objects**

Panel content can reference:

- approved character visual identities;
- locations/backgrounds;
- props;
- artwork;
- balloon/caption/SFX objects;
- script/dialogue lines;
- continuity/canon references.

### Required comic workflow

1. **Brief** — format, audience, print vs webtoon, reading direction, issue/episode intent, visual style.
2. **Script** — pages/scenes/panels/dialogue/captions/SFX as structured text.
3. **Thumbnail** — rough panel arrangement before final artwork.
4. **Layout** — panel frames, gutters, spreads or scroll spacing, balloon planning.
5. **Art** — reference/approved asset placement, sketch/artwork versions.
6. **Lettering** — dialogue, captions, balloons, tails, SFX, text styles.
7. **Continuity review** — characters/locations/canon + visual continuity.
8. **Production preview** — page thumbnails, spreads, bound preview or mobile scroll preview.
9. **Preflight/export**.

### Page-based print comic features

- page manager/reorder;
- single pages and facing-page spreads;
- page templates;
- panel split/merge/edit;
- configurable gutter;
- bleed/trim/live-area overlays;
- inner/gutter/binding safety;
- reading direction LTR/RTL;
- spread-aware artwork;
- page-number and cover separation;
- binding-aware page-count warnings;
- deterministic page ordering.

### Lettering features

- balloon shapes and editable tails;
- caption boxes;
- SFX text;
- reusable lettering styles;
- search/replace across issue;
- text-overflow warnings;
- reading-order metadata;
- copy fit without destructive auto-shrinking;
- dialogue linked to script line/source character when possible.

### Webtoon target

Webtoon must be a first-class target, not a crop of print pages:

- long vertical canvas/segments;
- mobile reader preview;
- pacing/spacing controls;
- target-width profile;
- automatic deterministic slicing for platform upload sizes;
- per-slice order and validation.

### Comic exports

- production PDF per selected print profile;
- CBZ with deterministic zero-padded page order;
- PNG/JPEG page/segment set;
- proof/contact sheet;
- portable source package.

### Comic preflight

Validate at minimum:

- page/segment order;
- required pages present;
- trim/bleed/safe/gutter;
- image effective resolution;
- text overflow and tiny lettering;
- missing fonts/assets;
- balloon/text outside safe areas;
- spread geometry;
- unsupported transparency/marks per provider;
- CBZ filenames/order;
- webtoon width/slice constraints.

---

# 3. Greeting Card function

Greeting cards are folded physical documents, not just a front image.

## Canonical document model

Use a four-panel semantic model:

- outside front;
- outside back;
- inside left;
- inside right.

The production imposition may render those as front/back spreads with rotations depending on fold direction. Store panel semantics separately from physical transformation so an author edits “inside right,” not “a rotated quadrant.”

## Required workflow

- occasion/purpose;
- recipient relationship;
- tone;
- card size/fold;
- envelope target;
- front concept;
- inside message;
- optional photo/personalization;
- back mark/credit;
- paper/finish intent;
- proof and production.

## Best practices to adopt

- common card-size presets plus custom sizes;
- explicit folded vs open dimensions;
- fold-line and safe-area overlays;
- 0.125 in typical bleed profile where provider permits;
- readable safe margin rather than edge-close copy;
- 300 PPI image quality for commercial print targets;
- paper/finish metadata;
- warnings for writable areas placed on finishes unsuitable for handwriting;
- envelope fit/mailing profile;
- physical proof recommendation for color/finish-critical work.

## Message assistance

Greeting copy should be guided by recipient, occasion, tone and specificity. AI suggestions remain candidates. Forge never silently replaces an author's message.

---

# 4. Birthday Card function

Birthday cards share the greeting-card layout/production engine but deserve their own guided author experience because the semantic brief is meaningfully different.

## Birthday-specific structured fields

- recipient name;
- relationship;
- age/milestone, optional;
- tone: heartfelt, funny, romantic, family, child, professional, etc.;
- shared memory/details;
- distance/across-miles context;
- photo personalization;
- date/year;
- sign-off/sender.

## Required behavior

- birthday-specific templates and copy structures;
- milestone variants without forcing age into the design;
- recipient-aware message generation;
- personalization preview;
- same four-panel folded-card semantics;
- same professional print/envelope/preflight system as greeting cards.

**Do not fork a second canvas engine for birthday cards.** The distinction belongs in the guided data model, content tools and templates.

---

# 5. Invitation function

An invitation is usually a coordinated suite and an information-accuracy problem as much as a design problem.

## Canonical invitation model

**Event facts are authoritative structured data.** Documents bind to these facts so correcting a date, venue or RSVP deadline can update every linked suite component and report downstream impact.

Core event fields:

- event name/type;
- hosts/honorees;
- date;
- start/end times;
- venue name;
- street/city/region/postal data;
- ceremony/reception or multi-event schedule;
- RSVP deadline/method;
- website/QR destination;
- dress code and optional notes;
- contact information.

## Suite documents

- main invitation;
- RSVP/reply card;
- details/accommodation card;
- optional save-the-date;
- outer envelope;
- optional reply envelope;
- optional liner/wrap/belly band.

Each item needs an explicit role, size, front/back status and relationship to the suite.

## Best practices to adopt

- main invitation commonly starts from a 5×7/A7-compatible profile in US workflows, without forcing it as the only choice;
- clear information hierarchy;
- restrained type system;
- ample whitespace;
- suite-wide shared style tokens;
- proof every factual field separately;
- validate QR destinations and scanability advisory;
- show the complete “guest experience” stack/order;
- versioned final approval, not approvals scattered across informal changes;
- envelope/mailability checks before final production.

## High-value invitation validation

- names are populated;
- date is valid;
- supplied weekday agrees with calendar date if weekday is displayed;
- time exists;
- venue/address exists where required;
- RSVP deadline precedes event date;
- RSVP mechanism is present;
- QR/URL target is syntactically valid and testable when online;
- suite components use consistent event facts;
- all required inserts fit chosen outer envelope profile;
- text stays in safe areas;
- print specs pass selected provider profile.

USPS-related guidance should be advisory and provider/location-specific. Square, rigid, unusually shaped or uneven mail can become nonmachinable; Forge should surface that early rather than letting an author discover it after printing.

---

# 6. Flyer function

Flyer quality is driven by **communication hierarchy and action**, not by filling a page with features.

## Structured flyer brief

- objective;
- audience;
- placement/distribution channel;
- single primary message/offer;
- headline;
- supporting benefits/details;
- evidence/social proof if supplied;
- CTA;
- CTA destination/contact method;
- campaign dates;
- brand kit;
- success metric;
- print/digital target.

## Best practices to adopt

- one dominant goal and one primary CTA;
- immediate focal point;
- scan hierarchy: headline → value/offer → essentials → action;
- concise copy rather than shrinking type to fit;
- strong contrast;
- purposeful whitespace;
- relevant high-resolution hero imagery;
- QR code as a semantic CTA object with destination and quiet-space constraints;
- front for impact/back for additional detail when duplex;
- target-specific sizes for handout, rack/counter, wall and digital/social use.

## Digital derivatives

Do not blindly resize/crop a print flyer into social formats. Reflow the same semantic content into target-specific compositions, preserving headline, CTA and brand identity.

## Flyer analytics hook

Where the user configures real tracking, Forge can store campaign-specific URLs/UTMs/QR destinations and later connect actual results to Promotion Office. Never fabricate scan or conversion metrics.

## Flyer preflight

- CTA present and unambiguous;
- destination/contact present;
- campaign dates internally valid;
- QR destination validation;
- QR safe/quiet zone advisory;
- contrast/readability advisory;
- no text overflow;
- print trim/bleed/resolution/provider checks;
- digital dimensions/file size target checks.

---

# 7. Trading Card Game function

The TCG function must be **data-driven**. Manually editing 100 independent canvases is the wrong architecture.

## Canonical TCG model

**Game → set/expansion → card types → templates → structured card records → rendered variants → decks/print order → packaging/rulebook**

Possible card fields are game-defined, not globally hard-coded:

- ID/collector number;
- name;
- card type/subtype;
- cost;
- stats;
- rules text;
- flavor text;
- rarity;
- faction/color;
- artwork reference;
- artist credit;
- icon/resource references;
- set symbol;
- front template;
- back template.

## Template/data binding

Adopt the proven “one template + dataset” pattern:

- named data fields;
- text/image/icon bindings;
- conditional visibility;
- calculated/display fields where explicitly defined;
- reusable style tokens;
- template edits propagate to all cards;
- per-card override only when intentional;
- bulk preview/navigator;
- overflow/error report across every variant.

CSV import/export can be supported as an interchange format, but Forge's durable project data remains authoritative.

## Gameplay/design workflow

1. define game/rules vocabulary;
2. define card taxonomy/types;
3. define data schema;
4. create low-fidelity prototype templates;
5. enter/import card data;
6. batch render prototype;
7. playtest/revise mechanics and wording;
8. establish final visual system;
9. batch production render;
10. full-deck preflight;
11. proof/sample;
12. approved production export.

Keep prototype and production states distinct so visual polish does not block mechanics iteration.

## Card readability/usability

- consistent information positions by card type;
- clear hierarchy for name/cost/type/rules/stats;
- icon legend and vocabulary consistency;
- fan/hand readability for important corner information;
- text overflow detection;
- avoid thin edge borders that magnify cutting drift;
- card-back consistency where hidden information depends on identical backs.

## Provider profiles are mandatory

### DriveThruCards profile

Research requirements include:

- 300 dpi images;
- 1/8 in bleed;
- important art/text at least 1/8 in inside finished edge;
- CMYK;
- provider ink-coverage restriction;
- PDF/X-1a:2003;
- embedded fonts;
- no printer/crop marks;
- deck PDF page order as back/face pairs;
- standard poker trim 2.5 × 3.5 in with 2.75 × 3.75 in bleed layout.

### The Game Crafter profile

Research requirements differ:

- component-specific templates;
- 300 DPI;
- full bleed and safe-zone discipline;
- allowance for cut/registration drift;
- avoid thin borders;
- RGB image uploads;
- PNG/JPG provider workflow;
- component/card dimensions derived from provider template;
- proof every image/component.

The conflict between these two providers is precisely why provider profiles must be first-class.

## TCG exports

Potential supported targets, implemented only when verified:

- provider-ready images;
- provider-ready deck PDF where supported;
- CSV/data package;
- print-and-play sheet/PDF;
- proof sheet/contact sheet;
- Tabletop Simulator-style spritesheet later;
- rulebook/packaging artifacts later through shared production contracts.

## Full-deck preflight

- duplicate/missing card IDs;
- schema violations;
- missing required data/assets;
- template binding errors;
- text overflow/tiny text;
- missing icons/fonts;
- inconsistent backs;
- image resolution;
- bleed/safe/cut-border risks;
- provider color/export requirements;
- deterministic ordering;
- quantity/deck mapping;
- unsupported artifact;
- representative proof plus complete automated variant scan.

---

# 8. Shared technical architecture

## Canonical document contracts

Implement interfaces around concepts, not a specific rendering library:

- `DesignDocument`
- `DesignPage` / `DesignSurface`
- `DesignElement`
- `TextElement`
- `ImageElement`
- `VectorElement`
- `GroupElement`
- `GuideSet`
- `TemplateDefinition`
- `ProductionProfile`
- `DesignRevision`
- `PreflightReport`
- `ExportArtifact`

Mode modules extend these contracts rather than duplicating them.

## Renderer/editor technology spike before dependency adoption

The current Forge runtime is intentionally lean. Before introducing a large canvas dependency, run a bounded proof-of-capability spike.

Candidate worth evaluating:

- **Fabric.js** — mature TypeScript/JavaScript canvas object library with canvas/SVG conversion and a long-lived ecosystem.

Compare it against a native SVG/DOM approach for:

- object selection/transforms;
- text editing;
- clipping/masks;
- serialization stability;
- SVG/vector fidelity;
- touch behavior;
- bundle size;
- headless/test rendering;
- high-DPI export;
- accessibility of editor controls;
- long-document performance.

Do not adopt a library merely because it is popular. The spike must prove it fits Forge's durable serialized model and Android/Chromebook constraints.

For PDF assembly/manipulation, **pdf-lib** is a credible JavaScript/TypeScript candidate, but the same rule applies: evaluate output fidelity and whether it can satisfy the selected professional print profiles before adoption. A library that can generate a PDF is not automatically a prepress-quality PDF/X pipeline.

## Source-of-truth rule

The durable semantic document is authoritative. Renderers are adapters. If the canvas library changes later, Forge projects must remain readable.

---

# 9. Build sequence after research gate

## Phase A — repair/unify foundation

- reconcile duplicate existing specialized-creation domain definitions;
- remove type/format inconsistencies;
- preserve six-mode lock;
- formalize revisioned durable office/project state;
- formalize production profiles and preflight issue model;
- add migration/version tests.

## Phase B — shared design document engine

- semantic document/page/element contracts;
- revision history;
- geometry, z-order, lock/group;
- guides/grid/snap;
- typography/styles;
- asset references;
- template engine;
- render adapter interface;
- persistence and recovery.

## Phase C — editor technology spike

- build one representative folded card and one TCG card with text/image/vector layers;
- test Fabric.js vs native SVG approach;
- test touch interactions at Android viewport;
- prove serialized reload fidelity;
- prove 300-DPI deterministic output;
- select technology only from evidence.

## Phase D — greeting + birthday cards

These are the lowest-risk proof of the shared folded-document engine.

- four-panel semantics;
- folds/orientation;
- message tools;
- photo/personalization;
- envelope/mail profile;
- print preflight/export.

## Phase E — invitations

- structured event facts;
- suite documents;
- linked data propagation;
- RSVP/QR validation;
- envelope fit/mailability;
- approval snapshot.

## Phase F — flyers

- campaign/CTA semantic brief;
- print/digital document variants;
- QR object;
- readability/contrast checks;
- optional tracking metadata.

## Phase G — comic books

- issue/episode/page/panel model;
- script editor;
- page manager;
- panel/balloon/lettering tools;
- print/spread preview;
- webtoon target;
- PDF/CBZ and web exports;
- continuity integration.

## Phase H — TCG

- game schema/card types;
- template + data binding;
- batch variant engine;
- rule/icon vocabulary;
- deck/order management;
- provider profiles;
- batch preflight/export;
- playtest/prototype workflow.

## Phase I — production hardening

- provider-specific profiles;
- preflight engine across all modes;
- proof artifacts;
- explicit approvals;
- revision invalidation rules;
- delivery packages;
- archive/recovery.

---

# 10. Acceptance standard

A mode is not complete because a form can save metadata. Each function must prove:

1. a real author can create a project in Studio;
2. durable state survives reload/restart;
3. editable source remains editable and versioned;
4. assets are reusable and attributable;
5. mode-specific workflow is present, not a renamed generic form;
6. production dimensions/guides are visible;
7. preflight catches deliberate defects;
8. export generates a real artifact appropriate to the selected target;
9. approval is explicit and editing invalidates stale approval where necessary;
10. desktop/Chromebook browser acceptance passes;
11. Android/touch acceptance passes;
12. no fake provider/output claims are presented.

# 11. Practices explicitly rejected

- six copy-pasted canvas implementations;
- one universal print profile;
- flattened-image project state;
- AI-generated layout replacing author state without approval;
- crop-to-fit derivatives that destroy hierarchy;
- manual per-card editing as the primary TCG workflow;
- treating an invitation as one card instead of structured event data + suite;
- treating a comic as generic pages without script/panel/lettering semantics;
- treating birthday card as only a label on generic greeting card UI;
- export without preflight;
- claiming print-ready based only on file extension;
- copying proprietary product code/assets.

# 12. Research references

Primary/professional references consulted include:

- Adobe InDesign print bleed and print-ready PDF guidance
- W3C WCAG 2.2 contrast guidance
- USPS physical/nonmachinable mail standards
- Clip Studio Paint comic, multi-page, Story Editor, balloon and webtoon workflows
- WEBTOON creator workflow guidance
- StationeryHQ and professional printer greeting/invitation production guidance
- Hallmark message/personalization patterns
- VistaPrint/Figma professional flyer guidance
- DriveThruCards print-card specifications
- The Game Crafter templates, cards, proofing and component/API guidance
- Cartamundi card-production guidelines
- Chitmunk data-driven card/template and preflight workflow as a competitive product pattern
- Fabric.js as a possible canvas technology reference
- pdf-lib as a possible PDF technology reference

Provider requirements change. Forge production profiles must therefore carry version/source metadata and be re-verified before being treated as authoritative.

---

# Research gate decision

**Mission 067 serious implementation is blocked until this plan is used as the engineering contract.** The next code work should begin with Phase A and the technology spike—not with a large UI build. Every subsequent mode must be implemented against the shared engine and its own proven workflow requirements.
