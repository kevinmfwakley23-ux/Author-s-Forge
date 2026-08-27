# Missions 020–021 — Marketing Studio + Author Marketing Calendar

## Mission 020

Marketing Studio is a structured promotional-package system. It models channel-specific social content for Facebook, Instagram, TikTok, Threads, X, Pinterest, and YouTube; short-form video scripts; flyers; bookmarks; postcards; quote cards; launch and countdown graphics; teaser images; character cards; review graphics; event posters; email campaigns; and advertising variants including copy, headlines, descriptions, and creative concepts.

Marketing assets are project-scoped, validated, immutable by derivation, versioned, and schedulable. `createMarketingVariants` creates explicit numbered variants rather than overwriting a source asset.

The domain is provider-neutral: generated copy or creative concepts can be supplied by a real AI provider through a future integration boundary without making provider output canonical truth.

## Mission 021

Author Marketing Calendar turns promotional assets into a dated launch plan. It supports preorder, release day, post-launch, 30-day, 60-day, and 90-day campaign phases. Entries retain their linked marketing asset, channel, purpose, date, and lifecycle status.

Calendar construction is deterministic from the selected start date and asset IDs. Persistence is atomic and project-scoped. Calendar entries are independently validated for ownership, dates, phases, and duplicate IDs.

Neither mission claims guaranteed reach, engagement, sales, or revenue. They organize and generate promotional work; outcomes remain observable market results rather than promises.