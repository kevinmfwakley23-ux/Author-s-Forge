import { randomUUID } from "node:crypto";
import type { ProjectState } from "../domain/project";
import { assertAiCollaborationCapability } from "../domain/ai-collaboration";
import {
  approveStoryArchitectureCandidate,
  createStoryArchitectureCandidate,
  createStoryArchitectureWorkflowState,
  revokeStoryArchitectureApproval,
  storyArchitectureApprovalFor,
  storyArchitecturePlanSha256,
  updateStoryArchitectureCandidatePlan,
  upsertStoryArchitectureCandidate,
  validateStoryArchitecturePlan,
  validateStoryArchitectureWorkflowState,
  type StoryArchitectureCandidate,
  type StoryArchitecturePlan,
  type StoryArchitectureWorkflowState,
} from "../domain/story-architecture-workflow";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { ProjectMemoryStore } from "./project-memory-store";
import { StoryArchitectureTemplateService, formatStoryArchitectureTemplateGuidance } from "./story-architecture-templates";

export type StoryArchitectureGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;

type StoryArchitectureProject = ProjectState & {
  readonly storyArchitectureWorkflow?: StoryArchitectureWorkflowState;
};

export interface GenerateStoryArchitectureInput {
  readonly idea: string;
  readonly kind?: string;
  readonly targetChapters?: number;
  readonly templateId?: string;
  readonly now?: string;
}

export class StudioStoryArchitectureWorkflowService {
  private readonly templates: StoryArchitectureTemplateService;

  constructor(
    private readonly projects: Pick<FileProjectStore, "load" | "save">,
    private readonly generator: StoryArchitectureGenerator = generateProjectText,
  ) {
    this.templates = new StoryArchitectureTemplateService(projects);
  }

  async snapshot(projectId: string) {
    const project = await this.requireProject(projectId);
    const workflow = workflowOf(project);
    const candidates = workflow.candidates.map((candidate) => {
      const approval = storyArchitectureApprovalFor(workflow, candidate);
      const historical = workflow.approvals.find((item) => item.candidateId === candidate.id);
      return {
        ...candidate,
        planSha256: storyArchitecturePlanSha256(candidate.plan),
        approved: Boolean(approval),
        approvalStale: Boolean(historical && !approval),
        ...(approval ? { approvedAt: approval.approvedAt } : {}),
      };
    });
    const approved = candidates.filter((item) => item.approved).sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)))[0];
    return Object.freeze({ projectId, workflow, candidates, approvedArchitectureId: approved?.id ?? null });
  }

  async generate(projectId: string, input: GenerateStoryArchitectureInput) {
    const project = await this.requireProject(projectId);
    assertAiCollaborationCapability(project.aiCollaborationPolicy, "draft", "AI Story Architecture generation", "author-requested");
    const idea = requiredText(input.idea, "Book idea", 32_000);
    const kind = optionalText(input.kind, "Book kind", 120) ?? "novel";
    const targetChapters = input.targetChapters === undefined || input.targetChapters === 0
      ? undefined
      : positiveInteger(input.targetChapters, "Target chapters", 100);
    const template = input.templateId === undefined || input.templateId === ""
      ? undefined
      : await this.templates.resolve(projectId, identifier(input.templateId, "Story Architecture template id"));

    const memory = new ProjectMemoryStore();
    for (const record of project.memories) memory.register(record);
    const characters = (project.characters ?? []).map((character) => ({ id: character.id, name: character.profile.name }));
    const result = await this.generator({
      memory,
      context: {
        projectId,
        taskMemoryClasses: [
          "author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory",
          "timeline-memory", "location-memory", "style-memory", "research-memory", "decision-memory",
          "creative-note", "working-draft", "open-thread",
        ],
        includeWorkingState: true,
        limit: 256,
      },
      system: [
        "You are Author's Forge Story Architecture planner.",
        "Return ONLY valid JSON matching the supplied schema; do not wrap it in markdown or commentary.",
        "Build planning, not final manuscript prose.",
        "Treat Project Brain authoritative canon as binding unless the author explicitly requested a change.",
        "Separate assumptions from supplied facts. Canon candidates are proposals only and must never be described as already-established canon.",
        "Make the chapter and scene plan coherent enough to hand directly into Chapter Card planning after author approval.",
        "A selected story structure template is guidance, not canon: adapt it to the author's idea and never force a beat that contradicts explicit author intent or authoritative Project Brain truth.",
        "Do not invent research, external facts, or unsupported character ids.",
      ].join(" "),
      user: [
        `BOOK TYPE: ${kind}`,
        `TARGET CHAPTERS: ${targetChapters ?? "choose the appropriate count"}`,
        `AUTHOR IDEA:\n${idea}`,
        template ? formatStoryArchitectureTemplateGuidance(template) : "STORY STRUCTURE TEMPLATE: none selected; derive an appropriate structure from the author idea and Project Brain.",
        characters.length ? `EXISTING CHARACTER IDS:\n${characters.map((item) => `- ${item.id}: ${item.name}`).join("\n")}` : "EXISTING CHARACTER IDS: none yet.",
        "JSON SCHEMA:",
        '{"premise":"","themes":[""],"audience":"","genreExpectations":[""],"canonCandidates":[""],"characterCandidates":[""],"locations":[""],"timelineConsiderations":[""],"assumptions":[""],"chapterPlan":[{"number":1,"title":"","summary":"","requiredEvents":[""],"continuityDependencies":[""]}],"scenePlan":[{"chapterNumber":1,"title":"","summary":"","goal":"","conflict":"","outcome":""}],"unresolvedQuestions":[""],"productionRisks":[""]}',
        "Use empty arrays when no item is justified. Themes must contain at least one meaningful theme.",
      ].join("\n\n"),
      task: "writing",
      requiresCreativeWriting: true,
      requiresInstructionFollowing: true,
      temperature: 0.35,
      maxOutputTokens: 16_000,
    });

    const plan = validateStoryArchitecturePlan(parseJsonObject(result.text));
    if (targetChapters !== undefined && plan.chapterPlan.length !== targetChapters) {
      throw new Error(`AI returned ${plan.chapterPlan.length} architecture chapters but the author requested ${targetChapters}. No architecture changes were saved.`);
    }
    if (plan.chapterPlan.length === 0) throw new Error("AI Story Architecture did not include a chapter plan. No architecture changes were saved.");

    const candidate = createStoryArchitectureCandidate({
      id: `story-architecture-${randomUUID()}`,
      projectId,
      idea,
      kind,
      ...(targetChapters === undefined ? {} : { targetChapters }),
      ...(template ? {
        template: {
          id: template.id,
          title: template.title,
          version: template.version,
          sourceKind: template.source.kind,
        },
      } : {}),
      plan,
      provider: result.provider,
      model: result.model,
      now: input.now,
    });
    const workflow = upsertStoryArchitectureCandidate(workflowOf(project), candidate);
    await this.save(project, workflow, input.now);
    return Object.freeze({
      candidate,
      planSha256: storyArchitecturePlanSha256(candidate.plan),
      authorApprovalRequired: true as const,
      manuscriptChanged: false as const,
      canonChanged: false as const,
      templateGuidanceApplied: template ? {
        id: template.id,
        title: template.title,
        version: template.version,
        sourceKind: template.source.kind,
      } : null,
      message: "Story Architecture saved as durable unapproved planning. Review/edit it, then explicitly approve the exact current plan before handing it to Chapter Cards.",
    });
  }

  async updatePlan(projectId: string, candidateId: string, plan: StoryArchitecturePlan, now?: string) {
    const project = await this.requireProject(projectId);
    const workflow = updateStoryArchitectureCandidatePlan(workflowOf(project), candidateId, plan, now);
    await this.save(project, workflow, now);
    return this.snapshot(projectId);
  }

  async approve(projectId: string, candidateId: string, input: { authorApproved: boolean; now?: string }) {
    if (input.authorApproved !== true) throw new Error("Explicit author approval is required before Story Architecture can govern downstream planning.");
    const project = await this.requireProject(projectId);
    const workflow = approveStoryArchitectureCandidate(workflowOf(project), candidateId, input.now);
    await this.save(project, workflow, input.now);
    return this.snapshot(projectId);
  }

  async revokeApproval(projectId: string, candidateId: string, now?: string) {
    const project = await this.requireProject(projectId);
    const workflow = revokeStoryArchitectureApproval(workflowOf(project), candidateId);
    await this.save(project, workflow, now);
    return this.snapshot(projectId);
  }

  async chapterCardSeed(projectId: string, candidateId?: string) {
    const project = await this.requireProject(projectId);
    const workflow = workflowOf(project);
    const candidate = candidateId
      ? workflow.candidates.find((item) => item.id === identifier(candidateId, "Story Architecture candidate id"))
      : latestApproved(workflow);
    if (!candidate) throw new Error("No approved Story Architecture is available for Chapter Card planning.");
    const approval = storyArchitectureApprovalFor(workflow, candidate);
    if (!approval) throw new Error("Story Architecture is not currently author-approved. Review and approve the exact current plan before using it for Chapter Cards.");
    const plan = candidate.plan;
    const events = uniqueStrings([
      ...plan.chapterPlan.flatMap((chapter) => chapter.requiredEvents),
      ...plan.scenePlan.map((scene) => `Chapter ${scene.chapterNumber} · ${scene.title}: ${scene.summary}`),
    ]);
    const description = [
      `APPROVED STORY ARCHITECTURE (${approval.planSha256})`,
      candidate.template ? `Structure template provenance: ${candidate.template.title} (${candidate.template.id} v${candidate.template.version}, ${candidate.template.sourceKind}). Template guidance is not Project Brain canon.` : "",
      `Premise: ${plan.premise}`,
      `Themes: ${plan.themes.join("; ")}`,
      `Audience: ${plan.audience}`,
      plan.genreExpectations.length ? `Genre expectations: ${plan.genreExpectations.join("; ")}` : "",
      plan.canonCandidates.length ? `Author-approved architecture canon candidates (not automatically Project Brain canon): ${plan.canonCandidates.join("; ")}` : "",
      plan.characterCandidates.length ? `Character candidates: ${plan.characterCandidates.join("; ")}` : "",
      plan.locations.length ? `Locations: ${plan.locations.join("; ")}` : "",
      plan.assumptions.length ? `Explicit assumptions to keep visible: ${plan.assumptions.join("; ")}` : "",
      plan.unresolvedQuestions.length ? `Unresolved questions: ${plan.unresolvedQuestions.join("; ")}` : "",
    ].filter(Boolean).join("\n\n");
    return Object.freeze({
      architectureId: candidate.id,
      architectureSha256: approval.planSha256,
      template: candidate.template ?? null,
      kind: candidate.kind,
      description,
      events,
      timelineDetails: plan.timelineConsiderations,
      targetChapters: candidate.targetChapters ?? plan.chapterPlan.length,
      manuscriptChanged: false as const,
      canonChanged: false as const,
    });
  }

  private async requireProject(projectId: string): Promise<StoryArchitectureProject> {
    const id = identifier(projectId, "Project id");
    const project = await this.projects.load(id);
    if (!project) throw new Error(`Project "${id}" not found.`);
    return project as StoryArchitectureProject;
  }

  private async save(project: StoryArchitectureProject, workflow: StoryArchitectureWorkflowState, now = new Date().toISOString()) {
    await this.projects.save({
      ...project,
      storyArchitectureWorkflow: validateStoryArchitectureWorkflowState(JSON.parse(JSON.stringify(workflow))),
      metadata: { ...project.metadata, updatedAt: timestamp(now, "Story Architecture workflow timestamp") },
    } as ProjectState);
  }
}

function latestApproved(workflow: StoryArchitectureWorkflowState): StoryArchitectureCandidate | undefined {
  return workflow.approvals
    .slice()
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))
    .flatMap((approval) => {
      const candidate = workflow.candidates.find((item) => item.id === approval.candidateId);
      return candidate && storyArchitectureApprovalFor(workflow, candidate) ? [candidate] : [];
    })[0];
}
function workflowOf(project: StoryArchitectureProject): StoryArchitectureWorkflowState {
  return project.storyArchitectureWorkflow ? validateStoryArchitectureWorkflowState(project.storyArchitectureWorkflow) : createStoryArchitectureWorkflowState();
}
function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  let value: unknown;
  try { value = JSON.parse(unfenced); }
  catch { throw new Error("AI Story Architecture response was not valid JSON. No architecture changes were saved."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI Story Architecture response must be a JSON object.");
  return value as Record<string, unknown>;
}
function uniqueStrings(values: readonly string[]): string[] { return [...new Set(values.map((item) => item.trim()).filter(Boolean))]; }
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/u.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}
function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredText(value, label, max);
}
function positiveInteger(value: unknown, label: string, max: number): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new Error(`${label} must be an integer from 1 through ${max}.`);
  return number;
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}