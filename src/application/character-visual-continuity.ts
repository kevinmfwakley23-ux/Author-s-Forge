import { createVisualCharacterIdentity, generateVisualCharacterIdentityPackage, resolveVisualCharacterIdentity, updateVisualCharacterIdentity, validateVisualCharacterIdentity, type VisualCharacterIdentity, type VisualIdentityPackage, type VisualIdentityState, type VisualIdentityUpdateInput } from "../domain/character-visual-continuity";

export interface VisualIdentityQuery { readonly projectId?: string; readonly characterId?: string; readonly seriesId?: string; }

export class CharacterVisualContinuityService {
  private readonly records = new Map<string, VisualCharacterIdentity>();

  create(input: { id: string; projectId: string; characterId: string; seriesId: string; state: VisualIdentityState; now?: string }): VisualCharacterIdentity {
    const identity = createVisualCharacterIdentity(input);
    if (this.records.has(identity.id)) throw new Error(`Duplicate visual identity id "${identity.id}".`);
    if ([...this.records.values()].some((item) => item.projectId === identity.projectId && item.characterId === identity.characterId)) throw new Error(`Visual identity already exists for character "${identity.characterId}".`);
    this.records.set(identity.id, identity);
    return clone(identity);
  }
  get(identityId: string): VisualCharacterIdentity | undefined { const value = this.records.get(identityId); return value ? clone(value) : undefined; }
  require(identityId: string): VisualCharacterIdentity { const value = this.records.get(identityId); if (!value) throw new Error(`Visual identity "${identityId}" not found.`); return clone(value); }
  update(input: VisualIdentityUpdateInput): VisualCharacterIdentity { const existing = this.records.get(input.identityId); if (!existing) throw new Error(`Visual identity "${input.identityId}" not found.`); const updated = updateVisualCharacterIdentity(existing, input); this.records.set(updated.id, updated); return clone(updated); }
  resolve(identityId: string, storyOrder: number): VisualIdentityState { return resolveVisualCharacterIdentity(this.require(identityId), storyOrder); }
  generatePackage(identityId: string, storyOrder: number, generatedAt?: string): VisualIdentityPackage { return generateVisualCharacterIdentityPackage(this.require(identityId), storyOrder, generatedAt); }
  list(query: VisualIdentityQuery = {}): VisualCharacterIdentity[] { return [...this.records.values()].filter((item) => (query.projectId === undefined || item.projectId === query.projectId) && (query.characterId === undefined || item.characterId === query.characterId) && (query.seriesId === undefined || item.seriesId === query.seriesId)).sort((a, b) => a.id.localeCompare(b.id)).map(clone); }
  restore(records: readonly VisualCharacterIdentity[]): void { this.records.clear(); for (const record of records) { const identity = validateVisualCharacterIdentity(record); if (this.records.has(identity.id)) throw new Error(`Duplicate visual identity id "${identity.id}".`); if ([...this.records.values()].some((item) => item.projectId === identity.projectId && item.characterId === identity.characterId)) throw new Error(`Visual identity already exists for character "${identity.characterId}".`); this.records.set(identity.id, clone(identity)); } }
  restoreProject(projectId: string, records: readonly VisualCharacterIdentity[]): void { if (!projectId.trim()) throw new Error("Project id is required."); if (records.some((record) => record.projectId !== projectId)) throw new Error("Visual identity state contains an identity from another project."); this.restore(records); }
  toPortableState(projectId?: string): readonly VisualCharacterIdentity[] { return this.list({ projectId }); }
}
function clone(identity: VisualCharacterIdentity): VisualCharacterIdentity { return validateVisualCharacterIdentity(JSON.parse(JSON.stringify(identity))); }
