import { createAuthorGoalsSnapshot, type AuthorGoal, type AuthorGoalsSnapshot } from "../domain/author-goals";
import type { ManuscriptState } from "../domain/manuscript";

export interface AuthorGoalsQuery {
  readonly manuscript: ManuscriptState;
  readonly goals: readonly AuthorGoal[];
  readonly wordCount?: number;
}

export class AuthorGoalsService {
  build(query: AuthorGoalsQuery): AuthorGoalsSnapshot {
    return createAuthorGoalsSnapshot(query.manuscript, query.goals, query.wordCount ?? 0);
  }
}
