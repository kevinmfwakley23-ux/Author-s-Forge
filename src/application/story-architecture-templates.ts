import { randomUUID } from "node:crypto";
import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import { withProjectMemories, type ProjectState } from "../domain/project";
import type { FileProjectStore } from "../infrastructure/file-project-store";

export const STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION = 1 as const;
const TEMPLATE_TAG = "story-architecture-template";
const TEMPLATE_MEMORY_PREFIX = "story-architecture-template-";

export interface StoryArchitectureTemplateBeat {
  readonly label: string;
  readonly purpose: string;
  readonly targetPosition?: string;
}

export interface StoryArchitectureTemplateSource {
  readonly kind: "built-in" | "author" | "installed-copy";
  readonly sourceTemplateId?: string;
  readonly sourceTemplateVersion?: number;
}

export interface StoryArchitectureTemplate {
  readonly formatVersion: typeof STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly bookKinds: readonly string[];
  readonly guidance: readonly string[];
  readonly beats: readonly StoryArchitectureTemplateBeat[];
  readonly version: number;
  readonly source: StoryArchitectureTemplateSource;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface StoredTemplateEnvelope {
  readonly formatVersion: typeof STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION;
  readonly template: StoryArchitectureTemplate;
  readonly deleted: boolean;
}

export interface SaveStoryArchitectureTemplateInput {
  readonly title: string;
  readonly description?: string;
  readonly bookKinds?: readonly string[];
  readonly guidance: readonly string[];
  readonly beats: readonly StoryArchitectureTemplateBeat[];
  readonly now?: string;
}

export interface UpdateStoryArchitectureTemplateInput {
  readonly title?: string;
  readonly description?: string;
  readonly bookKinds?: readonly string[];
  readonly guidance?: readonly string[];
  readonly beats?: readonly StoryArchitectureTemplateBeat[];
  readonly now?: string;
}

export class StoryArchitectureTemplateService {
  constructor(private readonly store: Pick<FileProjectStore, "load" | "save">) {}

  async list(projectId: string): Promise<{
    readonly builtIn: readonly StoryArchitectureTemplate[];
    readonly installed: readonly StoryArchitectureTemplate[];
  }> {
    const project = await this.requireProject(projectId);
    return Object.freeze({
      builtIn: builtInStoryArchitectureTemplates(),
      installed: [...latestEnvelopes(project).values()]
        .filter((entry) => !entry.deleted)
        .map((entry) => entry.template)
        .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id)),
    });
  }

  async resolve(projectId: string, templateId: string): Promise<StoryArchitectureTemplate> {
    const normalizedId = identifier(templateId, "Story Architecture template id");
    const builtIn = builtInStoryArchitectureTemplates().find((template) => template.id === normalizedId);
    if (builtIn) return builtIn;
    const project = await this.requireProject(projectId);
    const stored = latestEnvelopes(project).get(normalizedId);
    if (!stored || stored.deleted) throw new Error(`Story Architecture template "${normalizedId}" was not found.`);
    return stored.template;
  }

  async install(projectId: string, builtInId: string, title?: string, nowValue?: string): Promise<StoryArchitectureTemplate> {
    const project = await this.requireProject(projectId);
    const source = builtInStoryArchitectureTemplates().find((template) => template.id === identifier(builtInId, "Built-in Story Architecture template id"));
    if (!source) throw new Error(`Built-in Story Architecture template "${builtInId}" was not found.`);
    const now = timestamp(nowValue);
    const template = validateTemplate({
      ...source,
      id: `template-${randomUUID()}`,
      title: title === undefined ? source.title : requiredText(title, "Story Architecture template title", 160),
      version: 1,
      source: {
        kind: "installed-copy",
        sourceTemplateId: source.id,
        sourceTemplateVersion: source.version,
      },
      createdAt: now,
      updatedAt: now,
    });
    await this.append(project, template, false, now);
    return template;
  }

  async create(projectId: string, input: SaveStoryArchitectureTemplateInput): Promise<StoryArchitectureTemplate> {
    const project = await this.requireProject(projectId);
    const now = timestamp(input.now);
    const template = validateTemplate({
      formatVersion: STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION,
      id: `template-${randomUUID()}`,
      title: input.title,
      description: input.description ?? "",
      bookKinds: input.bookKinds ?? [],
      guidance: input.guidance,
      beats: input.beats,
      version: 1,
      source: { kind: "author" },
      createdAt: now,
      updatedAt: now,
    });
    await this.append(project, template, false, now);
    return template;
  }

  async update(projectId: string, templateId: string, input: UpdateStoryArchitectureTemplateInput): Promise<StoryArchitectureTemplate> {
    const project = await this.requireProject(projectId);
    const id = identifier(templateId, "Story Architecture template id");
    const previous = latestEnvelopes(project).get(id);
    if (!previous || previous.deleted) throw new Error(`Project Story Architecture template "${id}" was not found.`);
    const now = timestamp(input.now);
    const template = validateTemplate({
      ...previous.template,
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.bookKinds === undefined ? {} : { bookKinds: input.bookKinds }),
      ...(input.guidance === undefined ? {} : { guidance: input.guidance }),
      ...(input.beats === undefined ? {} : { beats: input.beats }),
      version: previous.template.version + 1,
      updatedAt: now,
    });
    await this.append(project, template, false, now);
    return template;
  }

  async remove(projectId: string, templateId: string, nowValue?: string): Promise<{ readonly id: string; readonly deleted: true; readonly version: number }> {
    const project = await this.requireProject(projectId);
    const id = identifier(templateId, "Story Architecture template id");
    const previous = latestEnvelopes(project).get(id);
    if (!previous || previous.deleted) throw new Error(`Project Story Architecture template "${id}" was not found.`);
    const now = timestamp(nowValue);
    const tombstone = validateTemplate({ ...previous.template, version: previous.template.version + 1, updatedAt: now });
    await this.append(project, tombstone, true, now);
    return { id, deleted: true, version: tombstone.version };
  }

  private async append(project: ProjectState, template: StoryArchitectureTemplate, deleted: boolean, now: string): Promise<void> {
    const envelope: StoredTemplateEnvelope = {
      formatVersion: STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION,
      template,
      deleted,
    };
    const memory = createMemoryRecord({
      id: `${TEMPLATE_MEMORY_PREFIX}${template.id}-v${template.version}`,
      projectId: project.metadata.id,
      class: "creative-note",
      authority: "working",
      summary: `${deleted ? "Deleted " : ""}Story Architecture template v${template.version}: ${template.title}`,
      content: JSON.stringify(envelope),
      provenance: [{ kind: "author", reference: "story-architecture-template-library", recordedAt: now }],
      relevanceTags: [TEMPLATE_TAG, `${TEMPLATE_TAG}:${template.id}`, "story-planning", "reusable-template"],
      now,
    });
    await this.store.save(withProjectMemories(project, [...project.memories, memory], now));
  }

  private async requireProject(projectId: string): Promise<ProjectState> {
    const id = identifier(projectId, "Project id");
    const project = await this.store.load(id);
    if (!project) throw new Error(`Project "${id}" not found.`);
    return project;
  }
}

export function formatStoryArchitectureTemplateGuidance(template: StoryArchitectureTemplate): string {
  const value = validateTemplate(template);
  return [
    `AUTHOR-SELECTED STORY STRUCTURE TEMPLATE: ${value.title} (id ${value.id}, version ${value.version}, source ${value.source.kind})`,
    value.description ? `PURPOSE: ${value.description}` : "",
    value.bookKinds.length ? `INTENDED BOOK KINDS: ${value.bookKinds.join(", ")}` : "",
    value.guidance.length ? `GUIDANCE:\n${value.guidance.map((item) => `- ${item}`).join("\n")}` : "",
    value.beats.length ? `STRUCTURE BEATS:\n${value.beats.map((beat, index) => `${index + 1}. ${beat.label}${beat.targetPosition ? ` [${beat.targetPosition}]` : ""}: ${beat.purpose}`).join("\n")}` : "",
    "Treat this template as author-selected planning guidance, not canon. Adapt it to the author's idea and existing Project Brain truth; do not force a beat that contradicts explicit author intent.",
  ].filter(Boolean).join("\n\n");
}

export function builtInStoryArchitectureTemplates(): readonly StoryArchitectureTemplate[] {
  const createdAt = "2026-09-05T00:00:00.000Z";
  const entries: Omit<StoryArchitectureTemplate, "formatVersion" | "version" | "source" | "createdAt" | "updatedAt">[] = [
    {
      id: "builtin-three-act",
      title: "Three-Act Story",
      description: "A flexible setup, escalation, and resolution scaffold for novels, novellas, screen-style narratives, and commercial fiction.",
      bookKinds: ["novel", "novella", "fiction"],
      guidance: ["Establish protagonist, desire, stakes, and destabilizing problem early.", "Escalate consequences through meaningful reversals rather than repetitive obstacles.", "Make the climax resolve the central dramatic question through character choice."],
      beats: [
        { label: "Setup", targetPosition: "opening 20-25%", purpose: "Establish normal, desire, relationships, constraints, and the problem that makes the old equilibrium impossible." },
        { label: "Commitment", targetPosition: "around first quarter", purpose: "Force a consequential choice or threshold that commits the protagonist to the central conflict." },
        { label: "Escalation", targetPosition: "middle 50%", purpose: "Increase opposition, cost, discovery, and irreversible consequences while developing the central relationships." },
        { label: "Crisis", targetPosition: "late third quarter", purpose: "Confront the protagonist with the hardest consequence, failure, revelation, or sacrifice." },
        { label: "Climax and resolution", targetPosition: "final 20-25%", purpose: "Resolve the main dramatic question, pay off setup, and show the changed equilibrium." },
      ],
    },
    {
      id: "builtin-heroic-transformation",
      title: "Heroic Transformation",
      description: "A mythic transformation scaffold focused on departure, trials, insight, decisive ordeal, and a changed return.",
      bookKinds: ["novel", "fantasy", "adventure", "young-adult"],
      guidance: ["Keep external trials tied to an internal limitation or fear.", "Allies and mentors should change available choices, not solve the protagonist's central problem.", "The return should demonstrate transformation in behavior, not only state it."],
      beats: [
        { label: "Known world and call", targetPosition: "opening", purpose: "Show the existing life and introduce a disruption or invitation that demands change." },
        { label: "Threshold", targetPosition: "early", purpose: "Cross into conditions where old assumptions are no longer sufficient." },
        { label: "Trials and allies", targetPosition: "middle", purpose: "Build skills, relationships, failures, temptations, and discoveries that expose the deeper problem." },
        { label: "Ordeal and insight", targetPosition: "late middle", purpose: "Force a high-cost confrontation that changes what the protagonist understands or values." },
        { label: "Return transformed", targetPosition: "ending", purpose: "Resolve the external conflict and prove the internal change through action in a new equilibrium." },
      ],
    },
    {
      id: "builtin-mystery-investigation",
      title: "Mystery Investigation",
      description: "A clue-driven investigation scaffold that protects fair-play causality, suspect pressure, reversals, and a provable reveal.",
      bookKinds: ["mystery", "thriller", "crime", "novel"],
      guidance: ["Every major conclusion should be supported by discoverable evidence.", "Red herrings should be plausible interpretations of real facts, not author deception.", "Track what the investigator, culprit, and reader can know at each stage."],
      beats: [
        { label: "Disruption and question", targetPosition: "opening", purpose: "Present the crime, disappearance, secret, or anomaly and the question that drives investigation." },
        { label: "Suspect field", targetPosition: "early", purpose: "Establish motives, opportunities, contradictions, and the first evidence trail." },
        { label: "Complication and reversal", targetPosition: "middle", purpose: "Make evidence challenge the leading theory and increase personal or external stakes." },
        { label: "Convergence", targetPosition: "late", purpose: "Bring independent clues into a coherent explanation while the antagonist or hidden force pushes back." },
        { label: "Proof and reveal", targetPosition: "climax", purpose: "Demonstrate the solution from evidence, expose causality, and resolve remaining material consequences." },
      ],
    },
    {
      id: "builtin-romance-relationship-arc",
      title: "Romance Relationship Arc",
      description: "A relationship-first scaffold built around attraction, earned intimacy, meaningful barriers, rupture, and an emotionally credible commitment outcome.",
      bookKinds: ["romance", "romantic-fiction", "novel"],
      guidance: ["Develop both attraction and compatibility through specific shared experiences.", "The central barrier should matter to each person's values or circumstances rather than rely only on avoidable miscommunication.", "The ending should pay off the relationship question in a way consistent with the promised subgenre."],
      beats: [
        { label: "Connection", targetPosition: "opening", purpose: "Create a reason these people notice, need, challenge, or repeatedly encounter one another." },
        { label: "Growing intimacy", targetPosition: "early-middle", purpose: "Build trust, chemistry, vulnerability, and evidence of compatibility alongside meaningful friction." },
        { label: "Deepening stakes", targetPosition: "middle", purpose: "Make the relationship matter enough that loss or commitment has real emotional cost." },
        { label: "Rupture or impossible choice", targetPosition: "late", purpose: "Bring the core internal/external barrier to a point that cannot be ignored." },
        { label: "Earned commitment", targetPosition: "ending", purpose: "Resolve the relationship question through changed choices and a concrete emotional payoff." },
      ],
    },
    {
      id: "builtin-picture-book-emotional-arc",
      title: "Picture Book Emotional Arc",
      description: "A concise child-centered scaffold for picture books with repetition, visual turns, emotional clarity, and a gentle earned resolution.",
      bookKinds: ["picture-book", "children", "children-fiction"],
      guidance: ["Give each spread or scene a clear visual action, emotional shift, or discoverable detail.", "Use repetition with variation so the pattern grows rather than stalls.", "Keep the lesson embodied in character action and consequence instead of ending with a lecture."],
      beats: [
        { label: "Warm orientation", targetPosition: "opening spreads", purpose: "Introduce the child-facing character, place, desire, and readable emotional problem." },
        { label: "Pattern begins", targetPosition: "early", purpose: "Establish a repeatable attempt, obstacle, question, or journey readers can anticipate." },
        { label: "Escalating variations", targetPosition: "middle", purpose: "Repeat with meaningful visual and emotional changes that deepen the problem or understanding." },
        { label: "Heart turn", targetPosition: "late", purpose: "Create the decisive realization, act of empathy, brave choice, or relationship shift." },
        { label: "Comforting payoff", targetPosition: "final spreads", purpose: "Show the new emotional reality with a memorable image or callback and room for the reader to feel it." },
      ],
    },
    {
      id: "builtin-memoir-transformation",
      title: "Memoir Transformation",
      description: "A truth-preserving memoir scaffold organized around a present narrative question, formative episodes, changed understanding, and reflective meaning.",
      bookKinds: ["memoir", "autobiography", "narrative-nonfiction"],
      guidance: ["Separate remembered fact, sourced fact, uncertainty, and reconstructed connective prose.", "Choose episodes because they change the reader's understanding, not only because they happened.", "Reflection should emerge from specific lived scenes and acknowledged limits of memory."],
      beats: [
        { label: "Present question", targetPosition: "opening", purpose: "Establish the emotional or life question that gives selected memories meaning." },
        { label: "Origins", targetPosition: "early", purpose: "Show formative conditions and relationships without pretending hindsight was available at the time." },
        { label: "Pressure and pattern", targetPosition: "middle", purpose: "Reveal repeated choices, consequences, relationships, or systems that shaped the trajectory." },
        { label: "Turning point", targetPosition: "late", purpose: "Center the event or accumulation that changed action, identity, understanding, or direction." },
        { label: "Meaning without false closure", targetPosition: "ending", purpose: "Connect past and present while preserving uncertainty and unfinished truth where appropriate." },
      ],
    },
    {
      id: "builtin-nonfiction-problem-solution",
      title: "Nonfiction Problem → Practice → Result",
      description: "A practical nonfiction scaffold that moves from a defined reader problem through evidence, framework, application, and measurable next actions.",
      bookKinds: ["nonfiction", "how-to", "business", "self-development"],
      guidance: ["Define the reader and promised transformation precisely.", "Distinguish sourced claims from author experience and opinion.", "Each chapter should advance understanding or action rather than restate the premise."],
      beats: [
        { label: "Problem and promise", targetPosition: "opening", purpose: "Define the reader's situation, stakes, constraints, and what useful change the book can realistically help create." },
        { label: "Foundations", targetPosition: "early", purpose: "Teach the minimum concepts, evidence, vocabulary, and assumptions required for the method." },
        { label: "Framework", targetPosition: "middle", purpose: "Present the core method in an order the reader can understand and apply." },
        { label: "Practice and exceptions", targetPosition: "late middle", purpose: "Apply the framework to realistic cases, obstacles, edge cases, and tradeoffs." },
        { label: "Action and measurement", targetPosition: "ending", purpose: "Give concrete next steps, ways to evaluate progress, and boundaries around what the method cannot promise." },
      ],
    },
  ];

  return Object.freeze(entries.map((entry) => Object.freeze(validateTemplate({
    ...entry,
    formatVersion: STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION,
    version: 1,
    source: { kind: "built-in" },
    createdAt,
    updatedAt: createdAt,
  }))));
}

function latestEnvelopes(project: ProjectState): Map<string, StoredTemplateEnvelope> {
  const result = new Map<string, StoredTemplateEnvelope>();
  for (const memory of project.memories.filter((item) => item.relevanceTags.includes(TEMPLATE_TAG))) {
    const envelope = parseEnvelope(memory);
    const previous = result.get(envelope.template.id);
    if (!previous || envelope.template.version > previous.template.version || (envelope.template.version === previous.template.version && envelope.template.updatedAt > previous.template.updatedAt)) {
      result.set(envelope.template.id, envelope);
    }
  }
  return result;
}

function parseEnvelope(memory: MemoryRecord): StoredTemplateEnvelope {
  let parsed: unknown;
  try { parsed = JSON.parse(memory.content); }
  catch { throw new Error(`Story Architecture template memory "${memory.id}" contains invalid JSON.`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Story Architecture template memory "${memory.id}" is invalid.`);
  const row = parsed as Record<string, unknown>;
  if (row.formatVersion !== STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION || typeof row.deleted !== "boolean") throw new Error(`Story Architecture template memory "${memory.id}" has an unsupported envelope.`);
  return { formatVersion: STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION, template: validateTemplate(row.template), deleted: row.deleted };
}

function validateTemplate(value: unknown): StoryArchitectureTemplate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Story Architecture template must be an object.");
  const row = value as Record<string, unknown>;
  if (row.formatVersion !== STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION) throw new Error("Unsupported Story Architecture template format.");
  const source = validateSource(row.source);
  const version = positiveInteger(row.version, "Story Architecture template version", 1_000_000);
  const createdAt = timestamp(row.createdAt);
  const updatedAt = timestamp(row.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Story Architecture template updatedAt cannot precede createdAt.");
  return Object.freeze({
    formatVersion: STORY_ARCHITECTURE_TEMPLATE_FORMAT_VERSION,
    id: identifier(row.id, "Story Architecture template id"),
    title: requiredText(row.title, "Story Architecture template title", 160),
    description: optionalText(row.description, "Story Architecture template description", 4_000) ?? "",
    bookKinds: Object.freeze(textList(row.bookKinds, "Story Architecture template book kind", 30, 120)),
    guidance: Object.freeze(textList(row.guidance, "Story Architecture template guidance", 60, 2_000, 1)),
    beats: Object.freeze(beatList(row.beats)),
    version,
    source,
    createdAt,
    updatedAt,
  });
}

function validateSource(value: unknown): StoryArchitectureTemplateSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Story Architecture template source must be an object.");
  const row = value as Record<string, unknown>;
  if (row.kind !== "built-in" && row.kind !== "author" && row.kind !== "installed-copy") throw new Error("Invalid Story Architecture template source kind.");
  if (row.kind !== "installed-copy") return Object.freeze({ kind: row.kind });
  return Object.freeze({
    kind: "installed-copy",
    sourceTemplateId: identifier(row.sourceTemplateId, "Story Architecture source template id"),
    sourceTemplateVersion: positiveInteger(row.sourceTemplateVersion, "Story Architecture source template version", 1_000_000),
  });
}

function beatList(value: unknown): StoryArchitectureTemplateBeat[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) throw new Error("Story Architecture template requires 1 through 40 structure beats.");
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Story Architecture template beat ${index + 1} must be an object.`);
    const row = item as Record<string, unknown>;
    const targetPosition = optionalText(row.targetPosition, `Story Architecture template beat ${index + 1} target position`, 300);
    return Object.freeze({
      label: requiredText(row.label, `Story Architecture template beat ${index + 1} label`, 160),
      purpose: requiredText(row.purpose, `Story Architecture template beat ${index + 1} purpose`, 2_000),
      ...(targetPosition ? { targetPosition } : {}),
    });
  });
}

function textList(value: unknown, label: string, maxItems: number, maxLength: number, minItems = 0): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length < minItems || value.length > maxItems) throw new Error(`${label} requires ${minItems} through ${maxItems} items.`);
  return [...new Set(value.map((item) => requiredText(item, label, maxLength)))];
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value.trim())) throw new Error(`${label} may contain only letters, numbers, hyphens, and underscores.`);
  return value.trim();
}
function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return result;
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
function timestamp(value: unknown): string {
  const result = value === undefined ? new Date().toISOString() : String(value);
  if (!result.trim() || Number.isNaN(Date.parse(result))) throw new Error("Story Architecture template timestamp must be valid ISO-compatible time.");
  return new Date(Date.parse(result)).toISOString();
}
