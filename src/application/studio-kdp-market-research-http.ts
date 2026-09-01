import type { StudioKdpMarketResearchService } from "./studio-kdp-market-research";

export async function runStudioMarketResearchFromHttp(service: StudioKdpMarketResearchService, projectId: string, input: unknown) {
  const request = objectInput(input, "Market research request");
  return service.run(projectId, {
    bookId: optionalText(request.bookId, "Market research book id"),
    question: requiredText(request.question, "Market research question"),
    market: requiredText(request.market, "Market research market"),
    reportId: optionalText(request.reportId, "Market research report id"),
    now: optionalTimestamp(request.now, "Market research timestamp"),
  });
}

export async function listStudioMarketResearchFromHttp(service: StudioKdpMarketResearchService, projectId: string, bookId?: unknown) {
  return { projectId, reports: await service.list(projectId, optionalText(bookId, "Market research book id")) };
}

export async function applyStudioMarketKeywordsFromHttp(service: StudioKdpMarketResearchService, projectId: string, input: unknown) {
  const request = objectInput(input, "Market keyword application request");
  if (request.authorApproved !== true) throw new Error("Explicit author approval is required before applying market-research keywords.");
  return service.applyKeywords(projectId, {
    bookId: requiredText(request.bookId, "Book id"),
    reportId: requiredText(request.reportId, "Market research report id"),
    authorApproved: true,
    ...(request.phrases === undefined ? {} : { phrases: stringArray(request.phrases, "Market keyword phrases") }),
    ...(request.now === undefined ? {} : { now: optionalTimestamp(request.now, "Market keyword application timestamp")! }),
  });
}

function objectInput(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as Record<string, unknown>;
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function optionalText(value: unknown, label: string): string | undefined {
  return value === undefined || value === null || value === "" ? undefined : requiredText(value, label);
}
function optionalTimestamp(value: unknown, label: string): string | undefined {
  const text = optionalText(value, label);
  if (text === undefined) return undefined;
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(Date.parse(text)).toISOString();
}
function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const phrases = value.map((item) => requiredText(item, label));
  return [...new Set(phrases)];
}
