"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COVER_APPROVAL_STATUSES = exports.PAPER_TYPES = exports.INTERIOR_TYPES = exports.BINDINGS = exports.COVER_FORMATS = exports.BOOK_COVER_STUDIO_FORMAT_VERSION = void 0;
exports.calculateKdpCoverLayout = calculateKdpCoverLayout;
exports.validatePublishingConfiguration = validatePublishingConfiguration;
exports.validateBookCoverFile = validateBookCoverFile;
exports.createBookCoverPlan = createBookCoverPlan;
exports.BOOK_COVER_STUDIO_FORMAT_VERSION = 1;
exports.COVER_FORMATS = ["ebook", "paperback", "hardcover", "series", "boxed-set", "promotional", "audiobook"];
exports.BINDINGS = ["paperback", "hardcover"];
exports.INTERIOR_TYPES = ["black-white", "premium-color", "standard-color"];
exports.PAPER_TYPES = ["white", "cream", "groundwood"];
exports.COVER_APPROVAL_STATUSES = ["draft", "pending", "approved", "rejected"];
function calculateKdpCoverLayout(config) {
    validatePublishingConfiguration(config);
    const bleed = config.bleedInches;
    let spine = 0;
    if (config.binding === "paperback") {
        if (config.pageCount < 24)
            throw new Error("KDP paperback covers require at least 24 pages.");
        const factor = config.paperType === "cream" ? 0.0025 : config.paperType === "groundwood" ? 0.00235 : config.interiorType === "premium-color" || config.interiorType === "standard-color" ? 0.002347 : 0.002252;
        spine = config.pageCount * factor;
    }
    else {
        if (config.pageCount < 75)
            throw new Error("KDP hardcover page count must be at least 75 pages for this cover planning model.");
        // KDP hardcover templates include wrap, hinge, spine and case dimensions that vary by selected production configuration. The provider template remains authoritative for final production geometry.
        spine = 0.635 + config.pageCount * 0.002252;
    }
    const wrap = config.binding === "hardcover" ? 0.51 : 0;
    const width = config.trimWidthInches * 2 + spine + bleed * 2 + wrap * 2;
    const height = config.trimHeightInches + bleed * 2 + wrap * 2;
    const frontX = width / 2 + spine / 2;
    const backX = frontX - spine - config.trimWidthInches;
    const trimY = wrap + bleed;
    const zones = {
        front: { x: frontX, y: trimY, width: config.trimWidthInches, height: config.trimHeightInches },
        spine: { x: width / 2 - spine / 2, y: trimY, width: spine, height: config.trimHeightInches },
        back: { x: backX, y: trimY, width: config.trimWidthInches, height: config.trimHeightInches },
        barcodeSafeArea: { x: backX + config.trimWidthInches - 2, y: trimY + 0.76, width: 2, height: 1.2 },
        trim: { x: bleed + wrap, y: trimY, width: config.trimWidthInches * 2 + spine, height: config.trimHeightInches },
        safeMarginInches: config.binding === "hardcover" ? 0.635 : 0.25
    };
    return { dimensions: { widthInches: round(width), heightInches: round(height), spineWidthInches: round(spine), bleedInches: bleed, wrapInches: wrap }, zones };
}
function validatePublishingConfiguration(config) {
    if (config.platform !== "kdp")
        throw new Error("Unsupported publishing platform.");
    if (!exports.BINDINGS.includes(config.binding))
        throw new Error("Invalid binding.");
    if (!Number.isFinite(config.trimWidthInches) || config.trimWidthInches <= 0 || !Number.isFinite(config.trimHeightInches) || config.trimHeightInches <= 0)
        throw new Error("Trim dimensions must be positive numbers.");
    if (!Number.isInteger(config.pageCount) || config.pageCount < 1)
        throw new Error("Page count must be a positive integer.");
    if (config.binding === "paperback" && (config.trimWidthInches < 4 || config.trimWidthInches > 8.5 || config.trimHeightInches < 6 || config.trimHeightInches > 11.69))
        throw new Error("Trim size is outside KDP paperback calculator bounds.");
    if (config.bleedInches !== 0.125)
        throw new Error("KDP cover bleed must be 0.125 inches (3.2 mm).");
    if (config.binding === "paperback" && !config.interiorType)
        throw new Error("Paperback interior type is required.");
    if (config.binding === "paperback" && !config.paperType)
        throw new Error("Paperback paper type is required.");
}
function validateBookCoverFile(plan, file) {
    const issues = [];
    if (file.format !== plan.outputFormat)
        issues.push({ code: "FORMAT_MISMATCH", severity: "error", message: "Output file format does not match the cover plan." });
    if (Math.abs(file.widthInches - plan.dimensions.widthInches) > 0.001 || Math.abs(file.heightInches - plan.dimensions.heightInches) > 0.001)
        issues.push({ code: "DIMENSIONS_MISMATCH", severity: "error", message: "Output dimensions do not match the calculated production layout." });
    if (file.dpi < 300)
        issues.push({ code: "LOW_RESOLUTION", severity: "error", message: "KDP cover artwork must be at least 300 DPI." });
    if (file.sizeBytes > 650 * 1024 * 1024)
        issues.push({ code: "FILE_TOO_LARGE", severity: "error", message: "Cover file exceeds the 650 MB KDP limit." });
    if (!file.hasFront || !file.hasBack || (plan.publishing.binding === "paperback" || plan.publishing.binding === "hardcover") && !file.hasSpine)
        issues.push({ code: "MISSING_COVER_ZONE", severity: "error", message: "The complete exterior cover must contain the required front, back and spine zones." });
    if (file.hasCropMarks)
        issues.push({ code: "CROP_MARKS", severity: "error", message: "Cover files must not contain crop or trim marks." });
    if (file.hasTemplateText)
        issues.push({ code: "TEMPLATE_TEXT", severity: "error", message: "Cover files must not contain template or guide text." });
    if (!file.flattened)
        issues.push({ code: "UNFLATTENED", severity: "error", message: "Cover transparency/layers must be flattened for print submission." });
    if (!file.fontsEmbedded)
        issues.push({ code: "FONTS_NOT_EMBEDDED", severity: "error", message: "Cover fonts must be embedded for print submission." });
    if (file.encrypted)
        issues.push({ code: "ENCRYPTED", severity: "error", message: "Cover files must not be locked or encrypted." });
    return issues;
}
function createBookCoverPlan(input) {
    validatePublishingConfiguration(input.publishing);
    const now = timestamp(input.now ?? new Date().toISOString());
    const { dimensions, zones } = calculateKdpCoverLayout(input.publishing);
    if (!input.title.trim() || !input.author.trim())
        throw new Error("Cover title and author are required.");
    if (!input.frontPrompt.trim() || !input.backText.trim())
        throw new Error("Cover front prompt and back text are required.");
    if (input.dpi < 300)
        throw new Error("Cover plan DPI must be at least 300.");
    return Object.freeze({ ...input, formatVersion: exports.BOOK_COVER_STUDIO_FORMAT_VERSION, id: id(input.id), projectId: id(input.projectId), bookId: id(input.bookId), title: input.title.trim(), author: input.author.trim(), frontPrompt: input.frontPrompt.trim(), spineText: input.spineText.trim(), backText: input.backText.trim(), dimensions, zones, createdAt: now, updatedAt: now });
}
function id(value) { if (!value.trim() || value !== value.trim())
    throw new Error("Identifier is required and cannot have surrounding whitespace."); return value; }
function timestamp(value) { if (Number.isNaN(Date.parse(value)))
    throw new Error("Timestamp must be valid."); return new Date(value).toISOString(); }
function round(value) { return Math.round(value * 1000000) / 1000000; }
//# sourceMappingURL=book-cover-studio.js.map