import type {
  AiGenerationResult,
} from "../infrastructure/ai-provider";

export type ForgeAiProvider =
  AiGenerationResult["provider"];

export interface AiMissionRoutingPreference {
  readonly preferProvider:
    ForgeAiProvider;
  readonly preferModel?:
    string;
}

const PROVIDERS:
  readonly ForgeAiProvider[] = [
  "omniroute",
  "9router",
  "openai",
  "ollama",
  "kings",
  "groq",
  "mistral",
  "gemini",
  "anthropic",
  "openrouter",
  "gateway",
];

const ALLOWED_FIELDS =
  new Set([
    "preferProvider",
    "preferModel",
  ]);

/**
 * Parse a mission/request preference without changing Forge's owner-wide
 * routing policy. This is deliberately a preference rather than a bypass:
 * normal spend, capability, health, quota, quality, and fallback gates remain
 * authoritative inside AiModelBroker.
 */
export function parseAiMissionRoutingPreference(
  value:
    unknown,
): AiMissionRoutingPreference | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Mission AI routing preference must be an object.",
    );
  }

  const row =
    value as Record<string, unknown>;

  const unsupportedFields =
    Object.keys(row).filter(
      (key) => !ALLOWED_FIELDS.has(key),
    );

  if (unsupportedFields.length) {
    throw new Error(
      `Mission AI routing preference contains unsupported fields: ${unsupportedFields.join(", ")}.`,
    );
  }

  const rawProvider =
    row.preferProvider;

  if (
    typeof rawProvider !== "string" ||
    !PROVIDERS.includes(
      rawProvider as ForgeAiProvider,
    )
  ) {
    throw new Error(
      "Mission AI routing preference requires a supported provider.",
    );
  }

  let preferModel:
    string | undefined;

  if (
    row.preferModel !== undefined &&
    row.preferModel !== null &&
    row.preferModel !== ""
  ) {
    if (
      typeof row.preferModel !== "string"
    ) {
      throw new Error(
        "Mission AI routing model must be a string.",
      );
    }

    preferModel =
      row.preferModel.trim();

    if (
      !preferModel ||
      preferModel.length > 512
    ) {
      throw new Error(
        "Mission AI routing model must contain 1 through 512 characters.",
      );
    }
  }

  return Object.freeze({
    preferProvider:
      rawProvider as ForgeAiProvider,
    ...(preferModel
      ? { preferModel }
      : {}),
  });
}

export function aiMissionRoutingGenerationFields(
  preference:
    AiMissionRoutingPreference | undefined,
): {
  readonly preferProvider?: string;
  readonly preferModel?: string;
} {
  if (!preference) {
    return {};
  }

  return {
    preferProvider:
      preference.preferProvider,
    ...(preference.preferModel
      ? {
        preferModel:
          preference.preferModel,
      }
      : {}),
  };
}
