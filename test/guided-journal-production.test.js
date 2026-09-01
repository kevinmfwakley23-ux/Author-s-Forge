const test = require("node:test");
const assert = require("node:assert/strict");
const { generateGuidedJournal } = require("../dist/domain/guided-journal.js");
const { defaultJournalInteriorFormat } = require("../dist/domain/guided-journal-layout.js");
const { GuidedJournalProductionService } = require("../dist/application/guided-journal-production.js");

function makeJournal(pageStyle) {
  const categories = ["remember", "discover", "challenge", "create", "become", "hope"];
  return generateGuidedJournal({
    id: `journal-${pageStyle}`,
    projectId: "project-1",
    title: `Journal ${pageStyle}`,
    seed: `seed-${pageStyle}`,
    promptCount: 6,
    promptLibrary: Array.from({ length: 12 }, (_, i) => ({ id: `${pageStyle}-${i}`, category: categories[i % categories.length], text: `What matters about moment ${i + 1}?`, tags: [], enabled: true })),
    pageStyle,
    responsePagesPerPrompt: 1,
    now: "2026-09-01T00:00:00.000Z",
  });
}

for (const style of ["lined", "lightly-lined", "blank", "dot-grid", "guided-response"]) {
  test(`renders a real ${style} PDF interior with exact production page count`, () => {
    const journal = makeJournal(style);
    const format = defaultJournalInteriorFormat(style, 1);
    const result = new GuidedJournalProductionService().renderPdf({ journal, bookId: `book-${style}`, author: "Author Name", format, now: "2026-09-01T00:00:00.000Z" });
    const bytes = Buffer.from(result.artifact.contentBase64, "base64");
    const text = bytes.toString("binary");
    assert.ok(text.startsWith("%PDF-1.4"));
    assert.equal((text.match(/\/Type \/Page\b/g) || []).length, result.layout.totalPages);
    assert.equal(result.artifact.format, "kdp-pdf");
    assert.equal(result.artifact.mimeType, "application/pdf");
    assert.ok(result.artifact.byteLength > 500);
    assert.match(result.artifact.sha256, /^[a-f0-9]{64}$/);
  });
}

test("lined and blank interiors produce materially different page drawing commands", () => {
  const service = new GuidedJournalProductionService();
  const lined = service.renderPdf({ journal: makeJournal("lined"), bookId: "book-lined", author: "Author", format: defaultJournalInteriorFormat("lined", 1), now: "2026-09-01T00:00:00.000Z" });
  const blank = service.renderPdf({ journal: makeJournal("blank"), bookId: "book-blank", author: "Author", format: defaultJournalInteriorFormat("blank", 1), now: "2026-09-01T00:00:00.000Z" });
  const linedPdf = Buffer.from(lined.artifact.contentBase64, "base64").toString("binary");
  const blankPdf = Buffer.from(blank.artifact.contentBase64, "base64").toString("binary");
  assert.ok((linedPdf.match(/ l S/g) || []).length > (blankPdf.match(/ l S/g) || []).length);
});
