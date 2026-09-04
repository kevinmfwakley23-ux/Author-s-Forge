const assert = require("node:assert/strict");
const test = require("node:test");
const { BookCoverStudioService, calculateKdpCoverLayout, validateBookCoverFile } = require("../.forge-build");

test("Mission 015 calculates a KDP paperback exterior from publishing configuration", () => {
  const publishing = { platform: "kdp", binding: "paperback", interiorType: "black-white", paperType: "white", trimWidthInches: 6, trimHeightInches: 9, pageCount: 300, bleedInches: 0.125, readingDirection: "ltr" };
  const { dimensions, zones } = calculateKdpCoverLayout(publishing);
  assert.equal(dimensions.spineWidthInches, 0.6756);
  assert.equal(dimensions.widthInches, 12.9256);
  assert.equal(dimensions.heightInches, 9.25);
  assert.equal(zones.front.width, 6);
  assert.equal(zones.back.width, 6);
  assert.equal(zones.spine.width, 0.6756);
  assert.equal(zones.safeMarginInches, 0.25);
});

test("Mission 015 creates and validates a complete paperback cover plan", () => {
  const service = new BookCoverStudioService();
  const plan = service.create({ id: "cover-1", projectId: "project-1", bookId: "book-1", format: "paperback", publishing: { platform: "kdp", binding: "paperback", interiorType: "black-white", paperType: "white", trimWidthInches: 6, trimHeightInches: 9, pageCount: 300, bleedInches: 0.125, readingDirection: "ltr" }, title: "The Example", author: "Author Example", frontPrompt: "A finished production-ready front cover", spineText: "The Example", backText: "A production-ready back cover blurb", outputFormat: "pdf", dpi: 300, version: 1, approvalStatus: "draft", now: "2026-01-01T00:00:00Z" });
  assert.equal(plan.dimensions.widthInches, 12.9256);
  assert.equal(plan.zones.front.height, 9);
  const issues = service.validate("cover-1", { format: "pdf", widthInches: 12.9256, heightInches: 9.25, dpi: 300, sizeBytes: 1000000, hasFront: true, hasBack: true, hasSpine: true, hasCropMarks: false, hasTemplateText: false, flattened: true, fontsEmbedded: true, encrypted: false });
  assert.deepEqual(issues, []);
});

test("print cover metadata follows the real KDP binding instead of preserving contradictory caller metadata", () => {
  const service = new BookCoverStudioService();
  const plan = service.create({
    id: "cover-hardcover",
    projectId: "project-1",
    bookId: "book-1",
    format: "paperback",
    publishing: { platform: "kdp", binding: "hardcover", interiorType: "black-white", paperType: "white", trimWidthInches: 6, trimHeightInches: 9, pageCount: 120, bleedInches: 0.125, readingDirection: "ltr" },
    title: "Hardcover Truth",
    author: "Author Example",
    frontPrompt: "Hardcover front direction",
    spineText: "Hardcover Truth",
    backText: "Hardcover back copy",
    outputFormat: "pdf",
    dpi: 300,
    version: 1,
    approvalStatus: "draft",
    now: "2026-01-01T00:00:00Z",
  });
  assert.equal(plan.format, "hardcover");
  assert.equal(plan.publishing.binding, "hardcover");
  assert.equal(plan.dimensions.wrapInches, 0.51);
  assert.equal(plan.zones.safeMarginInches, 0.635);
});

test("Mission 015 rejects production files that violate publishing requirements", () => {
  const publishing = { platform: "kdp", binding: "paperback", interiorType: "black-white", paperType: "white", trimWidthInches: 6, trimHeightInches: 9, pageCount: 100, bleedInches: 0.125, readingDirection: "ltr" };
  const layout = calculateKdpCoverLayout(publishing);
  const plan = { id: "cover", projectId: "p", bookId: "b", format: "paperback", publishing, dimensions: layout.dimensions, zones: layout.zones, title: "x", author: "y", frontPrompt: "x", spineText: "x", backText: "x", outputFormat: "pdf", dpi: 300, version: 1, approvalStatus: "draft", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
  const issues = validateBookCoverFile(plan, { format: "pdf", widthInches: plan.dimensions.widthInches + 1, heightInches: plan.dimensions.heightInches, dpi: 72, sizeBytes: 700 * 1024 * 1024, hasFront: true, hasBack: true, hasSpine: false, hasCropMarks: true, hasTemplateText: true, flattened: false, fontsEmbedded: false, encrypted: true });
  assert.ok(issues.some((issue) => issue.code === "DIMENSIONS_MISMATCH"));
  assert.ok(issues.some((issue) => issue.code === "LOW_RESOLUTION"));
  assert.ok(issues.some((issue) => issue.code === "MISSING_COVER_ZONE"));
  assert.ok(issues.some((issue) => issue.code === "CROP_MARKS"));
  assert.ok(issues.some((issue) => issue.code === "UNFLATTENED"));
  assert.ok(issues.some((issue) => issue.code === "FONTS_NOT_EMBEDDED"));
  assert.ok(issues.some((issue) => issue.code === "ENCRYPTED"));
});
