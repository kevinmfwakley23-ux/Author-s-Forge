import { type AssembledWritingContext, type ContextAssemblyRequest } from "../domain/context-assembly";
import type { ProjectState } from "../domain/project";
export declare class WritingContextService {
    assemble(project: ProjectState, request: Omit<ContextAssemblyRequest, "projectId"> & {
        projectId?: string;
    }): AssembledWritingContext;
}
