# Author's Forge on Android via Termux

Author's Forge is a platform-neutral web application. Android does not need a separate rewrite of the Forge domain/application layer. When a local Android development/runtime path is useful, Termux can host the same Forge workplace directly on the phone and Chrome can install/use the PWA shell.

## Why the Chromebook + phone connection is useful

The two terminals can serve different jobs while using the same Git repository:

- **Chromebook/Linux:** primary engineering, build, test, browser acceptance, and Git work.
- **Android/Termux:** real-device runtime, touch/PWA installation, phone file handling, and physical Android acceptance.
- **Shared GitHub repository:** both environments can pull the same verified commits and reproduce the same source state.

Do not edit the same files independently on both machines at the same time. Pull the latest commit before switching machines and commit focused changes from one environment at a time.

## First Android setup

In Termux:

```bash
pkg update
pkg install git nodejs
```

Clone the repository if it is not already present:

```bash
git clone https://github.com/kevinmfwakley23-ux/Author-s-Forge.git
cd Author-s-Forge
```

Then launch the complete local workplace:

```bash
bash scripts/termux-forge.sh
```

The Termux launcher installs dependencies when needed, creates a device-local Forge data directory, generates or reuses a strong `FORGE_ACCESS_TOKEN`, and starts the normal production launcher in protected non-loopback mode. The real Main Studio, Guided Journal, Educational Workbook, and Specialized Creation processes remain bound to loopback; only access-gated proxy ports are exposed to the phone/LAN interface.

The launcher prints a protected bootstrap URL similar to:

```text
http://127.0.0.1:4173/?access=<generated-token>
```

Open **that exact printed URL first** in Chrome on the Android phone. Forge immediately redirects to the clean URL without the token and stores an `HttpOnly`, `SameSite=Strict` host cookie. The same cookie authorizes the companion office ports on `127.0.0.1`.

If another trusted device on the same LAN needs to use the phone-hosted Forge, replace `127.0.0.1` in the printed bootstrap URL with the phone's LAN IP. Anonymous or incorrect-token requests receive `401` and do not reach the Forge project APIs.

The Studio's install control can then be used when Chrome exposes the PWA installation prompt. If the in-page install prompt is unavailable, use Chrome's **Install app / Add to Home screen** browser control when offered.

The access token protects the local HTTP surface from anonymous LAN access, but it does not provide transport encryption. Use this LAN mode only on a network you trust; use an authenticated encrypted tunnel or HTTPS reverse proxy for untrusted or remote networks.

## Durable data

The Termux launcher uses:

```text
.forge-data/
```

inside the repository by default. This is the phone's durable Forge project state and is separate from the browser's service-worker cache.

Do not put provider credentials in project files. Configure provider environment variables only when real provider execution is intentionally being tested.

## Chromebook ↔ phone workflow

A useful development loop is:

1. Build and test on the Chromebook.
2. Commit the verified change to `main`.
3. On the phone, run `git pull --ff-only`.
4. Run `bash scripts/termux-forge.sh`.
5. Open the protected bootstrap URL printed by the launcher in Chrome.
6. Install/open the PWA.
7. Exercise the affected workflow with real touch interaction.
8. If a device defect is found, reproduce and fix it in the repository rather than weakening the acceptance test.

The phone and Chromebook may use different `.forge-data` directories. That is intentional: the application code is shared, while local project state is device-local unless exported/imported through Forge's portable project package workflow.

## Important limitation

This is a **real Android runtime path**, but it is not an APK build. The canonical Android delivery surface remains the installable PWA. A future native shell can reuse the same platform-neutral application boundaries if there is a product reason to add one.

Final Android completion still requires physical-device evidence for installation, standalone launch, touch navigation, project creation, manuscript editing, reload/restart durability, artifact handling, offline shell behavior, and reconnection.
