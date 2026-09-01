import { createHash } from "node:crypto";
import { assertJsonValue } from "../domain/json-value";
import type { ProjectState } from "../domain/project";
import { validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import { createProjectPackage, deserializeProjectPackage, serializeProjectPackage, validateProjectPackage } from "../domain/project-package";
import type { ForgeProjectPackage, ProjectPackageFile } from "../domain/project-package";

export interface StudioProjectPackageState {
  readonly project: ProjectState;
  readonly studioWorkspace: StudioWorkspaceState;
}

export class ProjectPackageService {
  export(input:{projectId:string;projectState:unknown;files?:readonly ProjectPackageFile[];exportedAt?:string}):ForgeProjectPackage {
    return createProjectPackage(input);
  }

  exportSnapshot(input:{projectId:string;projectState:unknown;exportedAt?:string}):ForgeProjectPackage {
    assertJsonValue(input.projectState, "Project package projectState");
    const content = JSON.stringify(input.projectState, null, 2);
    const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
    return this.export({
      ...input,
      files: [{
        path: "project-state.json",
        content,
        encoding: "utf8",
        mediaType: "application/json",
        sha256,
      }],
    });
  }

  exportStudioSnapshot(input:{projectId:string;project:ProjectState;studioWorkspace:StudioWorkspaceState;exportedAt?:string}):ForgeProjectPackage {
    const projectState = validateStudioProjectPackageState({ project: input.project, studioWorkspace: input.studioWorkspace }, input.projectId);
    return this.exportSnapshot({ projectId: input.projectId, projectState, exportedAt: input.exportedAt });
  }

  serialize(pkg:ForgeProjectPackage):string {
    return serializeProjectPackage(pkg);
  }

  import(serialized:string):ForgeProjectPackage {
    return deserializeProjectPackage(serialized);
  }

  restoreSnapshot(pkg:ForgeProjectPackage, expectedProjectId?:string):unknown {
    const validated = this.validate(pkg);
    if (expectedProjectId !== undefined && validated.manifest.projectId !== expectedProjectId) throw new Error("Project package id does not match the restore target.");
    const stateFile = validated.files.find((file) => file.path === "project-state.json" && file.encoding === "utf8");
    if (!stateFile) throw new Error("Forge project package does not contain a UTF-8 project-state.json snapshot.");
    const state = JSON.parse(stateFile.content) as unknown;
    const stateRecord = state && typeof state === "object" && !Array.isArray(state) ? state as Record<string, unknown> : null;
    const metadata = stateRecord?.metadata;
    const metadataId = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).id : undefined;
    if (metadataId !== undefined && metadataId !== validated.manifest.projectId) throw new Error("Project package snapshot metadata id does not match the package project id.");
    return state;
  }

  restoreStudioSnapshot(pkg:ForgeProjectPackage, expectedProjectId?:string):ProjectState {
    const validatedPackage = this.validate(pkg);
    const projectId = expectedProjectId ?? validatedPackage.manifest.projectId;
    const state = this.restoreSnapshot(validatedPackage, projectId);
    return validateStudioProjectPackageState(state, projectId).project;
  }

  validate(pkg:ForgeProjectPackage):ForgeProjectPackage {
    return validateProjectPackage(pkg);
  }
}

function validateStudioProjectPackageState(value: unknown, expectedProjectId: string): StudioProjectPackageState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Studio project package state must be an object.");
  const envelope = value as Record<string, unknown>;
  if (!envelope.project || typeof envelope.project !== "object" || Array.isArray(envelope.project)) throw new Error("Studio project package requires a project object.");
  if (!envelope.studioWorkspace || typeof envelope.studioWorkspace !== "object" || Array.isArray(envelope.studioWorkspace)) throw new Error("Studio project package requires a studioWorkspace object.");

  const project = envelope.project as ProjectState;
  if (!project.metadata || typeof project.metadata !== "object" || project.metadata.id !== expectedProjectId) {
    throw new Error("Studio project package nested project id does not match the package project id.");
  }

  const workspace = validateStudioWorkspace(envelope.studioWorkspace as StudioWorkspaceState);
  if (project.studioWorkspace !== undefined) {
    const nestedWorkspace = validateStudioWorkspace(project.studioWorkspace);
    if (JSON.stringify(nestedWorkspace) !== JSON.stringify(workspace)) {
      throw new Error("Studio project package workspace does not match the nested project workspace.");
    }
  }

  const clonedWorkspace = validateStudioWorkspace(JSON.parse(JSON.stringify(workspace)));
  const normalizedProject = { ...project, studioWorkspace: clonedWorkspace } as ProjectState;
  return { project: normalizedProject, studioWorkspace: validateStudioWorkspace(JSON.parse(JSON.stringify(clonedWorkspace))) };
}
