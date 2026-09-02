#!/usr/bin/env node
"use strict";

const version = process.versions.node;
const major = Number(version.split(".", 1)[0]);

if (major !== 24) {
  console.error([
    `Author's Forge requires the validated Node.js 24 LTS runtime. Current runtime: ${version}.`,
    "Chromebook/Linux with nvm: run `nvm install 24 && nvm use 24`.",
    "Android/Termux: use the `nodejs-lts` package (and `npm`) rather than the current-release `nodejs` package.",
    "Forge intentionally refuses unvalidated or end-of-life Node major versions instead of presenting them as supported.",
  ].join("\n"));
  process.exit(1);
}
