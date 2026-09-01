export const GUIDED_JOURNAL_FORMAT_VERSION = 1 as const;

export const JOURNAL_CATEGORIES = ["remember", "discover", "challenge", "create", "become", "hope"] as const;
export type JournalCategory = typeof JOURNAL_CATEGORIES[number];

export const JOURNAL_PAGE_STYLES = ["blank", "lined", "lightly-lined", "dot-grid", "guided-response"] as const;
export type JournalPageStyle = typeof JOURNAL_PAGE_STYLES[number];

export interface JournalPrompt {
  readonly id: string;
  readonly category: JournalCategory;
  readonly text: string;
  readonly tags: readonly string[];
  readonly enabled: boolean;
}

export interface JournalCoverStatement {
  readonly id: string;
  readonly text: string;
  readonly tags: readonly string[];
  readonly enabled: boolean;
}

export interface GuidedJournalPool {
  readonly promptIds?: readonly string[];
  readonly categories?: readonly JournalCategory[];
  readonly excludedPromptIds?: readonly string[];
}

export interface GuidedJournalGenerationRequest {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly seed: string;
  readonly promptCount: number;
  readonly promptLibrary: readonly JournalPrompt[];
  readonly coverStatements?: readonly JournalCoverStatement[];
  readonly pool?: GuidedJournalPool;
  readonly pageStyle?: JournalPageStyle;
  readonly responsePagesPerPrompt?: number;
  readonly includeCoverStatement?: boolean;
  readonly now?: string;
}

export interface GuidedJournalPromptPage {
  readonly sequence: number;
  readonly promptId: string;
  readonly category: JournalCategory;
  readonly prompt: string;
  readonly pageStyle: JournalPageStyle;
  readonly responsePages: number;
}

export interface GuidedJournalPlan {
  readonly formatVersion: typeof GUIDED_JOURNAL_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly seed: string;
  readonly generatedAt: string;
  readonly pageStyle: JournalPageStyle;
  readonly responsePagesPerPrompt: number;
  readonly coverStatement?: JournalCoverStatement;
  readonly prompts: readonly GuidedJournalPromptPage[];
  readonly categoryCounts: Readonly<Record<JournalCategory, number>>;
  readonly sourcePromptIds: readonly string[];
}

export function generateGuidedJournal(request: GuidedJournalGenerationRequest): GuidedJournalPlan {
  const id = requiredText(request.id, "Journal id");
  const projectId = requiredText(request.projectId, "Project id");
  const title = requiredText(request.title, "Journal title");
  const seed = requiredText(request.seed, "Journal seed");
  if (!Number.isInteger(request.promptCount) || request.promptCount < 1) throw new Error("Journal prompt count must be a positive integer.");
  const responsePages = request.responsePagesPerPrompt ?? 1;
  if (!Number.isInteger(responsePages) || responsePages < 1 || responsePages > 20) throw new Error("Response pages per prompt must be an integer from 1 to 20.");
  const pageStyle = request.pageStyle ?? "guided-response";
  if (!JOURNAL_PAGE_STYLES.includes(pageStyle)) throw new Error("Unsupported journal page style.");

  const library = validatePromptLibrary(request.promptLibrary);
  const eligible = applyPool(library, request.pool);
  if (eligible.length < request.promptCount) {
    throw new Error(`Journal requires ${request.promptCount} unique prompts but only ${eligible.length} are eligible.`);
  }

  const random = seededRandom(seed);
  const selected = balancedSelection(eligible, request.promptCount, random);
  const counts = emptyCategoryCounts();
  const prompts = selected.map((prompt, index) => {
    counts[prompt.category] += 1;
    return Object.freeze({
      sequence: index + 1,
      promptId: prompt.id,
      category: prompt.category,
      prompt: prompt.text,
      pageStyle,
      responsePages,
    });
  });

  const coverStatement = request.includeCoverStatement === false
    ? undefined
    : selectCoverStatement(request.coverStatements ?? [], random);

  return Object.freeze({
    formatVersion: GUIDED_JOURNAL_FORMAT_VERSION,
    id,
    projectId,
    title,
    ...(request.subtitle?.trim() ? { subtitle: request.subtitle.trim() } : {}),
    seed,
    generatedAt: new Date(request.now ?? new Date().toISOString()).toISOString(),
    pageStyle,
    responsePagesPerPrompt: responsePages,
    ...(coverStatement ? { coverStatement } : {}),
    prompts: Object.freeze(prompts),
    categoryCounts: Object.freeze({ ...counts }),
    sourcePromptIds: Object.freeze(prompts.map((item) => item.promptId)),
  });
}

export function validatePromptLibrary(prompts: readonly JournalPrompt[]): readonly JournalPrompt[] {
  if (!Array.isArray(prompts) || !prompts.length) throw new Error("Guided Journal prompt library cannot be empty.");
  const ids = new Set<string>();
  return prompts.map((prompt) => {
    const id = requiredText(prompt.id, "Prompt id");
    const text = requiredText(prompt.text, `Prompt ${id} text`);
    if (!JOURNAL_CATEGORIES.includes(prompt.category)) throw new Error(`Prompt "${id}" has an invalid category.`);
    if (ids.has(id)) throw new Error(`Duplicate journal prompt id "${id}".`);
    ids.add(id);
    return Object.freeze({
      id,
      category: prompt.category,
      text,
      tags: Object.freeze(uniqueStrings(prompt.tags ?? [])),
      enabled: prompt.enabled !== false,
    });
  });
}

export function validateCoverStatementLibrary(statements: readonly JournalCoverStatement[]): readonly JournalCoverStatement[] {
  const ids = new Set<string>();
  return statements.map((statement) => {
    const id = requiredText(statement.id, "Cover statement id");
    const text = requiredText(statement.text, `Cover statement ${id} text`);
    if (ids.has(id)) throw new Error(`Duplicate journal cover statement id "${id}".`);
    ids.add(id);
    return Object.freeze({ id, text, tags: Object.freeze(uniqueStrings(statement.tags ?? [])), enabled: statement.enabled !== false });
  });
}

function applyPool(library: readonly JournalPrompt[], pool?: GuidedJournalPool): JournalPrompt[] {
  const includeIds = pool?.promptIds?.length ? new Set(pool.promptIds.map((id) => id.trim()).filter(Boolean)) : undefined;
  const categories = pool?.categories?.length ? new Set(pool.categories) : undefined;
  const excluded = new Set((pool?.excludedPromptIds ?? []).map((id) => id.trim()).filter(Boolean));
  if (categories) for (const category of categories) if (!JOURNAL_CATEGORIES.includes(category)) throw new Error(`Invalid journal pool category "${category}".`);
  if (includeIds) {
    const known = new Set(library.map((prompt) => prompt.id));
    for (const id of includeIds) if (!known.has(id)) throw new Error(`Journal pool references missing prompt "${id}".`);
  }
  return library.filter((prompt) => prompt.enabled && !excluded.has(prompt.id) && (!includeIds || includeIds.has(prompt.id)) && (!categories || categories.has(prompt.category)));
}

function balancedSelection(eligible: readonly JournalPrompt[], count: number, random: () => number): JournalPrompt[] {
  const byCategory = new Map<JournalCategory, JournalPrompt[]>();
  for (const category of JOURNAL_CATEGORIES) byCategory.set(category, []);
  for (const prompt of eligible) byCategory.get(prompt.category)!.push(prompt);
  for (const category of JOURNAL_CATEGORIES) shuffle(byCategory.get(category)!, random);

  const active = JOURNAL_CATEGORIES.filter((category) => byCategory.get(category)!.length > 0);
  if (!active.length) throw new Error("No enabled guided journal prompts are eligible.");
  shuffle(active, random);

  const selected: JournalPrompt[] = [];
  let cursor = 0;
  while (selected.length < count) {
    let selectedThisPass = false;
    for (let offset = 0; offset < active.length && selected.length < count; offset++) {
      const category = active[(cursor + offset) % active.length];
      const bucket = byCategory.get(category)!;
      if (!bucket.length) continue;
      selected.push(bucket.shift()!);
      selectedThisPass = true;
    }
    if (!selectedThisPass) break;
    cursor = (cursor + 1) % active.length;
  }
  if (selected.length !== count) throw new Error("Unable to select enough unique guided journal prompts.");
  return selected;
}

function selectCoverStatement(statements: readonly JournalCoverStatement[], random: () => number): JournalCoverStatement | undefined {
  const eligible = validateCoverStatementLibrary(statements).filter((statement) => statement.enabled);
  if (!eligible.length) return undefined;
  const selected = eligible[Math.floor(random() * eligible.length)];
  return Object.freeze({ ...selected, tags: Object.freeze([...selected.tags]) });
}

function emptyCategoryCounts(): Record<JournalCategory, number> {
  return { remember: 0, discover: 0, challenge: 0, create: 0, become: 0, hope: 0 };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function requiredText(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
