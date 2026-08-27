import { assembleWritingContext, type AssembledWritingContext, type ContextAssemblyRequest } from "../domain/context-assembly";
import type { ProjectState } from "../domain/project";

export class WritingContextService {
  public assemble(project: ProjectState, request: Omit<ContextAssemblyRequest, "projectId"> & { projectId?: string }): AssembledWritingContext {
    return assembleWritingContext(project, { ...request, projectId: request.projectId ?? project.metadata.id });
  }
}
