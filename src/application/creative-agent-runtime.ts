import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveAiCollaborationPolicy } from "../domain/ai-collaboration";
import type { ProjectState } from "../domain/project";
import {
  createStudioWorkspace,
  validateStudioWorkspace,
  type WorkspaceBook,
  type WorkspaceChapter,
  type WorkspaceScene,
} from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { aiMissionRoutingGenerationFields, type AiMissionRoutingPreference } from "./ai-mission-routing";
import { ProjectMemoryStore } from "./project-memory-store";
import {
  creativeToolById,
  listCreativeTools,
  resolveCreativeToolPath,
  type CreativeToolDescriptor,
} from "./creative-tool-registry";

export const CREATIVE_AGENT_RUN_FORMAT_VERSION = 1 as const;
export const CREATIVE_AGENT_DEFAULT_MAX_STEPS = 6 as const;
export const CREATIVE_AGENT_HARD_MAX_STEPS = 12 as const;

export type CreativeAgentRunStatus = "running" | "completed" | "failed" | "max-steps";

export interface CreativeAgentRunInput {
  readonly goal: string;
  readonly bookId?: string;
  readonly chapterId?: string;
  readonly sceneId?: string;
  readonly author?: string;
  readonly approvedToolIds?: readonly string[];
  readonly maxSteps?: number;
  readonly routingPreference?: AiMissionRoutingPreference;
  readonly runId?: string;
}

export interface CreativeAgentRunTarget {
  readonly bookId: string | null;
  readonly chapterId: string | null;
  readonly sceneId: string | null;
}

export interface CreativeAgentDecisionEvidence {
  readonly sequence: number;
  readonly action: "tool" | "finish";
  readonly toolId?: string;
  readonly reason?: string;
  readonly summary?: string;
  readonly provider?: AiGenerationResult["provider"];
  readonly model?: string;
  readonly requestId?: string;
  readonly decidedAt: string;
}

export interface CreativeAgentObservation {
  readonly sequence: number;
  readonly toolId: string;
  readonly title: string;
  readonly reason: string;
  readonly request: Readonly<Record<string, unknown>>;
  readonly response: unknown;
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface CreativeAgentRunRecord {
  readonly formatVersion: typeof CREATIVE_AGENT_RUN_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly goal: string;
  readonly target: CreativeAgentRunTarget;
  readonly approvedToolIds: readonly string[];
  readonly maxSteps: number;
  readonly status: CreativeAgentRunStatus;
  readonly decisions: readonly CreativeAgentDecisionEvidence[];
  readonly observations: readonly CreativeAgentObservation[];
  readonly finalSummary?: string;
  readonly error?: string;
  readonly startedAt: string;
  readonly updatedAt: string;
}

export type CreativeAgentDecision =
  | { readonly action: "tool"; readonly toolId: string; readonly reason: string }
  | { readonly action: "finish"; readonly summary: string };

export interface CreativeAgentDecisionResult {
  readonly decision: CreativeAgentDecision;
  readonly provider?: AiGenerationResult["provider"];
  readonly model?: string;
  readonly requestId?: string;
}

export interface CreativeAgentDecisionContext {
  readonly project: ProjectState;
  readonly goal: string;
  readonly target: CreativeAgentRunTarget;
  readonly eligibleTools: readonly CreativeToolDescriptor[];
  readonly observations: readonly CreativeAgentObservation[];
  readonly routingPreference?: AiMissionRoutingPreference;
}

export type CreativeAgentDecisionGenerator = (context: CreativeAgentDecisionContext) => Promise<CreativeAgentDecisionResult>;

export interface CreativeAgentToolExecution {
  readonly projectId: string;
  readonly tool: CreativeToolDescriptor;
  readonly body: Readonly<Record<string, unknown>>;
}

export type CreativeAgentToolExecutor = (execution: CreativeAgentToolExecution) => Promise<unknown>;

export interface CreativeAgentRuntimeOptions {
  readonly runStore?: CreativeAgentRunStore;
  readonly decide?: CreativeAgentDecisionGenerator;
  readonly execute?: CreativeAgentToolExecutor;
  readonly now?: () => string;
}

interface ResolvedTarget {
  readonly public: CreativeAgentRunTarget;
  readonly book?: WorkspaceBook;
  readonly chapter?: WorkspaceChapter;
  readonly scene?: WorkspaceScene;
}

export class CreativeAgentRunStore {
  public constructor(private readonly root = join(process.env.FORGE_DATA_DIR?.trim() || join(process.cwd(), ".forge-data"), "agent-runs")) {}

  public async save(record: CreativeAgentRunRecord): Promise<void> {
    const validated = validateRunRecord(record);
    const path = this.path(validated.projectId, validated.id);
    await mkdir(dirname(path), { recursive: true });
    await writeAtomically(path, `${JSON.stringify(validated, null, 2)}\n`);
  }

  public async load(projectId: string, runId: string): Promise<CreativeAgentRunRecord | undefined> {
    const path = this.path(identifier(projectId, "Project id"), identifier(runId, "Agent run id"));
    try {
      return validateRunRecord(JSON.parse(await readFile(path, "utf8")) as unknown);
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  private path(projectId: string, runId: string): string {
    return join(this.root, identifier(projectId, "Project id"), `${identifier(runId, "Agent run id")}.json`);
  }
}

export class CreativeAgentRuntime {
  private readonly runs: CreativeAgentRunStore;
  private readonly decide: CreativeAgentDecisionGenerator;
  private readonly execute: CreativeAgentToolExecutor;
  private readonly now: () => string;

  public constructor(private readonly projects: FileProjectStore, options: CreativeAgentRuntimeOptions = {}) {
    this.runs = options.runStore ?? new CreativeAgentRunStore();
    this.decide = options.decide ?? defaultDecisionGenerator;
    this.execute = options.execute ?? createLoopbackCreativeAgentExecutor();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  public async get(projectId: string, runId: string): Promise<CreativeAgentRunRecord> {
    const project = await this.requireProject(projectId);
    const record = await this.runs.load(project.metadata.id, runId);
    if (!record) throw new Error(`Creative Agent run "${runId}" was not found for project "${project.metadata.id}".`);
    return record;
  }

  public async run(projectId: string, input: CreativeAgentRunInput): Promise<CreativeAgentRunRecord> {
    const project = await this.requireProject(projectId);
    const goal = requiredText(input.goal, "Creative Agent goal", 10_000);
    const maxSteps = positiveInteger(input.maxSteps ?? CREATIVE_AGENT_DEFAULT_MAX_STEPS, "Creative Agent maxSteps", CREATIVE_AGENT_HARD_MAX_STEPS);
    const approvedToolIds = normalizeApprovals(input.approvedToolIds);
    const targetInput = {
      ...(input.bookId ? { bookId: identifier(input.bookId, "Book id") } : {}),
      ...(input.chapterId ? { chapterId: identifier(input.chapterId, "Chapter id") } : {}),
      ...(input.sceneId ? { sceneId: identifier(input.sceneId, "Scene id") } : {}),
    };
    const resolved = resolveTarget(project, targetInput);
    const runId = input.runId ? identifier(input.runId, "Agent run id") : `run-${randomUUID()}`;
    const startedAt = this.now();
    let record: CreativeAgentRunRecord = Object.freeze({
      formatVersion: CREATIVE_AGENT_RUN_FORMAT_VERSION,
      id: runId,
      projectId: project.metadata.id,
      goal,
      target: resolved.public,
      approvedToolIds,
      maxSteps,
      status: "running",
      decisions: Object.freeze([]),
      observations: Object.freeze([]),
      startedAt,
      updatedAt: startedAt,
    });
    await this.runs.save(record);

    try {
      for (let sequence = 1; sequence <= maxSteps; sequence += 1) {
        const latest = await this.requireProject(project.metadata.id);
        const currentTarget = resolveTarget(latest, targetInput);
        const executed = new Set(record.observations.map((observation) => observation.toolId));
        const eligibleTools = eligibleCreativeTools(latest, currentTarget, approvedToolIds, executed);
        if (!eligibleTools.length) {
          record = finishRecord(record, "completed", "No further approved and currently eligible Forge tools remain for this mission.", this.now());
          await this.runs.save(record);
          return record;
        }

        const decisionResult = await this.decide({
          project: latest,
          goal,
          target: currentTarget.public,
          eligibleTools,
          observations: record.observations,
          ...(input.routingPreference ? { routingPreference: input.routingPreference } : {}),
        });
        const decidedAt = this.now();
        const decisionEvidence = decisionToEvidence(sequence, decisionResult, decidedAt);
        record = Object.freeze({
          ...record,
          decisions: Object.freeze([...record.decisions, decisionEvidence]),
          updatedAt: decidedAt,
        });
        await this.runs.save(record);

        if (decisionResult.decision.action === "finish") {
          record = finishRecord(record, "completed", decisionResult.decision.summary, this.now());
          await this.runs.save(record);
          return record;
        }

        const selected = eligibleTools.find((tool) => tool.id === decisionResult.decision.toolId);
        if (!selected) throw new Error(`Creative Agent selected unavailable or unapproved tool "${decisionResult.decision.toolId}".`);
        const requestBody = buildCreativeToolRequest(latest, currentTarget, selected, goal, input.author, runId, record.observations);
        const started = this.now();
        const rawResponse = await this.execute({ projectId: latest.metadata.id, tool: selected, body: requestBody });
        const completed = this.now();
        const observation: CreativeAgentObservation = Object.freeze({
          sequence,
          toolId: selected.id,
          title: selected.title,
          reason: decisionResult.decision.reason,
          request: Object.freeze(cloneJson(requestBody)),
          response: sanitizeObservationValue(rawResponse),
          startedAt: started,
          completedAt: completed,
        });
        record = Object.freeze({
          ...record,
          observations: Object.freeze([...record.observations, observation]),
          updatedAt: completed,
        });
        await this.runs.save(record);
      }

      record = finishRecord(record, "max-steps", `Creative Agent reached its hard mission limit of ${maxSteps} executed steps before the model declared the mission complete.`, this.now());
      await this.runs.save(record);
      return record;
    } catch (error) {
      const message = clippedError(error, 2_000);
      record = Object.freeze({ ...record, status: "failed", error: message, updatedAt: this.now() });
      await this.runs.save(record);
      return record;
    }
  }

  private async requireProject(projectId: string): Promise<ProjectState> {
    const normalized = identifier(projectId, "Project id");
    const project = await this.projects.load(normalized);
    if (!project) throw new Error(`Project "${normalized}" not found.`);
    return project;
  }
}

export function createLoopbackCreativeAgentExecutor(origin = forgeInternalOrigin()): CreativeAgentToolExecutor {
  const normalizedOrigin = origin.replace(/\/$/u, "");
  return async (execution) => {
    const path = resolveCreativeToolPath(execution.tool.id, execution.projectId);
    const response = await fetch(`${normalizedOrigin}${path}`, {
      method: execution.tool.method,
      headers: {
        "content-type": "application/json",
        "x-forge-agent-runtime": "v4",
      },
      body: JSON.stringify(execution.body),
    });
    const text = await response.text();
    let payload: unknown = {};
    if (text.trim()) {
      try { payload = JSON.parse(text) as unknown; }
      catch { payload = { raw: text }; }
    }
    if (!response.ok) {
      const detail = payload && typeof payload === "object" && !Array.isArray(payload) && typeof (payload as Record<string, unknown>).error === "string"
        ? String((payload as Record<string, unknown>).error)
        : `Forge tool ${execution.tool.id} failed (${response.status}).`;
      throw new Error(detail);
    }
    return payload;
  };
}

function forgeInternalOrigin(): string {
  const explicit = process.env.FORGE_INTERNAL_ORIGIN?.trim();
  if (explicit) return explicit;
  const configuredHost = process.env.HOST?.trim() || "127.0.0.1";
  const host = configuredHost === "0.0.0.0" || configuredHost === "::" ? "127.0.0.1" : configuredHost;
  const formattedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const port = positiveInteger(Number(process.env.PORT ?? 4173), "Forge internal port", 65535);
  return `http://${formattedHost}:${port}`;
}

async function defaultDecisionGenerator(context: CreativeAgentDecisionContext): Promise<CreativeAgentDecisionResult> {
  const memory = new ProjectMemoryStore();
  for (const record of context.project.memories) memory.register(record);
  const request: ProjectAiGenerationRequest = {
    memory,
    context: {
      projectId: context.project.metadata.id,
      taskMemoryClasses: [
        "author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory",
        "location-memory", "timeline-memory", "style-memory", "research-memory", "decision-memory",
        "production-memory", "creative-note", "open-thread",
      ],
      includeWorkingState: true,
      limit: 128,
    },
    system: [
      "You are the server-owned Author's Forge Creative Agent controller.",
      "Choose exactly one next action after reading the durable Project Brain context and prior execution observations.",
      "You never execute tools yourself. Forge executes only the registered tool you select and then returns the real observation to you on the next turn.",
      "Return ONLY one JSON object in one of these forms: {\"action\":\"tool\",\"toolId\":\"registered.tool.id\",\"reason\":\"brief operational reason\"} or {\"action\":\"finish\",\"summary\":\"brief completion summary\"}.",
      "Select only from AVAILABLE TOOLS. Tools omitted from that list are unavailable, out of scope, already executed, or not approved by the author.",
      "Never request direct canon mutation, direct manuscript application, hidden tools, or unapproved operations.",
      "Do not repeat an executed tool. Finish when the author's goal is satisfied or when no remaining available tool materially advances it.",
    ].join(" "),
    user: JSON.stringify({
      goal: context.goal,
      target: context.target,
      availableTools: context.eligibleTools.map((tool) => ({
        id: tool.id,
        title: tool.title,
        description: tool.description,
        approvalClass: tool.approvalClass,
        providerRequirement: tool.providerRequirement,
        stateEffect: tool.stateEffect,
      })),
      observations: context.observations.map((observation) => ({
        sequence: observation.sequence,
        toolId: observation.toolId,
        reason: observation.reason,
        response: observation.response,
      })),
    }, null, 2),
    task: "tool-use",
    temperature: 0,
    maxOutputTokens: 1200,
    requiresInstructionFollowing: true,
    ...aiMissionRoutingGenerationFields(context.routingPreference),
  };
  const result = await generateProjectText(request);
  return {
    decision: parseDecision(result.text, context.eligibleTools),
    provider: result.provider,
    model: result.model,
    ...(result.requestId ? { requestId: result.requestId } : {}),
  };
}

function parseDecision(raw: string, eligibleTools: readonly CreativeToolDescriptor[]): CreativeAgentDecision {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) throw new Error("Creative Agent controller returned an empty decision.");
  const source = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)?.[1] ?? trimmed;
  let parsed: unknown;
  try { parsed = JSON.parse(source) as unknown; }
  catch { throw new Error("Creative Agent controller did not return valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Creative Agent decision must be a JSON object.");
  const row = parsed as Record<string, unknown>;
  if (row.action === "finish") {
    const unsupported = Object.keys(row).filter((key) => key !== "action" && key !== "summary");
    if (unsupported.length) throw new Error(`Creative Agent finish decision contains unsupported fields: ${unsupported.join(", ")}.`);
    return Object.freeze({ action: "finish", summary: requiredText(row.summary, "Creative Agent completion summary", 4_000) });
  }
  if (row.action === "tool") {
    const unsupported = Object.keys(row).filter((key) => key !== "action" && key !== "toolId" && key !== "reason");
    if (unsupported.length) throw new Error(`Creative Agent tool decision contains unsupported fields: ${unsupported.join(", ")}.`);
    const toolId = requiredText(row.toolId, "Creative Agent tool id", 160);
    if (!eligibleTools.some((tool) => tool.id === toolId)) throw new Error(`Creative Agent selected unavailable or unapproved tool "${toolId}".`);
    return Object.freeze({ action: "tool", toolId, reason: requiredText(row.reason, "Creative Agent tool reason", 2_000) });
  }
  throw new Error("Creative Agent decision action must be tool or finish.");
}

function decisionToEvidence(sequence: number, result: CreativeAgentDecisionResult, decidedAt: string): CreativeAgentDecisionEvidence {
  if (result.decision.action === "finish") {
    return Object.freeze({
      sequence,
      action: "finish",
      summary: result.decision.summary,
      ...(result.provider ? { provider: result.provider, model: result.model } : {}),
      ...(result.requestId ? { requestId: result.requestId } : {}),
      decidedAt,
    });
  }
  return Object.freeze({
    sequence,
    action: "tool",
    toolId: result.decision.toolId,
    reason: result.decision.reason,
    ...(result.provider ? { provider: result.provider, model: result.model } : {}),
    ...(result.requestId ? { requestId: result.requestId } : {}),
    decidedAt,
  });
}

function eligibleCreativeTools(project: ProjectState, target: ResolvedTarget, approvals: readonly string[], executed: ReadonlySet<string>): CreativeToolDescriptor[] {
  const approved = new Set(approvals);
  const collaboration = resolveAiCollaborationPolicy(project.aiCollaborationPolicy);
  const scope = {
    project: true,
    book: Boolean(target.book),
    chapter: Boolean(target.chapter),
    scene: Boolean(target.scene),
  } as const;
  return listCreativeTools().filter((tool) => {
    if (executed.has(tool.id)) return false;
    if (tool.requiredScope.some((required) => required !== "project" && !scope[required])) return false;
    if (tool.id === "editing.analyze" && !target.scene?.content.trim()) return false;
    if (tool.id === "writing.propose" && !collaboration.aiMayDraft) return false;
    if (tool.id === "memory.record-working" && executed.size < 1) return false;
    const automaticallySafe = tool.approvalClass === "read-only" && tool.stateEffect === "none";
    return automaticallySafe || approved.has(tool.id);
  });
}

function resolveTarget(project: ProjectState, input: { readonly bookId?: string; readonly chapterId?: string; readonly sceneId?: string }): ResolvedTarget {
  const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : createStudioWorkspace();
  const bookId = input.bookId ?? workspace.activeBookId ?? undefined;
  const book = bookId ? workspace.books.find((candidate) => candidate.id === bookId) : undefined;
  if (input.bookId && !book) throw new Error(`Book "${input.bookId}" not found for Creative Agent mission.`);
  if (input.chapterId && !book) throw new Error("Creative Agent chapter target requires a valid book target.");
  const chapter = book && input.chapterId ? book.chapters.find((candidate) => candidate.id === input.chapterId) : undefined;
  if (input.chapterId && !chapter) throw new Error(`Chapter "${input.chapterId}" not found for Creative Agent mission.`);
  if (input.sceneId && !chapter) throw new Error("Creative Agent scene target requires a valid chapter target.");
  const scene = chapter && input.sceneId ? chapter.scenes.find((candidate) => candidate.id === input.sceneId) : undefined;
  if (input.sceneId && !scene) throw new Error(`Scene "${input.sceneId}" not found for Creative Agent mission.`);
  return {
    public: Object.freeze({ bookId: book?.id ?? null, chapterId: chapter?.id ?? null, sceneId: scene?.id ?? null }),
    ...(book ? { book } : {}),
    ...(chapter ? { chapter } : {}),
    ...(scene ? { scene } : {}),
  };
}

function buildCreativeToolRequest(project: ProjectState, target: ResolvedTarget, tool: CreativeToolDescriptor, goal: string, authorValue: string | undefined, runId: string, observations: readonly CreativeAgentObservation[]): Record<string, unknown> {
  const lower = goal.toLowerCase();
  const author = optionalText(authorValue, 160) ?? "Author";
  switch (tool.id) {
    case "project.context": return { query: goal };
    case "research.live": return {
      question: goal,
      researchedBecause: "Author-approved Forge Creative Agent Runtime V4 mission",
      domain: chooseResearchDomain(lower),
      ...(target.book ? { bookId: target.book.id } : {}),
      ...(target.chapter ? { chapterId: target.chapter.id } : {}),
      ...(target.scene ? { sceneId: target.scene.id } : {}),
    };
    case "market.kdp.research": return { ...(target.book ? { bookId: target.book.id } : {}), question: goal, market: chooseMarket(goal) };
    case "architecture.generate": return { idea: goal, kind: target.book?.kind ?? "novel", targetChapters: target.book?.chapters.length ?? 0 };
    case "story.chapter-cards.propose": return { bookId: requireTarget(target.book, "book").id, description: goal, targetChapters: Math.max(1, target.book?.chapters.length ?? 1), replaceExistingCards: false };
    case "writing.propose": {
      const book = requireTarget(target.book, "book"), chapter = requireTarget(target.chapter, "chapter"), scene = requireTarget(target.scene, "scene");
      const task = lower.includes("rewrite") || lower.includes("revise") ? "rewrite" : (scene.content.trim() ? "continue" : "draft");
      return { bookId: book.id, chapterId: chapter.id, sceneId: scene.id, task, instruction: goal, contextQuery: goal };
    }
    case "editing.analyze": {
      const scene = requireTarget(target.scene, "scene");
      if (!scene.content.trim()) throw new Error("The selected scene has no manuscript text to edit.");
      return {
        manuscriptId: "studio-workspace",
        ...(target.book ? { bookId: target.book.id } : {}),
        ...(target.chapter ? { chapterId: target.chapter.id } : {}),
        sceneId: scene.id,
        title: scene.title || "Agent editorial analysis",
        text: scene.content,
        roles: ["developmental", "continuity", "line", "copy", "proofreading"],
      };
    }
    case "cover.direction.propose": return { bookId: requireTarget(target.book, "book").id, brief: goal };
    case "visual.image.generate": return { prompt: goal, purpose: hasAny(lower, ["cover", "book jacket", "dust jacket"]) ? "cover-art" : "illustration", size: "auto", quality: "auto" };
    case "promotion.campaign.propose": {
      const book = requireTarget(target.book, "book");
      return { bookId: book.id, objective: goal, audience: `Readers who are a strong fit for this ${book.kind.replace(/-/gu, " ")}`, readerPromise: book.description.trim() || goal, channels: ["social", "author-site"], marketplace: chooseMarket(goal) };
    }
    case "production.export": return { bookId: requireTarget(target.book, "book").id, format: chooseExportFormat(lower), pageSize: "6x9", author };
    case "memory.record-working": {
      if (!observations.length) throw new Error("Creative Agent must execute at least one workflow operation before recording working evidence.");
      const content = observations.map((observation) => `${observation.toolId.toUpperCase()}\n${JSON.stringify(observation.response, null, 2)}`).join("\n\n---\n\n");
      return {
        id: `agent-run-${runId}-${observations.length + 1}`,
        class: "creative-note",
        authority: "working",
        summary: `Forge Creative Agent V4: ${goal.slice(0, 140)}`,
        content: `AUTHOR GOAL:\n${goal}\n\nTARGET: ${target.book?.title ?? "project"}${target.chapter ? ` / ${target.chapter.title}` : ""}${target.scene ? ` / ${target.scene.title}` : ""}\n\nEXECUTION EVIDENCE:\n${clip(content, 12_000)}`,
        reference: "forge-agent-runtime-v4",
        relevanceTags: ["agent-workflow", "creative-workflow", "agent-runtime-v4"],
      };
    }
    default: creativeToolById(tool.id); throw new Error(`Creative Agent Runtime V4 has no execution adapter for registered tool "${tool.id}".`);
  }
}

function requireTarget<T>(value: T | undefined, label: string): T {
  if (!value) throw new Error(`Creative Agent tool requires ${label} scope.`);
  return value;
}

function chooseResearchDomain(goal: string): string {
  if (hasAny(goal, ["market", "niche", "sales", "selling", "keyword"])) return "market";
  if (hasAny(goal, ["genre trend", "trend", "popular genre"])) return "genre-trend";
  if (hasAny(goal, ["reader", "audience expectation"])) return "reader-expectation";
  if (hasAny(goal, ["comparable", "comp book", "similar book"])) return "comparable-book";
  if (hasAny(goal, ["publish", "kdp", "retailer"])) return "publishing";
  if (hasAny(goal, ["weather", "climate"])) return "weather";
  if (hasAny(goal, ["legal", "law", "regulation"])) return "legal-environmental";
  if (hasAny(goal, ["medical", "medicine", "science", "scientific"])) return "medical-scientific";
  if (hasAny(goal, ["historical event", "battle", "war", "election"])) return "historical-event";
  if (hasAny(goal, ["historical", "history", "period", "era"])) return "historical-period";
  if (hasAny(goal, ["travel", "distance", "route"])) return "travel-distance";
  if (hasAny(goal, ["setting", "location", "city", "town", "place", "geography"])) return "real-world-location";
  if (hasAny(goal, ["architecture", "building"])) return "architecture";
  return "terminology";
}

function chooseMarket(goal: string): string {
  if (/\b(uk|united kingdom|britain|amazon\.co\.uk)\b/iu.test(goal)) return "Amazon.co.uk";
  if (/\b(canada|amazon\.ca)\b/iu.test(goal)) return "Amazon.ca";
  if (/\b(australia|amazon\.com\.au)\b/iu.test(goal)) return "Amazon.com.au";
  return "Amazon.com";
}

function chooseExportFormat(goal: string): string {
  if (goal.includes("kdp") && goal.includes("epub")) return "kdp-epub";
  if (goal.includes("kdp") && (goal.includes("docx") || goal.includes("word document"))) return "kdp-docx";
  if (goal.includes("kdp")) return "kdp-pdf";
  if (goal.includes("epub")) return "epub";
  if (goal.includes("docx") || goal.includes("word document")) return "docx";
  return "pdf";
}

function hasAny(text: string, values: readonly string[]): boolean { return values.some((value) => text.includes(value)); }

function normalizeApprovals(value: readonly string[] | undefined): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) throw new Error("Creative Agent approvedToolIds must be an array.");
  const normalized = [...new Set(value.map((candidate) => requiredText(candidate, "Approved Creative Agent tool id", 160)))];
  if (normalized.length > 20) throw new Error("Creative Agent approvedToolIds cannot contain more than 20 tools.");
  for (const toolId of normalized) creativeToolById(toolId);
  return Object.freeze(normalized);
}

function finishRecord(record: CreativeAgentRunRecord, status: "completed" | "max-steps", summary: string, now: string): CreativeAgentRunRecord {
  return Object.freeze({ ...record, status, finalSummary: requiredText(summary, "Creative Agent final summary", 4_000), updatedAt: now });
}

function sanitizeObservationValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return clip(value, 4_000);
  if (depth >= 5) return "[nested value clipped]";
  if (Array.isArray(value)) return value.slice(0, 25).map((entry) => sanitizeObservationValue(entry, depth + 1));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      if (key === "contentBase64") {
        const byteLength = typeof (value as Record<string, unknown>).byteLength === "number" ? Number((value as Record<string, unknown>).byteLength) : undefined;
        result[key] = byteLength === undefined ? "[artifact bytes omitted from Agent observation]" : `[${byteLength} artifact bytes omitted from Agent observation]`;
      } else result[key] = sanitizeObservationValue(entry, depth + 1);
    }
    return result;
  }
  return clip(String(value), 4_000);
}

function validateRunRecord(value: unknown): CreativeAgentRunRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Creative Agent run record must be an object.");
  const row = value as Record<string, unknown>;
  if (row.formatVersion !== CREATIVE_AGENT_RUN_FORMAT_VERSION) throw new Error("Unsupported Creative Agent run format version.");
  const projectId = identifier(row.projectId, "Creative Agent project id");
  const id = identifier(row.id, "Creative Agent run id");
  const goal = requiredText(row.goal, "Creative Agent goal", 10_000);
  const maxSteps = positiveInteger(Number(row.maxSteps), "Creative Agent maxSteps", CREATIVE_AGENT_HARD_MAX_STEPS);
  if (!Array.isArray(row.approvedToolIds) || !row.approvedToolIds.every((item) => typeof item === "string")) throw new Error("Creative Agent run approvals are invalid.");
  if (!Array.isArray(row.decisions) || !Array.isArray(row.observations)) throw new Error("Creative Agent run evidence arrays are invalid.");
  const status = row.status;
  if (status !== "running" && status !== "completed" && status !== "failed" && status !== "max-steps") throw new Error("Creative Agent run status is invalid.");
  if (!row.target || typeof row.target !== "object" || Array.isArray(row.target)) throw new Error("Creative Agent run target is invalid.");
  const targetRow = row.target as Record<string, unknown>;
  const target: CreativeAgentRunTarget = {
    bookId: nullableIdentifier(targetRow.bookId, "Creative Agent book id"),
    chapterId: nullableIdentifier(targetRow.chapterId, "Creative Agent chapter id"),
    sceneId: nullableIdentifier(targetRow.sceneId, "Creative Agent scene id"),
  };
  const startedAt = timestamp(row.startedAt, "Creative Agent startedAt");
  const updatedAt = timestamp(row.updatedAt, "Creative Agent updatedAt");
  return Object.freeze({
    formatVersion: CREATIVE_AGENT_RUN_FORMAT_VERSION,
    id,
    projectId,
    goal,
    target,
    approvedToolIds: Object.freeze(row.approvedToolIds.map(String)),
    maxSteps,
    status,
    decisions: Object.freeze(row.decisions as CreativeAgentDecisionEvidence[]),
    observations: Object.freeze(row.observations as CreativeAgentObservation[]),
    ...(typeof row.finalSummary === "string" ? { finalSummary: row.finalSummary } : {}),
    ...(typeof row.error === "string" ? { error: row.error } : {}),
    startedAt,
    updatedAt,
  });
}

function nullableIdentifier(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  return identifier(value, label);
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value.trim())) throw new Error(`${label} may contain only letters, numbers, hyphens, and underscores.`);
  return value.trim();
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return normalized;
}

function optionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Creative Agent text value must be a string.");
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`Creative Agent text value exceeds ${max} characters.`);
  return normalized || undefined;
}

function positiveInteger(value: number, label: string, max: number): number {
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${label} must be an integer from 1 through ${max}.`);
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(Date.parse(value)).toISOString();
}

function clip(value: string, max: number): string { return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value; }
function clippedError(error: unknown, max: number): string { return clip((error instanceof Error ? error.message : String(error)).replace(/\s+/gu, " ").trim() || "Creative Agent failed without a usable error message.", max); }
function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function isMissing(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"; }

async function writeAtomically(path: string, content: string): Promise<void> {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(content, "utf8"); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, path);
    if (process.platform !== "win32") {
      const directory = await open(dirname(path), "r");
      try { await directory.sync(); } finally { await directory.close(); }
    }
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}
