import type { ProjectState } from "../domain/project";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { aiMissionRoutingGenerationFields, type AiMissionRoutingPreference } from "./ai-mission-routing";
import { ProjectMemoryStore } from "./project-memory-store";

export type CoverDirectionGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;

export interface CoverDirectionCandidate {
  readonly frontPrompt: string;
  readonly backText: string;
  readonly spineText: string;
  readonly typography: string;
  readonly composition: string;
  readonly mood: string;
  readonly palette: readonly string[];
  readonly avoid: readonly string[];
}

export interface ProposeCoverDirectionInput {
  readonly bookId: string;
  readonly brief: string;
  readonly routingPreference?: AiMissionRoutingPreference;
}

export interface CoverDirectionProposal {
  readonly projectId: string;
  readonly bookId: string;
  readonly candidate: CoverDirectionCandidate;
  readonly provider: AiGenerationResult["provider"];
  readonly model: string;
  readonly requestId?: string;
  readonly authorApprovalRequired: true;
  readonly persisted: false;
  readonly productionGeometryRequired: true;
}

/** Creative cover direction only. Production geometry remains Cover Studio authority. */
export class StudioCoverDirectionService {
  public constructor(
    private readonly store: Pick<FileProjectStore, "load">,
    private readonly generator: CoverDirectionGenerator = generateProjectText,
  ) {}

  public async propose(projectId: string, input: ProposeCoverDirectionInput): Promise<CoverDirectionProposal> {
    const project = await this.requireProject(projectId);
    if (!project.studioWorkspace) throw new Error("Project has no Studio workspace.");
    const book = getBook(validateStudioWorkspace(project.studioWorkspace), required(input.bookId, "Book id", 200));
    const brief = required(input.brief, "Cover direction brief", 20_000);
    const memory = new ProjectMemoryStore();
    for (const record of project.memories) memory.register(record);

    const result = await this.generator({
      memory,
      context: {
        projectId,
        taskMemoryClasses: [
          "author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory",
          "location-memory", "timeline-memory", "style-memory", "research-memory", "decision-memory", "creative-note",
        ],
        includeWorkingState: true,
        limit: 192,
      },
      system: [
        "You are Author's Forge Cover Studio creative director.",
        "Create a reviewable creative cover-direction candidate only. Do not claim production readiness, KDP acceptance, trim size, spine width, page count, bleed geometry, publication, sales, rankings, reviews, awards, or rights clearance.",
        "Respect supplied Project Brain canon, characters, tone, audience and book truth. Do not invent factual endorsements, retailer claims, prices, discounts, or customer reviews.",
        "Return ONLY valid JSON with exactly these fields: frontPrompt, backText, spineText, typography, composition, mood, palette, avoid.",
        "frontPrompt describes cover artwork/direction without embedding production dimensions. backText is usable draft back-cover copy based only on supplied book truth. spineText should normally be concise title/author text, not a fabricated production measurement.",
      ].join(" "),
      user: JSON.stringify({
        authorBrief: brief,
        book: { id: book.id, title: book.title, kind: book.kind, description: book.description },
        outputSchema: {
          frontPrompt: "string", backText: "string", spineText: "string", typography: "string",
          composition: "string", mood: "string", palette: ["string"], avoid: ["string"],
        },
      }, null, 2),
      task: "cover",
      temperature: 0.45,
      maxOutputTokens: 3500,
      requiresCreativeWriting: true,
      requiresInstructionFollowing: true,
      ...aiMissionRoutingGenerationFields(input.routingPreference),
    });

    return {
      projectId,
      bookId: book.id,
      candidate: parseCandidate(result.text),
      provider: result.provider,
      model: result.model,
      ...(result.requestId ? { requestId: result.requestId } : {}),
      authorApprovalRequired: true,
      persisted: false,
      productionGeometryRequired: true,
    };
  }

  private async requireProject(projectId: string): Promise<ProjectState> {
    const normalized = required(projectId, "Project id", 200);
    const project = await this.store.load(normalized);
    if (!project) throw new Error(`Project "${normalized}" not found.`);
    return project;
  }
}

function parseCandidate(raw: string): CoverDirectionCandidate {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Cover-direction AI returned an empty response.");
  const trimmed = raw.trim();
  const source = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { throw new Error("Cover-direction AI did not return valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Cover-direction AI JSON must be an object.");
  const row = parsed as Record<string, unknown>;
  const allowed = ["frontPrompt", "backText", "spineText", "typography", "composition", "mood", "palette", "avoid"];
  const extras = Object.keys(row).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`Cover-direction AI returned unsupported fields: ${extras.join(", ")}.`);
  for (const field of allowed) if (!(field in row)) throw new Error(`Cover-direction AI omitted required field "${field}".`);
  return Object.freeze({
    frontPrompt: required(row.frontPrompt, "Cover front prompt", 8_000),
    backText: required(row.backText, "Cover back text", 8_000),
    spineText: required(row.spineText, "Cover spine text", 500),
    typography: required(row.typography, "Cover typography direction", 2_000),
    composition: required(row.composition, "Cover composition direction", 4_000),
    mood: required(row.mood, "Cover mood direction", 2_000),
    palette: Object.freeze(textList(row.palette, "Cover palette", 20, 200)),
    avoid: Object.freeze(textList(row.avoid, "Cover avoid list", 30, 500)),
  });
}

function textList(value: unknown, label: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > maxItems) throw new Error(`${label} exceeds ${maxItems} entries.`);
  return [...new Set(value.map((item, index) => required(item, `${label} item ${index + 1}`, maxLength)))];
}

function required(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return normalized;
}
