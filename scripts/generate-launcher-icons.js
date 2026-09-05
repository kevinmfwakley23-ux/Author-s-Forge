#!/usr/bin/env node

/**
 * Deterministically generates opaque PNG launcher fallbacks for Android/PWA installs.
 * No image toolchain or native dependency is required; Node's zlib is sufficient.
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const COLORS = Object.freeze({
  background: [32, 37, 43, 255],
  inner: [22, 26, 31, 255],
  gold: [212, 173, 99, 255],
  marble: [244, 241, 235, 255],
});

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function paint(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const outerRadius = size * 0.395;
  const innerRadius = size * 0.355;
  const center = size / 2;
  const crown = [
    [0.297, 0.334], [0.332, 0.246], [0.398, 0.293], [0.5, 0.211],
    [0.602, 0.293], [0.668, 0.246], [0.703, 0.334],
  ].map(([x, y]) => [x * size, y * size]);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      let color = COLORS.background;
      if (distance <= outerRadius) color = COLORS.gold;
      if (distance <= innerRadius) color = COLORS.inner;

      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const inF =
        (nx >= 0.314 && nx <= 0.433 && ny >= 0.293 && ny <= 0.805) ||
        (nx >= 0.314 && nx <= 0.748 && ny >= 0.293 && ny <= 0.400) ||
        (nx >= 0.314 && nx <= 0.691 && ny >= 0.490 && ny <= 0.596);
      if (inF) color = COLORS.gold;
      if (pointInPolygon(x + 0.5, y + 0.5, crown)) color = COLORS.marble;

      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }
  return pixels;
}

function encodePng(size) {
  const pixels = paint(size);
  const stride = size * 4;
  const scanlines = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (stride + 1);
    scanlines[rowOffset] = 0;
    pixels.copy(scanlines, rowOffset + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function writeIcon(filename, size) {
  const output = path.join(process.cwd(), "public", filename);
  fs.writeFileSync(output, encodePng(size));
  const bytes = fs.readFileSync(output);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error(`${filename} was not written as a valid PNG`);
  }
  console.log(`Generated ${filename} (${size}x${size}, ${bytes.length} bytes)`);
}

writeIcon("icon-192.png", 192);
writeIcon("icon-512.png", 512);
writeIcon("icon-maskable-512.png", 512);
