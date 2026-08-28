"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_FIELDS = exports.CHARACTER_BIBLE_FORMAT_VERSION = void 0;
exports.createCharacter = createCharacter;
exports.updateCharacter = updateCharacter;
exports.getCharacterAt = getCharacterAt;
exports.getCharacterFieldHistory = getCharacterFieldHistory;
exports.getCharacterChanges = getCharacterChanges;
exports.validateCharacterRecord = validateCharacterRecord;
exports.CHARACTER_BIBLE_FORMAT_VERSION = 1;
exports.CHARACTER_FIELDS = [
    "name", "age", "birthDate", "physicalAppearance", "height", "build", "hair", "eyes", "skin", "clothing", "voice", "speechPatterns", "personality", "values", "fears", "secrets", "goals", "motivations", "relationships", "history", "knowledge", "skills", "weaknesses", "characterArc", "importantObjects", "currentEmotionalState", "currentLocation", "currentInjuries"
];
function createCharacter(input) {
    assertIdentifier(input.id, "Character id");
    assertIdentifier(input.projectId, "Character project id");
    const now = validateTimestamp(input.now ?? new Date().toISOString(), "Character timestamp");
    const reason = requireText(input.reason ?? "Initial character bible entry", "Character history reason");
    const actor = input.actor ?? "author";
    const profile = normalizeProfile(input.profile);
    const fieldHistory = {};
    for (const field of exports.CHARACTER_FIELDS)
        fieldHistory[field] = [{ field, value: cloneFieldValue(field, profile[field]), effectiveAt: now, sequence: 1, reason, actor }];
    return { formatVersion: exports.CHARACTER_BIBLE_FORMAT_VERSION, id: input.id, projectId: input.projectId, createdAt: now, updatedAt: now, profile: cloneProfile(profile), fieldHistory: cloneFieldHistory(fieldHistory) };
}
function updateCharacter(character, input) {
    if (character.id !== input.characterId)
        throw new Error("Character update id does not match the character.");
    const effectiveAt = validateTimestamp(input.effectiveAt ?? new Date().toISOString(), "Character update timestamp");
    if (effectiveAt < character.createdAt)
        throw new Error("Character update timestamp cannot precede character creation.");
    const reason = requireText(input.reason, "Character update reason");
    const actor = input.actor ?? "author";
    const changes = input.changes;
    const keys = Object.keys(changes);
    for (const key of keys)
        if (!exports.CHARACTER_FIELDS.includes(key))
            throw new Error(`Unsupported character field "${key}".`);
    if (keys.length === 0)
        throw new Error("Character update requires at least one field change.");
    const nextProfile = cloneProfile(character.profile);
    const nextHistory = cloneFieldHistory(character.fieldHistory);
    const nextSequence = highestSequence(character) + 1;
    const changed = [];
    for (const field of exports.CHARACTER_FIELDS) {
        if (!(field in changes))
            continue;
        const normalized = normalizeField(field, changes[field]);
        if (valuesEqual(nextProfile[field], normalized))
            continue;
        nextProfile[field] = cloneFieldValue(field, normalized);
        nextHistory[field].push({ field, value: cloneFieldValue(field, normalized), effectiveAt, sequence: nextSequence, reason, actor });
        changed.push(field);
    }
    if (changed.length === 0)
        throw new Error("Character update does not change any character field.");
    return { ...character, updatedAt: effectiveAt > character.updatedAt ? effectiveAt : character.updatedAt, profile: cloneProfile(nextProfile), fieldHistory: cloneFieldHistory(nextHistory) };
}
function getCharacterAt(character, asOf) {
    const timestamp = validateTimestamp(asOf, "Character historical timestamp");
    const target = Date.parse(timestamp);
    const profile = {};
    for (const field of exports.CHARACTER_FIELDS) {
        const versions = [...character.fieldHistory[field]].sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || a.sequence - b.sequence);
        let selected;
        for (const version of versions) {
            const effective = Date.parse(version.effectiveAt);
            if (effective > target)
                break;
            selected = version;
        }
        if (!selected)
            throw new Error(`Character field "${field}" did not exist at ${timestamp}.`);
        profile[field] = cloneFieldValue(field, selected.value);
    }
    return cloneProfile(profile);
}
function getCharacterFieldHistory(character, field) { return character.fieldHistory[field].map((version) => ({ ...version, value: cloneFieldValue(field, version.value) })); }
function getCharacterChanges(character) {
    const changes = [];
    for (const field of exports.CHARACTER_FIELDS) {
        const versions = [...character.fieldHistory[field]].sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || a.sequence - b.sequence);
        for (let index = 1; index < versions.length; index += 1) {
            const previous = versions[index - 1];
            const current = versions[index];
            changes.push({ field, previousValue: cloneFieldValue(field, previous.value), nextValue: cloneFieldValue(field, current.value), effectiveAt: current.effectiveAt, sequence: current.sequence, reason: current.reason, actor: current.actor });
        }
    }
    return changes.sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt) || a.sequence - b.sequence || a.field.localeCompare(b.field));
}
function validateCharacterRecord(value) {
    if (!value || typeof value !== "object")
        throw new Error("Invalid character record.");
    const candidate = value;
    if (candidate.formatVersion !== exports.CHARACTER_BIBLE_FORMAT_VERSION || typeof candidate.id !== "string" || typeof candidate.projectId !== "string")
        throw new Error("Unsupported or corrupt character record.");
    assertIdentifier(candidate.id, "Character id");
    assertIdentifier(candidate.projectId, "Character project id");
    if (!candidate.profile || typeof candidate.profile !== "object")
        throw new Error("Character profile is required.");
    const profile = normalizeProfile(candidate.profile);
    if (!candidate.fieldHistory || typeof candidate.fieldHistory !== "object")
        throw new Error("Character field history is required.");
    const history = candidate.fieldHistory;
    for (const field of exports.CHARACTER_FIELDS) {
        const versions = history[field];
        if (!Array.isArray(versions) || versions.length === 0)
            throw new Error(`Character field history is missing "${field}".`);
        for (const version of versions) {
            if (version.field !== field || typeof version.effectiveAt !== "string" || !Number.isInteger(version.sequence) || version.sequence < 1 || typeof version.reason !== "string" || !version.reason.trim() || (version.actor !== "author" && version.actor !== "system"))
                throw new Error(`Invalid history entry for character field "${field}".`);
            validateTimestamp(version.effectiveAt, `Character field "${field}" timestamp`);
            normalizeField(field, version.value);
        }
    }
    const createdAt = validateTimestamp(String(candidate.createdAt), "Character createdAt");
    const updatedAt = validateTimestamp(String(candidate.updatedAt), "Character updatedAt");
    if (updatedAt < createdAt)
        throw new Error("Character updatedAt cannot precede createdAt.");
    for (const field of exports.CHARACTER_FIELDS) {
        const versions = history[field];
        if (versions[0].sequence !== 1 || versions[0].effectiveAt !== createdAt)
            throw new Error(`Character field "${field}" history must begin at character creation.`);
        const latest = [...versions].sort((a, b) => b.sequence - a.sequence)[0];
        if (JSON.stringify(normalizeField(field, latest.value)) !== JSON.stringify(profile[field]))
            throw new Error(`Character profile does not match latest "${field}" history.`);
    }
    return createCharacterFromValidated(candidate, profile, history);
}
function createCharacterFromValidated(candidate, profile, history) { const createdAt = validateTimestamp(String(candidate.createdAt), "Character createdAt"); const updatedAt = validateTimestamp(String(candidate.updatedAt), "Character updatedAt"); return { formatVersion: exports.CHARACTER_BIBLE_FORMAT_VERSION, id: String(candidate.id), projectId: String(candidate.projectId), createdAt, updatedAt, profile: cloneProfile(profile), fieldHistory: cloneFieldHistory(history) }; }
function normalizeProfile(profile) { const normalized = {}; for (const field of exports.CHARACTER_FIELDS)
    normalized[field] = normalizeField(field, profile[field]); return cloneProfile(normalized); }
function normalizeField(field, value) {
    if (field === "age") {
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
            throw new Error("Character age must be a non-negative integer.");
        return value;
    }
    if (field === "relationships") {
        if (!Array.isArray(value))
            throw new Error("Character relationships must be an array.");
        return value.map((relationship) => { if (!relationship || typeof relationship !== "object")
            throw new Error("Character relationship must be an object."); const item = relationship; return { characterId: requireText(item.characterId, "Relationship character id"), relationship: requireText(item.relationship, "Relationship type"), status: requireText(item.status, "Relationship status"), notes: requireText(item.notes, "Relationship notes") }; });
    }
    if (field === "speechPatterns" || field === "values" || field === "fears" || field === "secrets" || field === "goals" || field === "motivations" || field === "knowledge" || field === "skills" || field === "weaknesses" || field === "importantObjects" || field === "currentInjuries") {
        if (!Array.isArray(value))
            throw new Error(`Character ${field} must be an array.`);
        return normalizeStringArray(value, field);
    }
    if (typeof value !== "string")
        throw new Error(`Character ${field} must be a string.`);
    const trimmed = value.trim();
    if (!trimmed)
        throw new Error(`Character ${field} is required.`);
    if (field === "birthDate" && Number.isNaN(Date.parse(trimmed)))
        throw new Error("Character birth date must be a valid date.");
    return trimmed;
}
function normalizeStringArray(value, field) { return [...new Set(value.map((item) => { if (typeof item !== "string")
        throw new Error(`Character ${field} entries must be strings.`); return requireText(item, `Character ${field} entry`); }))]; }
function cloneProfile(profile) { return { ...profile, speechPatterns: [...profile.speechPatterns], values: [...profile.values], fears: [...profile.fears], secrets: [...profile.secrets], goals: [...profile.goals], motivations: [...profile.motivations], relationships: profile.relationships.map((relationship) => ({ ...relationship })), knowledge: [...profile.knowledge], skills: [...profile.skills], weaknesses: [...profile.weaknesses], importantObjects: [...profile.importantObjects], currentInjuries: [...profile.currentInjuries] }; }
function cloneFieldValue(field, value) { if (field === "relationships")
    return value.map((item) => ({ ...item })); if (Array.isArray(value))
    return [...value]; return value; }
function cloneFieldHistory(history) { const result = {}; for (const field of exports.CHARACTER_FIELDS)
    result[field] = history[field].map((version) => ({ ...version, value: cloneFieldValue(field, version.value) })); return result; }
function valuesEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function highestSequence(character) { return Math.max(...exports.CHARACTER_FIELDS.flatMap((field) => character.fieldHistory[field].map((version) => version.sequence))); }
function assertIdentifier(value, label) { if (!value.trim())
    throw new Error(`${label} is required.`); }
function requireText(value, label) { if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required.`); return value.trim(); }
function validateTimestamp(value, label) { if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
    throw new Error(`${label} must be a valid timestamp.`); return new Date(value).toISOString(); }
//# sourceMappingURL=character-bible.js.map