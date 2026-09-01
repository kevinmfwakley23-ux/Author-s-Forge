import { randomUUID } from "node:crypto";
import { withProjectKdpMarketIntelligenceReports, type ProjectState } from "../domain/project";
import { validateKdpMarketIntelligenceReport, type KdpMarketIntelligenceReport } from "../domain/kdp-market-intelligence";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { KdpMarketIntelligenceService, type KdpMarketIntelligenceProvider } from "./kdp-market-intelligence";
import { StudioPublishingMetadataService, type PublishingMetadataState } from "./studio-publishing-metadata";

export interface RunStudioMarketResearchInput {
  readonly bookId?: string;
  readonly question: string;
  readonly market: string;
  readonly reportId?: string;
  readonly now?: string;
}

export class StudioKdpMarketResearchService {
  private readonly research: KdpMarketIntelligenceService;
  private readonly publishing: StudioPublishingMetadataService;

  public constructor(
    private readonly store: FileProjectStore,
    provider: KdpMarketIntelligenceProvider,
    publishing = new StudioPublishingMetadataService(store),
  ) {
    this.research = new KdpMarketIntelligenceService(provider);
    this.publishing = publishing;
  }

  public async run(projectId: string, input: RunStudioMarketResearchInput): Promise<KdpMarketIntelligenceReport> {
    const project = await this.load(projectId);
    const bookId = input.bookId?.trim() || undefined;
    if (bookId) this.requireBook(project, bookId);
    const reportId = input.reportId?.trim() || `market-${randomUUID()}`;
    if ((project.kdpMarketIntelligenceReports ?? []).some((report) => report.id === reportId)) throw new Error(`Market research report "${reportId}" already exists.`);
    const report = await this.research.research({
      id: reportId,
      projectId,
      ...(bookId ? { bookId } : {}),
      question: required(input.question, "Market research question"),
      market: required(input.market, "Market research market"),
    });
    const persistedReport = validateKdpMarketIntelligenceReport({ ...report, researchedAt: input.now ?? report.researchedAt });
    const reports = [...(project.kdpMarketIntelligenceReports ?? []), persistedReport];
    await this.store.save(withProjectKdpMarketIntelligenceReports(project, reports, input.now ?? persistedReport.researchedAt));
    const persisted = await this.load(projectId);
    const saved = persisted.kdpMarketIntelligenceReports?.find((item) => item.id === persistedReport.id);
    if (!saved) throw new Error("Market research completed but the report was not durably preserved.");
    return validateKdpMarketIntelligenceReport(saved);
  }

  public async list(projectId: string, bookId?: string): Promise<readonly KdpMarketIntelligenceReport[]> {
    const project = await this.load(projectId);
    const scope = bookId?.trim();
    if (scope) this.requireBook(project, scope);
    return (project.kdpMarketIntelligenceReports ?? [])
      .filter((report) => !scope || report.bookId === scope)
      .map(validateKdpMarketIntelligenceReport)
      .sort((left, right) => right.researchedAt.localeCompare(left.researchedAt));
  }

  public async get(projectId: string, reportId: string): Promise<KdpMarketIntelligenceReport> {
    const project = await this.load(projectId);
    const id = required(reportId, "Market research report id");
    const report = project.kdpMarketIntelligenceReports?.find((item) => item.id === id);
    if (!report) throw new Error(`Market research report "${id}" was not found.`);
    return validateKdpMarketIntelligenceReport(report);
  }

  public async applyKeywords(
    projectId: string,
    input: { readonly bookId: string; readonly reportId: string; readonly authorApproved: boolean; readonly phrases?: readonly string[]; readonly now?: string },
  ): Promise<PublishingMetadataState> {
    const bookId = required(input.bookId, "Book id");
    const report = await this.get(projectId, input.reportId);
    return this.publishing.applyMarketKeywords(projectId, bookId, report, {
      authorApproved: input.authorApproved,
      ...(input.phrases ? { phrases: input.phrases } : {}),
      ...(input.now ? { now: input.now } : {}),
    });
  }

  private async load(projectId: string): Promise<ProjectState> {
    const id = required(projectId, "Project id");
    const project = await this.store.load(id);
    if (!project) throw new Error(`Project "${id}" was not found.`);
    return project;
  }

  private requireBook(project: ProjectState, bookId: string) {
    if (!project.studioWorkspace) throw new Error("Project has no Studio workspace.");
    return getBook(validateStudioWorkspace(project.studioWorkspace), bookId);
  }
}

function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
