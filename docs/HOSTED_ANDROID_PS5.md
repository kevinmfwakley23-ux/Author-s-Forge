# Author's Forge — Hosted Universal Access + PS5 Compatibility

## Purpose

This deployment lane removes the requirement for phones, tablets, Chromebooks, restricted browsers, and ordinary desktop clients to execute the Forge backend locally.

The Author's Forge Node 24 runtime runs on one trusted hosted machine. Android, Chromebook, iPhone/iPad, desktop browsers, native gateway clients, and any compatible embedded WebView connect to that same runtime over HTTPS.

This is not a fake static demo and it is not a second Forge implementation. The hosted gateway launches the existing five production office servers against the same `FORGE_DATA_DIR` and proxies them through one authenticated origin:

| Public path | Existing production server |
| --- | --- |
| `/` | Main Studio |
| `/journal/` | Guided Journal Office |
| `/workbooks/` | Educational Workbook Office |
| `/specialized/` | Specialized Creation Office |
| `/nft/` | NFT Creation Office |

The application state, Project Brain, manuscript state, journal/workbook/specialized/NFT data, generated artifacts, provider boundaries, and author governance remain server-side Forge state.

## Security boundary

Hosted Forge requires `FORGE_ACCESS_TOKEN` when it is bound beyond loopback. Use at least 24 characters and treat it like a password.

The login form exchanges that token for an `HttpOnly`, `SameSite=Strict` cookie. When the public request is HTTPS, the cookie is also marked `Secure`.

Provider credentials such as `OPENAI_API_KEY`, OmniRoute, 9Router, or other configured provider secrets belong only in the host environment. Do not place them in browser JavaScript, the manifest, Git, Android storage, iOS storage, or console WebView storage.

`/healthz` intentionally exposes only a minimal process-health response so a hosting platform can perform health checks without receiving project state.

## Local hosted-mode verification

Use the validated Node 24 runtime:

```bash
nvm use 24
npm ci
export FORGE_ACCESS_TOKEN='replace-with-a-private-token-at-least-24-characters'
export FORGE_WEB_HOST='127.0.0.1'
npm run forge:web
```

Open `http://127.0.0.1:4173/` and enter the access token.

Hosted-mode source and integration regression coverage lives in `test/forge-web-gateway.test.js`. The real browser/device-style release gate is:

```bash
npm run test:browser:hosted
```

That gate boots the production hosted gateway, authenticates through it, creates a real project, traverses Studio, Guided Journal, Educational Workbooks, Specialized Creation, and NFT Creation on one origin, verifies project continuity and office API remapping, exercises restricted-console no-popup navigation, and deliberately blocks service workers to ensure the hosted authoring path does not depend on PWA support.

## Docker

The root `Dockerfile` builds Forge with Node 24 and starts the single-origin hosted gateway.

Example local container run:

```bash
docker build -t authors-forge .
docker run --rm \
  -p 4173:10000 \
  -v "$PWD/.forge-web-data:/data/authors-forge" \
  -e FORGE_ACCESS_TOKEN='replace-with-a-private-token-at-least-24-characters' \
  authors-forge
```

The volume is not optional for real work. Without persistent storage, a disposable host can lose Forge project files during redeployment.

## Render deployment

`render.yaml` defines one Docker web service with a persistent disk and HTTPS-aware access cookie handling.

1. Push/merge the release commit you want Render to deploy.
2. In Render, create a Blueprint from this GitHub repository.
3. When Render prompts for `FORGE_ACCESS_TOKEN`, enter a private value of at least 24 characters that you can enter on your devices.
4. Add only the AI/research/image provider environment variables you actually intend to use. Forge must continue to report unavailable providers honestly when credentials are absent.
5. Let the service deploy and verify `/healthz` reports `ok: true`.
6. Open the service's HTTPS address and sign in with the Forge access token.

The Blueprint mounts persistent storage at `/var/data` and points `FORGE_DATA_DIR` at `/var/data/authors-forge`.

Do not replace the persistent disk with ephemeral container storage for production author work.

## Android — no Termux

Once the hosted Forge address is live:

1. Open the HTTPS Forge address in Chrome on Android.
2. Enter the Forge access token.
3. Confirm a real project can be opened and saved.
4. Use Chrome's **Install app** or **Add to Home screen** action when available.
5. Launch Author's Forge from the home-screen icon thereafter.

The phone is now only the secure browser/PWA client. It does not need Node, npm, Git, Termux, or a local Forge checkout.

The existing responsive/mobile UI remains the application surface. The hosted client remaps the historical office ports—including the NFT Creation port—onto the single HTTPS origin.

## Chromebook, iPhone/iPad, and desktops

Chromebook can use the hosted/PWA lane without Linux, with the Android package as an additional option on supported models. iPhone/iPad and normal desktop browsers can use the same HTTPS hosted Forge immediately; native Tauri packaging is a separate distribution lane and must not create a second project database.

Windows/macOS/Linux native packaging is not considered a standalone offline desktop release until the application-owned Forge runtime sidecar is bundled and verified. Until then, the native shell is a real authenticated gateway client to the hosted Forge runtime.

## PS5

### Current product truth

PS5 system software contains WebKit components, and Forge retains a `PlayStation 5` user-agent compatibility mode that keeps office navigation on one origin, avoids popup/new-tab dependence, increases console-safe interaction behavior, and continues to route work to the hosted Forge backend.

However, PS5 does **not** provide a normal dedicated browser application that a user can launch and point at an arbitrary Forge URL. Therefore Author's Forge does not currently mark direct consumer PS5 access as supported or verified.

The repository must not depend on undocumented account-linking, messaging, redirect, or other hidden-browser tricks as the official product launch path. Those entry points are outside Forge's control and may be changed or blocked by Sony.

### What would make PS5 a supported lane

Direct PS5 support becomes a real supported lane only when at least one of these exists:

1. Sony exposes a supported user-accessible browser/WebView route that can open the hosted Forge URL; or
2. Author's Forge is distributed through a Sony-authorized PlayStation application/SDK program.

When either path exists, the current hosted compatibility client is the correct backend architecture: the console remains a client and all Project Brain, AI provider, persistence, artifact, and coding/sandbox work stays on the trusted Forge host.

### PS5 device acceptance

A real PS5 remains a separate physical-device gate. If an authorized web/app surface is available, acceptance must prove at least:

- login and authenticated session behavior;
- Main Studio load and navigation;
- open/save/reload of an existing project;
- text entry using controller keyboard or connected keyboard;
- Guided Journal, Workbook, Specialized Creation, and NFT navigation;
- artifact handling permitted by the PlayStation surface;
- long-page scrolling and modal/dialog interaction;
- provider-backed AI request and truthful provider error behavior.

A PS5 limitation must never be hidden behind a Chromium desktop test. The automated hosted-device gate proves the Forge architecture under restricted-console assumptions; it does not manufacture a PlayStation launch surface that Sony does not expose.

## Operational model

Hosted Forge is deliberately single-writer/single-instance friendly because its current durable state is file-backed. The persistent disk belongs to one running Forge service.

Do not horizontally scale multiple Forge instances against separate local disks and call that shared persistence. A future multi-instance deployment would require a deliberately designed shared storage/database boundary first.

## Environment variables

Core hosted runtime variables:

```text
FORGE_WEB_HOST=0.0.0.0
PORT=<hosting-platform-port>
FORGE_ACCESS_TOKEN=<private 24+ character token>
FORGE_DATA_DIR=<persistent mounted directory>
FORGE_REQUIRE_HTTPS=1
FORGE_SECURE_COOKIE=1
```

Provider variables remain the same as the normal Forge runtime. Configure only real providers and real credentials.

## Definition of done for this lane

The universal hosted lane is complete only after:

1. hosted gateway regression/integration tests pass;
2. `npm run test:browser:hosted` passes on the exact release head;
3. the normal Forge source/unit/browser/mobile verification remains green;
4. the hosted service deploys over HTTPS with persistent storage;
5. at least one real Android/Chromebook/iOS/desktop client completes login, save/reload, office navigation, and artifact retrieval against that deployment.

PS5 is tracked separately: Forge's compatibility architecture can be complete while direct PS5 consumer access remains **blocked by the lack of a supported user-launchable web/app entry surface**. Do not relabel that external platform limitation as an Author's Forge implementation success.
