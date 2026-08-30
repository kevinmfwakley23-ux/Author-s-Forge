import type { ManuscriptState } from "./manuscript";

export const AUTHOR_GOALS_FORMAT_VERSION = 1 as const;
export type AuthorGoalMetric = "words" | "scenes" | "chapters";

export interface AuthorGoal {
  readonly id: string;
  readonly metric: AuthorGoalMetric;
  readonly target: number;
  readonly period: "session" | "day" | "week" | "project";
  readonly label: string;
}

export interface AuthorGoalProgress {
  readonly goal: AuthorGoal;
  readonly current: number;
  readonly remaining: number;
  readonly percent: number;
  readonly complete: boolean;
}

export interface AuthorGoalsSnapshot {
  readonly formatVersion: typeof AUTHOR_GOALS_FORMAT_VERSION;
  readonly progress: readonly AuthorGoalProgress[];
  readonly manuscript: {
    readonly words: number;
    readonly scenes: number;
    readonly completedScenes: number;
    readonly chapters: number;
    readonly completedChapters: number;
  };
}

export function createAuthorGoal(input: { id: string; metric: AuthorGoalMetric; target: number; period?: AuthorGoal["period"]; label?: string }): AuthorGoal {
  if (!input.id.trim()) throw new Error("Author goal id is required.");
  if (!Number.isInteger(input.target) || input.target <= 0) throw new Error("Author goal target must be a positive integer.");
  const metric = input.metric;
  if (!["words", "scenes", "chapters"].includes(metric)) throw new Error(`Unsupported author goal metric \"${metric}\".`);
  const period = input.period ?? "day";
  const label = input.label?.trim() || defaultLabel(metric, period);
  return { id: input.id.trim(), metric, target: input.target, period, label };
}

export function createAuthorGoalsSnapshot(manuscript: ManuscriptState, goals: readonly AuthorGoal[]): AuthorGoalsSnapshot {
  const scenes = manuscript.scenes;
  const chapters = manuscript.chapters;
  const words = 0;
  const completedScenes = scenes.filter((scene) => scene.lifecycle === "complete").length;
  const completedChapters = chapters.filter((chapter) => chapter.lifecycle === "complete").length;
  return {
    formatVersion: AUTHOR_GOALS_FORMAT_VERSION,
    manuscript: { words, scenes: scenes.length, completedScenes, chapters: chapters.length, completedChapters },
    progress: goals.map((goal) => {
      const current = goal.metric === "scenes" ? completedScenes : goal.metric === "chapters" ? completedChapters : words;
      const percent = Math.min(100, Math.round((current / goal.target) * 100));
      return { goal, current, remaining: Math.max(0, goal.target - current), percent, complete: current >= goal.target };
    }),
  };
}

function defaultLabel(metric: AuthorGoalMetric, period: AuthorGoal["period"]): string {
  const names: Record<AuthorGoalMetric, string> = { words: "words", scenes: "completed scenes", chapters: "completed chapters" };
  return `${period[0].toUpperCase()}${period.slice(1)} ${names[metric]} goal`;
}
