import { compressContextPayload } from "./context-compressor";
import type { ContextPayloadKind } from "./context-payload-classifier";
import { ContextEngineRegistry, type ContextCompressionEngine } from "./context-engine-registry";

const ALL_KINDS: readonly ContextPayloadKind[] = ["json", "code", "diff", "log", "text"];

const deterministicCompressionEngine: ContextCompressionEngine = {
  id: "deterministic-lossless-first",
  priority: 100,
  enabled: true,
  supportedKinds: ALL_KINDS,
  supports: ({ kind }) => ALL_KINDS.includes(kind),
  apply: ({ kind, text }) => compressContextPayload(kind, text),
};

export function createDefaultContextEngineRegistry(): ContextEngineRegistry {
  return new ContextEngineRegistry([deterministicCompressionEngine]);
}
