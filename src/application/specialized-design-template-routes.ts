import type { IncomingMessage, ServerResponse } from "node:http";
import {
  auditBrandCompliance,
  type BrandComplianceReport,
} from "../domain/brand-kit";
import {
  captureSpecializedDesignTemplate,
  instantiateSpecializedDesignTemplate,
  type SpecializedDesignTemplateCandidate,
} from "../domain/specialized-design-template";
import type { FileBrandKitStore } from "../infrastructure/file-brand-kit-store";
import type { FileSpecializedCreationStore } from "../infrastructure/file-specialized-creation-store";
import type { FileSpecializedDesignTemplateStore } from "../infrastructure/file-specialized-design-template-store";

export type SpecializedDesignTemplateRouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  forgeProjectId: string,
) => Promise<boolean>;

export function createSpecializedDesignTemplateRoutes(
  templates: FileSpecializedDesignTemplateStore,
  specialized: FileSpecializedCreationStore,
  brandKits: FileBrandKitStore,
): SpecializedDesignTemplateRouteHandler {
  return async (req, res, url, forgeProjectId) => {
    const root = `/api/projects/${forgeProjectId}/design-templates`;

    if (url.pathname === root && req.method === "GET") {
      json(res, 200, { templates: await templates.list(forgeProjectId) });
      return true;
    }

    if (url.pathname === root && req.method === "POST") {
      const input = await body(req);
      const sourceSpecializedProjectId = required(
        input.sourceSpecializedProjectId,
        "Source Specialized project id",
      );
      const sourceProject = await specialized.get(
        forgeProjectId,
        sourceSpecializedProjectId,
      );
      if (!sourceProject) {
        throw new Error(`Specialized project "${sourceSpecializedProjectId}" not found.`);
      }
      const documentId = optional(input.documentId) ?? sourceProject.documents.at(-1)?.id;
      if (!documentId) throw new Error("A saved Specialized document is required to capture a design template.");
      const sourceDocument = sourceProject.documents.find((document) => document.id === documentId);
      if (!sourceDocument) throw new Error(`Specialized document "${documentId}" not found.`);
      const profileId = optional(input.profileId) ?? sourceProject.productionProfiles[0]?.id;
      if (!profileId) throw new Error("A production profile is required to capture a design template.");
      const sourceProfile = sourceProject.productionProfiles.find((profile) => profile.id === profileId);
      if (!sourceProfile) throw new Error(`Production profile "${profileId}" not found.`);

      const brandKitId = optional(input.brandKitId);
      if (brandKitId && !(await brandKits.get(forgeProjectId, brandKitId))) {
        throw new Error(`Brand Kit "${brandKitId}" not found.`);
      }

      const template = captureSpecializedDesignTemplate({
        forgeProjectId,
        sourceSpecializedProjectId,
        sourceDocument,
        sourceProfile,
        title: required(input.title, "Design template title"),
        ...(optional(input.description) ? { description: optional(input.description) } : {}),
        tags: stringArray(input.tags, "Design template tags"),
        ...(brandKitId ? { brandKitId } : {}),
        ...(optional(input.now) ? { now: optional(input.now) } : {}),
      });
      const saved = await templates.create(template);
      json(res, 201, {
        template: saved,
        detachedAssetSlots: countDetachedAssetSlots(saved.document),
      });
      return true;
    }

    const match = url.pathname.match(
      new RegExp(`^${escapeRegex(root)}/([^/]+)(?:/(propose-use))?$`),
    );
    if (!match) return false;
    const templateId = decodeURIComponent(match[1]);
    const action = match[2] ?? "";
    const template = await templates.get(forgeProjectId, templateId);
    if (!template) throw new Error(`Specialized design template "${templateId}" not found.`);

    if (!action && req.method === "GET") {
      json(res, 200, template);
      return true;
    }
    if (!action && req.method === "DELETE") {
      await templates.delete(forgeProjectId, templateId);
      json(res, 200, { deleted: true, id: templateId });
      return true;
    }

    if (action === "propose-use" && req.method === "POST") {
      const input = await body(req);
      const targetSpecializedProjectId = required(
        input.targetSpecializedProjectId,
        "Target Specialized project id",
      );
      const targetProject = await specialized.get(
        forgeProjectId,
        targetSpecializedProjectId,
      );
      if (!targetProject) {
        throw new Error(`Specialized project "${targetSpecializedProjectId}" not found.`);
      }
      const candidate = instantiateSpecializedDesignTemplate({
        template,
        targetSpecializedProjectId,
        targetMode: targetProject.mode,
        ...(optional(input.title) ? { title: optional(input.title) } : {}),
        ...(optional(input.now) ? { now: optional(input.now) } : {}),
      });

      let brandCompliance: BrandComplianceReport | undefined;
      if (template.brandKitId) {
        const kit = await brandKits.get(forgeProjectId, template.brandKitId);
        if (!kit) {
          throw new Error(
            `Template Brand Kit "${template.brandKitId}" is no longer available; template use is blocked until the missing governance dependency is resolved.`,
          );
        }
        brandCompliance = auditBrandCompliance(kit, candidate.document);
      }

      json(res, 200, {
        template,
        candidate,
        ...(brandCompliance ? { brandCompliance } : {}),
        persisted: false,
        readyForAuthorReview:
          !brandCompliance || brandCompliance.compliant,
        nextStep:
          "Review the editable candidate, detached asset slots, target production profile, and Brand Kit evidence. Persist only after explicit author approval through the existing Specialized Creation profile/document endpoints.",
      });
      return true;
    }

    return false;
  };
}

function countDetachedAssetSlots(
  document: SpecializedDesignTemplateCandidate["document"],
): number {
  let count = 0;
  for (const surface of document.surfaces) {
    for (const element of surface.elements) {
      if (element.metadata["forge.template.sourceAssetId"]) count += 1;
    }
  }
  return count;
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 4 * 1024 * 1024) throw new Error("Design template request exceeds 4 MiB.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Design template request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function required(value: unknown, label: string): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function optional(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const result = String(value).trim();
  return result || undefined;
}

function stringArray(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((entry) => required(entry, `${label} entry`));
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
