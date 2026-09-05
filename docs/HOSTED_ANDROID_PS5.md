# Author's Forge — Hosted Android + PS5 Access

## Purpose

This deployment lane removes the requirement for Android to execute the Forge backend locally.

The Author's Forge Node 24 runtime runs on one trusted hosted machine. Android, Chromebook, desktop browsers, and the PS5's limited system web view connect to that same runtime over HTTPS.

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

Provider credentials such as `OPENAI_API_KEY`, OmniRoute, 9Router, or other configured provider secrets belong only in the host environment. Do not place them in browser JavaScript, the manifest, Git, Android storage, or PS5 storage.

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

Hosted-mode source and integration regression coverage lives in `test/forge-web-gateway.test.js` and exercises Studio plus every prefixed production office, including NFT Creation.

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

1. Push/merge this implementation to the branch you want Render to deploy.
2. In Render, create a new Blueprint from this GitHub repository.
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

## PS5

### What PS5 support means

PS5 does not expose a normal standalone browser application. Therefore this repository does **not** claim a native PlayStation package or a normal PS5-installed web-browser app.

The supported Forge strategy is a console-browser compatibility mode on the same hosted HTTPS application. The client detects the `PlayStation 5` user agent, strengthens focus visibility and control sizing, disables smooth scrolling, and preserves single-origin navigation between Forge offices.

### Opening the hosted Forge in the current hidden browser flow

The currently documented community-accessible route uses the YouTube account-linking web view:

1. On PS5 open **Settings**.
2. Open **Users and Accounts**.
3. Open **Linked Services** and select **YouTube**.
4. Select **Link**, then **Use Browser**.
5. On the Google sign-in page select **Terms**.
6. Scroll to the footer and open **Google**.
7. Search for or navigate to your hosted Author's Forge address.
8. Enter the Forge access token.

Sony can change this hidden-browser route in a system update because it is not a dedicated browser feature.

### PS5 capability boundary

The hosted gateway is source-tested for console-compatible navigation, but a real PS5 remains a separate device-acceptance gate.

Do not mark PS5 support fully verified until the actual console has passed at least:

- login and cookie persistence for the browser session;
- Main Studio load and navigation;
- open/save/reload of an existing project;
- text entry with the PS5 on-screen keyboard or connected keyboard;
- Guided Journal, Workbook, Specialized Creation, and NFT Creation navigation;
- artifact download behavior for the formats the PS5 browser permits;
- long-page scrolling and modal/dialog interaction;
- provider-backed AI request and visible error behavior.

A PS5 failure must not be hidden behind a desktop/browser green test. If Sony's browser blocks a capability, Forge should identify that limitation and preserve the author's project state.

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

This lane is complete only after:

1. hosted gateway regression/integration tests pass;
2. the normal Forge source/unit/browser/mobile verification remains green or any unrelated infrastructure failure is recorded honestly;
3. the hosted service deploys with a persistent disk;
4. a real Android device completes save/reload and office navigation without Termux;
5. the PS5 hidden browser completes its feasible device-acceptance checks, with unsupported console-browser capabilities recorded rather than simulated.
