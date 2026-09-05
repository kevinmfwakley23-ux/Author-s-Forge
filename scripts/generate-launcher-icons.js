#!/usr/bin/env node

/**
 * Emits shipping-size derivatives of the owner-locked K.I.N.G.S. Author's Forge
 * brand artwork. The encoded sources live in assets/brand so CI can reproduce
 * the exact PNG bytes without an image toolchain or native dependency.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SOURCES = Object.freeze({
  512: {
    path: "assets/brand/kings-authors-forge-official-512.base64",
    sha256: "9da15eee1d8e1138a096fcd12dbbf2e7ee19285c100097cc37c87e8c3dea3609",
  },
  192: {
    path: "assets/brand/kings-authors-forge-official-192.base64",
    sha256: "4a67e683664849261197c72c5470f4c04255a12b75cf02bad6c77fda11d2893f",
  },
});

function digest(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function decodeLockedSource(size) {
  const source = SOURCES[size];
  const encoded = fs.readFileSync(path.join(ROOT, source.path), "utf8").trim();
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${source.path} did not decode to a PNG`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== size || height !== size) {
    throw new Error(`${source.path} must be ${size}x${size}; got ${width}x${height}`);
  }
  const actual = digest(bytes);
  if (actual !== source.sha256) {
    throw new Error(`${source.path} integrity mismatch: expected ${source.sha256}, got ${actual}`);
  }
  return bytes;
}

function writeLockedPng(relativePath, bytes, expectedSize) {
  const output = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes);
  const written = fs.readFileSync(output);
  if (!written.equals(bytes)) throw new Error(`${relativePath} did not preserve the locked artwork bytes`);
  if (written.readUInt32BE(16) !== expectedSize || written.readUInt32BE(20) !== expectedSize) {
    throw new Error(`${relativePath} has an unexpected PNG size`);
  }
  console.log(`Emitted official Forge artwork: ${relativePath} (${expectedSize}x${expectedSize}, sha256 ${digest(written)})`);
}

const official512 = decodeLockedSource(512);
const official192 = decodeLockedSource(192);

for (const output of [
  "public/assets/brand/kings-authors-forge-official-512.png",
  "public/icon-512.png",
  "public/icon-maskable-512.png",
  "native-shell/kings-authors-forge-official-512.png",
]) {
  writeLockedPng(output, official512, 512);
}

for (const output of [
  "public/assets/brand/kings-authors-forge-official-192.png",
  "public/icon-192.png",
]) {
  writeLockedPng(output, official192, 192);
}
