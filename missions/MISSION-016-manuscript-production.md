# Mission 016 — Manuscript Production

## Status

Implemented; awaiting Linux verification.

## Delivered

Author's Forge now has a provider-neutral manuscript production boundary that validates structured finished-manuscript input and renders actual DOCX, PDF, and EPUB byte artifacts. KDP-prefixed output formats use the same deterministic production renderers with explicit format identity for downstream publishing workflows.

The production model covers project/book identity, front matter, back matter, chapters, scenes, series information, title-page and contents generation, chapter/page structure, production options, MIME types, filenames, byte length, SHA-256 provenance, timestamps, and validation.

The DOCX renderer creates an Open XML package. The EPUB renderer creates a valid EPUB ZIP package with `mimetype`, container metadata, OPF metadata, navigation, and chapter XHTML. The PDF renderer creates a standards-based PDF 1.4 document with deterministic page layout and text wrapping.

The original manuscript state remains authoritative; production output is a derived artifact. Rendering never mutates the manuscript.

## Acceptance boundary

The service must reject empty/invalid manuscripts, duplicate chapter or scene identifiers, invalid chapter numbering, invalid production options, and malformed generated artifacts. Acceptance tests verify actual DOCX/EPUB/PDF signatures, metadata integrity, generated title/contents material, and input validation.
