# Author's Forge Competitive Gap Audit — 2026-09-04

**Purpose:** identify where the real Author's Forge product is behind current authoring, AI-writing, planning, design, collaboration, publishing, and creative-suite competitors; classify each gap; and drive implementation without copying proprietary code or pretending a feature exists.

**Engineering rule:** a competitor feature only counts as an Author's Forge capability after it reaches the real Forge state/provider/artifact boundary and is testable. Marketing similarity is not completion.

## Products reviewed

Current official product/documentation material was reviewed for:

- Reedsy Studio;
- Sudowrite;
- Novelcrafter;
- Plottr / Plottr Pro;
- Atticus;
- Adobe Express / Firefly;
- Canva Visual Suite;
- Amazon KDP production requirements;
- GitHub Codespaces / devcontainers;
- Tauri 2 desktop/mobile packaging;
- ChromeOS Android/PWA/Linux application lanes.

The benchmark is intentionally broader than "AI novel writing" because the product goal is an all-around AI creativity workplace.

## Executive position

Author's Forge is already unusually strong in areas competitors commonly split across separate products:

- durable project truth and provenance;
- author-controlled canon and manuscript mutation;
- Project Brain context selection;
- cross-book series/canon planning;
- governed AI proposals with explicit review/apply;
- model/provider routing and failover;
- voice preservation and continuity evidence;
- source-backed research and research honesty;
- publishing/KDP preflight and real production artifacts;
- recovery/version/project-package boundaries;
- image rights/provenance controls;
- separate guided-journal, educational-workbook, and specialized-creation workplaces.

The biggest remaining competitive weaknesses are not "more AI buttons." They are distribution, reusable customization, human collaboration, visual-brand reuse, broad creative media, direct external integrations, and frictionless multi-device operation.

## Gap matrix

| Area | Strong current benchmark | Forge before this pass | Current decision / status |
| --- | --- | --- | --- |
| Native distribution | Canva/Adobe mobile apps; Plottr/Atticus desktop/mobile availability | PWA + Node/Termux/local server lanes | **Build now.** Tauri 2 native shell added for Windows/macOS/Linux/Android/iOS; Chromebook Android/PWA lanes and PS5 hosted lane documented. Desktop bundled-local-runtime sidecar and signed store artifacts remain to complete. |
| No-Termux Android | Consumer creative apps launch directly | Android normal path could depend on browser-hosted or Termux-hosted runtime | **Build now.** Hosted single-origin gateway + native Android client direction; Termux is optional power-user tooling only. |
| PS5 / restricted browsers | Few direct competitors | No practical console lane | **Adapt.** Hosted single-origin client with console WebView hardening. No fake native PS5 package claim. |
| Reusable custom AI tools | Sudowrite Plugins; Novelcrafter custom prompts | Provider-rich AI routes but no author-created reusable workflow system | **Build now.** Forge Recipes added: 1–8 stages, Project Brain selection, provider/model preferences, chained output, durable run history, final pending proposal, explicit review/apply. |
| Model choice / routing | Novelcrafter broad provider flexibility | Already strong multi-provider broker | **Forge advantage.** OmniRoute, 9Router, K.I.N.G.S., Ollama, Groq, Mistral, Gemini, Anthropic, OpenRouter, OpenAI with spend/quality/failover governance. Recipes reuse this broker rather than creating a second provider stack. |
| Human comments / tracked changes | Reedsy live comments/edits; Atticus Owner/Co-writer/Editor/Beta Reader roles | AI collaboration policy only; no complete human review lane | **High-priority gap.** Build reviewer roles, anchored comments, tracked suggestions, author accept/reject, immutable audit evidence. Real-time co-editing only after concurrency/state reconciliation is proven. |
| Real-time co-editing / sync | Reedsy; Plottr Pro; Adobe/Canva | Hosted Forge gives one server truth but not a CRDT/editor sync contract | **Adapt later, architecture first.** Evaluate Yjs/Automerge behind Forge project/version truth; never create a hidden second manuscript database. |
| Beta-reader preview sharing | Reedsy | Production preview/artifacts exist but no scoped reviewer link workflow | **Build with collaboration block.** Read-only chapter/book preview links with explicit scope/revocation. |
| Plot templates / reusable planning | Plottr 30+ templates/custom templates | Strong Story Architecture/Map/Cards but limited reusable author template library | **Build next.** Forge Recipe presets + story-architecture templates with author-installable copies and provenance. |
| Visual story planning | Plottr | Story Map, Chapter Cards, Scene Cards, plotlines exist | **Mostly competitive.** Continue improving drag/reorder/filter/relationship visualization and phone ergonomics rather than creating another planning database. |
| Story / series bible | Sudowrite Story Bible, Novelcrafter Codex, Plottr Series Bible | Project Brain + Character/World/Series Engine | **Forge advantage target.** Preserve temporal/provenance/authority evidence and explain why context was selected. |
| Long-context continuation | Sudowrite/Novelcrafter | Context assembly + optimizer + model broker | **Competitive foundation.** Improve author-visible context preview and per-recipe/task budget controls; do not merely maximize token count. |
| Localized rewrite tools | Sudowrite | Editing Room, Craft Lens, lexical/rhyme tools, proposals | **Strong.** Continue adding focused tools through Recipes instead of hard-coding dozens of duplicate routes. |
| Writing goals / stats | Reedsy | Durable Author Goals + manuscript-derived metrics | **Competitive.** Add writing-session history only when real event history exists; never fabricate historical productivity. |
| Production formatting | Atticus/Reedsy | Real DOCX/PDF/EPUB + KDP paths | **Strong.** Remaining gap is richer author-facing theme/template customization and live visual page preview. |
| Cover constraints | KDP/Atticus/design apps | Edition-aware cover planning/preflight | **Strong truth boundary.** Continue visual editor integration; never label a cover KDP-ready without artifact evidence. |
| Existing manuscript import | Reedsy/Atticus | DOCX/TXT/Markdown preview-first import | **Competitive.** Future formats can be added when parsing can be real and safe. |
| Brand kits | Adobe Express/Canva | No first-class shared color/font/logo/asset governance | **High-priority creative gap.** Build Project/Series Brand Kit and locked brand constraints shared by covers, flyers, cards, social creative, journals, workbooks. |
| Reusable design templates | Adobe Express/Canva | Specialized structured documents but not a broad governed template library | **High priority.** Templates must preserve editable semantic fields, target size and brand locks rather than flattened fake assets. |
| One-click multi-format resize | Adobe Express/Canva | Per-mode production profiles; no general multi-target campaign resize | **Build after Brand Kit.** Derive multiple real production canvases with safe zones and per-target overflow validation. |
| Safe zones / design constraints | Adobe Express; platform specs | Specialized/KDP constraints in individual workflows | **Generalize.** Add reusable target-spec registry and safe-zone validation across marketing/specialized assets. |
| Stock asset library | Adobe Express/Canva | Generated/user assets; no large licensed stock catalog | **Integrate, don't imitate.** Add provider adapters only where licensing/API terms are explicit. Preserve source/license provenance. |
| Photo editing / background removal | Adobe/Canva | Image generation/editing provider path exists | **Partial.** Add provider-capability adapters for background removal/upscale/crop only when real providers are configured. |
| Video/audio creation | Adobe Express/Canva | Not a first-class Forge office | **Major all-around creativity gap.** Research/build later as a Media Studio with real timelines/assets/exports; avoid superficial placeholder editors. |
| Presentations / whiteboards | Canva Visual Suite | Not first-class | **Expansion candidate.** Useful for author pitch decks, courses, book promotion and education, but lower priority than core collaboration/brand/media reliability. |
| Social scheduling | Adobe Express/Canva | Promotion plans/performance records, no direct scheduler | **Integration gap.** Add provider-specific OAuth/API adapters only; local "scheduled" records must never imply external publication. |
| Campaign repurposing | Adobe/Canva | Marketing + Specialized modes | **Use Recipes + Brand Kit.** One source brief -> channel-specific approved variants -> real target artifacts. |
| Creative approval workflows | Canva/Adobe Teams | Author approval exists for AI/assets but not team role workflow | **Fold into human collaboration.** Owner remains final authority; reviewer/editor actions are scoped and auditable. |
| Coding environments | GitHub/Codespaces/devcontainers/cloud sandboxes | No generalized Forge coding-execution matrix | **Build now.** Platform doctor, Docker/Podman disposable sandbox, Codespaces adapter, SSH/Linux adapter, optional Termux lane added. |
| In-app coding execution | AI coding products | CLI adapters are real but not yet exposed as a hardened Studio tool surface | **Security-sensitive next step.** Expose only explicit adapters/policies; never create an unauthenticated arbitrary-host-shell endpoint. |
| GitHub workflows | GitHub/Codex-style development tools | Repository can be engineered externally; Forge app not a GitHub client | **Partial foundation.** `gh`/Codespaces adapter exists; future in-app GitHub operations require explicit auth/scopes/audit. |
| Disposable sandboxes | Coding agents | None | **Build now.** Docker/Podman runner defaults to read-only workspace, no network, resource limits, dropped capabilities, no host fallback. |
| Remote Linux / servers | Coding tools | Termux/local only patterns | **Build now.** Generic explicit SSH adapter added; no local fallback when SSH is unavailable. |
| Plugin/app ecosystem | Canva apps, Sudowrite plugin library | Internal modules only | **Architect after Recipes.** Recipes become the safe first extension primitive. Any future external plugin API must declare capabilities, context, provider policy, output type, permissions and mutation boundary. |
| Cloud backup/sync | Reedsy/Plottr Pro/Canva/Adobe | Local backup vault + hosted persistent disk | **Partial.** Add encrypted provider adapters and multi-device conflict policy; do not silently call browser cache a backup. |
| Offline | Atticus/Plottr/desktop apps | PWA shell and local server paths | **Partial/strong on shell.** Native desktop local-runtime sidecar is needed for a true consumer standalone offline desktop package. Mobile provider-dependent features will still require connectivity. |
| Accessibility | Major creative apps | Existing responsive/touch/reduced-motion/accessibility work | **Continuous.** Add keyboard, screen-reader, high-contrast and real-device acceptance to every new office. |
| Marketplace/community templates | Plottr templates; Sudowrite Plugins; Canva/Adobe templates | None | **Later.** Start with local/exportable Recipe/template packages, signing/provenance and safe import before any marketplace. |

## Competitive priorities from this audit

### P0 — release/platform truth

1. Keep PR/head build state truthful while GitHub Actions runner infrastructure is failing before recorded steps.
2. Complete native build plumbing and actual artifacts for desktop/Android/iOS targets.
3. Bundle/sidecar the local desktop Forge runtime so Windows/macOS/Linux end users do not install Node.
4. Real-device/emulator verification and signing/store lanes.

### P1 — creativity/workflow gaps

1. Forge Recipes (implemented in this pass; verification pending).
2. Human review: roles, comments, tracked suggestions, beta-reader preview.
3. Brand Kit + reusable template constraints.
4. Multi-target creative resize/safe-zone production.
5. Recipe/story/template starter library.

### P2 — integrations and media

1. hardened in-app sandbox/GitHub/Codespaces/SSH control surface;
2. external storage/sync adapters;
3. real social publishing/scheduling adapters;
4. licensed stock/media provider adapters;
5. first-class video/audio Media Studio;
6. presentations/whiteboards where they materially serve author/education/promotion workflows.

## What Forge should deliberately *not* copy

- unrestricted plugins that can silently mutate canon/manuscript;
- fake "publish" buttons with no external provider transaction;
- stock assets without durable license/source evidence;
- a hidden CRDT/browser store that becomes a second source of truth;
- arbitrary host-shell execution exposed through the hosted web app;
- provider/model lists that include unconfigured or inaccessible capacity;
- automatic AI approval of its own creative output;
- a native wrapper that is called a standalone app while it still secretly requires a separately installed runtime.

## Verification condition on this pass

The current PR runner has reproduced the repository's existing GitHub Actions infrastructure failure mode: the verify job can fail before GitHub records any steps, and the corresponding job-log blob may not exist. That condition is **not** proof that source/tests failed, but it also prevents an exact-head green claim. No tests should be removed or weakened to work around it.

Until a real executable verification path runs the head, new work is **implemented/reviewable, not verified**.
