import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "../dist/domain/project.js";
import { FileProjectStore } from "../dist/infrastructure/file-project-store.js";
import { StoryArchitectureTemplateService } from "../dist/application/story-architecture-templates.js";
import { StudioStoryArchitectureWorkflowService } from "../dist/application/studio-story-architecture-workflow.js";

function providerPlan() {
  return {
    premise: "A guarded archivist must expose a conspiracy before the evidence repository is destroyed.",
    themes: ["truth", "trust"],
    audience: "Adult suspense readers.",
    genreExpectations: ["Escalating stakes"],
    canonCandidates: [],
    characterCandidates: ["The archivist"],
    locations: ["Evidence archive"],
    timelineConsiderations: ["Track the countdown to demolition."],
    assumptions: [],
    chapterPlan: [
      { number: 1, title: "The Notice", summary: "The archivist learns the repository will be destroyed.", requiredEvents: ["Demolition is announced."], continuityDependencies: [] },
      { number: 2, title: "The Proof", summary: "The archivist commits to exposing the conspiracy.", requiredEvents: ["The hidden record is verified."], continuityDependencies: ["Demolition remains imminent."] },
    ],
    scenePlan: [
      { chapterNumber: 1, title: "Archive Floor", summary: "The deadline becomes real.", goal: "Preserve the records.", conflict: "Access is restricted.", outcome: "The archivist starts a covert search." },
      { chapterNumber: 2, title: "Verification", summary: "Independent evidence confirms the record.", goal: "Prove authenticity.", conflict: "A supervisor intervenes.", outcome: "The archivist chooses exposure." },
    ],
    unresolvedQuestions: ["Who ordered the destruction?"],
    productionRisks: ["Do not reveal the conspiracy before the evidence supports it."],
  };
}

async function withProject(prefix, run) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  try {
    const store = new FileProjectStore(root);
    await store.create(createProject({ id: "template-project", title: "Template Project", now: "2026-09-05T14:00:00Z" }));
    await run({ root, store });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("Story Architecture template library preserves immutable built-ins and versioned project copies", async () => {
  await withProject("forge-story-template-library-", async ({ root, store }) => {
    const service = new StoryArchitectureTemplateService(store);
    let library = await service.list("template-project");
    assert.ok(library.builtIn.length >= 6, "Forge must ship a useful built-in story-structure library.");
    assert.equal(library.installed.length, 0);
    const threeAct = library.builtIn.find((item) => item.id === "builtin-three-act");
    assert.ok(threeAct);
    assert.equal(threeAct.source.kind, "built-in");

    const installed = await service.install("template-project", threeAct.id, "My Flexible Three-Act", "2026-09-05T14:01:00Z");
    assert.equal(installed.version, 1);
    assert.equal(installed.source.kind, "installed-copy");
    assert.equal(installed.source.sourceTemplateId, threeAct.id);
    assert.notEqual(installed.id, threeAct.id);

    const updated = await service.update("template-project", installed.id, {
      guidance: [...installed.guidance, "Keep the midpoint tied to the protagonist's own consequential choice."],
      now: "2026-09-05T14:02:00Z",
    });
    assert.equal(updated.version, 2);
    assert.ok(updated.guidance.some((item) => /midpoint/i.test(item)));

    const authorTemplate = await service.create("template-project", {
      title: "My Two-Thread Structure",
      description: "Alternate investigation and family-pressure threads until they collide.",
      bookKinds: ["mystery"],
      guidance: ["Each thread must change the stakes of the other."],
      beats: [
        { label: "Thread A opens", purpose: "Establish the investigation question." },
        { label: "Thread B pressure", purpose: "Show the family cost of continuing." },
        { label: "Collision", purpose: "Make one discovery irreversibly change both threads." },
      ],
      now: "2026-09-05T14:03:00Z",
    });
    assert.equal(authorTemplate.source.kind, "author");

    library = await new StoryArchitectureTemplateService(new FileProjectStore(root)).list("template-project");
    assert.equal(library.installed.length, 2, "Project templates must survive service restart through durable project memory.");
    assert.equal(library.installed.find((item) => item.id === installed.id)?.version, 2);

    const removed = await service.remove("template-project", installed.id, "2026-09-05T14:04:00Z");
    assert.equal(removed.deleted, true);
    assert.equal(removed.version, 3);
    library = await service.list("template-project");
    assert.equal(library.installed.some((item) => item.id === installed.id), false, "Deleted project templates leave active library without erasing history.");
    await assert.rejects(() => service.resolve("template-project", installed.id), /was not found/);

    const project = await store.load("template-project");
    const templateMemories = project.memories.filter((memory) => memory.relevanceTags.includes("story-architecture-template"));
    assert.equal(templateMemories.length, 4, "Install, update, author-create, and delete must each leave append-only template evidence.");
  });
});

test("selected template guides AI generation and exact provenance survives approval and restart", async () => {
  await withProject("forge-story-template-generation-", async ({ root, store }) => {
    let capturedRequest;
    const service = new StudioStoryArchitectureWorkflowService(store, async (request) => {
      capturedRequest = request;
      return { provider: "test-provider", model: "template-model", text: JSON.stringify(providerPlan()) };
    });

    const generated = await service.generate("template-project", {
      idea: "An archivist finds proof of a conspiracy while the evidence archive is scheduled for demolition.",
      kind: "thriller",
      targetChapters: 2,
      templateId: "builtin-three-act",
      now: "2026-09-05T14:10:00Z",
    });

    assert.match(capturedRequest.user, /AUTHOR-SELECTED STORY STRUCTURE TEMPLATE: Three-Act Story/);
    assert.match(capturedRequest.user, /planning guidance, not canon/i);
    assert.deepEqual(generated.templateGuidanceApplied, {
      id: "builtin-three-act",
      title: "Three-Act Story",
      version: 1,
      sourceKind: "built-in",
    });
    assert.deepEqual(generated.candidate.template, generated.templateGuidanceApplied);
    assert.equal(generated.candidate.idea, "An archivist finds proof of a conspiracy while the evidence archive is scheduled for demolition.");

    let snapshot = await service.approve("template-project", generated.candidate.id, { authorApproved: true, now: "2026-09-05T14:11:00Z" });
    assert.equal(snapshot.candidates[0].approved, true);
    assert.equal(snapshot.candidates[0].template.id, "builtin-three-act");

    const seed = await service.chapterCardSeed("template-project", generated.candidate.id);
    assert.equal(seed.template.id, "builtin-three-act");
    assert.match(seed.description, /Structure template provenance: Three-Act Story/);
    assert.match(seed.description, /Template guidance is not Project Brain canon/);

    const restarted = new StudioStoryArchitectureWorkflowService(new FileProjectStore(root), async () => { throw new Error("generation not expected"); });
    snapshot = await restarted.snapshot("template-project");
    assert.deepEqual(snapshot.candidates[0].template, generated.candidate.template, "Template provenance must remain durable with the architecture candidate.");
  });
});