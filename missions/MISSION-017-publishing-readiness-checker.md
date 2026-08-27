# Mission 017 — Publishing Readiness Checker

## Status

IMPLEMENTED — awaiting Linux verification.

## Contract

Forge performs a deterministic final publication audit across manuscript, cover, metadata, formatting, images, table of contents, pagination, trim, bleed, production file types, title, author, description, keywords, and categories.

## Output

Every audit produces individual checks with category, severity, status, message, and actionable remediation. The report includes exact passed and attention counts and is `ready` only when every check passes.

The system deliberately reports actionable failures instead of returning a vague approval such as “looks good.”

## Persistence

Readiness reports are validated before entering project state and are retained as immutable audit records. Reports from another project or duplicate report identifiers are rejected.

## Boundary

The checker audits authoritative inputs and previously-produced artifacts; it does not claim that an unprovided artifact passed validation. Provider-specific rendering remains behind the production boundaries established by earlier missions.
