# K.I.N.G.S. Author's Forge — Native Android Package

## Status

K.I.N.G.S. Author's Forge has two Android delivery lanes:

1. **Installed PWA** — the hosted HTTPS Forge can be installed from Chromium as an app-style home-screen/launcher application.
2. **Tauri 2 native APK** — the repository's existing `native-shell/` and `src-tauri/` code are packaged into a real Android application. The native shell is a secure gateway to a real hosted Forge runtime; it does not embed or fake the Node.js backend on the phone.

The stable Android application identifier is **`com.authorsforge.app`**. Visible product branding may evolve, but changing this identifier would create a different Android application identity and must not happen casually after real APK distribution.

The native APK lane is intentionally separate from the old Termux/LAN development route. An end user does not need Node, npm, Git, Termux, or a repository checkout on the Android device.

## Security contract

The Android-specific Tauri configuration allows navigation to **HTTPS Forge runtimes only**. Plain HTTP and credential-bearing URLs are rejected by the shell. The hosted Forge runtime remains responsible for authentication, Project Brain, durable project files, AI providers, and server-side authorization.

The Android package does not claim offline AI/server capability. If the real Forge host is unavailable, hosted features are unavailable.

## Reproducible installable APK proof

`.github/workflows/android-native.yml` is the packaging gate. It:

- checks out the exact Git commit;
- installs the repository's validated Node runtime and locked npm dependencies;
- rebuilds Forge and validates the native shell JavaScript;
- installs Java 17 and the required Android SDK/NDK toolchain;
- installs all four Rust Android targets;
- installs a pinned Tauri CLI;
- regenerates Android launcher icons from Forge's real 512px launcher artwork;
- creates a fresh generated Android project rather than trusting stale generated files;
- builds a real Android debug APK;
- verifies every APK with Android `apksigner`;
- writes SHA-256 checksums; and
- uploads the APK and checksum file as a GitHub Actions artifact.

The debug APK is signed with Android's generated development/debug signing identity and is suitable for real sideload installation and package verification. It is **not** represented as the production Play Store signature.

## Production signing boundary

A production APK/AAB requires a private Android upload/release keystore. The keystore and passwords must never be committed to this repository. They belong in protected CI secrets or an equivalent secure signing service.

The production release lane is not complete until all of the following are true:

- the Android upload key exists and is securely stored;
- release Gradle signing is configured against CI-injected `keystore.properties`;
- both APK and AAB are built from a main-history release commit;
- `apksigner verify` succeeds on the release APK;
- the AAB contains the intended application identifier and version code;
- native release symbols are handled correctly and verified; and
- the resulting APK is installed and exercised on a physical Android phone and tablet.

Do not commit `.jks`, `.keystore`, `keystore.properties`, generated `src-tauri/gen/`, or native `target/` output.

## Local engineering build

A developer with the Tauri Android prerequisites installed can reproduce the package lane with:

```bash
npm ci
npm run build
cargo install tauri-cli --version 2.11.4 --locked
cargo tauri icon public/icon-512.png
cargo tauri android init --ci
cargo tauri android build --debug --apk --ci
```

Tauri's Android prerequisites include Java, Android SDK platform/build tools, an Android NDK, and Rust Android targets. The CI workflow is the canonical executable specification for the exact versions currently verified by this repository.
