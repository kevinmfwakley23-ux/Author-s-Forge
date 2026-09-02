import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { analyzeRhymeStory, RHYME_CRAFT_MODES, type RhymeCraftMode } from "../domain/rhyme-storytelling";
import { createMemoryRecord } from "../domain/memory";
import { withProjectMemories, type ProjectState } from "../domain/project";
import { ProjectMemoryStore } from "./project-memory-store";

type RhymeGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;
export type StudioRhymeRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioRhymeRoutes(
  store: Pick<FileProjectStore, "load" | "save">,
  generator: RhymeGenerator = generateProjectText,
): StudioRhymeRouteHandler {
  return async (req, res, url, projectId) => {
    if (url.pathname === `/api/projects/${projectId}/rhyme/analyze` && req.method === "POST") {
      await requireProject(store, projectId);
      const input = await body(req);
      const text = requiredText(input.text, "Rhyme story text");
      const mode = rhymeMode(input.mode);
      json(res, 200, analyzeRhymeStory(text, mode));
      return true;
    }

    if (url.pathname === `/api/projects/${projectId}/rhyme/revise` && req.method === "POST") {
      const project = await requireProject(store, projectId);
      const input = await body(req);
      const text = requiredText(input.text, "Rhyme story text");
      if (text.length > 80_000) throw new Error("Rhyme AI revision input exceeds 80,000 characters.");
      const mode = rhymeMode(input.mode);
      const instruction = String(input.instruction ?? "Improve rhyme, cadence and read-aloud flow while preserving story meaning and author voice.").trim();
      if (!instruction) throw new Error("Rhyme revision instruction is required.");
      const analysis = analyzeRhymeStory(text, mode);
      const memory = new ProjectMemoryStore();
      memory.restore(project.memories);
      const result = await generator({
        memory,
        context: {
          projectId,
          taskMemoryClasses: ["author-memory", "style-memory", "story-canon", "character-memory", "decision-memory"],
          relevanceTags: ["author-voice", "rhyme", "storytelling"],
          queryTerms: ["rhyme", "cadence", "voice", "story"],
          includeWorkingState: true,
          limit: 36,
        },
        system: [
          "You are the Rhyme & Verse Storytelling editor inside Author's Forge.",
          "Preserve author intent, canon, character identity and emotional meaning.",
          "Improve rhyme only when it helps the story. Never distort grammar, meaning or characterization merely to force a rhyme.",
          "Use descriptive craft goals rather than imitating any living or named writer's exact style.",
          "Return a complete candidate revision followed by a concise craft note. This is a proposal, never canon until the author chooses it.",
        ].join(" "),
        user: [
          `CRAFT MODE: ${mode}`,
          `AUTHOR INSTRUCTION: ${instruction}`,
          `CURRENT ANALYSIS: ${JSON.stringify({ meanSyllables: analysis.meanSyllables, syllableRange: analysis.syllableRange, cadenceConsistency: analysis.cadenceConsistency, endRhymeCoverage: analysis.endRhymeCoverage, coupletRhymeCoverage: analysis.coupletRhymeCoverage, scheme: analysis.detectedScheme, warnings: analysis.warnings })}`,
          "TEXT TO REVISE:",
          text,
        ].join("\n\n"),
        task: "voice-preservation",
        requiresCreativeWriting: true,
        requiresInstructionFollowing: true,
        temperature: 0.55,
        maxOutputTokens: 8000,
      });
      const now = new Date().toISOString();
      const proposal = createMemoryRecord({
        id: `rhyme-proposal-${randomUUID()}`,
        projectId,
        class: "generated-alternative",
        authority: "proposed",
        summary: `Rhyme & Verse candidate (${mode})`,
        content: result.text,
        provenance: [{ kind: "system", reference: `${result.provider}/${result.model}`, recordedAt: now }],
        relevanceTags: ["rhyme", "verse", "storytelling", mode, "author-review-required"],
        now,
      });
      await store.save(withProjectMemories(project, [...project.memories, proposal], now));
      json(res, 200, {
        candidate: result.text,
        proposalMemoryId: proposal.id,
        provider: result.provider,
        model: result.model,
        analysis,
        authorReviewRequired: true,
      });
      return true;
    }

    return false;
  };
}

function rhymeMode(value: unknown): RhymeCraftMode {
  const mode = String(value ?? "gentle-musical") as RhymeCraftMode;
  if (!RHYME_CRAFT_MODES.includes(mode)) throw new Error("Invalid rhyme craft mode.");
  return mode;
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
async function requireProject(store: Pick<FileProjectStore, "load">, projectId: string): Promise<ProjectState> {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
  return project;
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 2 * 1024 * 1024) throw new Error("Rhyme request body exceeds 2 MiB limit.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Rhyme JSON object body required.");
  return value as Record<string, unknown>;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
