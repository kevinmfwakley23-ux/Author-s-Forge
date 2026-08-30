import { analyzeCraft, type CraftLensReport } from "../domain/craft-lens";

export interface CraftLensQuery {
  readonly content: string;
}

export class CraftLensService {
  analyze(query: CraftLensQuery): CraftLensReport {
    return analyzeCraft(query.content);
  }
}
