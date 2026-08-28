"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileProjectStore = void 0;
const project_1 = require("../domain/project");
const character_bible_1 = require("../domain/character-bible");
const character_visual_continuity_1 = require("../domain/character-visual-continuity");
const illustration_asset_library_1 = require("../domain/illustration-asset-library");
const book_cover_studio_1 = require("../domain/book-cover-studio");
const final_product_systems_1 = require("../domain/final-product-systems");
const publishing_readiness_1 = require("../domain/publishing-readiness");
const kdp_market_intelligence_1 = require("../domain/kdp-market-intelligence");
const book_positioning_1 = require("../domain/book-positioning");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const LEGACY_PROJECT_FORMAT_VERSION = 2;
class FileProjectStore {
    rootDirectory;
    constructor(rootDirectory) {
        this.rootDirectory = rootDirectory;
    }
    async create(project) { if (await this.exists(project.metadata.id))
        throw new Error(`Project already exists: ${project.metadata.id}`); await this.save(project); }
    async load(projectId) { try {
        const raw = await (0, promises_1.readFile)(this.projectPath(projectId), "utf8");
        return this.validate(JSON.parse(raw), projectId);
    }
    catch (error) {
        if (isMissingFile(error))
            return null;
        throw error;
    } }
    async save(project) {
        const path = this.projectPath(project.metadata.id);
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true });
        const temporaryPath = `${path}.tmp`;
        const persisted = JSON.parse(JSON.stringify(project));
        persisted.formatVersion = LEGACY_PROJECT_FORMAT_VERSION;
        await (0, promises_1.writeFile)(temporaryPath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
        await (0, promises_1.rename)(temporaryPath, path);
    }
    async exists(projectId) { try {
        await (0, promises_1.access)(this.projectPath(projectId));
        return true;
    }
    catch (error) {
        if (isMissingFile(error))
            return false;
        throw error;
    } }
    projectPath(projectId) { if (!/^[a-zA-Z0-9_-]+$/.test(projectId))
        throw new Error("Project id contains unsupported path characters."); return (0, node_path_1.join)(this.rootDirectory, "projects", projectId, "project.json"); }
    validate(value, expectedId) {
        if (!value || typeof value !== "object")
            throw new Error("Invalid project package.");
        const candidate = value;
        const metadata = candidate.metadata;
        if (!metadata || typeof metadata !== "object")
            throw new Error("Invalid project metadata.");
        const record = metadata;
        if ((candidate.formatVersion !== 1 && candidate.formatVersion !== LEGACY_PROJECT_FORMAT_VERSION && candidate.formatVersion !== project_1.PROJECT_FORMAT_VERSION) || record.id !== expectedId || typeof record.title !== "string")
            throw new Error("Unsupported or corrupt project package.");
        const memories = candidate.memories === undefined ? [] : candidate.memories;
        if (!Array.isArray(memories) || !memories.every(isMemoryRecord))
            throw new Error("Invalid project memory state.");
        for (const memory of memories)
            if (memory.projectId !== expectedId)
                throw new Error("Project memory state contains a memory from another project.");
        const characters = validateOptionalCharacters(candidate.characters, expectedId);
        const visualIdentities = validateOptionalVisualIdentities(candidate.visualIdentities, expectedId);
        const illustrationAssetLibrary = candidate.illustrationAssetLibrary === undefined ? undefined : validateProjectIllustrationLibrary(candidate.illustrationAssetLibrary, expectedId);
        const bookCoverPlans = validateOptionalBookCoverPlans(candidate.bookCoverPlans, expectedId);
        const publishingReadinessReports = validateOptional(candidate.publishingReadinessReports, publishing_readiness_1.validatePublishingReadinessReport, expectedId, "Project publishing readiness report");
        const kdpMarketIntelligenceReports = validateOptional(candidate.kdpMarketIntelligenceReports, kdp_market_intelligence_1.validateKdpMarketIntelligenceReport, expectedId, "Project market intelligence report");
        const bookPositioningReports = validateOptional(candidate.bookPositioningReports, book_positioning_1.validateBookPositioningReport, expectedId, "Project book positioning report");
        const bookGenome = candidate.bookGenome === undefined ? undefined : validateBookGenome(candidate.bookGenome, expectedId);
        const normalized = JSON.parse(JSON.stringify(candidate));
        normalized.formatVersion = project_1.PROJECT_FORMAT_VERSION;
        normalized.metadata = { id: expectedId, title: record.title, createdAt: typeof record.createdAt === "string" ? record.createdAt : "", updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "", status: record.status === "archived" ? "archived" : "active" };
        normalized.memories = memories.map((memory) => cloneMemory(memory));
        if (characters)
            normalized.characters = characters;
        if (visualIdentities)
            normalized.visualIdentities = visualIdentities;
        if (illustrationAssetLibrary)
            normalized.illustrationAssetLibrary = cloneIllustrationAssetLibrary(illustrationAssetLibrary);
        if (bookCoverPlans)
            normalized.bookCoverPlans = bookCoverPlans;
        if (publishingReadinessReports)
            normalized.publishingReadinessReports = publishingReadinessReports;
        if (kdpMarketIntelligenceReports)
            normalized.kdpMarketIntelligenceReports = kdpMarketIntelligenceReports;
        if (bookPositioningReports)
            normalized.bookPositioningReports = bookPositioningReports;
        if (bookGenome)
            normalized.bookGenome = bookGenome;
        return normalized;
    }
}
exports.FileProjectStore = FileProjectStore;
function validateOptionalCharacters(value, expectedProjectId) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value))
        throw new Error("Invalid project character state.");
    const ids = new Set();
    return value.map((character) => { const validated = (0, character_bible_1.validateCharacterRecord)(character); if (validated.projectId !== expectedProjectId)
        throw new Error("Project character state contains a character from another project."); if (ids.has(validated.id))
        throw new Error(`Duplicate character id \"${validated.id}\" in project state.`); ids.add(validated.id); return cloneCharacter(validated); });
}
function validateOptionalVisualIdentities(value, expectedProjectId) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value))
        throw new Error("Invalid project visual identity state.");
    const ids = new Set();
    const characters = new Set();
    return value.map((identity) => { const validated = (0, character_visual_continuity_1.validateVisualCharacterIdentity)(identity); if (validated.projectId !== expectedProjectId)
        throw new Error("Project visual identity state contains an identity from another project."); if (ids.has(validated.id))
        throw new Error(`Duplicate visual identity id \"${validated.id}\" in project state.`); if (characters.has(validated.characterId))
        throw new Error(`Duplicate visual identity for character \"${validated.characterId}\" in project state.`); ids.add(validated.id); characters.add(validated.characterId); return cloneVisualIdentity(validated); });
}
function validateProjectIllustrationLibrary(value, expectedProjectId) { const library = (0, illustration_asset_library_1.validateIllustrationAssetLibraryState)(value); if (library.projectId !== expectedProjectId)
    throw new Error("Project illustration asset library belongs to another project."); return library; }
function validateOptionalBookCoverPlans(value, expectedProjectId) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value))
        throw new Error("Invalid project book cover plan state.");
    const ids = new Set();
    return value.map((plan) => { const validated = validateBookCoverPlan(plan); if (validated.projectId !== expectedProjectId)
        throw new Error("Project book cover plan belongs to another project."); if (ids.has(validated.id))
        throw new Error(`Duplicate book cover plan id \"${validated.id}\".`); ids.add(validated.id); return cloneBookCoverPlan(validated); });
}
function validateOptional(value, validator, expectedProjectId, label) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value))
        throw new Error(`Invalid ${label.toLowerCase()} state.`);
    const items = value;
    const seen = new Set();
    return items.map((item) => { const validated = validator(item); if (validated.projectId !== expectedProjectId)
        throw new Error(`${label} belongs to another project.`); if (typeof validated.id === "string") {
        if (seen.has(validated.id))
            throw new Error(`Duplicate ${label.toLowerCase()} id \"${validated.id}\".`);
        seen.add(validated.id);
    } return JSON.parse(JSON.stringify(validated)); });
}
function validateBookCoverPlan(value) { if (!value || typeof value !== "object")
    throw new Error("Invalid book cover plan."); const plan = value; (0, book_cover_studio_1.validatePublishingConfiguration)(plan.publishing); const expected = (0, book_cover_studio_1.calculateKdpCoverLayout)(plan.publishing); if (plan.formatVersion !== 1 || typeof plan.id !== "string" || typeof plan.projectId !== "string" || expected.dimensions.widthInches !== plan.dimensions.widthInches || expected.dimensions.heightInches !== plan.dimensions.heightInches)
    throw new Error("Invalid or corrupt book cover plan."); return cloneBookCoverPlan(plan); }
function validateBookGenome(value, expectedProjectId) { if (!value || typeof value !== "object")
    throw new Error("Invalid Book Genome."); const candidate = value; if (candidate.projectId !== expectedProjectId)
    throw new Error("Book Genome belongs to another project."); if (candidate.formatVersion !== 1 || typeof candidate.generatedAt !== "string" || !Array.isArray(candidate.nodes))
    throw new Error("Invalid or corrupt Book Genome."); return (0, final_product_systems_1.createBookGenome)({ projectId: expectedProjectId, nodes: candidate.nodes, now: candidate.generatedAt }); }
function cloneMemory(memory) { return { ...memory, provenance: memory.provenance.map((item) => ({ ...item })), relatedMemoryIds: [...memory.relatedMemoryIds], relevanceTags: [...memory.relevanceTags] }; }
function cloneCharacter(character) { return (0, character_bible_1.validateCharacterRecord)(JSON.parse(JSON.stringify(character))); }
function cloneVisualIdentity(identity) { return (0, character_visual_continuity_1.validateVisualCharacterIdentity)(JSON.parse(JSON.stringify(identity))); }
function cloneIllustrationAssetLibrary(library) { return (0, illustration_asset_library_1.validateIllustrationAssetLibraryState)(JSON.parse(JSON.stringify(library))); }
function cloneBookCoverPlan(plan) { return JSON.parse(JSON.stringify(plan)); }
function isMemoryRecord(value) { if (!value || typeof value !== "object")
    return false; const memory = value; return typeof memory.id === "string" && typeof memory.projectId === "string" && typeof memory.class === "string" && typeof memory.authority === "string" && typeof memory.summary === "string" && typeof memory.content === "string" && typeof memory.createdAt === "string" && typeof memory.updatedAt === "string" && Array.isArray(memory.provenance) && Array.isArray(memory.relatedMemoryIds) && Array.isArray(memory.relevanceTags); }
function isMissingFile(error) { return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"; }
//# sourceMappingURL=file-project-store.js.map