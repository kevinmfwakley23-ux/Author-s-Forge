# Author's Forge — Mission 002

## Author Input & Voice Intent Foundation

### Objective
Establish the canonical input contract that allows Author's Forge to accept typed or dictated author input without conflating transcription with manuscript generation.

### Scope
- Canonical author input records.
- Transcript provenance and preservation of original dictated text.
- Explicit input modes: typed, dictated, imported, pasted.
- Deterministic intent classification for common author commands.
- A routing boundary that separates author text from commands.
- Public exports and acceptance coverage.

### Required invariants
1. Original input text is never silently rewritten.
2. A transcript retains its source/provider metadata when available.
3. Command recognition is explicit and deterministic; ordinary prose remains prose.
4. The input layer does not directly mutate manuscripts or project files.
5. The design remains provider-neutral so browser speech recognition, local transcription, or future external providers can plug in without changing the domain contract.

### Acceptance criteria
- Build passes under strict TypeScript.
- Typed and dictated inputs normalize to the same canonical input contract.
- Original transcript text and provenance survive normalization.
- Known voice commands are classified without changing their original text.
- Ordinary manuscript prose is classified as author content.
- Unsafe/empty input is rejected.
- No input operation has direct filesystem authority.

### Explicitly deferred
Actual browser microphone capture and a visual editor are presentation-layer work. This mission establishes the production domain/application contract those adapters will consume; it does not create a fake speech service.
