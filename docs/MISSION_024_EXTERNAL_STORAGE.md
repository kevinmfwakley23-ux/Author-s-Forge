# Mission 024 — External Storage

Forge defines a provider-neutral storage contract for local files and downloadable packages plus future Google Drive, OneDrive, Dropbox, and technically available iCloud adapters.

External storage is explicitly a persistence destination, not the creative source of truth. Every project storage binding records `sourceOfTruth: forge-project`. Providers implement put/get/delete/list behind an explicit interface, allowing real integrations to be added without moving authority outside Forge.

The included in-memory/download provider is a real executable provider for deterministic local acceptance coverage; it is not presented as a production cloud integration.
