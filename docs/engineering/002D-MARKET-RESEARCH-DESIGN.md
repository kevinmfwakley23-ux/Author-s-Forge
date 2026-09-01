# 002D — Live AI Market Research + KDP Keyword Discovery

## Goal

Turn the existing KDP market-intelligence contracts into a real current-research capability. Forge must be able to research a market/niche, identify evidence-backed niche opportunities and reader-search keyword phrases, and carry selected phrases into publishing metadata without claiming guaranteed sales.

## Current KDP constraints applied

- KDP supports up to seven keyword phrases for a title.
- Keywords must accurately describe the book and should reflect reader search language.
- Avoid other authors/titles, sales-rank claims, promotions, unrelated terms, Amazon program names, HTML, and misleading metadata.
- Categories and keywords must remain relevant to the book's actual content.

## Architecture

1. `KdpMarketIntelligenceService` remains provider-neutral.
2. Reports gain explicit ranked `keywordRecommendations` and `nicheOpportunities` while preserving the v1 persisted-report format for backward compatibility.
3. `OpenAiWebKdpMarketIntelligenceProvider` uses the OpenAI Responses API with the hosted web-search tool.
4. The provider requests source-backed JSON, extracts tool-returned web source URLs, and rejects model evidence whose URL was not present in the actual web-search source set.
5. Provider output remains research evidence, not canon and not a sales forecast.
6. At most seven keyword candidates may be marked as KDP-slot recommendations; larger candidate lists can still be retained for author review.

## Honesty boundary

Observable current evidence → market signal → ranked keyword/niche candidate → author decision.

Forge never converts weak market signals into a promise of sales, rankings, revenue, or commercial success.