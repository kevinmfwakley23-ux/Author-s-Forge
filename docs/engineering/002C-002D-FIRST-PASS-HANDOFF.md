# 002C–002D First-Pass Handoff — Publishing Metadata + Live Market Research

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Base: merged 002B durable structured book version management on current `main`.
- Android currently owns Specialized Creation / Mission 059; these publishing-market files do not overlap that office.
- This block does not create a second project database and does not silently mutate author metadata.

## 002C — Publishing metadata authority

Forge now has a durable KDP-oriented publishing metadata record scoped to a real Studio book. It covers title/subtitle, series, edition, author/contributors, description, keywords, categories, reading age, marketplace, language, formats, ISBN strategy, publication date and AI-content disclosure.

The Studio publishing service stores revisions as `publishing-memory`, archives earlier active revisions instead of deleting history, preserves author provenance and checks metadata against current cover title/author state.

KDP-oriented validation includes current limits and constraints such as description length, up to seven keyword phrases, up to three categories, children's reading-age review, ISBN strategy and prohibited promotional/contact metadata.

## 002D — Live AI market research + KDP keyword discovery

The existing Mission 018 market-intelligence contracts are extended rather than replaced. Reports can now retain:

- ranked evidence-backed keyword candidates;
- at most seven candidates marked for KDP keyword slots;
- compliance notes per phrase;
- ranked niche opportunities;
- separate demand and competition signals;
- comparable-title evidence;
- explicit research limitations and a mandatory non-sales-guarantee disclaimer.

`OpenAiWebKdpMarketIntelligenceProvider` is a real current-research provider using the OpenAI Responses API hosted `web_search` tool. Current OpenAI guidance recommends `web_search` for new integrations and treats `web_search_preview` as legacy. Because market research is meaningless without current evidence, Forge uses `tool_choice: "required"` rather than allowing the model to skip search. It requests `web_search_call.action.sources` and rejects any model-supplied evidence URL that was not actually returned by the search tool. A model therefore cannot invent a source and have Forge preserve it as evidence.

`StudioKdpMarketResearchService`:

- runs market research for a project/book;
- persists each report in the existing `kdpMarketIntelligenceReports` ProjectState history;
- lists/reloads reports across process restarts;
- delegates keyword application to Publishing metadata;
- requires explicit author approval before any researched keyword reaches KDP metadata;
- permits accepting the top recommended phrases or an author-chosen evidence-backed subset;
- refuses arbitrary phrases that were not recommendations in the selected saved research report.

`createConfiguredStudioKdpMarketResearch()` is the production composition boundary. It uses the real OpenAI web-search provider and fails honestly if the required API key/model configuration is absent; no static or demo market result is substituted in production.

## Honesty / authority chain

Current web evidence → market signal → keyword/niche candidate → saved report → author review → author-approved publishing metadata revision.

No market report guarantees rankings, revenue, sales or commercial success. Research reports never change manuscript or publishing metadata by themselves.

## Verification

Regression coverage must prove:

1. source URLs are tied to actual hosted web-search sources;
2. hallucinated evidence URLs fail closed;
3. current `web_search` is required and the full source list is requested;
4. more than seven selected KDP keyword slots fail;
5. promotional/manipulative keyword phrases fail;
6. durable research reports survive a fresh FileProjectStore/service instance;
7. unapproved keyword application leaves current publishing metadata unchanged;
8. approved top recommendations are attributable to the research report;
9. authors may choose a smaller evidence-backed subset.

Exact-head Forge CI is required before this block is cleared for integration into the author-visible Publishing workbench.