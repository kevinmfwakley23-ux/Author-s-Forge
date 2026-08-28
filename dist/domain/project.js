"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_FORMAT_VERSION = void 0;
exports.createProject = createProject;
exports.touchProject = touchProject;
exports.withProjectMemories = withProjectMemories;
exports.withProjectCharacters = withProjectCharacters;
exports.withProjectVisualIdentities = withProjectVisualIdentities;
exports.withProjectIllustrationAssetLibrary = withProjectIllustrationAssetLibrary;
exports.withProjectBookCoverPlans = withProjectBookCoverPlans;
exports.withProjectPublishingReadinessReports = withProjectPublishingReadinessReports;
exports.withProjectKdpMarketIntelligenceReports = withProjectKdpMarketIntelligenceReports;
exports.withProjectBookPositioningReports = withProjectBookPositioningReports;
exports.withProjectBookVersionHistories = withProjectBookVersionHistories;
exports.withProjectAuthorDecisions = withProjectAuthorDecisions;
exports.withProjectSeries = withProjectSeries;
exports.withProjectVoiceProfiles = withProjectVoiceProfiles;
exports.withProjectAiCollaborationPolicy = withProjectAiCollaborationPolicy;
exports.withProjectHealthReports = withProjectHealthReports;
exports.withProjectMemoryRelationships = withProjectMemoryRelationships;
exports.withProjectDeliveryAudits = withProjectDeliveryAudits;
exports.withProjectBookGenome = withProjectBookGenome;
const character_bible_1 = require("./character-bible");
const character_visual_continuity_1 = require("./character-visual-continuity");
const illustration_asset_library_1 = require("./illustration-asset-library");
const book_cover_studio_1 = require("./book-cover-studio");
const publishing_readiness_1 = require("./publishing-readiness");
const kdp_market_intelligence_1 = require("./kdp-market-intelligence");
const book_positioning_1 = require("./book-positioning");
exports.PROJECT_FORMAT_VERSION = 3;
function createProject(input) { if (!input.id.trim())
    throw new Error("Project id is required."); if (!input.title.trim())
    throw new Error("Project title is required."); const now = input.now ?? new Date().toISOString(); return { formatVersion: exports.PROJECT_FORMAT_VERSION, metadata: { id: input.id, title: input.title.trim(), createdAt: now, updatedAt: now, status: "active" }, memories: [] }; }
function touchProject(project, now = new Date().toISOString()) { return { ...project, metadata: { ...project.metadata, updatedAt: now } }; }
function withProjectMemories(project, memories, now = new Date().toISOString()) { if (memories.some(m => m.projectId !== project.metadata.id))
    throw new Error("Project memory state contains a memory from another project."); const ids = new Set(); for (const m of memories) {
    if (ids.has(m.id))
        throw new Error(`Duplicate memory id \"${m.id}\" in project state.`);
    ids.add(m.id);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, memories: memories.map(cloneMemory) }; }
function withProjectCharacters(project, characters, now = new Date().toISOString()) { if (characters.some(c => c.projectId !== project.metadata.id))
    throw new Error("Project character state contains a character from another project."); const ids = new Set(); const validated = characters.map(character_bible_1.validateCharacterRecord); for (const c of validated) {
    if (ids.has(c.id))
        throw new Error(`Duplicate character id \"${c.id}\" in project state.`);
    ids.add(c.id);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, characters: validated.map(cloneCharacter) }; }
function withProjectVisualIdentities(project, v, now = new Date().toISOString()) { if (v.some(i => i.projectId !== project.metadata.id))
    throw new Error("Project visual identity state contains an identity from another project."); const ids = new Set(), characters = new Set(); const validated = v.map(character_visual_continuity_1.validateVisualCharacterIdentity); for (const i of validated) {
    if (ids.has(i.id))
        throw new Error(`Duplicate visual identity id \"${i.id}\" in project state.`);
    ids.add(i.id);
    if (characters.has(i.characterId))
        throw new Error(`Duplicate visual identity for character \"${i.characterId}\" in project state.`);
    characters.add(i.characterId);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, visualIdentities: validated.map(i => (0, character_visual_continuity_1.validateVisualCharacterIdentity)(JSON.parse(JSON.stringify(i)))) }; }
function withProjectIllustrationAssetLibrary(project, library, now = new Date().toISOString()) { const v = (0, illustration_asset_library_1.validateIllustrationAssetLibraryState)(library); if (v.projectId !== project.metadata.id)
    throw new Error("Project illustration asset library belongs to another project."); return { ...project, metadata: { ...project.metadata, updatedAt: now }, illustrationAssetLibrary: (0, illustration_asset_library_1.validateIllustrationAssetLibraryState)(JSON.parse(JSON.stringify(v))) }; }
function withProjectBookCoverPlans(project, plans, now = new Date().toISOString()) { const ids = new Set(); const validated = plans.map(p => { if (p.projectId !== project.metadata.id)
    throw new Error("Project book cover plan belongs to another project."); if (ids.has(p.id))
    throw new Error(`Duplicate book cover plan id \"${p.id}\" in project state.`); ids.add(p.id); (0, book_cover_studio_1.validatePublishingConfiguration)(p.publishing); const e = (0, book_cover_studio_1.calculateKdpCoverLayout)(p.publishing); if (e.dimensions.widthInches !== p.dimensions.widthInches || e.dimensions.heightInches !== p.dimensions.heightInches)
    throw new Error(`Book cover plan \"${p.id}\" contains invalid calculated dimensions.`); return JSON.parse(JSON.stringify(p)); }); return { ...project, metadata: { ...project.metadata, updatedAt: now }, bookCoverPlans: validated }; }
function withProjectPublishingReadinessReports(project, reports, now = new Date().toISOString()) { const ids = new Set(), validated = reports.map(publishing_readiness_1.validatePublishingReadinessReport); for (const r of validated) {
    if (r.projectId !== project.metadata.id)
        throw new Error(`Project publishing readiness report \"${r.id}\" belongs to another project.`);
    if (ids.has(r.id))
        throw new Error(`Duplicate publishing readiness report id \"${r.id}\" in project state.`);
    ids.add(r.id);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, publishingReadinessReports: validated.map(r => (0, publishing_readiness_1.validatePublishingReadinessReport)(JSON.parse(JSON.stringify(r)))) }; }
function withProjectKdpMarketIntelligenceReports(project, reports, now = new Date().toISOString()) { const ids = new Set(), validated = reports.map(kdp_market_intelligence_1.validateKdpMarketIntelligenceReport); for (const r of validated) {
    if (r.projectId !== project.metadata.id)
        throw new Error(`Project market intelligence report \"${r.id}\" belongs to another project.`);
    if (ids.has(r.id))
        throw new Error(`Duplicate market intelligence report id \"${r.id}\" in project state.`);
    ids.add(r.id);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, kdpMarketIntelligenceReports: validated.map(r => (0, kdp_market_intelligence_1.validateKdpMarketIntelligenceReport)(JSON.parse(JSON.stringify(r)))) }; }
function withProjectBookPositioningReports(project, reports, now = new Date().toISOString()) { const ids = new Set(), validated = reports.map(book_positioning_1.validateBookPositioningReport); for (const r of validated) {
    if (r.projectId !== project.metadata.id)
        throw new Error(`Project book positioning report \"${r.id}\" belongs to another project.`);
    if (ids.has(r.id))
        throw new Error(`Duplicate book positioning report id \"${r.id}\" in project state.`);
    ids.add(r.id);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, bookPositioningReports: validated.map(r => (0, book_positioning_1.validateBookPositioningReport)(JSON.parse(JSON.stringify(r)))) }; }
function withProjectBookVersionHistories(project, histories, now = new Date().toISOString()) { const ids = new Set(); for (const h of histories) {
    if (h.projectId !== project.metadata.id)
        throw new Error("Project version history belongs to another project.");
    if (ids.has(h.bookId))
        throw new Error(`Duplicate version history for book \"${h.bookId}\".`);
    ids.add(h.bookId);
    for (const v of h.versions)
        if (v.projectId !== project.metadata.id || v.bookId !== h.bookId)
            throw new Error("Version history contains an incorrectly scoped version.");
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, bookVersionHistories: JSON.parse(JSON.stringify(histories)) }; }
function withProjectAuthorDecisions(project, decisions, now = new Date().toISOString()) { const ids = new Set(); for (const d of decisions) {
    if (d.projectId !== project.metadata.id)
        throw new Error("Project author decision belongs to another project.");
    if (ids.has(d.id))
        throw new Error(`Duplicate author decision id \"${d.id}\".`);
    ids.add(d.id);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, authorDecisions: JSON.parse(JSON.stringify(decisions)) }; }
function withProjectSeries(project, series, now = new Date().toISOString()) { const ids = new Set(); for (const s of series) {
    if (s.projectId !== project.metadata.id)
        throw new Error("Project series belongs to another project.");
    if (ids.has(s.id))
        throw new Error(`Duplicate series id \"${s.id}\".`);
    ids.add(s.id);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, series: JSON.parse(JSON.stringify(series)) }; }
function withProjectVoiceProfiles(project, profiles, now = new Date().toISOString()) { const ids = new Set(); for (const p of profiles) {
    if (p.projectId !== project.metadata.id)
        throw new Error("Project voice profile belongs to another project.");
    if (ids.has(p.id))
        throw new Error(`Duplicate voice profile id \"${p.id}\".`);
    ids.add(p.id);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, voiceProfiles: JSON.parse(JSON.stringify(profiles)) }; }
function withProjectAiCollaborationPolicy(project, policy, now = new Date().toISOString()) { return { ...project, metadata: { ...project.metadata, updatedAt: now }, aiCollaborationPolicy: Object.freeze({ ...policy }) }; }
function withProjectHealthReports(project, reports, now = new Date().toISOString()) { const ids = new Set(); for (const r of reports) {
    if (r.projectId !== project.metadata.id)
        throw new Error("Project health report belongs to another project.");
    const key = r.generatedAt;
    if (ids.has(key))
        throw new Error(`Duplicate project health report timestamp \"${key}\".`);
    ids.add(key);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, projectHealthReports: reports.map(r => JSON.parse(JSON.stringify(r))) }; }
function withProjectMemoryRelationships(project, relationships, now = new Date().toISOString()) { const ids = new Set(); for (const r of relationships) {
    if (r.projectId !== project.metadata.id)
        throw new Error("Project memory relationship belongs to another project.");
    if (ids.has(r.id))
        throw new Error(`Duplicate memory relationship id \"${r.id}\".`);
    ids.add(r.id);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, memoryRelationships: relationships.map(r => JSON.parse(JSON.stringify(r))) }; }
function withProjectDeliveryAudits(project, audits, now = new Date().toISOString()) { const ids = new Set(); for (const a of audits) {
    if (a.projectId !== project.metadata.id)
        throw new Error("Project delivery audit belongs to another project.");
    if (ids.has(a.generatedAt))
        throw new Error(`Duplicate delivery audit timestamp \"${a.generatedAt}\".`);
    ids.add(a.generatedAt);
} return { ...project, metadata: { ...project.metadata, updatedAt: now }, deliveryAudits: audits.map(a => JSON.parse(JSON.stringify(a))) }; }
function withProjectBookGenome(project, bookGenome, now = new Date().toISOString()) { if (bookGenome.projectId !== project.metadata.id)
    throw new Error("Book Genome belongs to another project."); return { ...project, metadata: { ...project.metadata, updatedAt: now }, bookGenome: JSON.parse(JSON.stringify(bookGenome)) }; }
function cloneMemory(m) { return { ...m, provenance: m.provenance.map(p => ({ ...p })), relatedMemoryIds: [...m.relatedMemoryIds], relevanceTags: [...m.relevanceTags] }; }
function cloneCharacter(c) { return (0, character_bible_1.validateCharacterRecord)(JSON.parse(JSON.stringify(c))); }
//# sourceMappingURL=project.js.map