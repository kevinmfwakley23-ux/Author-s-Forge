import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import jpeg from "jpeg-js";
import type { IllustrationAsset } from "../domain/illustration-asset-library";
import type { ProductionIllustration } from "../domain/manuscript-production";

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;

export function productionIllustrationFromAsset(asset: IllustrationAsset): ProductionIllustration {
  if (asset.approvalStatus !== "approved") throw new Error(`Illustration asset "${asset.id}" is not author-approved.`);
  if (asset.generationSettings.purpose !== "illustration") throw new Error(`Illustration asset "${asset.id}" is not an interior illustration.`);
  const dpi = Number(asset.generationSettings.dpi);
  if (!Number.isFinite(dpi) || dpi <= 0) throw new Error(`Illustration asset "${asset.id}" has no valid production DPI.`);
  const source = decodeEmbeddedImage(asset.assetUri, asset.id);
  if (source.bytes.length > MAX_SOURCE_BYTES) throw new Error(`Illustration asset "${asset.id}" exceeds the 50 MiB publication-source limit.`);
  const pixels = source.width * source.height;
  if (!Number.isSafeInteger(pixels) || pixels < 1 || pixels > MAX_PIXELS) throw new Error(`Illustration asset "${asset.id}" exceeds the safe publication raster budget.`);
  const rgba = source.kind === "jpeg" ? decodeJpegRgba(source.bytes, asset.id) : source.rgba;
  flattenAlphaOnWhite(rgba);
  const encoded = jpeg.encode({ data: rgba, width: source.width, height: source.height }, 92).data;
  const bytes = Buffer.from(encoded);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new Error(`Illustration asset "${asset.id}" could not be normalized to a valid publication JPEG.`);
  }
  return Object.freeze({
    id: asset.id,
    sourceAssetId: asset.id,
    altText: publicationAltText(asset),
    mimeType: "image/jpeg" as const,
    contentBase64: bytes.toString("base64"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sourceAssetSha256: createHash("sha256").update(source.bytes).digest("hex"),
    widthPixels: source.width,
    heightPixels: source.height,
    dpi,
  });
}

type DecodedSource =
  | { readonly kind: "jpeg"; readonly bytes: Buffer; readonly width: number; readonly height: number }
  | { readonly kind: "png"; readonly bytes: Buffer; readonly width: number; readonly height: number; readonly rgba: Buffer };

function decodeEmbeddedImage(uri: string, assetId: string): DecodedSource {
  const match = uri.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) throw new Error(`Illustration asset "${assetId}" must contain durable embedded PNG/JPEG bytes before publication.`);
  const encoded = match[2].replace(/\s+/g, "");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.toString("base64") !== encoded) throw new Error(`Illustration asset "${assetId}" contains invalid base64 image data.`);
  if (match[1].toLowerCase() === "png") {
    const decoded = decodePng(bytes, assetId);
    return Object.freeze({ kind: "png" as const, bytes, ...decoded });
  }
  const dimensions = jpegDimensions(bytes, assetId);
  return Object.freeze({ kind: "jpeg" as const, bytes, ...dimensions });
}

function decodeJpegRgba(bytes: Buffer, assetId: string): Buffer {
  let decoded: { width: number; height: number; data: Uint8Array };
  try {
    decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  } catch (error) {
    throw new Error(`Illustration asset "${assetId}" JPEG could not be decoded: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!decoded.width || !decoded.height || decoded.data.length !== decoded.width * decoded.height * 4) throw new Error(`Illustration asset "${assetId}" JPEG decoded to invalid raster dimensions.`);
  return Buffer.from(decoded.data);
}

function jpegDimensions(bytes: Buffer, assetId: string): { readonly width: number; readonly height: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Illustration asset "${assetId}" is not a valid JPEG.`);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (width > 0 && height > 0) return Object.freeze({ width, height });
      break;
    }
    offset += length;
  }
  throw new Error(`Illustration asset "${assetId}" JPEG dimensions could not be read.`);
}

function decodePng(bytes: Buffer, assetId: string): { readonly width: number; readonly height: number; readonly rgba: Buffer } {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) throw new Error(`Illustration asset "${assetId}" is not a valid PNG.`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (offset + 12 + length > bytes.length) throw new Error(`Illustration asset "${assetId}" PNG chunk length is invalid.`);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      if (length !== 13) throw new Error(`Illustration asset "${assetId}" PNG header is invalid.`);
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === "IDAT") idat.push(Buffer.from(chunk));
    else if (type === "IEND") break;
  }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0 || !idat.length) {
    throw new Error(`Illustration asset "${assetId}" PNG must be non-interlaced 8-bit RGB/RGBA for publication.`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  let raw: Buffer;
  try { raw = inflateSync(Buffer.concat(idat)); }
  catch (error) { throw new Error(`Illustration asset "${assetId}" PNG data could not be decompressed: ${error instanceof Error ? error.message : String(error)}`); }
  if (raw.length !== (rowBytes + 1) * height) throw new Error(`Illustration asset "${assetId}" PNG raster length is invalid.`);
  const decoded = Buffer.alloc(rowBytes * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[sourceOffset++];
    const row = decoded.subarray(y * rowBytes, (y + 1) * rowBytes);
    const previous = y > 0 ? decoded.subarray((y - 1) * rowBytes, y * rowBytes) : undefined;
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[sourceOffset++];
      const a = x >= channels ? row[x - channels] : 0;
      const b = previous ? previous[x] : 0;
      const c = previous && x >= channels ? previous[x - channels] : 0;
      row[x] = (value + pngPredictor(filter, a, b, c)) & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  let sourcePixel = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const target = pixel * 4;
    rgba[target] = decoded[sourcePixel++];
    rgba[target + 1] = decoded[sourcePixel++];
    rgba[target + 2] = decoded[sourcePixel++];
    rgba[target + 3] = colorType === 6 ? decoded[sourcePixel++] : 255;
  }
  return Object.freeze({ width, height, rgba });
}

function pngPredictor(filter: number, a: number, b: number, c: number): number {
  if (filter === 0) return 0;
  if (filter === 1) return a;
  if (filter === 2) return b;
  if (filter === 3) return Math.floor((a + b) / 2);
  if (filter === 4) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  }
  throw new Error(`Unsupported PNG filter ${filter}.`);
}

function flattenAlphaOnWhite(rgba: Buffer): void {
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const alpha = rgba[offset + 3];
    if (alpha === 255) continue;
    const opacity = alpha / 255;
    rgba[offset] = Math.round(rgba[offset] * opacity + 255 * (1 - opacity));
    rgba[offset + 1] = Math.round(rgba[offset + 1] * opacity + 255 * (1 - opacity));
    rgba[offset + 2] = Math.round(rgba[offset + 2] * opacity + 255 * (1 - opacity));
    rgba[offset + 3] = 255;
  }
}

function publicationAltText(asset: IllustrationAsset): string {
  const text = asset.prompt.replace(/\s+/g, " ").trim();
  return text.length <= 500 ? text : `${text.slice(0, 497)}...`;
}
