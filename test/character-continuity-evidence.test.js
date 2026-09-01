import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../dist/domain/project.js";
import { createCharacter, updateCharacter } from "../dist/domain/character-bible.js";
import { createCharacterContinuityEvidence, verifyCharacterContinuityEvidence } from "../dist/domain/character-continuity-evidence.js";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, saveSceneContent } from "../dist/domain/studio-workspace.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";
import { AiWritingCoordinator } from "../dist/application/ai-writing-coordinator.js";
import { AiWritingStudioService } from "../dist/application/ai-writing-studio.js";

function mara() {
  return createCharacter({ id: "mara-1", projectId: "project-1", now: "2026-08-30T09:00:00.000Z", profile: {
    name: "Mara Voss", age: 31, birthDate: "1995-04-12", physicalAppearance: "Lean and weathered.", height: "5 ft 7 in", build: "Lean", hair: "Dark brown", eyes: "Gray-green", skin: "Olive", clothing: "Dark field jacket", voice: "Low and controlled", speechPatterns: ["Short declarative sentences"], personality: "Guarded investigator", values: ["Loyalty"], fears: ["Abandonment"], secrets: [], goals: ["Find the missing witness"], motivations: ["Protect people"], relationships: [], history: "Mountain town upbringing.", knowledge: ["Old reservoir roads"], skills: ["Investigation"], weaknesses: ["Distrusts authority"], characterArc: "Learns to trust", importantObjects: ["Compass"], currentEmotionalState: "Watchful", currentLocation: "North shoreline", currentInjuries: []
  }});
}

async function fixture(root) {
  const projects = new FileProjectStore(root);
  let workspace = createStudioWorkspace();
  workspace = addWorkspaceBook(workspace, { id: "book-1", title: "Book", kind: "novel", lifecycle: "active", description: "", chapters: [], updatedAt: "2026-08-30T09:00:00.000Z" });
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Chapter One" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Scene One" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "The original scene.", "2026-08-30T09:00:00.000Z");
  await projects.create({ ...createProject({ id: "project-1", title: "Continuity", now: "2026-08-30T08:00:00.000Z" }), characters: [mara()], studioWorkspace: workspace });
  return projects;
}

function request() {
  return { projectId: "project-1", bookId: "book-1", chapterId: "chapter-1", sceneId: "scene-1", task: "continue", instruction: "Continue with Mara and the missing witness.", existingContent: "The original scene.", proposalId: "proposal-1", now: "2026-08-30T09:01:00.000Z", context: { query: "Mara missing witness", characterIds: ["mara-1"] } };
}

test("character continuity evidence fingerprints the authoritative selected state", () => {
  const character = mara();
  const evidence = createCharacterContinuityEvidence({ projectId: "project-1", characters: [character], selectedCharacterIds: ["mara-1"], evidence: { "mara-1": ["goals: matched missing,witness"] }, checkedAt: "2026-08-30T09:01:00.000Z" });
  assert.equal(evidence.status, "clear");
  assert.match(evidence.characters[0].profileSha256, /^[a-f0-9]{64}$/);
  assert.equal(verifyCharacterContinuityEvidence(evidence, [character]).valid, true);
  const changed = updateCharacter(character, { characterId: "mara-1", changes: { currentLocation: "Old spillway" }, now: "2026-08-30T09:02:00.000Z", actor: "author", reason: "Mara moved." });
  const verification = verifyCharacterContinuityEvidence(evidence, [changed]);
  assert.equal(verification.valid, false);
  assert.match(verification.findings[0], /changed after this proposal was generated/);
});

test("Studio proposals persist continuity anchors and block apply when authoritative character state changed", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-continuity-"));
  try {
    const projects = await fixture(root);
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async () => ({ provider: "test", model: "fixture", text: "Mara followed the shoreline toward the witness." }));
    const service = new AiWritingStudioService(projects, coordinator);
    const generated = await service.generateWithProjectContext(request());
    assert.equal(generated.proposal.characterContinuity.status, "clear");
    assert.deepEqual(generated.proposal.characterContinuity.characters.map((item) => item.characterId), ["mara-1"]);
    await service.review("project-1", "proposal-1", "accepted", "Author approved.", "2026-08-30T09:02:00.000Z");
    const project = await projects.load("project-1");
    const changed = updateCharacter(project.characters[0], { characterId: "mara-1", changes: { currentLocation: "Old spillway" }, now: "2026-08-30T09:02:30.000Z", actor: "author", reason: "Mara moved before apply." });
    await projects.save({ ...project, characters: [changed] });
    await assert.rejects(() => service.applyAccepted("project-1", "proposal-1"), /requires a new continuity review/);
    const after = await projects.load("project-1");
    assert.equal(after.studioWorkspace.books[0].chapters[0].scenes[0].content, "The original scene.");
    const persisted = await service.get("project-1", "proposal-1");
    assert.deepEqual(persisted.characterContinuity, generated.proposal.characterContinuity);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Studio apply succeeds when anchored character state is unchanged", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-continuity-clear-"));
  try {
    const projects = await fixture(root);
    const coordinator = new AiWritingCoordinator(new FileAiProposalStore(join(root, "proposals.json")), async () => ({ provider: "test", model: "fixture", text: "Mara followed the shoreline toward the witness." }));
    const service = new AiWritingStudioService(projects, coordinator);
    await service.generateWithProjectContext(request());
    await service.review("project-1", "proposal-1", "accepted", undefined, "2026-08-30T09:02:00.000Z");
    const applied = await service.applyAccepted("project-1", "proposal-1", "2026-08-30T09:03:00.000Z");
    assert.match(applied.workspace.books[0].chapters[0].scenes[0].content, /Mara followed the shoreline/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
