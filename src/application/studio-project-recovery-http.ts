import type { ForgeProjectPackage } from "../domain/project-package";
import type { StudioProjectRecoveryResult } from "./studio-project-recovery";
import { StudioProjectRecoveryService } from "./studio-project-recovery";

export interface StudioProjectRecoveryHttpInput {
  readonly authorApproved: boolean;
  readonly package: ForgeProjectPackage;
  readonly rollbackExportedAt?: string;
}

export async function restoreStudioProjectFromHttp(
  recovery: StudioProjectRecoveryService,
  projectId: string,
  input: unknown,
): Promise<StudioProjectRecoveryResult> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Project recovery request must be a JSON object.");
  const request = input as Partial<StudioProjectRecoveryHttpInput>;
  if (request.authorApproved !== true) throw new Error("Explicit author approval is required before restoring a project package.");
  if (!request.package || typeof request.package !== "object" || Array.isArray(request.package)) throw new Error("A Forge project package is required for recovery.");
  if (request.rollbackExportedAt !== undefined && (typeof request.rollbackExportedAt !== "string" || Number.isNaN(Date.parse(request.rollbackExportedAt)))) {
    throw new Error("Recovery rollbackExportedAt must be a valid timestamp when supplied.");
  }
  return recovery.restoreExisting(projectId, request.package, request.rollbackExportedAt);
}
