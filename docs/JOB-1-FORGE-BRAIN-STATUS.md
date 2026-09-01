# Job #1 — Forge Brain / Core / Trunk

**Status: IN PROGRESS**

Job #1 is the only active engineering target for the new canonical lead-pass traversal. Downstream office failures remain parked unless they are caused by or block the shared Forge Brain trunk. Mission 059 Specialized Creation work already in flight remains coordinated separately and must not be overwritten by this pass.

## Verified trunk boundaries already established on `main`

- `ForgeCore` is the shared composition root for the canonical memory store and AI model broker.
- Durable project persistence is defined by the provider-neutral `ProjectStorePort` rather than an infrastructure dependency inside application code.
- `FileProjectStore` is the current durable filesystem adapter.
- Forge readiness requires both real configured AI capacity and a bound durable project store.
- Core health reports durable project storage as an explicit operational check.
- Production core composition binds the filesystem project store and discovers only actually configured AI resources.
- Author Voice Memory is exposed through the canonical public API.
- Core regression coverage uses the canonical build output and deterministic historical character timestamps.
- Forge Core exposes durable project snapshot/recovery boundaries that capture project state, memory identity, and routing state together.

## Lead-pass work in review

Branch: `core/forge-brain-lead-pass-001`

Pull request: `#41 — Forge Brain lead pass: authoritative AI execution readiness`

This block is intentionally not marked verified until CI and Chromebook follow-behind evidence are green.

- `ForgeCore` now owns the existing broker-driven `AiExecutionFallback` using the same shared `AiModelBroker` and `AiRoutingState` rather than creating a disconnected execution state.
- Core readiness now distinguishes **configured** AI resources from **operational** AI resources; unhealthy models and models still in cooldown cannot create a false-ready state.
- Forge Core health exposes configured and operational model counts plus the shared retry/failover execution boundary.
- `FileProjectStore` now publishes durable state through unique sibling temporary files, syncs completed file data before rename, attempts parent-directory sync where supported, and cleans temporary files on failure.
- Regression coverage exercises shared failover telemetry, unhealthy/cooldown readiness, and sixteen overlapping project saves without temp-file collision or partial JSON publication.

## Remaining Job #1 gates

1. Wire the production Studio server to the `ForgeCore` composition root. **NEXT**
2. Make the `ForgeCore` broker the authoritative live model-selection boundary for AI execution rather than the current parallel provider-order path. **NEXT**
3. Bring quota/cost protection, health, cooldown, latency and truthful failover completely under the shared broker boundary. **PARTIAL — shared execution/failover now owned by ForgeCore in PR #41; live Studio/provider routing still must consume it.**
4. Move remaining core memory domains behind the shared Project Brain/trunk without creating duplicate feature-office brains.
5. ~~Establish durable core snapshot/recovery coverage that includes all core-owned state required for restart.~~ **COMPLETE**
6. Establish the shared governance/authority boundary at the core composition root.
7. Establish shared artifact/version, jobs/streaming and device foundations as reusable core contracts.
8. Verify the integrated trunk with build, regression, browser and device evidence.

## Research-backed hardening direction

The Forge Brain should keep one authoritative model-routing boundary with health-aware eligibility, retries/fallback, cost/quota protection, and observable runtime telemetry. AI observability should record model identity, latency, token usage, finish/failure state and retry behavior without recording private manuscript/prompt content by default. Durable project-state writes should preserve all-or-nothing visibility and avoid shared-temp-file races; project-level conflict/version handling remains a later persistence hardening item after the live Studio is routed through the trunk.

## Parking rule

Craft Lens, PWA cache-version mismatches, downstream office UI failures, and other non-core failures are not Job #1 work unless their root cause is demonstrated to be a Forge Brain/Core/Trunk dependency.
