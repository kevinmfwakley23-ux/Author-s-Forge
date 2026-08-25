# Author's Forge — Mission 003

## Cross-Platform / Multi-Device Foundation

### Objective
Establish the canonical runtime and device-neutral contract for Author's Forge so the product's project state, author identity, workflows, and durable data are not coupled to a single operating system, device, browser, or local filesystem.

### Supported environment classes
The foundation must be able to represent, without changing domain semantics:

- Web browser on desktop
- Web browser on tablet
- Web browser on phone
- Desktop application/runtime
- Mobile application/runtime
- Local development runtime
- Remote/cloud runtime

A concrete platform adapter may support only a subset initially, but the domain contract must not encode platform-specific assumptions.

### Core design rules
1. Project data belongs to the portable Forge project, not to a device.
2. Runtime-specific paths, storage APIs, microphone APIs, notifications, clipboard, and file pickers are adapters.
3. Domain/application services operate on capabilities rather than platform names.
4. A project may be opened on another authorized runtime without changing its identity or canonical content.
5. Runtime interruption must not corrupt project state.
6. Autosave/checkpoint semantics are defined above the platform adapter layer.
7. The architecture must permit future offline-first behavior without forcing an online-only contract today.

### Initial platform-neutral contracts
- Runtime identity
- Device identity
- Storage capability
- Input capability
- Audio capture capability
- File import/export capability
- Network capability
- Notification capability
- Clipboard capability
- Render/display capability
- Connectivity state
- Project portability metadata

### Explicitly deferred
This mission does not build separate native applications for every device class. It establishes stable interfaces and deterministic capability detection so future presentation/runtime adapters can be added without changing the core domain model.

### Acceptance criteria
- Strict TypeScript build passes.
- Runtime/device capability models compile independently of browser, Node, iOS, Android, or desktop APIs.
- A portable project records no absolute device-local path as canonical project identity.
- Capability availability can be represented independently from capability implementation.
- A project can be opened with a different runtime identity in an acceptance test without changing project content.
- Runtime interruption can be represented as a recoverable state rather than a domain failure.
- No platform adapter receives unrestricted project-write authority merely by being registered.
