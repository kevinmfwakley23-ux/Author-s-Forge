# Job #1 — Forge Brain / Core / Trunk

**Status: IN PROGRESS**

Job #1 is the only active engineering target. Downstream office failures remain parked unless they are caused by or block the shared Forge Brain trunk.

## Verified trunk boundaries now established

- `ForgeCore` is the shared composition root for the canonical memory store and AI model broker.
- Durable project persistence is defined by the provider-neutral `ProjectStorePort` rather than an infrastructure dependency inside application code.
- `FileProjectStore` is the current durable filesystem adapter.
- Forge readiness now requires both real configured AI capacity and a bound durable project store.
- Core health reports durable project storage as an explicit operational check.
- Production core composition binds the filesystem project store and discovers only actually configured AI resources.
- Author Voice Memory is exposed through the canonical public API.
- Core regression coverage uses the canonical build output and deterministic historical character timestamps.
- Forge Core now exposes durable project snapshot/recovery boundaries that capture project state, memory identity, and routing state together.

## Remaining Job #1 gates

1. Wire the production Studio server to the ForgeCore composition root.
2. Make the ForgeCore broker the authoritative live model-selection boundary for AI execution rather than a parallel registry.
3. Bring quota/cost protection, health, cooldown, latency and truthful failover under the shared broker boundary.
4. Move remaining core memory domains behind the shared Project Brain/trunk without creating duplicate feature-office brains.
5. ~~Establish durable core snapshot/recovery coverage that includes all core-owned state required for restart.~~ **COMPLETE**
6. Establish the shared governance/authority boundary at the core composition root.
7. Establish shared artifact/version, jobs/streaming and device foundations as reusable core contracts.
8. Verify the integrated trunk with build, regression, browser and device evidence.

## Parking rule

Craft Lens, PWA cache-version mismatches, downstream office UI failures, and other non-core failures are not Job #1 work unless their root cause is demonstrated to be a Forge Brain/Core/Trunk dependency.
