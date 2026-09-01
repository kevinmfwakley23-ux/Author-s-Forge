import type { JournalCoverStatement, JournalPrompt } from "../domain/guided-journal";
import { GUIDED_JOURNAL_LIBRARY_STORE_VERSION, FileGuidedJournalLibraryStore, type GuidedJournalLibrarySnapshot } from "../infrastructure/file-guided-journal-library-store";

export class GuidedJournalLibraryService {
  constructor(private readonly store: FileGuidedJournalLibraryStore) {}

  async get(projectId: string): Promise<GuidedJournalLibrarySnapshot> {
    return this.store.get(projectId);
  }

  async upsertPrompts(projectId: string, prompts: readonly JournalPrompt[], now = new Date().toISOString()): Promise<GuidedJournalLibrarySnapshot> {
    const current = await this.store.get(projectId);
    const byId = new Map(current.prompts.map((prompt) => [prompt.id, prompt]));
    for (const prompt of prompts) byId.set(prompt.id, prompt);
    return this.store.save({ formatVersion: GUIDED_JOURNAL_LIBRARY_STORE_VERSION, projectId, prompts: [...byId.values()], coverStatements: current.coverStatements, updatedAt: now });
  }

  async upsertCoverStatements(projectId: string, statements: readonly JournalCoverStatement[], now = new Date().toISOString()): Promise<GuidedJournalLibrarySnapshot> {
    const current = await this.store.get(projectId);
    const byId = new Map(current.coverStatements.map((statement) => [statement.id, statement]));
    for (const statement of statements) byId.set(statement.id, statement);
    return this.store.save({ formatVersion: GUIDED_JOURNAL_LIBRARY_STORE_VERSION, projectId, prompts: current.prompts, coverStatements: [...byId.values()], updatedAt: now });
  }

  async setPromptEnabled(projectId: string, promptId: string, enabled: boolean, now = new Date().toISOString()): Promise<GuidedJournalLibrarySnapshot> {
    const current = await this.store.get(projectId);
    const found = current.prompts.some((prompt) => prompt.id === promptId);
    if (!found) throw new Error(`Guided Journal prompt "${promptId}" not found.`);
    return this.store.save({
      formatVersion: GUIDED_JOURNAL_LIBRARY_STORE_VERSION,
      projectId,
      prompts: current.prompts.map((prompt) => prompt.id === promptId ? { ...prompt, enabled } : prompt),
      coverStatements: current.coverStatements,
      updatedAt: now,
    });
  }

  async setCoverStatementEnabled(projectId: string, statementId: string, enabled: boolean, now = new Date().toISOString()): Promise<GuidedJournalLibrarySnapshot> {
    const current = await this.store.get(projectId);
    const found = current.coverStatements.some((statement) => statement.id === statementId);
    if (!found) throw new Error(`Guided Journal cover statement "${statementId}" not found.`);
    return this.store.save({
      formatVersion: GUIDED_JOURNAL_LIBRARY_STORE_VERSION,
      projectId,
      prompts: current.prompts,
      coverStatements: current.coverStatements.map((statement) => statement.id === statementId ? { ...statement, enabled } : statement),
      updatedAt: now,
    });
  }

  async removePrompt(projectId: string, promptId: string, now = new Date().toISOString()): Promise<GuidedJournalLibrarySnapshot> {
    const current = await this.store.get(projectId);
    if (!current.prompts.some((prompt) => prompt.id === promptId)) throw new Error(`Guided Journal prompt "${promptId}" not found.`);
    return this.store.save({ formatVersion: GUIDED_JOURNAL_LIBRARY_STORE_VERSION, projectId, prompts: current.prompts.filter((prompt) => prompt.id !== promptId), coverStatements: current.coverStatements, updatedAt: now });
  }

  async removeCoverStatement(projectId: string, statementId: string, now = new Date().toISOString()): Promise<GuidedJournalLibrarySnapshot> {
    const current = await this.store.get(projectId);
    if (!current.coverStatements.some((statement) => statement.id === statementId)) throw new Error(`Guided Journal cover statement "${statementId}" not found.`);
    return this.store.save({ formatVersion: GUIDED_JOURNAL_LIBRARY_STORE_VERSION, projectId, prompts: current.prompts, coverStatements: current.coverStatements.filter((statement) => statement.id !== statementId), updatedAt: now });
  }
}
