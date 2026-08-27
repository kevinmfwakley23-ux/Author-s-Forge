# Author's Forge — Mission 008

## Research Engine

### Objective
Establish governed, provider-neutral research access that converts external research into durable, project-linked research knowledge without silently changing manuscript or canon state.

### Supported research domains
- historical periods
- geography
- real-world locations
- travel distances
- weather
- architecture
- clothing
- technology
- occupations
- political environments
- cultural practices
- terminology
- historical events
- local landmarks
- regional speech patterns
- legal/environmental background
- medical/scientific facts
- publishing information
- market information
- genre trends
- reader expectations
- comparable books

### Required research record
Every persisted research claim carries:
- source
- date
- URL
- claim
- confidence
- relevance
- project link
- optional book/chapter/scene links
- research question
- reason the research was performed

### Authority boundary
Research is evidence and project knowledge, not automatic canon. Research records enter the memory layer as `research-memory` with `working` authority and explicit source provenance. Promotion to authoritative creative truth remains governed by the existing Project Memory rules.

### Persistence
Research claims are stored through the existing portable Project Memory store. Retrieval can scope by project, book, chapter, scene, domain, and result limit. The persisted record retains enough provenance to explain why the research exists and where the claim came from.

### Provider boundary
The engine consumes a `ResearchProvider` interface. Internet/search implementations are adapters behind that boundary. The core engine does not fabricate external results and does not couple the product to a search vendor.

### Safety and integrity
- Only HTTP(S) source URLs are accepted.
- Source dates must be valid dates.
- Empty research results are rejected.
- Duplicate research identifiers cannot silently overwrite existing project knowledge.
- Cross-project retrieval is isolated.
- Research never mutates manuscript content.
- Research never silently promotes itself to canon.

### Acceptance criteria
- Research claims preserve source, date, URL, claim, confidence, relevance, and project/book/chapter/scene links.
- Research questions and rationale are persisted.
- Research becomes durable project memory.
- Previously collected research can be retrieved without invoking the provider again.
- Retrieval isolates projects and supports book/chapter/scene/domain filters.
- Malformed URLs and dates are rejected.
- Empty provider results are rejected.
- Duplicate research identifiers are rejected.
- Research memory retains source provenance and remains non-canon working knowledge.
- Existing mission regression coverage remains intact.
