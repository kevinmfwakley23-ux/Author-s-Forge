import test from "node:test";
import assert from "node:assert/strict";
import { applyManuscriptImport, previewManuscriptImport } from "../dist/application/studio-manuscript-import.js";
import { createStudioWorkspace } from "../dist/domain/studio-workspace.js";

function b64(value) { return Buffer.from(value, "utf8").toString("base64"); }

function storedZipEntry(name, content) {
  const filename = Buffer.from(name, "utf8");
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(filename.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(filename.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);

  const centralOffset = local.length + filename.length + data.length;
  const centralSize = central.length + filename.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([local, filename, data, central, filename, eocd]);
}

test("Markdown manuscript preview detects chapters and scene breaks without mutation", () => {
  const source = `# Chapter One — Arrival\n\nMara reached the station before dawn.\n\n***\n\nThe platform lights went dark.\n\n# Chapter Two — The Call\n\nHer phone rang once.`;
  const preview = previewManuscriptImport({ fileName: "winter-gate.md", dataBase64: b64(source) });
  assert.equal(preview.format, "markdown");
  assert.equal(preview.suggestedBookTitle, "winter gate");
  assert.equal(preview.chapterCount, 2);
  assert.equal(preview.sceneCount, 3);
  assert.equal(preview.chapters[0].title, "Chapter One — Arrival");
  assert.equal(preview.chapters[0].scenes[0].content, "Mara reached the station before dawn.");
  assert.equal(preview.chapters[0].scenes[1].content, "The platform lights went dark.");
  assert.equal(preview.chapters[1].scenes[0].content, "Her phone rang once.");
  assert.match(preview.sourceSha256, /^[a-f0-9]{64}$/);
});

test("DOCX manuscript preview reads Word Heading 1 paragraphs and preserves prose", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter One</w:t></w:r></w:p>
<w:p><w:r><w:t>Mara &amp; Elias crossed the yard.</w:t></w:r></w:p>
<w:p><w:r><w:t>***</w:t></w:r></w:p>
<w:p><w:r><w:t>The gate opened.</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter Two</w:t></w:r></w:p>
<w:p><w:r><w:t>Snow covered the tracks.</w:t></w:r></w:p>
</w:body></w:document>`;
  const docx = storedZipEntry("word/document.xml", xml);
  const preview = previewManuscriptImport({ fileName: "Winter Gate.docx", dataBase64: docx.toString("base64") });
  assert.equal(preview.format, "docx");
  assert.equal(preview.chapterCount, 2);
  assert.equal(preview.sceneCount, 3);
  assert.equal(preview.chapters[0].scenes[0].content, "Mara & Elias crossed the yard.");
  assert.equal(preview.chapters[0].scenes[1].content, "The gate opened.");
  assert.equal(preview.chapters[1].scenes[0].content, "Snow covered the tracks.");
});

test("applying a preview creates a new durable book with source provenance and never overwrites another book", () => {
  const preview = previewManuscriptImport({ fileName: "draft.txt", dataBase64: b64("Chapter 1\n\nFirst imported paragraph.\n\nChapter 2\n\nSecond imported paragraph."), bookTitle: "Imported Draft" });
  const original = createStudioWorkspace();
  const result = applyManuscriptImport({ workspace: original, preview, title: "Imported Draft", kind: "novel", now: "2026-09-02T20:00:00.000Z" });
  assert.equal(original.books.length, 0, "input workspace must remain immutable");
  assert.equal(result.workspace.books.length, 1);
  assert.equal(result.workspace.activeBookId, result.importedBookId);
  const book = result.workspace.books[0];
  assert.equal(book.title, "Imported Draft");
  assert.match(book.description, /Imported from draft\.txt/);
  assert.match(book.description, /source SHA-256 [a-f0-9]{64}/);
  assert.equal(book.chapters.length, 2);
  assert.equal(book.chapters[0].scenes[0].content, "First imported paragraph.");
  assert.equal(book.chapters[1].scenes[0].content, "Second imported paragraph.");
});

test("content before the first detected chapter is retained and called out for review", () => {
  const preview = previewManuscriptImport({ fileName: "preface.txt", dataBase64: b64("Copyright note\n\nChapter 1\n\nOpening prose.") });
  assert.equal(preview.chapterCount, 1);
  assert.equal(preview.chapters[0].scenes[0].content, "Copyright note\n\nOpening prose.");
  assert.ok(preview.warnings.some((warning) => /before the first detected chapter/i.test(warning)));
});

test("unsupported, malformed, and oversized manuscript sources fail explicitly", () => {
  assert.throws(() => previewManuscriptImport({ fileName: "draft.pdf", dataBase64: b64("not a pdf") }), /Unsupported manuscript format/);
  assert.throws(() => previewManuscriptImport({ fileName: "draft.txt", dataBase64: "%%%" }), /not valid base64/);
  assert.throws(() => previewManuscriptImport({ fileName: "draft.docx", dataBase64: b64("not a zip") }), /valid ZIP package/);
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 65).toString("base64");
  assert.throws(() => previewManuscriptImport({ fileName: "huge.txt", dataBase64: oversized }), /5 MiB source-file limit/);
});
