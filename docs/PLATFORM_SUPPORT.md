# Author's Forge — Platform Support Contract

Author's Forge is being built as a standards-based web application first so the same product can run on the user's Asus Chromebook and Android phone without creating separate codebases.

## Supported product targets

### Asus Chromebook
- Primary experience: Chromium browser.
- Installable application target: Progressive Web App (PWA).
- Responsive layout must remain usable from touch-sized screens through desktop displays.
- No dependency on Windows/macOS-only APIs or native desktop installation.
- Local development and production launch are validated on Node.js 24 LTS; `.nvmrc` is the repository runtime authority for nvm-based environments.

### Android phone
- Primary experience: current Chromium-based mobile browser.
- Installable application target: PWA / standalone browser application.
- The local Termux host runtime is Node.js 24 LTS via the `nodejs-lts` package; Forge intentionally rejects the current-release `nodejs` package when it resolves to an unvalidated major version.
- Touch controls, responsive forms, readable editor surfaces, and viewport-safe layouts are required.
- Camera, microphone, file, and other device capabilities must be accessed only through browser-standard APIs with explicit permission and graceful fallback.

## Runtime contract

- Supported Node major: **24 LTS**.
- `package.json`, `package-lock.json`, `.nvmrc`, CI, release packaging, and the Termux launcher must agree on that runtime.
- Unsupported or end-of-life Node majors fail explicitly before Forge presents them as supported.
- Dependency installation in CI and release instructions uses `npm ci` so `package-lock.json` is authoritative.
- Runtime-major changes are engineering migrations: they require regression, desktop browser, and Android/mobile acceptance before merge.

## Future environments

The application boundary must remain browser-first and platform-neutral. Future native shells (for example desktop wrappers or Android/iOS shells) should consume the same HTTP/API and project-package contracts rather than duplicating domain logic.

## Offline and data rules

The PWA shell may cache static application resources for startup resilience. It must never cache `/api/` responses as authoritative project state. Project persistence remains governed by the server/project-store boundary and the portable project package format.

## Engineering requirements

Every new UI capability must:

1. Work with mouse and touch input.
2. Avoid fixed desktop-only dimensions.
3. Use responsive layout primitives.
4. Keep API and domain logic independent of the device.
5. Provide an explicit fallback when a browser capability is unavailable.
6. Be covered by automated tests where platform behavior can be tested without a physical device.
7. Preserve the author's project data and portable recovery path.

Chromebook and Android are first-class targets, not temporary development conveniences.
