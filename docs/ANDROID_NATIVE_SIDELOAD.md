# Author's Forge — Native Android Sideload

## Goal

This is the native Android packaging lane for people who want Author's Forge to launch from the Android app drawer like a normal application without running Node, localhost, Termux, or a separate launcher on the phone.

The APK is a hardened native shell for the hosted Forge runtime. The actual Project Brain, AI providers, durable project state, sandboxes, publishing services, and secrets stay on the trusted Forge server.

## What the APK does

- remembers the Forge HTTPS origin after first setup;
- launches the full responsive Forge UI in an Android WebView;
- accepts normal manuscript/art file uploads through Android's system file picker;
- saves same-origin Forge exports with Android Download Manager;
- sends Forge authentication cookies with downloads;
- blocks mixed content;
- disables WebView file/content URL access;
- accepts same-origin navigation inside the app and sends external web links to the system browser;
- rejects invalid TLS certificates;
- ships no JavaScript-to-native secret bridge;
- stores only the Forge origin, not a pasted one-time `?access=` bootstrap query.

Release builds accept HTTPS only. Debug builds can use HTTP on loopback/private LAN hosts for engineering verification.

## Build an installable APK

The GitHub workflow `.github/workflows/android-apk.yml` builds against:

- Android Gradle Plugin 8.13.2;
- Gradle 8.13;
- JDK 17;
- compile/target SDK 36;
- min SDK 26.

Every successful workflow produces a real installable debug APK artifact:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The debug APK uses Android's debug signing identity and is for direct owner/device testing. Because CI runners can create different debug keys, it is not the stable long-term update identity.

## Stable release signing

For an APK that can update the same installed app over time, keep one private release signing key and never rotate it casually.

The workflow recognizes these GitHub Actions secrets:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

When all four exist, CI also builds and verifies:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Do not commit the `.jks`/`.keystore`, its passwords, or its Base64 form to Git.

Optionally set the GitHub repository variable:

```text
FORGE_PUBLIC_URL=https://your-real-forge-host.example/
```

That makes the app open the production host immediately. Without it, the app asks for the HTTPS address once and remembers the origin.

## Install without Google Play

Android supports direct APK distribution. Host the signed release APK on your own HTTPS site/server or download it directly from the private GitHub Actions artifact while testing.

On Android 8+ the user grants the downloading source permission under **Install unknown apps**. This is Android's normal sideloading flow.

### 2026/2027 Android developer verification

Android developer verification is changing sideloading rules on certified devices. As of August 2026, Android provides:

- full distribution for verified developers;
- free limited distribution for students/hobbyists/personal use, up to 20 devices, without identity verification;
- an advanced sideload flow for unregistered developers/power users.

Initial store enforcement begins September 30, 2026 in Brazil, Indonesia, Singapore, and Thailand for participating stores. Direct sideloading is not subject to that initial September participating-store deadline, but Android plans broader global rollout in 2027.

For a personal Author's Forge install on a few devices, the limited-distribution path is a practical long-term fit. For public commercial distribution later, register `com.authorsforge.app` and its release signing certificate through the Android Developer Console/Play Console path appropriate at that time.

## Security model

Never compile these into `BuildConfig`, Java resources, JavaScript, or the APK:

- OpenAI/provider API keys;
- Daytona/E2B keys;
- GitHub App private keys;
- GitHub PATs;
- `FORGE_ACCESS_TOKEN`.

The APK may receive a one-time hosted bootstrap URL or show the normal hosted login. Authentication becomes an `HttpOnly` server cookie. The server owns provider credentials.

## Current device gates

Before calling a release APK production-ready, verify on the actual Android phone/tablet:

1. fresh install;
2. first server setup or default URL;
3. login/bootstrap cookie persistence;
4. project create/open/save/reload;
5. every Forge office route;
6. manuscript and image upload through the Android picker;
7. PDF/EPUB/artifact download into Downloads;
8. AI generation and visible provider failure behavior;
9. orientation changes and keyboard editing;
10. app relaunch with remembered server origin;
11. signed APK update over the prior installed release.

A desktop browser test is not a substitute for this physical-device gate.
