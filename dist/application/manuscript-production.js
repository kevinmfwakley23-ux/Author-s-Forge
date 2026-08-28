"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManuscriptProductionService = void 0;
const node_crypto_1 = require("node:crypto");
const manuscript_production_1 = require("../domain/manuscript-production");
class ManuscriptProductionService {
    render(manuscript, options, now = new Date().toISOString()) {
        const book = (0, manuscript_production_1.normalizeProductionManuscript)(manuscript);
        (0, manuscript_production_1.validateProductionOptions)(options);
        const bytes = renderBytes(book, options);
        const format = options.format;
        const safe = book.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "manuscript";
        const artifact = { formatVersion: 1, id: `production-${book.bookId}-${format}-${Date.parse(now)}`, projectId: book.projectId, bookId: book.bookId, format, mimeType: (0, manuscript_production_1.mimeFor)(format), fileName: `${safe}${(0, manuscript_production_1.extensionFor)(format)}`, byteLength: bytes.length, sha256: (0, node_crypto_1.createHash)("sha256").update(bytes).digest("hex"), generatedAt: new Date(now).toISOString(), contentBase64: bytes.toString("base64") };
        const issues = (0, manuscript_production_1.validateProductionArtifact)(artifact);
        if (issues.some(i => i.severity === "error"))
            throw new Error(issues.map(i => i.message).join(" "));
        return Object.freeze(artifact);
    }
    validate(artifact) { return (0, manuscript_production_1.validateProductionArtifact)(artifact); }
}
exports.ManuscriptProductionService = ManuscriptProductionService;
function renderBytes(book, o) { if (o.format.includes("docx"))
    return docx(book, o); if (o.format.includes("epub"))
    return epub(book, o); return pdf(book, o); }
function sections(book, o) {
    const out = [];
    const front = [...book.frontMatter];
    if (o.includeTitlePage !== false && !front.some(s => s.kind === "title-page"))
        front.unshift({ kind: "title-page", title: book.title, body: book.author });
    if (!front.some(s => s.kind === "copyright"))
        front.push({ kind: "copyright", title: "Copyright", body: `Copyright ${new Date().getFullYear()} ${book.author}. All rights reserved.` });
    if (o.includeToc !== false && !front.some(s => s.kind === "toc"))
        front.push({ kind: "toc", title: "Contents", body: book.chapters.map(c => `${c.number}. ${c.title}`).join("\n") });
    for (const s of front)
        out.push({ heading: s.title, body: s.body, kind: s.kind });
    for (const c of book.chapters) {
        out.push({ heading: `Chapter ${c.number}: ${c.title}`, body: "", kind: "chapter" });
        for (const s of c.scenes)
            out.push({ heading: s.title, body: s.body, kind: "scene" });
    }
    for (const s of book.backMatter)
        out.push({ heading: s.title, body: s.body, kind: s.kind });
    return out;
}
function pageSize(o) { return o.pageSize === "6x9" ? [8640, 12960] : o.pageSize === "5x8" ? [7200, 11520] : o.pageSize === "a4" ? [11906, 16838] : [12240, 15840]; }
function docx(book, o) {
    const body = sections(book, o).map(s => s.heading ? `<w:p><w:pPr>${s.kind === "chapter" ? "<w:pageBreakBefore/>" : ""}</w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xml(s.heading)}</w:t></w:r></w:p>${paragraphs(s.body)}` : paragraphs(s.body)).join("");
    const footer = o.pageNumbers !== false ? `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldSimple w:instr="PAGE"/></w:r></w:p></w:ftr>` : `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>`;
    const [w, h] = pageSize(o);
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>${o.pageNumbers !== false ? "<w:footerReference w:type=\"default\" r:id=\"rId2\"/>" : ""}</w:sectPr></w:body></w:document>`;
    const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${o.pageNumbers !== false ? "<Override PartName=\"/word/footer1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml\"/>" : ""}</Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    const docrels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${o.pageNumbers !== false ? "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer\" Target=\"footer1.xml\"/>" : ""}</Relationships>`;
    const entries = [['[Content_Types].xml', Buffer.from(types)], ['_rels/.rels', Buffer.from(rels)], ['word/document.xml', Buffer.from(document)], ['word/_rels/document.xml.rels', Buffer.from(docrels)]];
    if (o.pageNumbers !== false)
        entries.push(['word/footer1.xml', Buffer.from(footer)]);
    return zip(entries);
}
function epub(book, o) {
    const items = [];
    let spine = "";
    let manifest = "";
    const title = xml(book.title);
    const all = sections(book, o);
    const front = all.filter(s => s.kind !== "chapter" && s.kind !== "scene");
    const addXhtml = (id, file, heading, content) => { items.push([`OEBPS/${file}`, Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xml(heading)}</title></head><body><h1>${xml(heading)}</h1>${content}</body></html>`)]); manifest += `<item id="${id}" href="${file}" media-type="application/xhtml+xml"/>`; spine += `<itemref idref="${id}"/>`; };
    if (front.length)
        addXhtml("front-matter", "front.xhtml", "Front Matter", front.map(s => `<h2>${xml(s.heading ?? s.kind)}</h2>${htmlParagraphs(s.body)}`).join(""));
    for (const c of book.chapters)
        addXhtml(`chapter-${c.number}`, `chapter-${c.number}.xhtml`, `Chapter ${c.number}: ${c.title}`, c.scenes.map(s => `<h2>${xml(s.title)}</h2>${htmlParagraphs(s.body)}`).join(""));
    if (book.backMatter.length)
        addXhtml("back-matter", "back.xhtml", "Back Matter", book.backMatter.map(s => `<h2>${xml(s.title ?? s.kind)}</h2>${htmlParagraphs(s.body)}`).join(""));
    const nav = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol>${book.chapters.map(c => `<li><a href="chapter-${c.number}.xhtml">${c.number}. ${xml(c.title)}</a></li>`).join("")}</ol></nav></body></html>`;
    items.push(["OEBPS/nav.xhtml", Buffer.from(nav)]);
    manifest += `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`;
    const opf = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${xml(book.bookId)}</dc:identifier><dc:title>${title}</dc:title><dc:creator>${xml(book.author)}</dc:creator><dc:language>en</dc:language></metadata><manifest>${manifest}</manifest><spine>${spine}</spine></package>`;
    items.push(["OEBPS/content.opf", Buffer.from(opf)]);
    items.push(["META-INF/container.xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`)]);
    return zip([["mimetype", Buffer.from("application/epub+zip")], ...items], true);
}
function pdf(book, o) {
    const lines = sections(book, o).flatMap(s => [(s.heading ? `### ${s.heading}` : "").trim(), ...s.body.split(/\r?\n/)]).filter(Boolean).flatMap(l => wrap(l, 88));
    const size = o.pageSize === "6x9" ? [432, 648] : o.pageSize === "5x8" ? [360, 576] : o.pageSize === "a4" ? [595, 842] : [612, 792];
    const linesPerPage = Math.floor((size[1] - 100) / 14);
    const pages = [];
    for (let i = 0; i < lines.length; i += linesPerPage)
        pages.push(lines.slice(i, i + linesPerPage));
    if (!pages.length)
        pages.push([]);
    const objects = [];
    const add = (s) => { objects.push(s); return objects.length; };
    const catalog = add("");
    const pagesObj = add("");
    const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const pageRefs = [];
    for (let p = 0; p < pages.length; p++) {
        let stream = "BT /F1 10 Tf 54 738 Td 14 TL ";
        if (o.runningHeader)
            stream += `(${pdfText(o.runningHeader)}) Tj 0 -20 Td `;
        for (const line of pages[p])
            stream += `(${pdfText(line)}) Tj T* `;
        if (o.runningFooter)
            stream += `0 -20 Td (${pdfText(o.runningFooter.replace(/\{page\}/g, String(p + 1)).replace(/\{pages\}/g, String(pages.length)))}) Tj `;
        if (o.pageNumbers !== false)
            stream += `0 -20 Td (Page ${p + 1} of ${pages.length}) Tj `;
        stream += "ET";
        const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
        pageRefs.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${size[0]} ${size[1]}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageRefs.map(r => `${r} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;
    return buildPdf(objects);
}
function paragraphs(v) { return v.split(/\r?\n/).filter(Boolean).map(p => `<w:p><w:r><w:t xml:space="preserve">${xml(p)}</w:t></w:r></w:p>`).join(""); }
function htmlParagraphs(v) { return v.split(/\r?\n/).filter(Boolean).map(p => `<p>${xml(p)}</p>`).join(""); }
function xml(v) { return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function pdfText(v) { return v.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function wrap(v, n) { const out = []; let s = v.trim(); while (s.length > n) {
    let i = s.lastIndexOf(" ", n);
    if (i < 1)
        i = n;
    out.push(s.slice(0, i));
    s = s.slice(i + 1);
} if (s)
    out.push(s); return out; }
function crc32(b) { let c = 0xffffffff; for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++)
        c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
} return (c ^ 0xffffffff) >>> 0; }
function zip(entries, firstStored = false) { const chunks = []; const central = []; let offset = 0; for (let i = 0; i < entries.length; i++) {
    const [name, data] = entries[i];
    const nb = Buffer.from(name);
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0, 6);
    h.writeUInt16LE(0, 8);
    h.writeUInt16LE(0, 10);
    h.writeUInt16LE(0, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(nb.length, 26);
    h.writeUInt16LE(0, 28);
    chunks.push(h, nb, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0, 8);
    c.writeUInt16LE(0, 10);
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(0, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nb.length, 28);
    c.writeUInt16LE(0, 30);
    c.writeUInt16LE(0, 32);
    c.writeUInt16LE(0, 34);
    c.writeUInt16LE(0, 36);
    c.writeUInt32LE(0, 38);
    c.writeUInt32LE(offset, 42);
    central.push(c, nb);
    offset += h.length + nb.length + data.length;
} const cd = Buffer.concat(central); const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(offset, 16); return Buffer.concat([...chunks, cd, e]); }
function buildPdf(objects) { let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const offsets = [0]; for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
} const xref = Buffer.byteLength(out); out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; for (let i = 1; i < offsets.length; i++)
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`; out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`; return Buffer.from(out, "binary"); }
//# sourceMappingURL=manuscript-production.js.map