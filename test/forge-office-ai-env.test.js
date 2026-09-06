const test = require("node:test");
const assert = require("node:assert/strict");
const { buildOfficeAiEnvironment, resolveOfficeSelection } = require("../scripts/forge-office-ai-env");

test("Author's Forge launches every attached office by default", () => {
  const all = ["studio", "journal", "workbooks", "specialized", "nft"];
  assert.deepEqual(resolveOfficeSelection([], {}), all);
  assert.deepEqual(resolveOfficeSelection(["--offices=all"], {}), all);
  assert.deepEqual(resolveOfficeSelection([], { FORGE_ENABLED_OFFICES: "" }), all);

  // Explicit subsets remain engineering/test controls, not the product default.
  assert.deepEqual(resolveOfficeSelection(["--offices=journal,specialized"], {}), ["studio", "journal", "specialized"]);
  assert.deepEqual(resolveOfficeSelection([], { FORGE_ENABLED_OFFICES: "workbooks,nft" }), ["studio", "workbooks", "nft"]);
  assert.deepEqual(resolveOfficeSelection(["--core"], { FORGE_ENABLED_OFFICES: "all" }), ["studio"]);
  assert.throws(() => resolveOfficeSelection(["--offices=studio,journal"], {}), /invalid Forge side office/);
});

test("office AI environment removes shared credentials and other-office secrets by default", () => {
  const env = buildOfficeAiEnvironment({
    PATH: "/bin",
    OPENAI_API_KEY: "shared-key",
    OMNIROUTE_TOKEN_QUOTA: "1000",
    FORGE_STUDIO_OPENAI_API_KEY: "studio-key",
    FORGE_JOURNAL_OPENAI_API_KEY: "journal-key",
    FORGE_JOURNAL_OMNIROUTE_TOKEN_QUOTA: "7000",
  }, "journal");

  assert.equal(env.PATH, "/bin");
  assert.equal(env.OPENAI_API_KEY, "journal-key");
  assert.equal(env.OMNIROUTE_TOKEN_QUOTA, "7000");
  assert.equal(env.FORGE_STUDIO_OPENAI_API_KEY, undefined);
  assert.equal(env.FORGE_JOURNAL_OPENAI_API_KEY, undefined);
  assert.equal(env.FORGE_AI_SCOPE, "journal");
});

test("two offices receive independent provider credentials and quota pools", () => {
  const source = {
    FORGE_STUDIO_OMNIROUTE_BASE_URL: "https://studio-router.example",
    FORGE_STUDIO_OMNIROUTE_API_KEY: "studio-router-key",
    FORGE_STUDIO_OMNIROUTE_TOKEN_QUOTA: "100000",
    FORGE_JOURNAL_OMNIROUTE_BASE_URL: "https://journal-router.example",
    FORGE_JOURNAL_OMNIROUTE_API_KEY: "journal-router-key",
    FORGE_JOURNAL_OMNIROUTE_TOKEN_QUOTA: "250000",
    FORGE_STUDIO_OPENAI_API_KEY: "studio-openai",
    FORGE_JOURNAL_OPENAI_API_KEY: "journal-openai",
  };

  const studio = buildOfficeAiEnvironment(source, "studio");
  const journal = buildOfficeAiEnvironment(source, "journal");

  assert.equal(studio.OMNIROUTE_BASE_URL, "https://studio-router.example");
  assert.equal(studio.OMNIROUTE_API_KEY, "studio-router-key");
  assert.equal(studio.OMNIROUTE_TOKEN_QUOTA, "100000");
  assert.equal(studio.OPENAI_API_KEY, "studio-openai");

  assert.equal(journal.OMNIROUTE_BASE_URL, "https://journal-router.example");
  assert.equal(journal.OMNIROUTE_API_KEY, "journal-router-key");
  assert.equal(journal.OMNIROUTE_TOKEN_QUOTA, "250000");
  assert.equal(journal.OPENAI_API_KEY, "journal-openai");
});

test("every supported provider family can be scoped independently", () => {
  const source = {
    FORGE_SPECIALIZED_OMNIROUTE_BASE_URL: "https://omni.example",
    FORGE_SPECIALIZED_ROUTER9_BASE_URL: "https://nine.example",
    FORGE_SPECIALIZED_OPENAI_API_KEY: "openai",
    FORGE_SPECIALIZED_GROQ_API_KEY: "groq",
    FORGE_SPECIALIZED_MISTRAL_API_KEY: "mistral",
    FORGE_SPECIALIZED_GEMINI_API_KEY: "gemini",
    FORGE_SPECIALIZED_ANTHROPIC_API_KEY: "anthropic",
    FORGE_SPECIALIZED_OPENROUTER_API_KEY: "openrouter",
    FORGE_SPECIALIZED_OLLAMA_BASE_URL: "http://127.0.0.1:11434",
    FORGE_SPECIALIZED_KINGS_AI_RESPONSES_URL: "https://kings.example/v1/responses",
    FORGE_SPECIALIZED_AI_PROVIDER_ORDER: "omniroute,9router,openai,groq,mistral,gemini,anthropic,openrouter,ollama,kings",
  };
  const env = buildOfficeAiEnvironment(source, "specialized");

  assert.equal(env.OMNIROUTE_BASE_URL, "https://omni.example");
  assert.equal(env.ROUTER9_BASE_URL, "https://nine.example");
  assert.equal(env.OPENAI_API_KEY, "openai");
  assert.equal(env.GROQ_API_KEY, "groq");
  assert.equal(env.MISTRAL_API_KEY, "mistral");
  assert.equal(env.GEMINI_API_KEY, "gemini");
  assert.equal(env.ANTHROPIC_API_KEY, "anthropic");
  assert.equal(env.OPENROUTER_API_KEY, "openrouter");
  assert.equal(env.OLLAMA_BASE_URL, "http://127.0.0.1:11434");
  assert.equal(env.KINGS_AI_RESPONSES_URL, "https://kings.example/v1/responses");
  assert.match(env.AI_PROVIDER_ORDER, /omniroute/);
});

test("shared AI fallback exists only as an explicit migration option", () => {
  const env = buildOfficeAiEnvironment({
    FORGE_ALLOW_SHARED_AI_FALLBACK: "true",
    OPENAI_API_KEY: "legacy-shared-key",
  }, "workbooks");
  assert.equal(env.OPENAI_API_KEY, "legacy-shared-key");
});
