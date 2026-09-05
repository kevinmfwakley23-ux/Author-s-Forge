#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const HOST = "127.0.0.1";
const PORT = 5960 + Math.floor(Math.random() * 80);
const PROJECT_ID = "agent-planner-api-acceptance";
const BOOK_ID = "book-plan";
const CHAPTER_ID = "chapter-plan";
const SCENE_ID = "scene-plan";

async function waitForHttp(url, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function api(base, path, method = "GET", payload) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${body.error || JSON.stringify(body)}`);
  return body;
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "forge-agent-plan-api-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT),
      FORGE_DATA_DIR: dataDir,
      OPENAI_API_KEY: "", OPENAI_MODEL: "", OPENAI_MODELS: "",
      OLLAMA_BASE_URL: "", OLLAMA_MODEL: "", OLLAMA_MODELS: "",
      KINGS_AI_ENDPOINT: "", KINGS_AI_MODEL: "", KINGS_AI_MODELS: "",
      OMNIROUTE_BASE_URL: "", OMNIROUTE_API_KEY: "", OMNIROUTE_MODEL: "", OMNIROUTE_MODELS: "",
      ROUTER9_BASE_URL: "", ROUTER9_API_KEY: "", ROUTER9_MODEL: "", ROUTER9_MODELS: "",
      GROQ_API_KEY: "", GROQ_MODEL: "", GROQ_MODELS: "",
      MISTRAL_API_KEY: "", MISTRAL_MODEL: "", MISTRAL_MODELS: "",
      GEMINI_API_KEY: "", GEMINI_MODEL: "", GEMINI_MODELS: "",
      ANTHROPIC_API_KEY: "", ANTHROPIC_MODEL: "", ANTHROPIC_MODELS: "",
      OPENROUTER_API_KEY: "", OPENROUTER_MODEL: "", OPENROUTER_MODELS: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const base = `http://${HOST}:${PORT}`;
    await waitForHttp(`${base}/api/health`);
    await api(base, "/api/projects", "POST", { id: PROJECT_ID, title: "Agent Planner API Acceptance" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books`, "POST", { id: BOOK_ID, title: "Planner Proof", kind: "novel", description: "Planner fixture" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books/${BOOK_ID}/chapters`, "POST", { id: CHAPTER_ID, number: 1, title: "Boundaries", synopsis: "Planner boundary proof" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books/${BOOK_ID}/chapters/${CHAPTER_ID}/scenes`, "POST", { id: SCENE_ID, number: 1, title: "Visible Steps", synopsis: "Agent planning remains visible" });
    await api(base, `/api/projects/${PROJECT_ID}/workspace/books/${BOOK_ID}/chapters/${CHAPTER_ID}/scenes/${SCENE_ID}/content`, "PUT", { content: "Every step was visible before it ran." });

    const registry = await api(base, `/api/projects/${PROJECT_ID}/agent/tools`);
    assert.equal(registry.authority, "discovery-only");
    assert.equal(registry.formatVersion, 3);
    assert.equal(registry.tools.length, 12);
    assert.equal(registry.tools.find((tool) => tool.id === "writing.propose").stateEffect, "proposal-ledger");
    assert.equal(registry.tools.find((tool) => tool.id === "visual.image.generate").providerRequirement, "configured-image");
    assert.equal(registry.tools.find((tool) => tool.id === "market.kdp.research").stateEffect, "market-intelligence");
    assert.equal(registry.tools.find((tool) => tool.id === "promotion.campaign.propose").stateEffect, "campaign-draft");
    assert.equal(registry.tools.find((tool) => tool.id === "cover.direction.propose").stateEffect, "candidate-response");

    await api(base, `/api/projects/${PROJECT_ID}/collaboration`, "POST", { mode: "editor" });
    const editorPlanResponse = await api(base, `/api/projects/${PROJECT_ID}/agent/plan`, "POST", {
      goal: "Draft and continuity edit this scene.", bookId: BOOK_ID, chapterId: CHAPTER_ID, sceneId: SCENE_ID,
    });
    assert.equal(editorPlanResponse.authority, "plan-only");
    assert.equal(editorPlanResponse.plannerRequested, "deterministic");
    assert.equal(editorPlanResponse.plannerUsed, "deterministic");
    assert.equal(editorPlanResponse.plan.mode, "editor");
    assert.match(editorPlanResponse.plan.steps.find((step) => step.toolId === "writing.propose").blockedReason, /configured not to draft new prose/);
    assert.equal(editorPlanResponse.plan.policy.bulkExecutionEligible, false);

    await api(base, `/api/projects/${PROJECT_ID}/collaboration`, "POST", { mode: "autonomous" });
    const autonomousPlanResponse = await api(base, `/api/projects/${PROJECT_ID}/agent/plan`, "POST", {
      goal: "Research the setting, draft and edit the scene, then export a PDF review copy.", bookId: BOOK_ID, chapterId: CHAPTER_ID, sceneId: SCENE_ID,
    });
    const plan = autonomousPlanResponse.plan;
    assert.equal(plan.mode, "autonomous");
    assert.equal(plan.policy.bulkExecutionEligible, true);
    assert.deepEqual(plan.steps.map((step) => step.toolId), ["research.live", "project.context", "writing.propose", "editing.analyze", "production.export", "memory.record-working"]);
    assert.equal(plan.steps.find((step) => step.toolId === "project.context").eligibleForApprovedRunGroup, true);
    assert.equal(plan.steps.find((step) => step.toolId === "editing.analyze").eligibleForApprovedRunGroup, true);
    assert.equal(plan.steps.find((step) => step.toolId === "writing.propose").eligibleForApprovedRunGroup, false);
    assert.equal(plan.steps.find((step) => step.toolId === "production.export").eligibleForApprovedRunGroup, false);
    assert.equal(plan.steps.some((step) => step.toolId.includes("apply") || step.toolId.includes("content")), false);

    const crossSurface = await api(base, `/api/projects/${PROJECT_ID}/agent/plan`, "POST", {
      goal: "Research the KDP niche and keywords, create chapter cards, generate an illustration, and build a promotion campaign.",
      bookId: BOOK_ID, chapterId: CHAPTER_ID, sceneId: SCENE_ID,
    });
    assert.deepEqual(crossSurface.plan.steps.map((step) => step.toolId), [
      "market.kdp.research", "story.chapter-cards.propose", "visual.image.generate", "promotion.campaign.propose", "memory.record-working",
    ]);
    assert.equal(crossSurface.plan.steps.find((step) => step.toolId === "visual.image.generate").providerRequirement, "configured-image");
    assert.equal(crossSurface.plan.steps.find((step) => step.toolId === "promotion.campaign.propose").eligibleForApprovedRunGroup, false);

    // AI-enhanced planning is opt-in. With every provider deliberately absent it must visibly fall back, not fabricate an AI plan.
    const aiFallback = await api(base, `/api/projects/${PROJECT_ID}/agent/plan`, "POST", {
      planner: "ai",
      goal: "Research the KDP niche and keywords, create chapter cards, generate an illustration, and build a promotion campaign.",
      bookId: BOOK_ID, chapterId: CHAPTER_ID, sceneId: SCENE_ID,
    });
    assert.equal(aiFallback.plannerRequested, "ai");
    assert.equal(aiFallback.plannerUsed, "deterministic-fallback");
    assert.match(aiFallback.plannerFallbackReason, /No AI provider is configured/i);
    assert.equal(aiFallback.plannerProvider, undefined);
    assert.deepEqual(aiFallback.plan.steps.map((step) => step.toolId), crossSurface.plan.steps.map((step) => step.toolId));

    const createdRecipe = await api(base, `/api/projects/${PROJECT_ID}/agent/recipes`, "POST", {
      id: "launch-recipe",
      title: "Launch Recipe",
      description: "Research, visualize, and prepare a launch campaign.",
      steps: [
        { toolId: "market.kdp.research", instruction: "Gather current market evidence." },
        { toolId: "visual.image.generate", instruction: "Generate a reviewable visual." },
        { toolId: "promotion.campaign.propose", instruction: "Prepare draft campaign assets." },
      ],
    });
    assert.equal(createdRecipe.authority, "author-defined-workflow");
    assert.equal(createdRecipe.recipe.version, 1);

    const recipeList = await api(base, `/api/projects/${PROJECT_ID}/agent/recipes`);
    assert.equal(recipeList.authority, "author-defined-workflow");
    assert.deepEqual(recipeList.recipes.map((recipe) => recipe.id), ["launch-recipe"]);

    const recipePlan = await api(base, `/api/projects/${PROJECT_ID}/agent/recipes/launch-recipe/plan`, "POST", {
      goal: "Prepare this book's launch kit.", bookId: BOOK_ID, chapterId: CHAPTER_ID, sceneId: SCENE_ID,
    });
    assert.equal(recipePlan.authority, "plan-only");
    assert.equal(recipePlan.plannerUsed, "recipe");
    assert.deepEqual(recipePlan.plan.steps.map((step) => step.toolId), [
      "market.kdp.research", "visual.image.generate", "promotion.campaign.propose", "memory.record-working",
    ]);
    assert.equal(recipePlan.plan.steps.find((step) => step.toolId === "promotion.campaign.propose").eligibleForApprovedRunGroup, false);
    const projectWithRecipe = await api(base, `/api/projects/${PROJECT_ID}`);
    assert.ok(projectWithRecipe.memories.some((memory) => memory.relevanceTags?.includes("agent-recipe:launch-recipe")));

    const missingScopeResponse = await api(base, `/api/projects/${PROJECT_ID}/agent/plan`, "POST", { goal: "Draft the next scene." });
    assert.match(missingScopeResponse.plan.steps.find((step) => step.toolId === "writing.propose").blockedReason, /requires chapter, scene scope/);

    console.log("FORGE AGENT PLANNER API ACCEPTANCE PASSED: 12-tool registry v3 + deterministic default + truthful AI fallback + durable Forge Recipes + Editor block + bounded Autonomous grouping + missing-scope honesty.");
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });