#!/usr/bin/env node

/**
 * Build the K.I.N.G.S. Author's Forge install/runtime logo assets from the
 * owner-approved official artwork derivative checked into assets/brand.
 *
 * The checked source is hash-pinned. No network access, substitute artwork,
 * procedural logo, or silent fallback is allowed: if the official source is
 * missing or altered, the build fails.
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");

const SOURCE = path.join(process.cwd(), "assets", "brand", "kings-authors-forge-official-192.base64");
const SOURCE_SHA256 = "51e63036fa02378911ed63f85a2a3ff2a78992704a3aa928292efb1012cbd7d3";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(bytes) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("Official Forge logo source is not a PNG.");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new Error(`Official Forge logo PNG has a truncated ${type} chunk.`);
    const data = bytes.subarray(start, end);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      const compression = data[10];
      const filterMethod = data[11];
      interlace = data[12];
      if (compression !== 0 || filterMethod !== 0) throw new Error("Official Forge logo PNG uses unsupported compression/filter metadata.");
    } else if (type === "PLTE") {
      palette = Buffer.from(data);
    } else if (type === "tRNS") {
      transparency = Buffer.from(data);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset = end + 4;
  }

  if (width !== 192 || height !== 192) throw new Error(`Official Forge runtime source must be 192x192; got ${width}x${height}.`);
  if (interlace !== 0) throw new Error("Official Forge logo PNG must be non-interlaced for deterministic build decoding.");
  if (!idat.length) throw new Error("Official Forge logo PNG contains no image data.");

  const channelsByType = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);
  const channels = channelsByType.get(colorType);
  if (!channels) throw new Error(`Official Forge logo PNG color type ${colorType} is unsupported.`);
  if (colorType === 3) {
    if (bitDepth !== 4 && bitDepth !== 8) throw new Error(`Indexed official Forge logo bit depth ${bitDepth} is unsupported; expected 4 or 8.`);
    if (!palette || palette.length < 3) throw new Error("Indexed official Forge logo is missing its palette.");
  } else if (bitDepth !== 8) {
    throw new Error(`Official Forge logo PNG bit depth ${bitDepth} is unsupported; expected 8.`);
  }

  const bitsPerPixel = channels * bitDepth;
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const filterBytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const expected = (rowBytes + 1) * height;
  if (packed.length !== expected) throw new Error(`Official Forge logo PNG decoded length mismatch: ${packed.length} != ${expected}.`);

  const raw = Buffer.alloc(rowBytes * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = packed[sourceOffset++];
    const rowOffset = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const value = packed[sourceOffset++];
      const left = x >= filterBytesPerPixel ? raw[rowOffset + x - filterBytesPerPixel] : 0;
      const up = y > 0 ? raw[rowOffset - rowBytes + x] : 0;
      const upperLeft = y > 0 && x >= filterBytesPerPixel ? raw[rowOffset - rowBytes + x - filterBytesPerPixel] : 0;
      let decoded;
      if (filter === 0) decoded = value;
      else if (filter === 1) decoded = (value + left) & 255;
      else if (filter === 2) decoded = (value + up) & 255;
      else if (filter === 3) decoded = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) decoded = (value + paeth(left, up, upperLeft)) & 255;
      else throw new Error(`Official Forge logo PNG uses unsupported row filter ${filter}.`);
      raw[rowOffset + x] = decoded;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const dst = pixel * 4;
      if (colorType === 3) {
        const rowOffset = y * rowBytes;
        let index;
        if (bitDepth === 8) index = raw[rowOffset + x];
        else {
          const packedByte = raw[rowOffset + (x >> 1)];
          index = (x & 1) === 0 ? packedByte >> 4 : packedByte & 0x0f;
        }
        const paletteOffset = index * 3;
        if (paletteOffset + 2 >= palette.length) throw new Error(`Official Forge logo palette index ${index} is invalid.`);
        rgba[dst] = palette[paletteOffset];
        rgba[dst + 1] = palette[paletteOffset + 1];
        rgba[dst + 2] = palette[paletteOffset + 2];
        rgba[dst + 3] = transparency && index < transparency.length ? transparency[index] : 255;
        continue;
      }

      const src = y * rowBytes + x * channels;
      if (colorType === 6) {
        raw.copy(rgba, dst, src, src + 4);
      } else if (colorType === 2) {
        rgba[dst] = raw[src];
        rgba[dst + 1] = raw[src + 1];
        rgba[dst + 2] = raw[src + 2];
        rgba[dst + 3] = 255;
      } else if (colorType === 0) {
        rgba[dst] = raw[src];
        rgba[dst + 1] = raw[src];
        rgba[dst + 2] = raw[src];
        rgba[dst + 3] = 255;
      } else if (colorType === 4) {
        rgba[dst] = raw[src];
        rgba[dst + 1] = raw[src];
        rgba[dst + 2] = raw[src];
        rgba[dst + 3] = raw[src + 1];
      }
    }
  }
  return { width, height, rgba };
}

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
  for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    scanlines[rowStart] = 0;
    rgba.copy(scanlines, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function resizeRgba(source, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) return Buffer.from(source);
  const output = Buffer.alloc(targetWidth * targetHeight * 4);
  const scaleX = sourceWidth / targetWidth;
  const scaleY = sourceHeight / targetHeight;
  for (let y = 0; y < targetHeight; y += 1) {
    const sy = Math.max(0, Math.min(sourceHeight - 1, (y + 0.5) * scaleY - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(sourceHeight - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < targetWidth; x += 1) {
      const sx = Math.max(0, Math.min(sourceWidth - 1, (x + 0.5) * scaleX - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(sourceWidth - 1, x0 + 1);
      const fx = sx - x0;
      const dst = (y * targetWidth + x) * 4;
      const p00 = (y0 * sourceWidth + x0) * 4;
      const p10 = (y0 * sourceWidth + x1) * 4;
      const p01 = (y1 * sourceWidth + x0) * 4;
      const p11 = (y1 * sourceWidth + x1) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const top = source[p00 + channel] * (1 - fx) + source[p10 + channel] * fx;
        const bottom = source[p01 + channel] * (1 - fx) + source[p11 + channel] * fx;
        output[dst + channel] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return output;
}

function writePng(relativePath, width, height, rgba) {
  const output = path.join(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const bytes = encodePng(width, height, rgba);
  fs.writeFileSync(output, bytes);
  const written = fs.readFileSync(output);
  if (!written.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${relativePath} is not a valid PNG.`);
  if (written.readUInt32BE(16) !== width || written.readUInt32BE(20) !== height) throw new Error(`${relativePath} has incorrect PNG dimensions.`);
  console.log(`[forge-logo] ${relativePath} ${width}x${height} ${written.length} bytes`);
}

console.log("[forge-logo] Verify official K.I.N.G.S. Author's Forge artwork source");
const encoded = fs.readFileSync(SOURCE, "utf8").replace(/\s+/g, "");
if (!encoded) throw new Error("Official Forge logo source is empty.");
const sourceBytes = Buffer.from(encoded, "base64");
const digest = sha256(sourceBytes);
if (digest !== SOURCE_SHA256) throw new Error(`Official Forge logo source hash mismatch: ${digest}`);
const official = decodePng(sourceBytes);
const official512 = resizeRgba(official.rgba, official.width, official.height, 512, 512);

writePng("public/assets/brand/kings-authors-forge-official-192.png", 192, 192, official.rgba);
writePng("public/assets/brand/kings-authors-forge-official-512.png", 512, 512, official512);
writePng("native-shell/assets/brand/kings-authors-forge-official-512.png", 512, 512, official512);
writePng("public/icon-192.png", 192, 192, official.rgba);
writePng("public/icon-512.png", 512, 512, official512);
writePng("public/icon-maskable-512.png", 512, 512, official512);
console.log(`[forge-logo] Locked source SHA-256 ${SOURCE_SHA256}`);
