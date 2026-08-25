export const PROJECT_FORMAT_VERSION = 1 as const;

export type ProjectStatus = "active" | "archived";

export interface ProjectMetadata {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: ProjectStatus;
}

export interface ProjectState {
  readonly formatVersion: typeof PROJECT_FORMAT_VERSION;
  readonly metadata: ProjectMetadata;
}

export function createProject(input: {
  id: string;
  title: string;
  now?: string;
}): ProjectState {
  if (!input.id.trim()) throw new Error("Project id is required.");
  if (!input.title.trim()) throw new Error("Project title is required.");

  const now = input.now ?? new Date().toISOString();
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    metadata: {
      id: input.id,
      title: input.title.trim(),
      createdAt: now,
      updatedAt: now,
      status: "active"
    }
  };
}

export function touchProject(project: ProjectState, now = new Date().toISOString()): ProjectState {
  return {
    ...project,
    metadata: {
      ...project.metadata,
      updatedAt: now
    }
  };
}
