export { createProject, PROJECT_FORMAT_VERSION, touchProject } from "./domain/project";
export type { ProjectMetadata, ProjectState, ProjectStatus } from "./domain/project";
export type { ProjectStore } from "./application/project-store";
export { FileProjectStore } from "./infrastructure/file-project-store";
export { createAuthorInput } from "./domain/author-input";
export type { AuthorInput, AuthorInputIntent, AuthorInputMode, ClassifiedAuthorInput, TranscriptProvenance } from "./domain/author-input";
export { classifyAuthorInput, routeAuthorInput } from "./application/input-router";
