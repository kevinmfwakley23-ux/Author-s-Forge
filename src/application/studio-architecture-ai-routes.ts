import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { assertAiCollaborationCapability } from "../domain/ai-collaboration";
import { ProjectMemoryStore } from "./project-memory-store";

export type StudioArchitectureGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;
export type StudioArchitectureAiRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export interface StudioArchitecturePlanInput {
  readonly projectId: string;
  readonly idea: string;
  readonly kind?: string;
  readonly targetChapters?: number;
}

/**
 * Project-Brain-aware architecture planning boundary.
 *
 * The legacy Studio endpoint previously sent only the current text box to the
 * provider. This service binds the request to durable project memory/canon while
 * still returning a candidate plan that requires explicit author approval.
 */
export class StudioArchitectureAiService {
  constructor(
    private readonly store: Pick<FileProjectStore, "load">,
    private readonly generator: StudioArchitectureGenerator = generateProjectText,
  ) {}

  async generate(input: StudioArchitecturePlanInput) {
    const projectId = requiredId(input.projectId, "Project id");
    const idea = requiredText(input.idea, "Book idea", 16_000);
    const kind = optionalText(input.kind, "Book kind", 120) ?? "novel";
    const targetChapters = optionalPositiveInteger(input.targetChapters, "Target chapters");
    const project = await this.store.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found.`);
    assertAiCollaborationCapability(project.aiCollaborationPolicy, "draft", "AI architecture generation", "author-requested");

    const memory = new ProjectMemoryStore();
    for (const record of project.memories) memory.register(record);

    const result = await this.generator({
      memory,
      context: {
        projectId,
        taskMemoryClasses: [
          "author-memory",
          "project-memory",
          "story-canon",
          "character-memory",
          "relationship-memory",
          "timeline-memory",
          "location-memory",
          "style-memory",
          "research-memory",
          "decision-memory",
          "creative-note",
          "working-draft",
          "open-thread",
        ],
        includeWorkingState: true,
        limit: 256,
      },
      system: [
        "You are Author's Forge story architect.",
        "Build a detailed, practical book architecture; do not write final manuscript prose.",
        "Treat supplied Project Brain canon as binding unless the author explicitly asks to change it.",
        "Keep assumptions separate from author-supplied facts and never invent research as fact.",
        "Return useful chapter and scene structure plus unresolved questions and production risks.",
      ].join(" "),
      user: [
        `BOOK TYPE: ${kind}`,
        `TARGET CHAPTERS: ${targetChapters ?? "choose an appropriate number"}`,
        `AUTHOR IDEA:\n${idea}`,
        "---",
        "Return: premise, themes, audience, genre expectations, canon candidates, character candidates, locations, timeline considerations, chapter plan, scene plan, unresolved questions, and production risks.",
      ].join("\n"),
      task: "writing",
      requiresCreativeWriting: true,
      requiresInstructionFollowing: true,
      temperature: 0.4,
      maxOutputTokens: 8000,
    });

    return Object.freeze({
      ...result,
      candidate: true as const,
      authorApprovalRequired: true as const,
      contextBoundary: "project-brain" as const,
    });
  }
}

export function createStudioArchitectureAiRoutes(
  store: FileProjectStore,
  generator: StudioArchitectureGenerator = generateProjectText,
): StudioArchitectureAiRouteHandler {
  const service = new StudioArchitectureAiService(store, generator);
  return async (req, res, url, projectId) => {
    if (url.pathname !== `/api/projects/${projectId}/ai/architecture` || req.method !== "POST") return false;
    const input = await body(req);
    const result = await service.generate({
      projectId,
      idea: String(input.idea ?? ""),
      kind: input.kind === undefined ? undefined : String(input.kind),
      targetChapters: input.targetChapters === undefined ? undefined : Number(input.targetChapters),
    });
    json(res, 200, result);
    return true;
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 256 * 1024) throw new Error("Architecture request body exceeds 256 KiB limit.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Architecture JSON object body required.");
  return value as Record<string, unknown>;
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

function requiredId(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function requiredText(value: string, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}
function optionalText(value: string | undefined, label: string, max: number): string | undefined {
  return value === undefined || !value.trim() ? undefined : requiredText(value, label, max);
}
function optionalPositiveInteger(value: number | undefined, label: string): number | undefined {
  if (value === undefined || value === 0) return undefined;
  if (!Number.isInteger(value) || value < 1 || value > 500) throw new Error(`${label} must be an integer from 1 through 500.`);
  return value;
}
