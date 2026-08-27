# Mission 019 — Book Positioning

## Status

IMPLEMENTED — awaiting Linux verification.

## Purpose

Provide a structured, evidence-aware positioning layer that answers who a book is for, what desire/problem it addresses, genre, shelf, differentiation, comparable books, and click motivation, then produces reusable positioning copy and promotional concepts.

## Contract

A positioning report contains target audience, problem/desire, genre, shelf, differentiation, comparable books, click reason, title concepts, subtitle concepts, hooks, elevator pitches, back-cover copy, Amazon description, author bio, taglines, promotional hooks, evidence, limitations, and a mandatory non-guarantee disclaimer.

## Safety / honesty boundary

Positioning is strategic interpretation of supplied manuscript and market evidence. It must never claim guaranteed reader response, clicks, rankings, sales, revenue, or commercial performance.

## Architecture

- Domain: `src/domain/book-positioning.ts`
- Application: `src/application/book-positioning.ts`
- Project persistence: `withProjectBookPositioningReports`
- Public API: `src/index.ts`
- Acceptance coverage: `test/book-positioning.test.js`

The provider boundary accepts real positioning intelligence while `StaticBookPositioningProvider` supplies deterministic test data. No fake commercial prediction engine is used.

## Verification

```bash
npm run check
```

Linux terminal verification is the acceptance authority.
