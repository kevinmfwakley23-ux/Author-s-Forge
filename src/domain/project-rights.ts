import type { ProjectState } from "./project";
import { validateAssetRightsRegistry, type AssetRightsRegistry } from "./asset-rights-provenance";

declare module "./project" {
  interface ProjectState {
    readonly assetRightsRegistry?: AssetRightsRegistry;
  }
}

export function withProjectAssetRightsRegistry(project: ProjectState, registry: AssetRightsRegistry, now = new Date().toISOString()): ProjectState {
  const validated = validateAssetRightsRegistry(registry);
  if (validated.projectId !== project.metadata.id) throw new Error("Project asset rights registry belongs to another project.");
  if (Number.isNaN(Date.parse(now))) throw new Error("Project asset rights registry timestamp is invalid.");
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: new Date(now).toISOString() },
    assetRightsRegistry: validateAssetRightsRegistry(JSON.parse(JSON.stringify(validated))),
  };
}

export function projectAssetRightsRegistry(project: ProjectState): AssetRightsRegistry | undefined {
  return project.assetRightsRegistry === undefined ? undefined : validateAssetRightsRegistry(project.assetRightsRegistry);
}
