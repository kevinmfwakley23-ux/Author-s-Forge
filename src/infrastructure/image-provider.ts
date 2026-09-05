import { buildProjectContext } from "../application/context-pipeline";
import type { ProjectBrainQuery } from "../application/project-brain";
import type { ProjectMemoryStore } from "../application/project-memory-store";

export type ImageGenerationSize = "1024x1024" | "1536x1024" | "1024x1536" | "2048x2048" | "2048x1152" | "auto";
export type ImageGenerationQuality = "low" | "medium" | "high" | "auto";
export interface ImageReferenceInput { readonly dataUri: string; readonly label?: string; }
export interface ImageGenerationRequest {
  readonly prompt: string;
  readonly size?: ImageGenerationSize;
  readonly quality?: ImageGenerationQuality;
  readonly background?: "opaque" | "transparent" | "auto";
  readonly referenceImages?: readonly ImageReferenceInput[];
}
export interface ImageGenerationResult {
  readonly provider: "openai";
  readonly model: string;
  readonly mimeType: "image/png";
  readonly bytesBase64: string;
  readonly dataUri: string;
  readonly requestId?: string;
  readonly size: ImageGenerationSize;
  readonly quality: ImageGenerationQuality;
}
export interface ProjectImageGenerationRequest extends ImageGenerationRequest {
  readonly memory: ProjectMemoryStore;
  readonly context: ProjectBrainQuery;
  readonly contextBudget?: number;
}
export interface ImageProviderRuntimeOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly fetchImpl?: typeof fetch;
  readonly generationEndpoint?: string;
  readonly editEndpoint?: string;
}

const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_REFERENCE_BYTES = 24 * 1024 * 1024;
const MAX_GENERATED_IMAGE_BYTES = 64 * 1024 * 1024;
const ALLOWED_REFERENCE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Call the real OpenAI image provider. With no references this uses the normal
 * generation endpoint. With approved reference images it uses the image-edit
 * endpoint so visual continuity is based on actual image bytes, not an opaque id.
 */
export async function generateImage(
  request: ImageGenerationRequest,
  options: ImageProviderRuntimeOptions = {},
): Promise<ImageGenerationResult> {
  const key = options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("No real image provider is configured. Configure OPENAI_API_KEY; Forge never fabricates generated images.");

  const model = options.model?.trim() || process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
  const size = request.size ?? "1024x1024";
  const quality = request.quality ?? "medium";
  const background = request.background ?? "opaque";
  const prompt = required(request.prompt, "Image prompt");
  const fetchImpl = options.fetchImpl ?? fetch;
  const references = normalizeReferenceImages(request.referenceImages ?? []);
  const endpoint = references.length
    ? (options.editEndpoint?.trim() || "https://api.openai.com/v1/images/edits")
    : (options.generationEndpoint?.trim() || "https://api.openai.com/v1/images/generations");
  const init: RequestInit = references.length
    ? referenceRequest({ key, model, prompt, size, quality, background, references })
    : generationRequest({ key, model, prompt, size, quality, background });

  const response = await fetchImpl(endpoint, init);
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error && typeof payload.error === "object"
      ? String((payload.error as Record<string, unknown>).message ?? "")
      : "";
    throw new Error(error || `OpenAI image generation failed (${response.status}).`);
  }

  const data = Array.isArray(payload.data) ? payload.data : [];
  const first = data[0] as Record<string, unknown> | undefined;
  const encoded = typeof first?.b64_json === "string" ? first.b64_json.trim() : "";
  if (!encoded) throw new Error("OpenAI image generation returned no image bytes.");
  const bytes = decodeCanonicalBase64(encoded, "OpenAI image generation output");
  if (bytes.byteLength > MAX_GENERATED_IMAGE_BYTES) {
    throw new Error(`OpenAI image generation output exceeds the ${MAX_GENERATED_IMAGE_BYTES / 1024 / 1024} MiB safety limit.`);
  }
  assertImageBytes("image/png", bytes, "OpenAI image generation output");
  const canonical = bytes.toString("base64");

  return Object.freeze({
    provider: "openai",
    model,
    mimeType: "image/png",
    bytesBase64: canonical,
    dataUri: `data:image/png;base64,${canonical}`,
    requestId: response.headers.get("x-request-id") ?? undefined,
    size,
    quality,
  });
}

export async function generateProjectImage(
  request: ProjectImageGenerationRequest,
  options: ImageProviderRuntimeOptions = {},
): Promise<ImageGenerationResult> {
  const context = buildProjectContext(request.memory, { query: request.context, budget: request.contextBudget });
  const referenceNote = request.referenceImages?.length
    ? `REFERENCE IMAGES\n${request.referenceImages.map((item, index) => `${index + 1}. ${item.label?.trim() || "Approved visual reference"}`).join("\n")}\nUse these images only as continuity/reference material. Preserve identity traits while following explicit current-stage changes in the request.`
    : "";
  const prompt = [
    "AUTHOR'S FORGE PROJECT CONTEXT",
    context.system,
    referenceNote,
    "IMAGE REQUEST",
    request.prompt,
    "Do not render production-critical card text, labels, logos, collector numbers, rules text, or UI into the image. Those remain editable composition elements in Forge.",
  ].filter(Boolean).join("\n\n");
  return generateImage({
    prompt,
    size: request.size,
    quality: request.quality,
    background: request.background,
    referenceImages: request.referenceImages,
  }, options);
}

function generationRequest(input: {
  key: string;
  model: string;
  prompt: string;
  size: ImageGenerationSize;
  quality: ImageGenerationQuality;
  background: "opaque" | "transparent" | "auto";
}): RequestInit {
  return {
    method: "POST",
    headers: { authorization: `Bearer ${input.key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      size: input.size,
      quality: input.quality,
      background: input.background,
      output_format: "png",
      n: 1,
    }),
  };
}

function referenceRequest(input: {
  key: string;
  model: string;
  prompt: string;
  size: ImageGenerationSize;
  quality: ImageGenerationQuality;
  background: "opaque" | "transparent" | "auto";
  references: readonly NormalizedReference[];
}): RequestInit {
  const form = new FormData();
  form.append("model", input.model);
  form.append("prompt", input.prompt);
  form.append("size", input.size);
  form.append("quality", input.quality);
  form.append("background", input.background);
  form.append("output_format", "png");
  form.append("n", "1");
  // gpt-image-2 processes image inputs at high fidelity automatically; do not send input_fidelity.
  input.references.forEach((reference, index) => form.append(
    "image[]",
    new Blob([concreteArrayBuffer(reference.bytes)], { type: reference.mimeType }),
    referenceFileName(index, reference.mimeType),
  ));
  return { method: "POST", headers: { authorization: `Bearer ${input.key}` }, body: form };
}

interface NormalizedReference {
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  readonly bytes: Uint8Array;
  readonly label?: string;
}

function normalizeReferenceImages(values: readonly ImageReferenceInput[]): NormalizedReference[] {
  if (values.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`Image generation supports at most ${MAX_REFERENCE_IMAGES} approved reference images per request.`);
  }
  let total = 0;
  return values.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`Image reference ${index + 1} is invalid.`);
    const parsed = parseImageDataUri(value.dataUri, index + 1);
    total += parsed.bytes.byteLength;
    if (total > MAX_TOTAL_REFERENCE_BYTES) {
      throw new Error(`Approved image references exceed the ${Math.floor(MAX_TOTAL_REFERENCE_BYTES / 1024 / 1024)} MiB total request limit.`);
    }
    return { ...parsed, ...(value.label?.trim() ? { label: value.label.trim() } : {}) };
  });
}

function parseImageDataUri(value: string, index: number): NormalizedReference {
  if (typeof value !== "string") throw new Error(`Image reference ${index} must be an inline data URI.`);
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) throw new Error(`Image reference ${index} must be a base64 PNG, JPEG, or WebP data URI. Forge will not fetch arbitrary reference URLs.`);
  const mimeType = match[1].toLowerCase() as NormalizedReference["mimeType"];
  if (!ALLOWED_REFERENCE_MIME_TYPES.has(mimeType)) throw new Error(`Image reference ${index} uses an unsupported image type.`);
  const raw = decodeCanonicalBase64(match[2], `Image reference ${index}`);
  if (raw.byteLength > MAX_REFERENCE_BYTES) {
    throw new Error(`Image reference ${index} exceeds the ${MAX_REFERENCE_BYTES / 1024 / 1024} MiB per-image limit.`);
  }
  assertImageBytes(mimeType, raw, `Image reference ${index}`);
  return { mimeType, bytes: Uint8Array.from(raw) };
}

function decodeCanonicalBase64(encoded: string, label: string): Buffer {
  if (!encoded || encoded.length % 4 === 1) throw new Error(`${label} contains invalid base64 data.`);
  const raw = Buffer.from(encoded, "base64");
  if (!raw.byteLength) throw new Error(`${label} is empty.`);
  const canonical = raw.toString("base64").replace(/=+$/, "");
  const provided = encoded.replace(/=+$/, "");
  if (canonical !== provided) throw new Error(`${label} contains invalid base64 data.`);
  return raw;
}

function assertImageBytes(mimeType: NormalizedReference["mimeType"], bytes: Uint8Array, label: string): void {
  const buffer = Buffer.from(bytes);
  if (mimeType === "image/png") {
    if (buffer.length < 33 || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new Error(`${label} is not a valid PNG byte stream.`);
    }
    const firstChunkLength = buffer.readUInt32BE(8);
    const firstChunkType = buffer.toString("ascii", 12, 16);
    if (firstChunkLength !== 13 || firstChunkType !== "IHDR") throw new Error(`${label} is not a valid PNG byte stream.`);
    let offset = 8;
    let sawIend = false;
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const typeStart = offset + 4;
      const dataStart = offset + 8;
      const next = dataStart + length + 4;
      if (next > buffer.length) throw new Error(`${label} contains a truncated PNG chunk.`);
      const type = buffer.toString("ascii", typeStart, typeStart + 4);
      if (type === "IEND") {
        if (length !== 0 || next !== buffer.length) throw new Error(`${label} contains an invalid PNG IEND chunk.`);
        sawIend = true;
        break;
      }
      offset = next;
    }
    if (!sawIend) throw new Error(`${label} is missing the PNG IEND chunk.`);
    return;
  }
  if (mimeType === "image/jpeg") {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) {
      throw new Error(`${label} is not a valid JPEG byte stream.`);
    }
    return;
  }
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`${label} is not a valid WebP byte stream.`);
  }
  const declaredLength = buffer.readUInt32LE(4) + 8;
  if (declaredLength > buffer.length) throw new Error(`${label} contains a truncated WebP byte stream.`);
}

function concreteArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
function referenceFileName(index: number, mimeType: string): string {
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] || "png";
  return `forge-reference-${index + 1}.${extension}`;
}
function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
