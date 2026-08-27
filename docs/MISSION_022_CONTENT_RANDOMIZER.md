# Mission 022 — Content Randomization Engine

Forge provides a generic seeded content randomizer for journals, writing prompts, workbooks, activity books, card decks, educational materials, and question books.

The engine supports shuffling, deterministic seeds, duplicate avoidance, category balancing, alternative set generation, and exclusion of previously emitted combinations. It returns explicit item IDs and set provenance so generated sets can be reconstructed without mutating the source pool.

The source pool remains authoritative. Generated sets are derived outputs.
