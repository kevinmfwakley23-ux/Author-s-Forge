# Author's Forge on Android via Termux

Author's Forge is a platform-neutral web application. Android does not need a separate rewrite of the Forge domain/application layer. When a local Android development/runtime path is useful, Termux can host the same Studio process directly on the phone and Chrome can install/use the PWA shell.

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

Then launch the local Studio:

```bash
bash scripts/termux-forge.sh
```

The launcher installs dependencies when needed, creates a device-local Forge data directory, binds the Studio to `0.0.0.0:4173`, and starts the normal production build/server path.

Open Chrome **on the Android phone** and visit:

```text
http://127.0.0.1:4173
```

The Studio's install control can then be used when Chrome exposes the PWA installation prompt. If the in-page install prompt is unavailable, use Chrome's **Install app / Add to Home screen** browser control when offered.

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
5. Open the phone's local Studio in Chrome.
6. Install/open the PWA.
7. Exercise the affected workflow with real touch interaction.
8. If a device defect is found, reproduce and fix it in the repository rather than weakening the acceptance test.

The phone and Chromebook may use different `.forge-data` directories. That is intentional: the application code is shared, while local project state is device-local unless exported/imported through Forge's portable project package workflow.

## Important limitation

This is a **real Android runtime path**, but it is not an APK build. The canonical Android delivery surface remains the installable PWA. A future native shell can reuse the same platform-neutral application boundaries if there is a product reason to add one.

Final Android completion still requires physical-device evidence for installation, standalone launch, touch navigation, project creation, manuscript editing, reload/restart durability, artifact handling, offline shell behavior, and reconnection.
