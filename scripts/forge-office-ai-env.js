"use strict";

const OFFICE_IDS = Object.freeze(["studio", "journal", "workbooks", "specialized", "nft"]);
const SIDE_OFFICE_IDS = Object.freeze(OFFICE_IDS.filter((id) => id !== "studio"));
const ADDON_OFFICE_IDS = SIDE_OFFICE_IDS;
const OFFICE_PREFIXES = Object.freeze(OFFICE_IDS.map((id) => `FORGE_${id.toUpperCase()}_`));
const AI_SETTING_PREFIXES = Object.freeze([
  "AI_",
  "OMNIROUTE_",
  "ROUTER9_",
  "OPENAI_",
  "OLLAMA_",
  "KINGS_AI_",
  "GROQ_",
  "MISTRAL_",
  "GEMINI_",
  "ANTHROPIC_",
  "OPENROUTER_",
]);

function assertOfficeId(officeId) {
  const normalized = String(officeId || "").trim().toLowerCase();
  if (!OFFICE_IDS.includes(normalized)) {
    throw new Error(`Unknown Forge office "${officeId}". Expected one of: ${OFFICE_IDS.join(", ")}.`);
  }
  return normalized;
}

function isAiSetting(key) {
  return AI_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isOfficeScopedSecret(key) {
  return OFFICE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Product default: Author's Forge launches as one complete product with every
 * current side office attached. Explicit subsets remain available only for
 * engineering diagnostics, migration, or targeted testing.
 */
function resolveOfficeSelection(argv = [], env = {}) {
  if (argv.includes("--core")) return ["studio"];
  const officesArg = argv.find((arg) => String(arg).startsWith("--offices="));
  const hasExplicitEnvSelection = Object.prototype.hasOwnProperty.call(env, "FORGE_ENABLED_OFFICES");
  if (!officesArg && !hasExplicitEnvSelection) return [...OFFICE_IDS];

  const raw = officesArg
    ? String(officesArg).slice("--offices=".length)
    : String(env.FORGE_ENABLED_OFFICES || "");
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === "all") return [...OFFICE_IDS];

  const requestedSideOffices = normalized.split(",").map((value) => value.trim()).filter(Boolean);
  const invalid = requestedSideOffices.filter((id) => id === "studio" || !SIDE_OFFICE_IDS.includes(id));
  if (invalid.length) {
    throw new Error(`Unknown or invalid Forge side office(s): ${invalid.join(", ")}. Choose from ${SIDE_OFFICE_IDS.join(", ")}, or use all.`);
  }
  return ["studio", ...new Set(requestedSideOffices)];
}

/**
 * Build the child-process environment for exactly one Forge office.
 *
 * By default global AI/provider settings are deliberately removed. Each office
 * receives only its FORGE_<OFFICE>_* AI settings, translated back to the
 * canonical provider variable names expected by the existing provider stack.
 * This gives every office an independent broker/routing/quota process and keeps
 * credentials for other offices out of the child environment.
 *
 * FORGE_ALLOW_SHARED_AI_FALLBACK=true is an explicit migration escape hatch.
 * It is off by default because a shared upstream credential normally means a
 * shared provider-side allowance even if Forge keeps separate local counters.
 */
function buildOfficeAiEnvironment(baseEnv, officeId) {
  const id = assertOfficeId(officeId);
  const source = { ...baseEnv };
  const allowSharedFallback = String(source.FORGE_ALLOW_SHARED_AI_FALLBACK || "").trim().toLowerCase() === "true";
  const scopedPrefix = `FORGE_${id.toUpperCase()}_`;
  const result = { ...source };

  for (const key of Object.keys(result)) {
    if (isOfficeScopedSecret(key)) delete result[key];
    if (!allowSharedFallback && isAiSetting(key)) delete result[key];
  }

  let applied = 0;
  for (const [key, value] of Object.entries(source)) {
    if (!key.startsWith(scopedPrefix)) continue;
    const target = key.slice(scopedPrefix.length);
    if (!target || !isAiSetting(target)) continue;
    result[target] = value;
    applied += 1;
  }

  result.FORGE_AI_SCOPE = id;
  result.FORGE_AI_SCOPE_CONFIGURED_KEYS = String(applied);
  return result;
}

module.exports = {
  ADDON_OFFICE_IDS,
  SIDE_OFFICE_IDS,
  AI_SETTING_PREFIXES,
  OFFICE_IDS,
  buildOfficeAiEnvironment,
  isAiSetting,
  resolveOfficeSelection,
};
