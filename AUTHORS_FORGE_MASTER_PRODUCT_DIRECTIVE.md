# AUTHOR'S FORGE — MASTER PRODUCT DIRECTIVE

## 1. Mission

Build **AUTHOR'S FORGE**, a high-level AI authoring, editing, illustration, cover-design, publishing-preparation, research, marketing, and project-management studio.

Author’s Forge is a separate product from K.I.N.G.S.

**K.I.N.G.S. is its builder and ultimate engineering authority.**

Author’s Forge must eventually be capable of operating independently as a high-level creative application. When Forge encounters a capability it cannot safely or reliably complete, it may request assistance from K.I.N.G.S. K.I.N.G.S. remains the higher-level engineering, research, recovery, and capability-acquisition authority.

Forge must be designed for eventual commercial release, but the first production-quality version is for private owner use and extensive real-world testing.

## 2. The Core Promise

The Forge must allow an author to begin with something as simple as:

> “I have an idea for a novel.”

and eventually reach:

> **Completed, edited, illustrated, cover-designed, marketing-ready, publishing-ready book.**

The system must preserve the author's intent throughout the entire lifecycle.

The Forge must never treat the book as merely a collection of disconnected prompts.

It must treat every project as a **living creative system with persistent memory, canon, structure, history, evidence, assets, and decisions.**

## 3. Long-Form Novel Intelligence

Forge must support novels up to approximately **700 pages**, and potentially substantially longer projects.

It must be designed around the assumption that a novel may contain:

- 100,000+ words
- hundreds of scenes
- dozens of characters
- extensive chronology
- multiple locations
- multiple timelines
- recurring objects
- clues and reveals
- evolving relationships
- thematic structures
- multiple books in a series

The model must **not rely on the entire manuscript remaining inside a single active context window**.

Instead, Forge needs hierarchical persistent memory.

### Required memory layers

**Project memory** — The entire project identity.

**Canon memory** — Facts that cannot drift.

**Story memory** — What has happened.

**Character memory** — Who people are, what they know, what they want, how they change, and what they look like.

**Timeline memory** — Dates, ages, chronology, flashbacks, historical events, travel, seasonal changes, etc.

**Location memory** — Physical geography, distances, landmarks, weather, architecture, culture and scene-specific details.

**Style memory** — Narrative voice, POV, tense, tone, sentence behavior, dialogue tendencies, formatting rules and author preferences.

**Series memory** — For multi-book projects.

**Decision memory** — Why important creative decisions were made.

**Artifact memory** — Manuscripts, images, covers, reference documents, outlines, exports and previous versions.

**Research memory** — External sources and the facts extracted from them.

## 4. Anti-Drift Engine

This should be one of Forge's signature technologies.

Before writing begins, Forge should establish a **Canon Lock**.

The system should track:

```text
FACT
STATUS
SOURCE
AUTHORITY
BOOK
CHAPTER
SCENE
DATE ESTABLISHED
LAST VERIFIED
```

Before generating new content, Forge should automatically check relevant canon.

The Forge should detect contradiction, continuity drift, knowledge leakage, timeline violation, style drift, and character drift. The author must be able to **approve, reject, or deliberately override** a detected inconsistency.

## 5. Story Architecture Before Writing

Forge should strongly encourage:

```text
Idea
↓
Premise
↓
Genre
↓
Theme
↓
Characters
↓
World
↓
Timeline
↓
Story architecture
↓
Act/part structure
↓
Chapter architecture
↓
Chapter cards
↓
Scene cards
↓
Writing
```

Chapter cards are first-class features and should include chapter number, title, POV, location, date/time, emotional objective, plot objective, characters present, required events, clues, reveals, continuity dependencies, atmosphere, ending hook, approximate word count, and forbidden deviations.

Forge should **not blindly begin a chapter merely because the user says “write Chapter 8.”** It should consult the chapter architecture first.

## 6. Writing Engine

Forge needs multiple writing modes including Draft, Canon-safe, Literary, Scene expansion, Scene compression, Rewrite, POV conversion, Tense conversion, Voice matching, Style experiment, Dialogue enhancement, Description enhancement, and Emotional enhancement.

Crucially, Forge must distinguish between **content truth** and **style transformation**. A stylistic rewrite must not silently alter canonical facts.

## 7. Intelligent Editing

Forge should act as developmental editor, continuity editor, line editor, copy editor, proofreader, structural editor, dialogue editor, pacing editor, character editor, and genre editor.

It should produce reports for pacing, character consistency, plot holes, continuity conflicts, repetition, weak scenes, unresolved threads, exposition, dialogue, POV, tense, clichés, overused words, sentence rhythm, and chapter balance.

**Never silently rewrite the manuscript unless the author instructs it to.**

## 8. Research Engine

Forge needs governed internet access for historical periods, geography, real-world locations, travel distances, weather, architecture, clothing, technology, occupations, political environments, cultural practices, terminology, historical events, landmarks, regional speech, legal/environmental background, medical/scientific facts when appropriate, publishing information, market information, genre trends, reader expectations, comparable books, and related research.

Research needs:

```text
SOURCE
DATE
URL
CLAIM
CONFIDENCE
RELEVANCE
BOOK/PROJECT LINK
```

Research becomes persistent project knowledge and can be retrieved without repeating the investigation.

## 9. Research Honesty

Forge must distinguish:

```text
KNOWN FACT
SOURCE-SUPPORTED
LIKELY INFERENCE
CREATIVE FICTION
UNCERTAIN
```

It must never confidently invent research and present it as fact.

## 10. Character Bible

Every major character should have a structured profile containing Name, Age, Birth date, Physical appearance, Height, Build, Hair, Eyes, Skin, Clothing, Voice, Speech patterns, Personality, Values, Fears, Secrets, Goals, Motivations, Relationships, History, Knowledge, Skills, Weaknesses, Character arc, Important objects, Current emotional state, Current location, and Current injuries.

The system must track how each changes over time.

## 11. Character Visual Continuity

Forge should have a **Visual Character Identity** system containing face reference, body reference, wardrobe, hairstyle, age progression, distinguishing marks, scars, tattoos, accessories, color palette, artistic style, and pose references.

The identity must be reusable across chapters and series.

## 12. Illustration Studio

Forge needs AI-only, assisted, collaborative, reference-driven, character-consistent, historical/era-aware, environment-consistent, scene illustration, character portrait, map, and object generation workflows.

## 13. Image Editing

Forge should allow users to upload images and modify them while preserving the original. Supported transformations include pencil sketch, ink illustration, watercolor, graphic novel, historical portrait, fantasy character, noir illustration, clothing/background/age/medium/lighting changes, object removal/addition, pose changes, crop, restore, upscale, and stylize.

## 14. Illustration Asset Library

Every generated illustration should retain Project, Book, Chapter, Scene, Character, Location, Prompt, References, Style, Generation settings, Version, Date, and Approval status. Images must be reusable and canonical character designs can be locked for future use.

## 15. Book Cover Studio

Forge should create ebook, paperback, hardcover, series, boxed-set, promotional, and audiobook artwork. Publishing specifications must be real rather than merely aesthetic. For KDP, paperback/hardcover covers require the complete exterior and dimensions derived from publishing configuration, including front, spine, back, barcode-safe area, bleed, trim, margins, and correct dimensions.

## 16. Manuscript Production

Forge should transform the finished manuscript into publication-ready DOCX, PDF, EPUB, and KDP-compatible outputs with title page, copyright, dedication, epigraph, TOC, chapter formatting, page numbering, headers/footers where appropriate, biography, acknowledgments, about-the-author, back matter, and series information.

## 17. Publishing Readiness Checker

Before publishing, Forge should audit manuscript, cover, metadata, formatting, images, TOC, page count, trim, bleed, file types, title, author, description, keywords, and categories. It should produce actionable audit results rather than “looks good.”

## 18. Amazon KDP Market Intelligence

Forge may research genres, subgenres, niches, categories, competing titles, publication frequency, reader expectations, pricing, cover conventions, title conventions, keyword opportunities, emerging/underserved niches, and comparable books while distinguishing research from guaranteed sales predictions.

## 19. Book Positioning

Commercial positioning must remain evidence-backed and must not become sales guarantees.

## 20. Content Randomization

Forge should support deterministic, balanced content generation and remember previous combinations so repeated products do not accidentally duplicate earlier combinations.

## 21. Project State and Memory

Project state must be durable, project-scoped, portable, attributable, and recoverable. Memory retrieval must be relevant rather than indiscriminately injecting the entire project into every AI request.

## 22. Context Assembly

Context should be hierarchical and selectable. Canon, characters, relationships, timeline, research, voice, and unresolved threads should support Full, Brief, Extended, Custom, and Off inclusion policies. Source provenance must survive assembly.

## 23. Import/Export and Project Portability

A complete Forge Project Package should include:

```text
AUTHOR'S FORGE PROJECT
├── manuscript
├── canon
├── characters
├── timeline
├── locations
├── research
├── illustrations
├── visual identities
├── covers
├── marketing
├── publishing metadata
├── decisions
└── project state
```

Forge must be able to restore such a package later. The author's work must not depend on one machine.

## 24. External Storage

Eventually support local files, Google Drive, OneDrive, Dropbox, iCloud where technically available, and downloadable project packages.

**Cloud storage is storage—not the source of truth.**

## 25. Version Control for Books

Authors need Draft 1, Draft 2, Draft 3, Final, Published, plus Restore, Compare, Rollback, Branch, and Merge.

## 26. Author Control System

Forge should distinguish:

```text
AI suggestion
AI draft
Author approved
Canon locked
Author override
```

The author can declare canon explicitly and the system must respect it.

## 27. Series Engine

Forge should support series with shared characters, world rules, visual identities, locations, terminology, history, unresolved threads, and timeline.

## 28. Voice Preservation

Forge should learn the author's writing fingerprint without replacing it, analyzing sentence length, punctuation, dialogue ratio, vocabulary, paragraph length, narrative distance, description density, metaphor use, pacing, and emotional intensity. It should support voice-preserving rewrites and literary refinement.

## 29. AI Collaboration Modes

The author can choose:

- **Co-pilot** — author does most of the writing.
- **Partner** — AI and author alternate.
- **Director** — author gives high-level direction; Forge performs most work.
- **Autonomous** — author approves major decisions while Forge performs the bulk of the project.
- **Editor** — Forge mainly analyzes and improves existing work.

## 30. Project Health Dashboard

Forge should report completion, chapter count, word count, canon conflicts, unresolved plot threads, characters, locations, research sources, illustrations, cover status, marketing completion, and publishing readiness.

## 31. Why Memory Matters

Forge needs **relationship-aware memory**, not just isolated fact storage. Memory should preserve why facts were established and where they become relevant.

## 32. Self-Checking Before Delivery

Before Forge declares a book finished it must run:

```text
Canon audit
Continuity audit
Timeline audit
Character audit
POV audit
Style audit
Grammar audit
Formatting audit
Research audit
Artwork audit
Cover audit
Metadata audit
Publishing audit
```

Only then should it reach **PROJECT READY FOR AUTHOR APPROVAL**.

## 33. K.I.N.G.S. Relationship

Forge handles normal author workflows autonomously. K.I.N.G.S. is the **capability escalation authority**. Capability gaps may flow through requested → research → plan → build → test → verified before Forge receives the capability.

## 34. Security and Ownership

Because Forge will hold unpublished manuscripts, personal information, photographs and intellectual property, security is first-class. Architecture should include project isolation, encrypted storage where applicable, explicit permissions, export/delete controls, audit history, no silent external uploads, research consent, image-processing consent, provider transparency, and local-first options where feasible.

## 35. Accessibility and Platforms

Eventually support Android, iPhone/iPad, Windows, macOS, Linux, and Web. The project format remains platform-independent. UI should support keyboard, mouse, touch, voice, accessibility readers, large text, and high contrast.

## 36. Voice as a First-Class Input

Voice supports idea capture, story planning, editing commands, research requests, character creation, scene direction, and revision instructions. The original transcription remains available.

## 37. Creative Safety / IP Boundaries

Forge should distinguish uploaded copyrighted material, user-owned characters, reference images, real-person images, trademarks, public-domain material, external research, and generated artwork. It should make clear what is known, generated, and externally sourced.

## 38. The Ultimate User Experience

The Forge should feel less like “Chat with an AI” and more like **“Walk into your publishing studio.”** The user sees their books, series, characters, world, manuscripts, art, covers, research, marketing, and publishing, while AI operates throughout the environment.

## 39. The Golden Rules

1. **AUTHOR'S FORGE must never optimize for merely producing more words. It must optimize for producing a coherent, intentional, memorable, publishable work that remains faithful to the author's vision from the first idea through final publication.**
2. **When uncertain, Forge should ask or flag uncertainty rather than inventing canon.**
3. **When the author changes canon intentionally, Forge must update the affected memory, continuity, visual, timeline, and downstream structures rather than treating the change as an isolated edit.**
4. **Author ownership and creative authority remain primary.**
5. **Every major autonomous action must be observable, reversible, and attributable to a project, task, artifact, or decision.**

## 40. The Book Genome

Every book gets a machine-readable representation containing:

```text
BOOK GENOME
│
├── Premise
├── Theme
├── Genre
├── Voice
├── Characters
├── Relationships
├── Locations
├── Timeline
├── Events
├── Scenes
├── Objects
├── Clues
├── Reveals
├── Conflicts
├── Motivations
├── Research
├── Visual identities
├── Art
├── Cover
├── Metadata
└── Publishing state
```

The manuscript is **one output of the Book Genome**, not the only thing Forge remembers. Canon changes should support downstream impact analysis across characters, scenes, timelines, illustrations, cover concepts, research assumptions, and future books.

## 41. Final Product Standard

Author’s Forge is successful when a user can begin with an idea and produce:

```text
Story concept
↓
Story architecture
↓
Canon
↓
Character system
↓
Timeline
↓
Research
↓
Manuscript
↓
Editing
↓
Illustrations
↓
Cover
↓
Formatting
↓
Metadata
↓
Market positioning
↓
Promotion material
↓
Publishing preparation
↓
Portable archived project
```

The Forge should feel like an **AI publishing company in a box**, while preserving the author as the ultimate creative authority.

## 42. First Private Release Strategy

The first release is for the owner only. Prioritize:

1. Long-memory story projects.
2. Canon and anti-drift.
3. Chapter/scene architecture.
4. Writing and editing.
5. Research and web access.
6. Character and illustration continuity.
7. KDP-ready cover creation.
8. Manuscript production.
9. Project export/import and recovery.
10. Marketing and publishing preparation.

Do not prioritize social-scale features, billing, multi-user infrastructure, or broad public distribution until the private system demonstrates reliable end-to-end book completion.

The private version should be tested against real projects until continuity, research, writing, illustration, cover, export, and publishing workflows are dependable.

# AUTHOR'S FORGE — ONE-SENTENCE MISSION

> **Build an autonomous, memory-rich AI publishing studio that can help an author conceive, architect, research, write, edit, illustrate, design, market, format, and prepare an entire book or series for publication without losing continuity, style, canon, visual identity, or author control—and call upon K.I.N.G.S. whenever it encounters a capability gap beyond its current abilities.**
