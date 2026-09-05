# Author's Forge Platform & Coding-Environment Matrix

**Status:** active engineering contract

Author's Forge must be usable from ordinary consumer devices **without requiring Termux, VS Code, a terminal, or another developer application just to launch Forge**. Developer tools remain optional power-user integrations.

## Product rule

One Forge codebase and one durable project/state model serve every platform. Platform packaging and execution adapters may differ, but they must not fork project truth, author authority, AI routing, provenance, recovery, or publishing behavior.

No platform may be marked supported merely because a static screen opens. A supported lane must reach the real Forge APIs/state boundary and return truthful failures when a provider or execution backend is absent.

## Supported / target lanes

| Platform | End-user lane | Coding/execution lane | Packaging truth |
| --- | --- | --- | --- |
| Windows 10/11 | Native packaged desktop app + hosted fallback | local shell, Git, GitHub CLI, Docker/Podman sandbox, remote SSH/Codespaces | Native installer is the target; no Node/terminal should be required by the end user after packaging. |
| macOS | Native packaged desktop app + hosted fallback | local shell, Git, GitHub CLI, Docker/Podman sandbox, remote SSH/Codespaces | Native app/DMG target. Apple signing/notarization is required for normal distribution. |
| Linux | Native packaged desktop app/AppImage/DEB/RPM target + hosted fallback | local shell, Git, Docker/Podman, SSH, GitHub CLI | Native packages target. Runtime capability must be detected rather than assumed. |
| Chromebook | Installable Android app where Google Play is supported; installable PWA/hosted lane everywhere; optional Linux lane | ChromeOS Linux/Crostini, Git, Docker/Podman where available, SSH, Codespaces | Do not require Linux or Termux for normal use. Android support depends on the Chromebook model/policy. |
| Android phone/tablet | Native APK/AAB target + hosted PWA fallback | optional Termux bridge, remote sandbox/Codespaces/SSH; no Termux requirement | End-user app must launch directly. Heavy arbitrary coding execution should prefer governed remote/local sandbox adapters rather than pretending every Android device is a full Linux workstation. |
| iPhone/iPad | Native iOS App Store/TestFlight target + hosted web fallback | remote sandbox/Codespaces/SSH via Forge services | iOS packaging requires macOS/Xcode and Apple signing. Do not claim local arbitrary process execution that iOS does not permit. |
| PS5 | Hosted single-origin web lane adapted to the system web view | remote sandbox/Codespaces/GitHub through Forge backend | No native PS5 package is claimed. Console access is a client surface to a hosted Forge runtime. |
| Other browser-capable devices | Hosted responsive web/PWA lane | governed remote execution adapters | Browser support does not imply local shell access. |

## Coding environment adapters

Forge's coding-capability layer is provider-neutral. A task may be executed through one of these real backends when configured:

1. **Local host** — direct repository/file operations on Windows/macOS/Linux/ChromeOS Linux/Termux when the user intentionally enables the local developer lane.
2. **Disposable Docker/Podman sandbox** — preferred for build/test or unfamiliar code. `npm run forge:sandbox -- -- <command>` defaults to read-only workspace, no network, dropped Linux capabilities, memory/CPU/PID limits, and never falls back to the host when a container runtime is missing.
3. **GitHub / GitHub CLI** — repository, branch, commit, pull-request and issue workflows using authenticated GitHub tooling.
4. **GitHub Codespaces / devcontainer** — `.devcontainer/devcontainer.json` creates the validated Node 24 development environment with GitHub CLI, Rust and Docker-in-Docker available for real build/test work.
5. **SSH Linux host** — target for user-owned servers, cloud VMs, NAS/dev machines and other remote Linux environments after explicit credential/configuration setup.
6. **Termux** — optional Android power-user bridge only. It must never be required for ordinary Android app usage.
7. **Future sandbox providers** — E2B, Daytona, Modal, Fly Machines, Kubernetes jobs, self-hosted runners or equivalent may be added behind the same execution contract. Forge must expose provider name, workspace identity, command, exit status, logs, artifact lineage and failure reason.

## Capability detection

Run:

```bash
npm run forge:doctor
npm run forge:doctor:json
```

The platform doctor detects Node/npm, Git, GitHub CLI, Docker, Podman, Rust/Cargo, Java, Android SDK, ADB, Xcode, Codespaces, Termux, WSL, containers and ChromeOS indicators. Missing capabilities remain `false`; Forge does not simulate them.

## Native application architecture

The native packaging direction is **Tauri 2** because it supports Windows, macOS, Linux, Android and iOS from one web UI/codebase while allowing platform-specific Rust/Swift/Kotlin integration where necessary.

The packaging contract is split deliberately:

- **UI/client:** existing Forge responsive interface inside the native shell.
- **Forge state/runtime:** same project/state/provider contracts already used by the web application.
- **desktop local-runtime mode:** package or launch the Forge backend as an application-owned sidecar so end users do not install Node separately.
- **mobile mode:** use native client packaging with the hosted Forge gateway for full server-side/provider/sandbox work; device-local storage is for app/session material permitted by the platform, not a second hidden project database.
- **offline/local-authoring goal:** keep authoring/review surfaces usable where practical; capabilities that require providers, GitHub or sandboxes must fail visibly when offline.

A native wrapper that merely opens a screen is not completion. Platform release acceptance must prove login/bootstrap where applicable, project open/save/reload, writing state, office navigation, artifact download/share, provider failure honesty, and recovery on real target-sized devices.

## Distribution targets

- Windows: signed installer / Microsoft Store-compatible build target.
- macOS: signed/notarized app or DMG; App Store-compatible configuration where desired.
- Linux: AppImage plus at least one native package format (DEB initially).
- Android: signed APK for direct testing/distribution and AAB for Google Play.
- iOS/iPadOS: signed IPA/TestFlight/App Store build from macOS/Xcode.
- Chromebook: Android package on Play-enabled devices plus installable PWA fallback; Linux package is optional power-user support.
- PS5: HTTPS hosted Forge gateway; no fake native-console package.

## Acceptance standard

A platform is only promoted to **verified** after the strongest available real-device or emulator/browser acceptance is green and the build artifact for that platform actually exists. Documentation must distinguish `implemented`, `buildable`, `signed`, `store-ready`, and `verified-on-device`; these words are not interchangeable.
