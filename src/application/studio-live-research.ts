import { randomUUID } from "node:crypto";
import { ResearchEngine, type ResearchProvider } from "./research-engine";
import { ProjectMemoryStore } from "./project-memory-store";
import { RESEARCH_DOMAINS, type ResearchDomain } from "../domain/research";
import { withProjectMemories } from "../domain/project";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { OpenAiWebResearchProvider } from "../infrastructure/openai-web-research-provider";
import { refreshPersistedAiOwnerControl, type RuntimeAiOwnerControl } from "../infrastructure/ai-owner-control-runtime";

export interface StudioLiveResearchInput {
  readonly question: string;
  readonly researchedBecause: string;
  readonly domain: ResearchDomain;
  readonly bookId?: string;
  readonly chapterId?: string;
  readonly sceneId?: string;
}

export interface StudioLiveResearchResult {
  readonly record: Awaited<ReturnType<ResearchEngine["research"]>>["record"];
  readonly persistedMemoryIds: readonly string[];
  readonly sourceBacked: true;
  readonly canonEligible: false;
  readonly authority: "working";
  readonly spendPolicy: "unrestricted";
}

type ControlReader = () => RuntimeAiOwnerControl;
type ProviderFactory = (control: RuntimeAiOwnerControl) => ResearchProvider;

export class StudioLiveResearchService {
  constructor(
    private readonly store: Pick<FileProjectStore, "load" | "save">,
    private readonly providerFactory: ProviderFactory = defaultProviderFactory,
    private readonly readControl: ControlReader = () => refreshPersistedAiOwnerControl(),
  ) {}

  async research(projectId: string, input: StudioLiveResearchInput): Promise<StudioLiveResearchResult> {
    validateProjectId(projectId);
    validateInput(input);
    const before = await this.store.load(projectId);
    if (!before) throw new Error(`Project "${projectId}" not found.`);

    const control = this.readControl();
    assertHostedResearchAllowed(control);
    const memory = new ProjectMemoryStore();
    const engine = new ResearchEngine(this.providerFactory(control), memory);
    const result = await engine.research({
      id: `live-research-${randomUUID()}`,
      projectId,
      question: input.question.trim(),
      researchedBecause: input.researchedBecause.trim(),
      domain: input.domain,
      ...(optionalText(input.bookId) ? { bookId: optionalText(input.bookId) } : {}),
      ...(optionalText(input.chapterId) ? { chapterId: optionalText(input.chapterId) } : {}),
      ...(optionalText(input.sceneId) ? { sceneId: optionalText(input.sceneId) } : {}),
    });

    // The network call can outlive an author edit. Reload and merge only the new
    // research memories so no newer project/workspace state can be overwritten.
    const latest = await this.store.load(projectId);
    if (!latest) throw new Error(`Project "${projectId}" disappeared before research could be persisted.`);
    const existingIds = new Set(latest.memories.map((item) => item.id));
    for (const item of result.memories) if (existingIds.has(item.id)) throw new Error(`Research persistence collision for memory "${item.id}".`);
    const persisted = withProjectMemories(latest, [...latest.memories, ...result.memories]);
    await this.store.save(persisted);

    return {
      record: result.record,
      persistedMemoryIds: result.memories.map((item) => item.id),
      sourceBacked: true,
      canonEligible: false,
      authority: "working",
      spendPolicy: "unrestricted",
    };
  }
}

export function assertHostedResearchAllowed(control: RuntimeAiOwnerControl): void {
  if (control.spendPolicy !== "unrestricted") {
    throw new Error("Live hosted web research is blocked by the owner AI spend policy. Hosted web-search tool fees are not treated as free or safely pre-estimable; switch the primary AI control to Unrestricted configured APIs to run live research.");
  }
  if (control.pinnedProvider && control.pinnedProvider !== "openai") {
    throw new Error(`Live hosted web research requires the OpenAI web_search tool, but the owner AI control is pinned to ${control.pinnedProvider}/${control.pinnedModel}. Clear the pin or pin an OpenAI model.`);
  }
}

function defaultProviderFactory(control: RuntimeAiOwnerControl): ResearchProvider {
  return new OpenAiWebResearchProvider({
    ...(control.pinnedProvider === "openai" && control.pinnedModel ? { model: control.pinnedModel } : {}),
  });
}

function validateProjectId(value: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid research project id.");
}
function validateInput(input: StudioLiveResearchInput): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Live research request must be an object.");
  if (typeof input.question !== "string" || !input.question.trim()) throw new Error("Live research question is required.");
  if (typeof input.researchedBecause !== "string" || !input.researchedBecause.trim()) throw new Error("Live research rationale is required.");
  if (!RESEARCH_DOMAINS.includes(input.domain)) throw new Error("Invalid live research domain.");
  for (const [value, label] of [[input.bookId, "book id"], [input.chapterId, "chapter id"], [input.sceneId, "scene id"]] as const) {
    if (value !== undefined && (typeof value !== "string" || !value.trim() || value.length > 200 || /[\r\n]/.test(value))) throw new Error(`Invalid research ${label}.`);
  }
}
function optionalText(value: string | undefined): string | undefined { const trimmed = value?.trim(); return trimmed || undefined; }
