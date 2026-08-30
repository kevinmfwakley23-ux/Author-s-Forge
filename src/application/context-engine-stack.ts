import type { ContextPayloadKind } from "./context-payload-classifier";
import { ContextEngineRegistry, type ContextCompressionEngine } from "./context-engine-registry";
import { compressContextPayload } from "./context-compressor";

const STRUCTURED_KINDS: readonly ContextPayloadKind[] = ["json"];
const ALL_KINDS: readonly ContextPayloadKind[] = ["json", "code", "diff", "log", "text"];

const deterministicEngine: ContextCompressionEngine = {
  id: "deterministic-lossless-first",
  priority: 100,
  enabled: true,
  supportedKinds: ALL_KINDS,
  supports: ({ kind }) => ALL_KINDS.includes(kind),
  apply: ({ kind, text }) => compressContextPayload(kind, text),
};

const structuredDataCompactionEngine: ContextCompressionEngine = {
  id: "structured-data-compaction",
  priority: 90,
  enabled: true,
  supportedKinds: STRUCTURED_KINDS,
  supports: ({ kind, text }) => kind === "json" && text.trim().length > 2,
  apply: ({ text }) => {
    try {
      const parsed: unknown = JSON.parse(text);
      const compact = JSON.stringify(parsed);
      if (compact.length >= text.length) return { text, changed: false, strategy: ["structured-data-no-gain"] };
      return { text: compact, changed: true, strategy: ["lossless-json-compaction"] };
    } catch {
      return { text, changed: false, strategy: ["structured-data-invalid-preserved"] };
    }
  },
};

export function createProductionContextEngineRegistry(): ContextEngineRegistry {
  return new ContextEngineRegistry([deterministicEngine, structuredDataCompactionEngine]);
}

export interface ContextEngineCapability {
  readonly id: string;
  readonly production: boolean;
  readonly safety: "lossless" | "derived" | "optional-model" | "experimental";
  readonly description: string;
}

export const CONTEXT_ENGINE_CAPABILITIES: readonly ContextEngineCapability[] = [
  { id: "session-dedup", production: false, safety: "derived", description: "Content-address repeated session context only when an explicit retrieval/cache boundary can preserve meaning." },
  { id: "ccr-retrieval", production: false, safety: "derived", description: "Archive large derived blocks behind internal retrieval handles; never expose handles as source text." },
  { id: "lite", production: true, safety: "lossless", description: "Normalize whitespace and remove safe duplicate boilerplate." },
  { id: "rtk-tool-output", production: false, safety: "derived", description: "Compress tool results using command-aware, bounded diagnostic extraction." },
  { id: "lossless-structured-output", production: true, safety: "lossless", description: "Preserve machine-readable structure while removing redundant representation." },
  { id: "structured-data-compaction", production: true, safety: "lossless", description: "Compact JSON without changing its parsed value." },
  { id: "relevance-extraction", production: false, safety: "derived", description: "Query-aware extractive reduction for temporary research context." },
  { id: "conservative-prose", production: false, safety: "derived", description: "Temporary non-canonical prose reduction only; never manuscript mutation." },
  { id: "progressive-aging", production: false, safety: "derived", description: "Age low-value historical context only behind recoverable source storage." },
  { id: "llmlingua-2-onnx", production: false, safety: "optional-model", description: "Optional semantic compression after fidelity, footprint, latency, and savings benchmarks." },
  { id: "stronger-heuristic-slm", production: false, safety: "optional-model", description: "Optional stronger compression tier activated only when measured economics justify it." },
  { id: "context-as-image", production: false, safety: "experimental", description: "Provider-specific experiment isolated from the production context path." },
];
