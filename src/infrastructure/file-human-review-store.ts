import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  HUMAN_REVIEW_FORMAT_VERSION,
  createReviewComment,
  createReviewer,
  createReviewSuggestion,
  emptyHumanReviewState,
  markSuggestionApplied,
  resolveReviewComment,
  revokeReviewer,
  reviewSuggestion,
  validateHumanReviewState,
  verifyReviewToken,
  type HumanReviewComment,
  type HumanReviewer,
  type HumanReviewRole,
  type HumanReviewScope,
  type HumanReviewState,
  type HumanReviewSuggestion,
  type HumanReviewTarget,
  type HumanReviewSelection,
} from "../domain/human-review";

export class FileHumanReviewStore {
  private state: HumanReviewState = emptyHumanReviewState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Human review store path is required.");
  }

  async load(): Promise<HumanReviewState> {
    if (!this.loaded) {
      try {
        this.state = validateHumanReviewState(JSON.parse(await readFile(this.filePath, "utf8")));
      } catch (error) {
        if (!isMissingFile(error)) throw error;
        this.state = emptyHumanReviewState();
      }
      this.loaded = true;
    }
    return clone(this.state);
  }

  async listReviewers(projectId: string): Promise<HumanReviewer[]> {
    await this.load();
    return this.state.reviewers.filter((item) => item.projectId === projectId).map(clone);
  }

  async createReviewer(input: { id: string; projectId: string; displayName: string; role: HumanReviewRole; scope?: HumanReviewScope; now?: string }): Promise<{ reviewer: HumanReviewer; token: string }> {
    await this.load();
    if (this.state.reviewers.some((item) => item.id === input.id)) throw new Error(`Reviewer "${input.id}" already exists.`);
    const created = createReviewer(input);
    this.state = validateHumanReviewState({ ...this.state, reviewers: [...this.state.reviewers, created.reviewer] });
    await this.persist();
    return { reviewer: clone(created.reviewer), token: created.token };
  }

  async revokeReviewer(projectId: string, reviewerId: string, now?: string): Promise<HumanReviewer> {
    await this.load();
    const existing = this.state.reviewers.find((item) => item.id === reviewerId && item.projectId === projectId);
    if (!existing) throw new Error(`Reviewer "${reviewerId}" not found.`);
    const reviewer = revokeReviewer(existing, now);
    this.state = validateHumanReviewState({ ...this.state, reviewers: this.state.reviewers.map((item) => item.id === reviewerId ? reviewer : item) });
    await this.persist();
    return clone(reviewer);
  }

  async authenticate(projectId: string, token: string): Promise<HumanReviewer> {
    await this.load();
    for (const reviewer of this.state.reviewers) {
      if (reviewer.projectId === projectId && verifyReviewToken(reviewer, token)) return clone(reviewer);
    }
    throw new Error("Review token is invalid or revoked.");
  }

  async listComments(projectId: string): Promise<HumanReviewComment[]> {
    await this.load();
    return this.state.comments.filter((item) => item.projectId === projectId).map(clone);
  }

  async addComment(input: { id: string; projectId: string; reviewerId: string; target: HumanReviewTarget; body: string; selection?: HumanReviewSelection; now?: string }): Promise<HumanReviewComment> {
    await this.load();
    if (this.hasItemId(input.id)) throw new Error(`Human review item "${input.id}" already exists.`);
    const comment = createReviewComment(input);
    this.state = validateHumanReviewState({ ...this.state, comments: [...this.state.comments, comment] });
    await this.persist();
    return clone(comment);
  }

  async resolveComment(projectId: string, commentId: string, note?: string, now?: string): Promise<HumanReviewComment> {
    await this.load();
    const existing = this.state.comments.find((item) => item.id === commentId && item.projectId === projectId);
    if (!existing) throw new Error(`Review comment "${commentId}" not found.`);
    const comment = resolveReviewComment(existing, note, now);
    this.state = validateHumanReviewState({ ...this.state, comments: this.state.comments.map((item) => item.id === commentId ? comment : item) });
    await this.persist();
    return clone(comment);
  }

  async listSuggestions(projectId: string): Promise<HumanReviewSuggestion[]> {
    await this.load();
    return this.state.suggestions.filter((item) => item.projectId === projectId).map(clone);
  }

  async addSuggestion(input: { id: string; projectId: string; reviewerId: string; target: HumanReviewTarget; baseContentSha256: string; replacementContent: string; rationale: string; now?: string }): Promise<HumanReviewSuggestion> {
    await this.load();
    if (this.hasItemId(input.id)) throw new Error(`Human review item "${input.id}" already exists.`);
    const suggestion = createReviewSuggestion(input);
    this.state = validateHumanReviewState({ ...this.state, suggestions: [...this.state.suggestions, suggestion] });
    await this.persist();
    return clone(suggestion);
  }

  async reviewSuggestion(projectId: string, suggestionId: string, decision: "accepted" | "rejected", note?: string, now?: string): Promise<HumanReviewSuggestion> {
    await this.load();
    const existing = this.state.suggestions.find((item) => item.id === suggestionId && item.projectId === projectId);
    if (!existing) throw new Error(`Review suggestion "${suggestionId}" not found.`);
    const suggestion = reviewSuggestion(existing, decision, note, now);
    this.state = validateHumanReviewState({ ...this.state, suggestions: this.state.suggestions.map((item) => item.id === suggestionId ? suggestion : item) });
    await this.persist();
    return clone(suggestion);
  }

  async getSuggestion(projectId: string, suggestionId: string): Promise<HumanReviewSuggestion> {
    await this.load();
    const suggestion = this.state.suggestions.find((item) => item.id === suggestionId && item.projectId === projectId);
    if (!suggestion) throw new Error(`Review suggestion "${suggestionId}" not found.`);
    return clone(suggestion);
  }

  async markApplied(projectId: string, suggestionId: string, now?: string): Promise<HumanReviewSuggestion> {
    await this.load();
    const existing = this.state.suggestions.find((item) => item.id === suggestionId && item.projectId === projectId);
    if (!existing) throw new Error(`Review suggestion "${suggestionId}" not found.`);
    const suggestion = markSuggestionApplied(existing, now);
    this.state = validateHumanReviewState({ ...this.state, suggestions: this.state.suggestions.map((item) => item.id === suggestionId ? suggestion : item) });
    await this.persist();
    return clone(suggestion);
  }

  private hasItemId(id: string): boolean {
    return this.state.comments.some((item) => item.id === id) || this.state.suggestions.some((item) => item.id === id);
  }

  private async persist(): Promise<void> {
    const snapshot = clone(this.state);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporary, `${JSON.stringify({ ...snapshot, formatVersion: HUMAN_REVIEW_FORMAT_VERSION }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.filePath);
    });
    await this.writeChain;
  }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function isMissingFile(error: unknown): boolean { return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT"); }
