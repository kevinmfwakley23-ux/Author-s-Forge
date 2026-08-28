"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTEXT_INCLUSION_MODES = exports.CONTEXT_ASSEMBLY_FORMAT_VERSION = void 0;
exports.assembleWritingContext = assembleWritingContext;
exports.CONTEXT_ASSEMBLY_FORMAT_VERSION = 1;
exports.CONTEXT_INCLUSION_MODES = ["full", "brief", "extended", "custom", "off"];
const DEFAULT_POLICIES = [
    { key: "canon", mode: "full" }, { key: "characters", mode: "extended" }, { key: "relationships", mode: "extended" },
    { key: "timeline", mode: "brief" }, { key: "research", mode: "brief" }, { key: "voice", mode: "full" }, { key: "unresolved-threads", mode: "full" },
];
function assembleWritingContext(project, request) {
    if (request.projectId !== project.metadata.id)
        throw new Error("Context assembly belongs to another project.");
    const sections = (request.policies ?? DEFAULT_POLICIES).map((policy) => buildSection(project, policy, request)).filter((section) => section !== null);
    const sourceIds = [...new Set(sections.flatMap((section) => section.sourceIds))];
    return { formatVersion: exports.CONTEXT_ASSEMBLY_FORMAT_VERSION, projectId: project.metadata.id, sections, totalWords: sections.reduce((total, section) => total + section.wordCount, 0), sourceIds };
}
function buildSection(project, policy, request) {
    if (!exports.CONTEXT_INCLUSION_MODES.includes(policy.mode))
        throw new Error(`Invalid context inclusion mode: ${policy.mode}.`);
    if (policy.mode === "off")
        return null;
    const records = selectRecords(project, policy.key, request);
    const raw = records.map((record) => record.text).filter(Boolean).join("\n\n");
    if (!raw)
        return null;
    const maxWords = policy.maxWords ?? (policy.mode === "brief" ? 450 : policy.mode === "extended" ? 1000 : policy.mode === "custom" ? 500 : Number.MAX_SAFE_INTEGER);
    const text = truncateWords(raw, maxWords);
    return { key: policy.key, title: titleFor(policy.key), mode: policy.mode, text, sourceIds: records.map((record) => record.id), wordCount: countWords(text) };
}
function selectRecords(project, key, request) {
    const query = request.query?.trim().toLowerCase();
    const memories = (className) => project.memories.filter((memory) => memory.class === className && memory.authority !== "archived").filter((memory) => matches(`${memory.summary} ${memory.content}`, query)).map((memory) => ({ id: memory.id, text: `${memory.summary}\n${memory.content}` }));
    if (key === "canon")
        return memories("story-canon");
    if (key === "relationships")
        return memories("relationship-memory");
    if (key === "timeline")
        return memories("timeline-memory");
    if (key === "research")
        return memories("research-memory");
    if (key === "unresolved-threads")
        return memories("open-thread");
    if (key === "voice")
        return memories("style-memory");
    if (key === "characters")
        return (project.characters ?? []).filter((character) => request.characterIds?.length ? request.characterIds.includes(character.id) : true).filter((character) => matches(JSON.stringify(character.profile), query)).map((character) => ({ id: character.id, text: JSON.stringify(character.profile, null, 2) }));
    return [];
}
function matches(value, query) { return !query || value.toLowerCase().includes(query); }
function countWords(value) { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function truncateWords(value, maxWords) { const words = value.trim().split(/\s+/); return words.length <= maxWords ? value.trim() : `${words.slice(0, maxWords).join(" ")}…`; }
function titleFor(key) { return key.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
//# sourceMappingURL=context-assembly.js.map