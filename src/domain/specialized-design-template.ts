import { randomUUID } from "node:crypto";
import type { SpecializedCreationMode } from "./specialized-creation";
import {
  SPECIALIZED_DOCUMENT_FORMAT_VERSION,
  SPECIALIZED_PRODUCTION_PROFILE_VERSION,
  validateProductionProfile,
  validateSpecializedDocument,
  type SpecializedDocument,
  type SpecializedElement,
  type SpecializedProductionProfile,
  type SpecializedSurface,
} from "./specialized-creation-office";

export const SPECIALIZED_DESIGN_TEMPLATE_FORMAT_VERSION = 1 as const;
export type SpecializedTemplateAssetPolicy = "detached-placeholders";

export interface SpecializedDesignTemplateSource {
  readonly kind: "author-captured" | "installed-copy";
  readonly specializedProjectId: string;
  readonly documentId: string;
  readonly profileId: string;
  readonly sourceTemplateId?: string;
  readonly sourceTemplateVersion?: number;
}

export interface SpecializedDesignTemplate {
  readonly formatVersion: typeof SPECIALIZED_DESIGN_TEMPLATE_FORMAT_VERSION;
  readonly id: string;
  readonly forgeProjectId: string;
  readonly title: string;
  readonly description: string;
  readonly mode: SpecializedCreationMode;
  readonly tags: readonly string[];
  readonly brandKitId?: string;
  readonly assetPolicy: SpecializedTemplateAssetPolicy;
  readonly document: SpecializedDocument;
  readonly profile: SpecializedProductionProfile;
  readonly source: SpecializedDesignTemplateSource;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CaptureSpecializedDesignTemplateInput {
  readonly forgeProjectId: string;
  readonly sourceSpecializedProjectId: string;
  readonly sourceDocument: SpecializedDocument;
  readonly sourceProfile: SpecializedProductionProfile;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly brandKitId?: string;
  readonly now?: string;
}

export interface SpecializedDesignTemplateCandidate {
  readonly templateId: string;
  readonly templateVersion: number;
  readonly document: SpecializedDocument;
  readonly profile: SpecializedProductionProfile;
  readonly detachedAssetSlots: readonly {
    readonly surfaceId: string;
    readonly elementId: string;
    readonly slot: string;
    readonly sourceAssetId: string;
  }[];
  readonly persisted: false;
}

export function captureSpecializedDesignTemplate(
  input: CaptureSpecializedDesignTemplateInput,
): SpecializedDesignTemplate {
  const forgeProjectId = identifier(input.forgeProjectId, "Forge project id");
  const sourceSpecializedProjectId = identifier(input.sourceSpecializedProjectId, "Specialized project id");
  const title = requiredText(input.title, "Design template title", 180);
  const description = optionalText(input.description, "Design template description", 2_000) ?? "";
  const tags = normalizeTags(input.tags ?? []);
  const brandKitId = input.brandKitId === undefined
    ? undefined
    : identifier(input.brandKitId, "Brand Kit id");
  const now = timestamp(input.now);

  validateSpecializedDocument(input.sourceDocument);
  validateProductionProfile(input.sourceProfile);
  if (input.sourceDocument.projectId !== sourceSpecializedProjectId) {
    throw new Error("Specialized design template source document belongs to another Specialized project.");
  }

  const document = detachSourceAssets(input.sourceDocument, now);
  const template: SpecializedDesignTemplate = {
    formatVersion: SPECIALIZED_DESIGN_TEMPLATE_FORMAT_VERSION,
    id: `design-template-${randomUUID()}`,
    forgeProjectId,
    title,
    description,
    mode: input.sourceDocument.mode,
    tags,
    ...(brandKitId ? { brandKitId } : {}),
    assetPolicy: "detached-placeholders",
    document,
    profile: cloneProfile(input.sourceProfile),
    source: {
      kind: "author-captured",
      specializedProjectId: sourceSpecializedProjectId,
      documentId: input.sourceDocument.id,
      profileId: input.sourceProfile.id,
    },
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  return validateSpecializedDesignTemplate(template);
}

export function validateSpecializedDesignTemplate(
  value: SpecializedDesignTemplate,
): SpecializedDesignTemplate {
  if (value.formatVersion !== SPECIALIZED_DESIGN_TEMPLATE_FORMAT_VERSION) {
    throw new Error("Unsupported Specialized design template format.");
  }
  identifier(value.id, "Design template id");
  identifier(value.forgeProjectId, "Forge project id");
  requiredText(value.title, "Design template title", 180);
  optionalText(value.description, "Design template description", 2_000);
  if (value.assetPolicy !== "detached-placeholders") {
    throw new Error("Unsupported Specialized design template asset policy.");
  }
  if (!Number.isInteger(value.version) || value.version < 1) {
    throw new Error("Specialized design template version must be a positive integer.");
  }
  normalizeTags(value.tags);
  if (value.brandKitId !== undefined) identifier(value.brandKitId, "Brand Kit id");
  validateSpecializedDocument(value.document);
  validateProductionProfile(value.profile);
  if (value.document.mode !== value.mode) {
    throw new Error("Specialized design template document mode does not match template mode.");
  }
  if (value.source.specializedProjectId !== value.document.projectId) {
    throw new Error("Specialized design template source scope is inconsistent.");
  }
  identifier(value.source.specializedProjectId, "Source Specialized project id");
  identifier(value.source.documentId, "Source document id");
  identifier(value.source.profileId, "Source production profile id");
  timestamp(value.createdAt);
  timestamp(value.updatedAt);
  return deepFreeze(clone(value));
}

export function instantiateSpecializedDesignTemplate(input: {
  readonly template: SpecializedDesignTemplate;
  readonly targetSpecializedProjectId: string;
  readonly targetMode: SpecializedCreationMode;
  readonly title?: string;
  readonly now?: string;
}): SpecializedDesignTemplateCandidate {
  const template = validateSpecializedDesignTemplate(input.template);
  const targetProjectId = identifier(input.targetSpecializedProjectId, "Target Specialized project id");
  if (input.targetMode !== template.mode) {
    throw new Error(
      `Design template mode "${template.mode}" cannot be applied to target mode "${input.targetMode}".`,
    );
  }
  const now = timestamp(input.now);
  const token = randomUUID();
  const detachedAssetSlots: Array<{
    surfaceId: string;
    elementId: string;
    slot: string;
    sourceAssetId: string;
  }> = [];

  const surfaces = template.document.surfaces.map((surface, surfaceIndex) => {
    const surfaceId = `template-surface-${surfaceIndex + 1}-${token}`;
    const elements = surface.elements.map((element, elementIndex) => {
      const elementId = `template-element-${surfaceIndex + 1}-${elementIndex + 1}-${token}`;
      const sourceAssetId = metadataText(element.metadata["forge.template.sourceAssetId"]);
      const slot = metadataText(element.metadata["forge.template.assetSlot"]);
      if (sourceAssetId && slot) {
        detachedAssetSlots.push({
          surfaceId,
          elementId,
          slot,
          sourceAssetId,
        });
      }
      return Object.freeze({
        ...element,
        id: elementId,
        metadata: Object.freeze({
          ...element.metadata,
          "forge.template.sourceElementId": element.id,
          "forge.template.id": template.id,
          "forge.template.version": template.version,
        }),
      });
    });
    return Object.freeze({
      ...surface,
      id: surfaceId,
      label: surface.label,
      elements: Object.freeze(elements),
    });
  });

  const document: SpecializedDocument = Object.freeze({
    formatVersion: SPECIALIZED_DOCUMENT_FORMAT_VERSION,
    id: `template-document-${token}`,
    projectId: targetProjectId,
    title: input.title === undefined
      ? `${template.title} — editable copy`
      : requiredText(input.title, "Template candidate title", 240),
    mode: template.mode,
    surfaces: Object.freeze(surfaces),
    styleTokens: Object.freeze({
      ...template.document.styleTokens,
      "forge.template.id": template.id,
      "forge.template.version": template.version,
    }),
    createdAt: now,
    updatedAt: now,
  });
  validateSpecializedDocument(document);

  const profile: SpecializedProductionProfile = Object.freeze({
    ...template.profile,
    formatVersion: SPECIALIZED_PRODUCTION_PROFILE_VERSION,
    id: `template-profile-${token}`,
    label: `${template.title} — ${template.profile.label}`,
    notes: Object.freeze([
      ...template.profile.notes,
      `Instantiated from Specialized design template ${template.id} version ${template.version}.`,
      "Review detached image/logo slots and Brand Kit compliance before production.",
    ]),
  });
  validateProductionProfile(profile);

  return Object.freeze({
    templateId: template.id,
    templateVersion: template.version,
    document,
    profile,
    detachedAssetSlots: Object.freeze(detachedAssetSlots),
    persisted: false as const,
  });
}

function detachSourceAssets(
  source: SpecializedDocument,
  now: string,
): SpecializedDocument {
  const surfaces: SpecializedSurface[] = source.surfaces.map((surface) => Object.freeze({
    ...surface,
    elements: Object.freeze(surface.elements.map((element) => detachElementAsset(element))),
  }));
  const document: SpecializedDocument = Object.freeze({
    ...source,
    surfaces: Object.freeze(surfaces),
    styleTokens: Object.freeze({ ...source.styleTokens }),
    createdAt: source.createdAt,
    updatedAt: now,
  });
  validateSpecializedDocument(document);
  return document;
}

function detachElementAsset(element: SpecializedElement): SpecializedElement {
  if (!element.assetId) {
    return Object.freeze({
      ...element,
      style: Object.freeze({ ...element.style }),
      metadata: Object.freeze({ ...element.metadata }),
    });
  }
  const { assetId, ...rest } = element;
  return Object.freeze({
    ...rest,
    style: Object.freeze({ ...element.style }),
    metadata: Object.freeze({
      ...element.metadata,
      "forge.template.sourceAssetId": assetId,
      "forge.template.assetSlot": element.role ?? element.id,
      "forge.template.assetRequired": true,
    }),
  });
}

function cloneProfile(profile: SpecializedProductionProfile): SpecializedProductionProfile {
  return Object.freeze({
    ...profile,
    artifactKinds: Object.freeze([...profile.artifactKinds]),
    notes: Object.freeze([...profile.notes]),
  });
}

function normalizeTags(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values)) throw new Error("Design template tags must be an array.");
  if (values.length > 32) throw new Error("Design template supports at most 32 tags.");
  const tags = [...new Set(values.map((value) => requiredText(value, "Design template tag", 80).toLowerCase()))];
  return Object.freeze(tags.sort());
}

function metadataText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function identifier(value: string, label: string): string {
  const result = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(result)) {
    throw new Error(`${label} may contain only letters, numbers, underscore, and hyphen.`);
  }
  return result;
}

function requiredText(value: string, label: string, maxLength: number): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return result;
}

function optionalText(value: string | undefined, label: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  const result = String(value).trim();
  if (result.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return result || undefined;
}

function timestamp(value?: string): string {
  const raw = value ?? new Date().toISOString();
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) throw new Error("Design template timestamp must be valid ISO date-time text.");
  return new Date(ms).toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry);
  return value;
}
