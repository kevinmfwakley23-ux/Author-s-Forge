import { createHash } from "node:crypto";
import { assertJsonValue } from "../domain/json-value";
import { createProjectPackage, deserializeProjectPackage, serializeProjectPackage, validateProjectPackage } from "../domain/project-package";
import type { ForgeProjectPackage, ProjectPackageFile } from "../domain/project-package";

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

  validate(pkg:ForgeProjectPackage):ForgeProjectPackage {
    return validateProjectPackage(pkg);
  }
}
