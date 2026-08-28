"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BACK_MATTER_KINDS = exports.FRONT_MATTER_KINDS = exports.PRODUCTION_FORMATS = exports.MANUSCRIPT_PRODUCTION_FORMAT_VERSION = void 0;
exports.validateProductionManuscript = validateProductionManuscript;
exports.validateProductionOptions = validateProductionOptions;
exports.normalizeProductionManuscript = normalizeProductionManuscript;
exports.requiredFrontMatter = requiredFrontMatter;
exports.requiredBackMatter = requiredBackMatter;
exports.validateProductionArtifact = validateProductionArtifact;
exports.mimeFor = mimeFor;
exports.extensionFor = extensionFor;
exports.MANUSCRIPT_PRODUCTION_FORMAT_VERSION = 1;
exports.PRODUCTION_FORMATS = ["docx", "pdf", "epub", "kdp-docx", "kdp-pdf", "kdp-epub"];
exports.FRONT_MATTER_KINDS = ["title-page", "copyright", "dedication", "epigraph", "toc"];
exports.BACK_MATTER_KINDS = ["author-biography", "acknowledgments", "about-the-author", "back-matter", "series-information"];
function validateProductionManuscript(input) {
    required(input.projectId, "Project id");
    required(input.bookId, "Book id");
    required(input.title, "Book title");
    required(input.author, "Author");
    if (!input.chapters.length)
        throw new Error("At least one chapter is required.");
    const chapterNumbers = new Set();
    const ids = new Set();
    for (const chapter of input.chapters) {
        if (!Number.isInteger(chapter.number) || chapter.number < 1)
            throw new Error("Chapter number must be a positive integer.");
        if (chapterNumbers.has(chapter.number))
            throw new Error(`Duplicate chapter number ${chapter.number}.`);
        chapterNumbers.add(chapter.number);
        if (ids.has(chapter.id))
            throw new Error(`Duplicate chapter id ${chapter.id}.`);
        ids.add(chapter.id);
        required(chapter.title, "Chapter title");
        for (const scene of chapter.scenes) {
            if (ids.has(scene.id))
                throw new Error(`Duplicate scene id ${scene.id}.`);
            ids.add(scene.id);
            required(scene.title, "Scene title");
        }
    }
    for (const section of [...input.frontMatter, ...input.backMatter]) {
        if (!section.body.trim())
            throw new Error(`Production section ${section.kind} cannot be empty.`);
    }
    if (input.seriesNumber !== undefined && (!Number.isInteger(input.seriesNumber) || input.seriesNumber < 1))
        throw new Error("Series number must be a positive integer.");
}
function validateProductionOptions(options) { if (!exports.PRODUCTION_FORMATS.includes(options.format))
    throw new Error("Unsupported production format."); if (options.pageNumbers !== undefined && typeof options.pageNumbers !== "boolean")
    throw new Error("pageNumbers must be boolean."); }
function normalizeProductionManuscript(input) {
    validateProductionManuscript(input);
    const chapters = [...input.chapters].sort((a, b) => a.number - b.number || a.id.localeCompare(b.id)).map(c => ({ ...c, title: c.title.trim(), scenes: c.scenes.map(s => ({ ...s, title: s.title.trim(), body: s.body })) }));
    return { ...input, title: input.title.trim(), author: input.author.trim(), chapters, frontMatter: input.frontMatter.map(cloneSection), backMatter: input.backMatter.map(cloneSection) };
}
function requiredFrontMatter(manuscript) { return ["title-page", "copyright"]; }
function requiredBackMatter() { return []; }
function validateProductionArtifact(artifact) {
    const issues = [];
    if (artifact.formatVersion !== exports.MANUSCRIPT_PRODUCTION_FORMAT_VERSION)
        issues.push({ code: "VERSION", severity: "error", message: "Unsupported production artifact version." });
    if (!artifact.contentBase64)
        issues.push({ code: "EMPTY", severity: "error", message: "Production artifact contains no file content." });
    let bytes;
    try {
        bytes = Buffer.from(artifact.contentBase64, "base64");
    }
    catch {
        issues.push({ code: "BASE64", severity: "error", message: "Artifact content is not valid base64." });
        return issues;
    }
    if (bytes.length !== artifact.byteLength)
        issues.push({ code: "BYTE_LENGTH", severity: "error", message: "Artifact byte length does not match encoded content." });
    const expectedMime = mimeFor(artifact.format);
    if (artifact.mimeType !== expectedMime)
        issues.push({ code: "MIME", severity: "error", message: "Artifact MIME type does not match its format." });
    if (!artifact.fileName.toLowerCase().endsWith(extensionFor(artifact.format)))
        issues.push({ code: "EXTENSION", severity: "error", message: "Artifact filename extension does not match its format." });
    return issues;
}
function mimeFor(format) { if (format.includes("docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; if (format.includes("pdf"))
    return "application/pdf"; return "application/epub+zip"; }
function extensionFor(format) { return format.includes("docx") ? ".docx" : format.includes("pdf") ? ".pdf" : ".epub"; }
function required(value, label) { if (!value.trim())
    throw new Error(`${label} is required.`); }
function cloneSection(s) { return { ...s }; }
//# sourceMappingURL=manuscript-production.js.map