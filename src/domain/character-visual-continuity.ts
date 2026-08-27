export const VISUAL_IDENTITY_FORMAT_VERSION = 1 as const;
export const VISUAL_REFERENCE_KINDS = ["face", "body", "wardrobe", "hairstyle", "pose"] as const;
export type VisualReferenceKind = typeof VISUAL_REFERENCE_KINDS[number];

export interface VisualReference { readonly id: string; readonly kind: VisualReferenceKind; readonly uri: string; readonly label: string; readonly notes: string; }
export interface VisualIdentityState {
  readonly distinguishingMarks: readonly string[];
  readonly scars: readonly string[];
  readonly tattoos: readonly string[];
  readonly accessories: readonly string[];
  readonly colorPalette: readonly string[];
  readonly artisticStyle: string;
  readonly wardrobe: readonly string[];
  readonly hairstyle: string;
  readonly age: number;
  readonly faceReferences: readonly VisualReference[];
  readonly bodyReferences: readonly VisualReference[];
  readonly poseReferences: readonly VisualReference[];
}
export interface VisualIdentitySnapshot extends VisualIdentityState { readonly storyOrder: number; readonly effectiveAt: string; readonly sequence: number; readonly reason: string; readonly actor: "author" | "system"; }
export interface VisualCharacterIdentity {
  readonly formatVersion: typeof VISUAL_IDENTITY_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly characterId: string;
  readonly seriesId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly base: VisualIdentityState;
  readonly snapshots: readonly VisualIdentitySnapshot[];
}
export interface VisualIdentityUpdateInput { readonly identityId: string; readonly state: Partial<VisualIdentityState>; readonly storyOrder: number; readonly effectiveAt?: string; readonly reason: string; readonly actor?: "author" | "system"; }
export interface VisualIdentityPackage { readonly packageVersion: typeof VISUAL_IDENTITY_FORMAT_VERSION; readonly identityId: string; readonly projectId: string; readonly characterId: string; readonly seriesId: string; readonly generatedAt: string; readonly storyOrder: number; readonly identity: VisualIdentityState; readonly references: readonly VisualReference[]; readonly continuity: readonly VisualIdentitySnapshot[]; }

export function createVisualCharacterIdentity(input: { id: string; projectId: string; characterId: string; seriesId: string; state: VisualIdentityState; now?: string }): VisualCharacterIdentity {
  identifier(input.id, "Visual identity id"); identifier(input.projectId, "Visual identity project id"); identifier(input.characterId, "Visual identity character id"); identifier(input.seriesId, "Visual identity series id");
  const now = timestamp(input.now ?? new Date().toISOString(), "Visual identity timestamp");
  const base = normalizeState(input.state);
  return { formatVersion: VISUAL_IDENTITY_FORMAT_VERSION, id: input.id, projectId: input.projectId, characterId: input.characterId, seriesId: input.seriesId, createdAt: now, updatedAt: now, base, snapshots: [] };
}

export function updateVisualCharacterIdentity(identity: VisualCharacterIdentity, input: VisualIdentityUpdateInput): VisualCharacterIdentity {
  if (identity.id !== input.identityId) throw new Error("Visual identity update id does not match the identity.");
  if (!Number.isInteger(input.storyOrder) || input.storyOrder < 0) throw new Error("Visual identity story order must be a non-negative integer.");
  const effectiveAt = timestamp(input.effectiveAt ?? new Date().toISOString(), "Visual identity update timestamp");
  const reason = text(input.reason, "Visual identity update reason");
  const actor = input.actor ?? "author";
  const current = resolveVisualCharacterIdentity(identity, input.storyOrder);
  const next = normalizePartialState(input.state, current);
  if (JSON.stringify(current) === JSON.stringify(next)) throw new Error("Visual identity update does not change visual state.");
  const sequence = identity.snapshots.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
  const snapshot: VisualIdentitySnapshot = { ...next, storyOrder: input.storyOrder, effectiveAt, sequence, reason, actor };
  return { ...identity, updatedAt: effectiveAt > identity.updatedAt ? effectiveAt : identity.updatedAt, snapshots: [...identity.snapshots, snapshot].sort(compareSnapshots) };
}

export function resolveVisualCharacterIdentity(identity: VisualCharacterIdentity, storyOrder: number): VisualIdentityState {
  if (!Number.isInteger(storyOrder) || storyOrder < 0) throw new Error("Visual identity story order must be a non-negative integer.");
  let state = cloneState(identity.base);
  for (const snapshot of [...identity.snapshots].sort(compareSnapshots)) {
    if (snapshot.storyOrder > storyOrder) break;
    state = cloneState(snapshot);
  }
  return state;
}

export function generateVisualCharacterIdentityPackage(identity: VisualCharacterIdentity, storyOrder: number, generatedAt?: string): VisualIdentityPackage {
  const state = resolveVisualCharacterIdentity(identity, storyOrder);
  const references = [...state.faceReferences, ...state.bodyReferences, ...state.poseReferences];
  return { packageVersion: VISUAL_IDENTITY_FORMAT_VERSION, identityId: identity.id, projectId: identity.projectId, characterId: identity.characterId, seriesId: identity.seriesId, generatedAt: timestamp(generatedAt ?? new Date().toISOString(), "Visual package timestamp"), storyOrder, identity: state, references: references.map(cloneReference), continuity: identity.snapshots.map(cloneSnapshot) };
}

export function validateVisualCharacterIdentity(value: unknown): VisualCharacterIdentity {
  if (!value || typeof value !== "object") throw new Error("Invalid visual character identity.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== VISUAL_IDENTITY_FORMAT_VERSION) throw new Error("Unsupported visual character identity format.");
  for (const field of ["id", "projectId", "characterId", "seriesId"] as const) if (typeof candidate[field] !== "string") throw new Error(`Visual identity ${field} is required.`);
  identifier(candidate.id as string, "Visual identity id"); identifier(candidate.projectId as string, "Visual identity project id"); identifier(candidate.characterId as string, "Visual identity character id"); identifier(candidate.seriesId as string, "Visual identity series id");
  const createdAt = timestamp(String(candidate.createdAt), "Visual identity createdAt"); const updatedAt = timestamp(String(candidate.updatedAt), "Visual identity updatedAt");
  if (updatedAt < createdAt) throw new Error("Visual identity updatedAt cannot precede createdAt.");
  const base = normalizeState(candidate.base as VisualIdentityState);
  if (!Array.isArray(candidate.snapshots)) throw new Error("Visual identity snapshots are required.");
  const snapshots = candidate.snapshots.map(validateSnapshot);
  const sequences = new Set<number>(); for (const snapshot of snapshots) { if (sequences.has(snapshot.sequence)) throw new Error("Visual identity snapshot sequence must be unique."); sequences.add(snapshot.sequence); }
  return { formatVersion: VISUAL_IDENTITY_FORMAT_VERSION, id: candidate.id as string, projectId: candidate.projectId as string, characterId: candidate.characterId as string, seriesId: candidate.seriesId as string, createdAt, updatedAt, base, snapshots: snapshots.sort(compareSnapshots) };
}

function validateSnapshot(value: unknown): VisualIdentitySnapshot {
  if (!value || typeof value !== "object") throw new Error("Invalid visual identity snapshot.");
  const item = value as Record<string, unknown>;
  if (!Number.isInteger(item.storyOrder) || (item.storyOrder as number) < 0) throw new Error("Visual identity snapshot story order must be a non-negative integer.");
  if (!Number.isInteger(item.sequence) || (item.sequence as number) < 1) throw new Error("Visual identity snapshot sequence must be positive.");
  if (item.actor !== "author" && item.actor !== "system") throw new Error("Invalid visual identity snapshot actor.");
  const state = normalizeState(item as unknown as VisualIdentityState);
  return { ...state, storyOrder: item.storyOrder as number, effectiveAt: timestamp(String(item.effectiveAt), "Visual identity snapshot timestamp"), sequence: item.sequence as number, reason: text(String(item.reason), "Visual identity snapshot reason"), actor: item.actor as "author" | "system" };
}
function normalizeState(state: VisualIdentityState): VisualIdentityState {
  if (!state || typeof state !== "object") throw new Error("Visual identity state is required.");
  return { distinguishingMarks: stringArray(state.distinguishingMarks, "distinguishing marks"), scars: stringArray(state.scars, "scars"), tattoos: stringArray(state.tattoos, "tattoos"), accessories: stringArray(state.accessories, "accessories"), colorPalette: stringArray(state.colorPalette, "color palette"), artisticStyle: text(state.artisticStyle, "artistic style"), wardrobe: stringArray(state.wardrobe, "wardrobe"), hairstyle: text(state.hairstyle, "hairstyle"), age: nonNegativeInteger(state.age, "visual age"), faceReferences: references(state.faceReferences, "face references", "face"), bodyReferences: references(state.bodyReferences, "body references", "body"), poseReferences: references(state.poseReferences, "pose references", "pose") };
}
function normalizePartialState(changes: Partial<VisualIdentityState>, current: VisualIdentityState): VisualIdentityState { return normalizeState({ ...current, ...changes } as VisualIdentityState); }
function stringArray(value: readonly string[], label: string): readonly string[] { if (!Array.isArray(value)) throw new Error(`Visual identity ${label} must be an array.`); return [...new Set(value.map((item) => text(item, `Visual identity ${label} entry`)))]; }
function references(value: readonly VisualReference[], label: string, kind: VisualReferenceKind): readonly VisualReference[] { if (!Array.isArray(value)) throw new Error(`Visual identity ${label} must be an array.`); return value.map((item) => { if (!item || typeof item !== "object") throw new Error(`Invalid ${label} entry.`); const ref = item as VisualReference; if (ref.kind !== kind) throw new Error(`Visual reference ${ref.id ?? ""} must be a ${kind} reference.`); identifier(ref.id, `${kind} reference id`); const uri = text(ref.uri, `${kind} reference uri`); const labelText = text(ref.label, `${kind} reference label`); const notes = text(ref.notes, `${kind} reference notes`); return { id: ref.id, kind, uri, label: labelText, notes }; }); }
function cloneState(state: VisualIdentityState): VisualIdentityState { return { ...state, distinguishingMarks: [...state.distinguishingMarks], scars: [...state.scars], tattoos: [...state.tattoos], accessories: [...state.accessories], colorPalette: [...state.colorPalette], wardrobe: [...state.wardrobe], hairstyle: state.hairstyle, age: state.age, faceReferences: state.faceReferences.map(cloneReference), bodyReferences: state.bodyReferences.map(cloneReference), poseReferences: state.poseReferences.map(cloneReference) }; }
function cloneReference(reference: VisualReference): VisualReference { return { ...reference }; }
function cloneSnapshot(snapshot: VisualIdentitySnapshot): VisualIdentitySnapshot { return { ...cloneState(snapshot), storyOrder: snapshot.storyOrder, effectiveAt: snapshot.effectiveAt, sequence: snapshot.sequence, reason: snapshot.reason, actor: snapshot.actor }; }
function compareSnapshots(a: VisualIdentitySnapshot, b: VisualIdentitySnapshot): number { return a.storyOrder - b.storyOrder || Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || a.sequence - b.sequence; }
function nonNegativeInteger(value: number, label: string): number { if (!Number.isInteger(value) || value < 0) throw new Error(`Visual identity ${label} must be a non-negative integer.`); return value; }
function identifier(value: string, label: string): string { if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} is required and cannot have surrounding whitespace.`); return value; }
function text(value: string, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function timestamp(value: string, label: string): string { if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`); return new Date(value).toISOString(); }
