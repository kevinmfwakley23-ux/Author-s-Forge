# Author's Forge Reference Integration

This document records public repositories reviewed while hardening the private Author's Forge implementation.

## References

### The Novelist's Atelier

Repository: https://github.com/f5alcon/The-Novelists-Atelier
License: Apache License 2.0

Useful engineering patterns reviewed:

- hierarchical Series / Book / Chapter context
- Full / Brief / Extended / Custom / Off context inclusion
- pipeline-oriented editing
- autosave and backup concepts
- global search and find/replace
- Style DNA
- local text analysis
- multiple model-provider boundaries

Author's Forge implementation decision: reimplement the context-selection and workflow concepts inside the existing TypeScript domain/application architecture. Do not import the browser application wholesale.

### BOOKGEN-AI / google-book-writer

Repository: https://github.com/ildrm/google-book-writer
License: MIT

Useful engineering patterns reviewed:

- staged long-form generation
- persistent book bible, character and timeline state
- resumable generation checkpoints
- per-chapter memory extraction and rolling context
- quality review
- DOCX/PDF/Markdown/TXT export

Author's Forge implementation decision: retain Forge's Project Brain and Book Genome as the source of truth while adopting resumable, staged workflow principles where appropriate.

### ai-book-studio

Repository: https://github.com/edwarddumi/ai-book-studio
License: MIT

Useful workflow patterns reviewed:

- Plan → Write → Save lifecycle
- approved-outline gates
- chapter-by-chapter continuity
- session persistence
- separate review, packaging and cover stages

Author's Forge implementation decision: map these controls to Author Control, Project Brain, Book Genome, manuscript production and delivery-audit boundaries.

## No blind transplantation

The repositories above solve narrower problems than Author's Forge. Their source code is not treated as a substitute for Forge's domain model. Any future reuse of third-party code must preserve its applicable license and attribution requirements and must be reviewed for dependency, security, privacy, and architectural fit before inclusion.

The first integrated feature from this research is `src/domain/context-assembly.ts`, which provides bounded hierarchical context selection for writing operations. It deliberately uses Forge's durable project state and provenance identifiers rather than conversation-local state.
