# Mission 023 — Import/Export and Project Portability

A Forge Project Package is a portable, versioned JSON envelope containing the authoritative project state plus project files, their media types, paths, and integrity identifiers.

Package paths are relative and traversal-safe. Import validates format version, project identity, manifest/file agreement, timestamps, and file metadata before restoration. Serialization is deterministic JSON for the package object and never mutates the source project.

A package can therefore move between machines and be restored without making cloud storage the source of truth.
