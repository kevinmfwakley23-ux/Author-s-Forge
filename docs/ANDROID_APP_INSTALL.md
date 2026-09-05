# Author's Forge — Android App-Style Installation

Author's Forge supports an Android-first installed experience without requiring a Google Play Store listing.

## What the user gets

After the hosted Forge is opened over HTTPS on an Android phone or tablet, Forge presents a round royal Forge launcher control. Installing Forge creates an Author's Forge launcher entry on the Android home screen/app launcher. From then on, the normal workflow is simply:

1. Tap the Forge icon.
2. Author's Forge opens in its own standalone app window.
3. Continue working against the same hosted Project Brain and durable project storage.

There is no requirement for Termux, Node, npm, Git, or a local repository checkout on the Android device.

## Installation behavior

Forge uses the standards-based web app installation boundary rather than pretending a web shortcut is a native binary. The manifest has a stable application ID, standalone display mode, Android-compatible 192px and 512px PNG launcher assets, a dedicated maskable/adaptive icon, and launcher shortcuts for major Forge workplaces.

When Chromium exposes its install prompt, tapping the round Forge control invokes that real browser-managed installation flow. If the prompt is not yet available, Forge shows the exact Chrome `Install app` / `Add to Home screen` fallback steps instead of claiming an installation occurred.

The installed app is intentionally not tied to a Play Store listing (`prefer_related_applications` is false).

## HTTPS requirement

A production PWA install requires a secure origin. The hosted Forge deployment is therefore the supported app-style Android installation route.

A phone can still reach a Chromebook-hosted LAN Forge in a normal browser using the LAN workflow, but plain HTTP on a private LAN must not be described as equivalent to the production installed PWA. Do not weaken transport security merely to force an install prompt.

## Phone and tablet verification

The normal mobile release gate includes a real Chromium acceptance script with Android user agents, touch input, and both phone and tablet viewports. It verifies that the round launcher is visible, at least 64×64 CSS pixels, circular, accessible, uses the Forge launcher artwork, and does not introduce horizontal overflow.

## Launcher artwork

The royal Forge launcher uses the black/charcoal, marble, and gold visual system. SVG source remains available for scalable browser surfaces, while deterministic opaque PNG fallbacks are generated during every Forge build for Android launcher compatibility. The maskable icon keeps important artwork inside Android's adaptive-icon safe area.

## Relationship to a sideloaded APK

This installed PWA is the primary Android access path because the live Forge backend, Project Brain, AI providers, project files, and updates remain on the trusted Forge host while the phone/tablet stays a lightweight secure client.

A separately signed sideloadable APK can be added later if there is a requirement for Android-native device integrations that the installed PWA cannot provide. Do not ship an unsigned or throwaway-signed APK and call it a production app.
