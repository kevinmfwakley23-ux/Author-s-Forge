import { createHash } from "node:crypto";
import { createProjectPackage, deserializeProjectPackage, serializeProjectPackage, validateProjectPackage } from "../domain/project-package";
import type { ForgeProjectPackage, ProjectPackageFile } from "../domain/project-package";

export class ProjectPackageService {
  export(input:{projectId:string;projectState:unknown;files?:readonly ProjectPackageFile[];exportedAt?:string}):ForgeProjectPackage {
    return createProjectPackage(input);
  }

  exportSnapshot(input:{projectId:string;projectState:unknown;exportedAt?:string}):ForgeProjectPackage {
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

  validate(pkg:ForgeProjectPackage):ForgeProjectPackage {
    return validateProjectPackage(pkg);
  }
}
