"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VISUAL_REFERENCE_KINDS = exports.VISUAL_IDENTITY_FORMAT_VERSION = void 0;
exports.createVisualCharacterIdentity = createVisualCharacterIdentity;
exports.updateVisualCharacterIdentity = updateVisualCharacterIdentity;
exports.resolveVisualCharacterIdentity = resolveVisualCharacterIdentity;
exports.generateVisualCharacterIdentityPackage = generateVisualCharacterIdentityPackage;
exports.validateVisualCharacterIdentity = validateVisualCharacterIdentity;
exports.VISUAL_IDENTITY_FORMAT_VERSION = 1;
exports.VISUAL_REFERENCE_KINDS = ["face", "body", "wardrobe", "hairstyle", "pose"];
function createVisualCharacterIdentity(input) {
    identifier(input.id, "Visual identity id");
    identifier(input.projectId, "Visual identity project id");
    identifier(input.characterId, "Visual identity character id");
    identifier(input.seriesId, "Visual identity series id");
    const now = timestamp(input.now ?? new Date().toISOString(), "Visual identity timestamp");
    const base = normalizeState(input.state);
    return { formatVersion: exports.VISUAL_IDENTITY_FORMAT_VERSION, id: input.id, projectId: input.projectId, characterId: input.characterId, seriesId: input.seriesId, createdAt: now, updatedAt: now, base, snapshots: [] };
}
function updateVisualCharacterIdentity(identity, input) {
    if (identity.id !== input.identityId)
        throw new Error("Visual identity update id does not match the identity.");
    if (!Number.isInteger(input.storyOrder) || input.storyOrder < 0)
        throw new Error("Visual identity story order must be a non-negative integer.");
    const effectiveAt = timestamp(input.effectiveAt ?? new Date().toISOString(), "Visual identity update timestamp");
    const reason = text(input.reason, "Visual identity update reason");
    const actor = input.actor ?? "author";
    const current = resolveVisualCharacterIdentity(identity, input.storyOrder);
    const next = normalizePartialState(input.state, current);
    if (JSON.stringify(current) === JSON.stringify(next))
        throw new Error("Visual identity update does not change visual state.");
    const sequence = identity.snapshots.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
    const snapshot = { ...next, storyOrder: input.storyOrder, effectiveAt, sequence, reason, actor };
    return { ...identity, updatedAt: effectiveAt > identity.updatedAt ? effectiveAt : identity.updatedAt, snapshots: [...identity.snapshots, snapshot].sort(compareSnapshots) };
}
function resolveVisualCharacterIdentity(identity, storyOrder) {
    if (!Number.isInteger(storyOrder) || storyOrder < 0)
        throw new Error("Visual identity story order must be a non-negative integer.");
    let state = cloneState(identity.base);
    for (const snapshot of [...identity.snapshots].sort(compareSnapshots)) {
        if (snapshot.storyOrder > storyOrder)
            break;
        state = cloneState(snapshot);
    }
    return state;
}
function generateVisualCharacterIdentityPackage(identity, storyOrder, generatedAt) {
    const state = resolveVisualCharacterIdentity(identity, storyOrder);
    const references = [...state.faceReferences, ...state.bodyReferences, ...state.poseReferences];
    return { packageVersion: exports.VISUAL_IDENTITY_FORMAT_VERSION, identityId: identity.id, projectId: identity.projectId, characterId: identity.characterId, seriesId: identity.seriesId, generatedAt: timestamp(generatedAt ?? new Date().toISOString(), "Visual package timestamp"), storyOrder, identity: state, references: references.map(cloneReference), continuity: identity.snapshots.map(cloneSnapshot) };
}
function validateVisualCharacterIdentity(value) {
    if (!value || typeof value !== "object")
        throw new Error("Invalid visual character identity.");
    const candidate = value;
    if (candidate.formatVersion !== exports.VISUAL_IDENTITY_FORMAT_VERSION)
        throw new Error("Unsupported visual character identity format.");
    for (const field of ["id", "projectId", "characterId", "seriesId"])
        if (typeof candidate[field] !== "string")
            throw new Error(`Visual identity ${field} is required.`);
    identifier(candidate.id, "Visual identity id");
    identifier(candidate.projectId, "Visual identity project id");
    identifier(candidate.characterId, "Visual identity character id");
    identifier(candidate.seriesId, "Visual identity series id");
    const createdAt = timestamp(String(candidate.createdAt), "Visual identity createdAt");
    const updatedAt = timestamp(String(candidate.updatedAt), "Visual identity updatedAt");
    if (updatedAt < createdAt)
        throw new Error("Visual identity updatedAt cannot precede createdAt.");
    const base = normalizeState(candidate.base);
    if (!Array.isArray(candidate.snapshots))
        throw new Error("Visual identity snapshots are required.");
    const snapshots = candidate.snapshots.map(validateSnapshot);
    const sequences = new Set();
    for (const snapshot of snapshots) {
        if (sequences.has(snapshot.sequence))
            throw new Error("Visual identity snapshot sequence must be unique.");
        sequences.add(snapshot.sequence);
    }
    return { formatVersion: exports.VISUAL_IDENTITY_FORMAT_VERSION, id: candidate.id, projectId: candidate.projectId, characterId: candidate.characterId, seriesId: candidate.seriesId, createdAt, updatedAt, base, snapshots: snapshots.sort(compareSnapshots) };
}
function validateSnapshot(value) {
    if (!value || typeof value !== "object")
        throw new Error("Invalid visual identity snapshot.");
    const item = value;
    if (!Number.isInteger(item.storyOrder) || item.storyOrder < 0)
        throw new Error("Visual identity snapshot story order must be a non-negative integer.");
    if (!Number.isInteger(item.sequence) || item.sequence < 1)
        throw new Error("Visual identity snapshot sequence must be positive.");
    if (item.actor !== "author" && item.actor !== "system")
        throw new Error("Invalid visual identity snapshot actor.");
    const state = normalizeState(item);
    return { ...state, storyOrder: item.storyOrder, effectiveAt: timestamp(String(item.effectiveAt), "Visual identity snapshot timestamp"), sequence: item.sequence, reason: text(String(item.reason), "Visual identity snapshot reason"), actor: item.actor };
}
function normalizeState(state) {
    if (!state || typeof state !== "object")
        throw new Error("Visual identity state is required.");
    return { distinguishingMarks: stringArray(state.distinguishingMarks, "distinguishing marks"), scars: stringArray(state.scars, "scars"), tattoos: stringArray(state.tattoos, "tattoos"), accessories: stringArray(state.accessories, "accessories"), colorPalette: stringArray(state.colorPalette, "color palette"), artisticStyle: text(state.artisticStyle, "artistic style"), wardrobe: stringArray(state.wardrobe, "wardrobe"), hairstyle: text(state.hairstyle, "hairstyle"), age: nonNegativeInteger(state.age, "visual age"), faceReferences: references(state.faceReferences, "face references", "face"), bodyReferences: references(state.bodyReferences, "body references", "body"), poseReferences: references(state.poseReferences, "pose references", "pose") };
}
function normalizePartialState(changes, current) { return normalizeState({ ...current, ...changes }); }
function stringArray(value, label) { if (!Array.isArray(value))
    throw new Error(`Visual identity ${label} must be an array.`); return [...new Set(value.map((item) => text(item, `Visual identity ${label} entry`)))]; }
function references(value, label, kind) { if (!Array.isArray(value))
    throw new Error(`Visual identity ${label} must be an array.`); return value.map((item) => { if (!item || typeof item !== "object")
    throw new Error(`Invalid ${label} entry.`); const ref = item; if (ref.kind !== kind)
    throw new Error(`Visual reference ${ref.id ?? ""} must be a ${kind} reference.`); identifier(ref.id, `${kind} reference id`); const uri = text(ref.uri, `${kind} reference uri`); const labelText = text(ref.label, `${kind} reference label`); const notes = text(ref.notes, `${kind} reference notes`); return { id: ref.id, kind, uri, label: labelText, notes }; }); }
function cloneState(state) { return { ...state, distinguishingMarks: [...state.distinguishingMarks], scars: [...state.scars], tattoos: [...state.tattoos], accessories: [...state.accessories], colorPalette: [...state.colorPalette], wardrobe: [...state.wardrobe], hairstyle: state.hairstyle, age: state.age, faceReferences: state.faceReferences.map(cloneReference), bodyReferences: state.bodyReferences.map(cloneReference), poseReferences: state.poseReferences.map(cloneReference) }; }
function cloneReference(reference) { return { ...reference }; }
function cloneSnapshot(snapshot) { return { ...cloneState(snapshot), storyOrder: snapshot.storyOrder, effectiveAt: snapshot.effectiveAt, sequence: snapshot.sequence, reason: snapshot.reason, actor: snapshot.actor }; }
function compareSnapshots(a, b) { return a.storyOrder - b.storyOrder || Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || a.sequence - b.sequence; }
function nonNegativeInteger(value, label) { if (!Number.isInteger(value) || value < 0)
    throw new Error(`Visual identity ${label} must be a non-negative integer.`); return value; }
function identifier(value, label) { if (typeof value !== "string" || !value.trim() || value !== value.trim())
    throw new Error(`${label} is required and cannot have surrounding whitespace.`); return value; }
function text(value, label) { if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required.`); return value.trim(); }
function timestamp(value, label) { if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
    throw new Error(`${label} must be a valid timestamp.`); return new Date(value).toISOString(); }
//# sourceMappingURL=character-visual-continuity.js.map