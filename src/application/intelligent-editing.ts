import {
  createEditingDocument,
  createEditorialFinding,
  createEditorialReport,
  validateEditorialReport,
  EDITOR_ROLES,
  type EditingDocument,
  type EditorialFinding,
  type EditorialReport,
  type EditorRole,
  type FindingKind,
  type FindingSeverity
} from "../domain/intelligent-editing";

export interface EditingRequest { readonly document: EditingDocument; readonly roles: readonly EditorRole[]; readonly reportId: string; readonly generatedAt?: string; }

const KIND_ROLES: Readonly<Record<FindingKind, readonly EditorRole[]>> = {
  pacing: ["pacing", "structural", "developmental", "genre"],
  "character-consistency": ["character", "continuity", "dialogue"],
  "plot-hole": ["developmental"],
  "continuity-conflict": ["continuity"],
  repetition: ["line", "copy", "dialogue"],
  "weak-scene": ["developmental", "structural", "pacing"],
  "unresolved-thread": ["developmental"],
  "unnecessary-exposition": ["pacing", "genre"],
  "dialogue-problem": ["dialogue", "character"],
  "pov-violation": ["continuity", "character"],
  "tense-inconsistency": ["continuity", "copy"],
  cliche: ["line", "genre"],
  "overused-word": ["line", "copy", "proofreading"],
  "sentence-rhythm": ["line", "proofreading"],
  "chapter-balance": ["structural", "developmental"],
  "genre-fit": ["genre"]
};

export class IntelligentEditingService {
  analyze(request: EditingRequest): EditorialReport {
    const document = createEditingDocument(request.document);
    if (request.roles.length === 0) throw new Error("At least one editorial role is required.");
    for (const role of request.roles) if (!EDITOR_ROLES.includes(role)) throw new Error(`Unknown editorial role "${role}".`);
    const findings: EditorialFinding[] = [];
    for (const role of request.roles) findings.push(...this.analyzeRole(document, role));
    const deduped = deduplicate(findings);
    const report = createEditorialReport({
      id: request.reportId,
      target: document.target,
      roles: [...new Set(request.roles)],
      findings: deduped,
      summary: summarize(deduped),
      generatedAt: request.generatedAt ?? new Date().toISOString()
    });
    validateEditorialReport(report, document.text);
    return report;
  }

  private analyzeRole(document: EditingDocument, role: EditorRole): EditorialFinding[] {
    const out: EditorialFinding[] = [];
    const allowed = (kind: FindingKind) => KIND_ROLES[kind].includes(role);
    if (allowed("overused-word")) out.push(...overusedWords(document, role));
    if (allowed("repetition")) out.push(...repeatedSentences(document, role));
    if (allowed("sentence-rhythm")) out.push(...rhythm(document, role));
    if (allowed("cliche")) out.push(...cliches(document, role));
    if (allowed("tense-inconsistency") && document.tense) out.push(...tense(document, role));
    if (allowed("pov-violation") && document.pov) out.push(...pov(document, role));
    if (allowed("dialogue-problem")) out.push(...dialogue(document, role));
    if (allowed("character-consistency") && document.expectedCharacterNames?.length) out.push(...characterConsistency(document, role));
    if (allowed("continuity-conflict")) out.push(...requiredFacts(document, role));
    if (allowed("unresolved-thread")) out.push(...unresolvedThreads(document, role));
    if (allowed("unnecessary-exposition")) out.push(...exposition(document, role));
    if (allowed("weak-scene") || allowed("pacing")) out.push(...scenePacing(document, role));
    if (allowed("chapter-balance")) out.push(...chapterBalance(document, role));
    if (allowed("plot-hole")) out.push(...plotHoles(document, role));
    if (allowed("genre-fit") && document.genreExpectations?.length) out.push(...genreFit(document, role));
    return out;
  }
}

function finding(document: EditingDocument, role: EditorRole, kind: FindingKind, severity: FindingSeverity, message: string, recommendation: string, start: number, end: number, confidence: number): EditorialFinding {
  return createEditorialFinding({ id: `${role}:${kind}:${start}:${end}`, role, kind, severity, message, recommendation, start, end, excerpt: document.text.slice(start, end), confidence });
}
function words(text: string): Array<{ word: string; start: number; end: number }> { const result: Array<{ word: string; start: number; end: number }> = []; const re = /[A-Za-z][A-Za-z'-]*/g; let m; while ((m = re.exec(text))) result.push({ word: m[0].toLowerCase(), start: m.index, end: re.lastIndex }); return result; }
function overusedWords(d: EditingDocument, r: EditorRole): EditorialFinding[] { const counts = new Map<string, number[]>(); for (const w of words(d.text)) { if (w.word.length < 5 || STOP.has(w.word)) continue; const positions = counts.get(w.word) ?? []; positions.push(w.start); counts.set(w.word, positions); } const out: EditorialFinding[] = []; for (const [word, positions] of counts) if (positions.length >= Math.max(4, Math.ceil(words(d.text).length / 120))) { const start = positions[0]; out.push(finding(d, r, "overused-word", "suggestion", `The word “${word}” appears ${positions.length} times and may be overused.`, "Review repeated uses and vary wording only where it preserves meaning and author voice.", start, start + word.length, 0.91)); } return out; }
function repeatedSentences(d: EditingDocument, r: EditorRole): EditorialFinding[] { const seen = new Map<string, number>(); const out: EditorialFinding[] = []; for (const s of sentences(d.text)) { const key = normalize(s.text); if (key.length < 35) continue; if (seen.has(key)) out.push(finding(d, r, "repetition", "warning", "A substantially repeated sentence appears elsewhere in the document.", "Compare both passages and remove or differentiate only with author approval.", s.start, s.end, 0.96)); else seen.set(key, s.start); } return out; }
function rhythm(d: EditingDocument, r: EditorRole): EditorialFinding[] { const ss = sentences(d.text); const out: EditorialFinding[] = []; for (let i = 2; i < ss.length; i++) { const lengths = [wordCount(ss[i - 2].text), wordCount(ss[i - 1].text), wordCount(ss[i].text)]; if (lengths.every((n) => n >= 28)) out.push(finding(d, r, "sentence-rhythm", "suggestion", "Three consecutive long sentences may flatten sentence rhythm.", "Consider whether a shorter sentence or paragraph break would improve cadence without changing content.", ss[i - 2].start, ss[i].end, 0.78)); } return out; }
function cliches(d: EditingDocument, r: EditorRole): EditorialFinding[] { const patterns = ["at the end of the day", "cold as ice", "heart sank", "dead as a doornail", "time will tell", "only time will tell", "once in a lifetime"]; return phraseFindings(d, r, "cliche", patterns, "A potentially familiar cliché appears.", "Consider a more specific expression if it better serves the established voice."); }
function tense(d: EditingDocument, r: EditorRole): EditorialFinding[] { const out: EditorialFinding[] = []; const pattern = d.tense === "past" ? /\b(is|are|was|were|am)\b/g : /\b(was|were|had|did)\b/g; let m; while ((m = pattern.exec(d.text))) out.push(finding(d, r, "tense-inconsistency", "warning", `The passage contains a ${d.tense === "past" ? "present-oriented" : "past-oriented"} verb that may conflict with the requested ${d.tense} tense.`, "Verify the intended tense against narrative context; do not alter it automatically.", m.index, pattern.lastIndex, 0.63)); return out.slice(0, 20); }
function pov(d: EditingDocument, r: EditorRole): EditorialFinding[] { const patterns = d.pov === "first" ? [/\b(he|she|they)\b/gi] : d.pov === "second" ? [/\b(I|we|he|she|they)\b/gi] : [/\b(I|we)\b/gi]; const out: EditorialFinding[] = []; for (const pattern of patterns) { let m; while ((m = pattern.exec(d.text))) out.push(finding(d, r, "pov-violation", "suggestion", `A ${m[0]}-person reference may conflict with the requested ${d.pov}-person POV.`, "Review the local narrative perspective before changing it; quoted dialogue may be valid.", m.index, pattern.lastIndex, 0.58)); } return out.slice(0, 20); }
function dialogue(d: EditingDocument, r: EditorRole): EditorialFinding[] { const out: EditorialFinding[] = []; const re = /“([^”]*)”|"([^"]*)"/g; let m; while ((m = re.exec(d.text))) { const text = m[1] ?? m[2] ?? ""; if (wordCount(text) > 45) out.push(finding(d, r, "dialogue-problem", "suggestion", "A dialogue turn is unusually long and may need review for natural conversational pacing.", "Check whether the character would realistically sustain this turn and preserve the intended character objective.", m.index, re.lastIndex, 0.81)); } return out; }
function characterConsistency(d: EditingDocument, r: EditorRole): EditorialFinding[] { const out: EditorialFinding[] = []; for (const name of d.expectedCharacterNames ?? []) { const count = words(d.text).filter((w) => w.word === name.toLowerCase()).length; if (count === 0) out.push(finding(d, r, "character-consistency", "warning", `Expected character “${name}” does not appear in the supplied text.`, "Verify whether the character's absence is intentional for this scene.", 0, Math.min(d.text.length, 1), 0.86)); } return out; }
function requiredFacts(d: EditingDocument, r: EditorRole): EditorialFinding[] { const out: EditorialFinding[] = []; for (const fact of d.requiredFacts ?? []) if (!d.text.toLocaleLowerCase().includes(fact.toLocaleLowerCase())) out.push(finding(d, r, "continuity-conflict", "warning", `A supplied required fact is not represented in the analyzed passage: “${fact}”.`, "Verify whether the fact belongs in this passage; absence is a review signal, not proof of a continuity error.", 0, Math.min(d.text.length, 1), 0.74)); return out; }
function unresolvedThreads(d: EditingDocument, r: EditorRole): EditorialFinding[] { const out: EditorialFinding[] = []; for (const thread of d.unresolvedThreads ?? []) if (!d.text.toLocaleLowerCase().includes(thread.toLocaleLowerCase())) out.push(finding(d, r, "unresolved-thread", "suggestion", `The supplied open thread is not visibly addressed: “${thread}”.`, "Confirm whether the thread should remain open or receive a deliberate beat in this passage.", 0, Math.min(d.text.length, 1), 0.72)); return out; }
function exposition(d: EditingDocument, r: EditorRole): EditorialFinding[] { const out: EditorialFinding[] = []; const re = /\b(?:was|were|is|are)\s+[^.!?]{90,}[.!?]/g; let m; while ((m = re.exec(d.text))) out.push(finding(d, r, "unnecessary-exposition", "suggestion", "A long explanatory sentence may be carrying substantial exposition at once.", "Check whether some information can emerge through action, dialogue, or more focused narration.", m.index, re.lastIndex, 0.68)); return out; }
function scenePacing(d: EditingDocument, r: EditorRole): EditorialFinding[] { const paragraphs = d.text.split(/\n\s*\n/); if (paragraphs.length < 3) return []; const avg = paragraphs.reduce((n, p) => n + wordCount(p), 0) / paragraphs.length; const index = paragraphs.findIndex((p) => wordCount(p) > avg * 2.5); if (index < 0) return []; const start = d.text.indexOf(paragraphs[index]); return [finding(d, r, "pacing", "suggestion", "One paragraph is substantially longer than the document's average paragraph and may affect pacing.", "Review the paragraph's purpose and consider a deliberate break if it improves scene movement.", start, start + paragraphs[index].length, 0.75)]; }
function chapterBalance(d: EditingDocument, r: EditorRole): EditorialFinding[] { const paragraphs = d.text.split(/\n\s*\n/).filter(Boolean); if (paragraphs.length < 2) return []; const lengths = paragraphs.map(wordCount); const max = Math.max(...lengths), min = Math.min(...lengths); if (max < min * 4) return []; return [finding(d, r, "chapter-balance", "suggestion", "Paragraph/section lengths vary substantially and may warrant structural review.", "Confirm that section balance reflects deliberate story emphasis rather than accidental imbalance.", 0, d.text.length, 0.7)]; }
function plotHoles(d: EditingDocument, r: EditorRole): EditorialFinding[] { const out: EditorialFinding[] = []; const contradiction = /\b(?:but|however)\b[^.!?]{0,80}\b(?:already|never|always)\b/i.exec(d.text); if (contradiction) out.push(finding(d, r, "plot-hole", "warning", "The passage contains a local contradiction signal that merits developmental review.", "Compare the surrounding event sequence and canon before deciding whether a plot hole exists.", contradiction.index, contradiction.index + contradiction[0].length, 0.55)); return out; }
function genreFit(d: EditingDocument, r: EditorRole): EditorialFinding[] { const out: EditorialFinding[] = []; for (const expectation of d.genreExpectations ?? []) if (!d.text.toLocaleLowerCase().includes(expectation.toLocaleLowerCase())) out.push(finding(d, r, "genre-fit", "suggestion", `The stated genre expectation is not visibly represented: “${expectation}”.`, "Review whether the expectation belongs in this passage rather than forcing genre markers into the prose.", 0, Math.min(d.text.length, 1), 0.61)); return out; }
function phraseFindings(d: EditingDocument, r: EditorRole, kind: FindingKind, patterns: readonly string[], message: string, recommendation: string): EditorialFinding[] { const out: EditorialFinding[] = []; const lower = d.text.toLocaleLowerCase(); for (const phrase of patterns) { let at = lower.indexOf(phrase); while (at >= 0) { out.push(finding(d, r, kind, "suggestion", message, recommendation, at, at + phrase.length, 0.94)); at = lower.indexOf(phrase, at + phrase.length); } } return out; }
function sentences(text: string): Array<{ text: string; start: number; end: number }> { const out: Array<{ text: string; start: number; end: number }> = []; const re = /[^.!?]+[.!?]+|[^.!?]+$/g; let m; while ((m = re.exec(text))) { const value = m[0].trim(); if (!value) continue; const start = m.index + m[0].indexOf(value); out.push({ text: value, start, end: start + value.length }); } return out; }
function normalize(value: string): string { return value.toLocaleLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(); }
function wordCount(value: string): number { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function deduplicate(findings: readonly EditorialFinding[]): EditorialFinding[] { const seen = new Set<string>(); return findings.filter((f) => { const key = `${f.kind}:${f.start}:${f.end}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function summarize(findings: readonly EditorialFinding[]): string { if (!findings.length) return "No deterministic editorial findings were identified by the selected analysis roles."; const counts = new Map<string, number>(); for (const f of findings) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1); return `${findings.length} editorial finding(s) identified: ${[...counts.entries()].map(([kind, count]) => `${kind} (${count})`).join(", ")}. Findings are recommendations only and do not authorize manuscript mutation.`; }
const STOP = new Set(["about", "after", "again", "could", "every", "first", "from", "going", "great", "having", "other", "their", "there", "these", "thing", "those", "through", "under", "where", "which", "while", "would", "with", "without", "should", "shall", "still", "being", "because", "before", "between", "really", "right", "something", "someone"]);
