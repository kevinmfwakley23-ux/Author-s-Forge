export const SPECIALIZED_CREATION_WORKFLOW_VERSION = 1 as const;

export const SPECIALIZED_CREATION_MODES = [
  'comic-book',
  'greeting-card',
  'birthday-card',
  'invitation',
  'flyer',
  'trading-card-game',
] as const;
export type SpecializedCreationMode = typeof SPECIALIZED_CREATION_MODES[number];

export type SpecializedCreationStage = 'brief' | 'plan' | 'create' | 'review' | 'production';

export interface SpecializedCreationProject {
  readonly id: string;
  readonly mode: SpecializedCreationMode;
  readonly title: string;
  readonly brief: string;
  readonly stage: SpecializedCreationStage;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SpecializedCreationStep {
  readonly id: string;
  readonly projectId: string;
  readonly mode: SpecializedCreationMode;
  readonly stage: SpecializedCreationStage;
  readonly label: string;
  readonly required: boolean;
  readonly completed: boolean;
}

const STAGES: readonly SpecializedCreationStage[] = ['brief', 'plan', 'create', 'review', 'production'];

export function createSpecializedCreationProject(input: {
  id: string;
  mode: SpecializedCreationMode;
  title: string;
  brief: string;
  now?: string;
}): SpecializedCreationProject {
  const now = input.now ?? new Date().toISOString();
  return Object.freeze({
    id: input.id,
    mode: input.mode,
    title: input.title.trim(),
    brief: input.brief.trim(),
    stage: 'brief',
    createdAt: now,
    updatedAt: now,
  });
}

export function buildSpecializedCreationSteps(project: SpecializedCreationProject): readonly SpecializedCreationStep[] {
  const labels: Record<SpecializedCreationStage, string> = {
    brief: 'Define creative brief',
    plan: 'Build production plan',
    create: 'Create assets',
    review: 'Review and approve',
    production: 'Validate and export',
  };
  return STAGES.map((stage) => Object.freeze({
    id: `${project.id}:${stage}`,
    projectId: project.id,
    mode: project.mode,
    stage,
    label: labels[stage],
    required: true,
    completed: stage === 'brief' ? Boolean(project.brief.trim()) : false,
  }));
}

export function advanceSpecializedCreationStage(
  project: SpecializedCreationProject,
  completedStage: SpecializedCreationStage,
  now?: string,
): SpecializedCreationProject {
  if (project.stage !== completedStage) {
    throw new Error(`Cannot advance ${project.id}: expected current stage ${project.stage}, received ${completedStage}`);
  }
  const index = STAGES.indexOf(completedStage);
  const nextStage = STAGES[index + 1] ?? completedStage;
  return Object.freeze({ ...project, stage: nextStage, updatedAt: now ?? new Date().toISOString() });
}

export function validateSpecializedCreationProject(project: SpecializedCreationProject): readonly string[] {
  const errors: string[] = [];
  if (!project.id.trim()) errors.push('project id is required');
  if (!SPECIALIZED_CREATION_MODES.includes(project.mode)) errors.push('unsupported specialized creation mode');
  if (!project.title.trim()) errors.push('title is required');
  if (!project.brief.trim()) errors.push('brief is required');
  if (!STAGES.includes(project.stage)) errors.push('invalid workflow stage');
  return errors;
}
