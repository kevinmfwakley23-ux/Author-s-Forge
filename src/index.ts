export type { MemoryClass, MemoryAuthority, MemoryProvenance, MemoryRecord, MemoryQuery } from "./domain/memory";
export { createMemoryRecord, MEMORY_FORMAT_VERSION } from "./domain/memory";
export { ProjectMemoryStore } from "./application/project-memory-store";
export type { MemoryPromotionDecision, ProjectMemorySnapshot } from "./application/project-memory-store";
export { assembleProjectBrainContext } from "./application/project-brain";
export type { ProjectBrainQuery, ProjectBrainContext } from "./application/project-brain";
export { createProject, touchProject, withProjectMemories, PROJECT_FORMAT_VERSION } from "./domain/project";
export type { ProjectMetadata, ProjectState, ProjectStatus } from "./domain/project";
export { FileProjectStore } from "./infrastructure/file-project-store";
export {
  MANUSCRIPT_FORMAT_VERSION,
  createManuscriptState,
  createBook,
  createChapter,
  createScene,
  addBook,
  addChapter,
  addScene,
  insertChapter,
  insertScene,
  validateManuscriptState
} from "./domain/manuscript";
export type {
  BookLifecycle,
  ChapterLifecycle,
  SceneLifecycle,
  BookRecord,
  ChapterRecord,
  SceneRecord,
  ManuscriptState
} from "./domain/manuscript";
