# Forge Execution Fabric

## Why this exists

Author's Forge must be able to use real coding/build environments without turning an AI response into unrestricted shell access.

The execution fabric is a shared ForgeCore trunk capability. Offices may propose jobs such as EPUB validation, PDF inspection, image conversion, source analysis, tests, packaging, or other build work. The execution boundary is deliberately separate from canonical book/art state.

**Execution output is evidence or a candidate artifact. It does not become approved manuscript, canon, artwork, publishing state, or source code merely because a command succeeded.** The author must still approve the downstream apply/import operation.

## Approval contract

1. Author or AI creates a proposed job with an exact provider, purpose, command vector, working directories, timeouts, and network-domain allowlist.
2. Forge normalizes the plan and stores its SHA-256 digest.
3. Only the author can approve it.
4. Immediately before execution Forge recomputes the digest. A changed plan invalidates approval.
5. The configured provider executes the approved plan.
6. Exit codes, stdout/stderr, timestamps, provider identity, sandbox identity when applicable, and the approved digest are persisted.
7. A rejected job never executes.

The command model uses `program + args[]`. Local Linux execution uses `spawn(..., shell:false)`, not an interpolated shell command.

## Durable store

`FileForgeExecutionStore` stores the author approval ledger atomically under:

```text
<FORGE_DATA_DIR>/execution/jobs.json
```

The execution ledger is intentionally distinct from project canon. It can be inspected as evidence without silently changing a book.

## Local Linux / Termux provider

Local execution is disabled unless the owner explicitly configures all of:

```text
FORGE_LOCAL_EXECUTION=1
FORGE_EXECUTION_ROOT=/absolute/path/to/a/dedicated/workspace
FORGE_LOCAL_EXECUTABLES=node,npm,git,python3
```

Security properties:

- no shell invocation;
- exact executable allowlist;
- realpath containment beneath `FORGE_EXECUTION_ROOT`, including symlink escape protection;
- minimal inherited environment (`PATH`, `HOME`, temp/locale basics), not the Forge provider-secret environment;
- per-command timeout;
- bounded output capture;
- stop the plan on first non-zero exit.

Do not point `FORGE_EXECUTION_ROOT` at the Forge data directory. Use a disposable/dedicated workspace.

On Termux, this provider can run only when the Forge backend itself is intentionally hosted inside Termux. The Android APK does not require Termux and does not grant a remote AI uncontrolled access to the phone shell.

## Daytona provider

Configure:

```text
DAYTONA_API_KEY=<server-side secret>
DAYTONA_API_URL=https://app.daytona.io/api               # optional override
DAYTONA_TOOLBOX_URL=https://proxy.app.daytona.io/toolbox # optional override
DAYTONA_LANGUAGE=typescript                              # typescript|javascript|python
DAYTONA_TTL_MINUTES=30
```

The provider uses Daytona's documented REST boundaries:

- creates one ephemeral sandbox for the approved job;
- applies a wall-clock TTL;
- uses `networkBlockAll: true` when the job requires no internet;
- otherwise sends only the author-approved `domainAllowList`;
- sends exact, POSIX-quoted command vectors to the sandbox process endpoint;
- records real exit codes/results;
- deletes the sandbox in `finally`, with TTL as a second cleanup boundary.

`DAYTONA_API_KEY` belongs only on the Forge server. Never put it in the Android app, browser JavaScript, project JSON, or generated book/art files.

## Why domain allowlists matter

If a build requires GitHub and npm, approve only those required domains. A normal no-network inspection should remain block-all. This reduces the chance that generated/untrusted code can exfiltrate project data.

## GitHub boundary

Private GitHub authentication should be implemented server-side with a GitHub App and least-privilege, expiring installation/user tokens. Do not put a GitHub App private key, PAT, or repository write credential inside a Daytona sandbox by default. If a future task genuinely needs private-repository access inside a sandbox, use a short-lived, repository-scoped credential delivered through a provider secret mechanism and revoke/expire it after the job.

## Additional providers

`ForgeExecutionProvider` is the stable adapter boundary. E2B or another isolated execution platform can be added without changing office code or weakening the author-approval contract.

## Examples of legitimate Forge jobs

- run EPUBCheck against an exported EPUB;
- run PDF metadata/preflight inspection;
- execute the Forge regression suite against a proposed code change;
- rasterize or inspect an approved artwork candidate;
- run image dimension/color-profile checks;
- construct a temporary publishing bundle and verify checksums;
- inspect a Git working tree or diff in an isolated workspace;
- compile user-approved interactive/specialized book assets.

## Non-goals

The execution fabric is not permission for AI to:

- run arbitrary commands merely because a prompt asked for them;
- access arbitrary internet destinations;
- read server secrets;
- write directly into canonical author state;
- force-push repositories;
- approve its own execution plan;
- hide failures or replace tool output with simulated success.
