import { createHash } from "node:crypto";

export interface SessionDedupInput { readonly sessionId: string; readonly system: string; readonly user: string; }
export interface SessionDedupResult { readonly system: string; readonly user: string; readonly removedBlocks: number; readonly removedCharacters: number; readonly strategy: readonly string[]; }
interface SessionState { readonly seen: Set<string>; }

/** Content-addressed derived optimization state; never mutates canonical project data. */
export class ContextSessionDeduplicator {
  private readonly sessions = new Map<string, SessionState>();
  constructor(private readonly maxSessions = 128) {}

  optimize(input: SessionDedupInput): SessionDedupResult {
    const sessionId = input.sessionId.trim();
    if (!sessionId) return { ...input, removedBlocks: 0, removedCharacters: 0, strategy: ["session-dedup-no-session"] };
    const state = this.getSession(sessionId);
    const system = this.deduplicateBlocks(input.system, state);
    const user = this.deduplicateBlocks(input.user, state);
    const removedCharacters = input.system.length + input.user.length - system.text.length - user.text.length;
    const removedBlocks = system.removedBlocks + user.removedBlocks;
    return { system: system.text, user: user.text, removedBlocks, removedCharacters, strategy: removedBlocks > 0 ? ["session-dedup", `session-dedup-blocks:${removedBlocks}`] : ["session-dedup-no-op"] };
  }

  clear(sessionId: string): void { this.sessions.delete(sessionId); }
  clearAll(): void { this.sessions.clear(); }

  private getSession(sessionId: string): SessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    if (this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (oldest) this.sessions.delete(oldest);
    }
    const created: SessionState = { seen: new Set() };
    this.sessions.set(sessionId, created);
    return created;
  }

  private deduplicateBlocks(text: string, state: SessionState): { text: string; removedBlocks: number } {
    const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    if (blocks.length < 2) {
      const normalized = text.trim();
      const key = this.key(normalized);
      if (normalized.length >= 64 && state.seen.has(key)) return { text: "", removedBlocks: 1 };
      if (normalized.length >= 64) state.seen.add(key);
      return { text, removedBlocks: 0 };
    }
    const kept: string[] = [];
    let removedBlocks = 0;
    for (const block of blocks) {
      const key = this.key(block);
      if (block.length >= 64 && state.seen.has(key)) { removedBlocks += 1; continue; }
      if (block.length >= 64) state.seen.add(key);
      kept.push(block);
    }
    return { text: kept.join("\n\n"), removedBlocks };
  }

  private key(value: string): string { return createHash("sha256").update(value).digest("hex"); }
}
