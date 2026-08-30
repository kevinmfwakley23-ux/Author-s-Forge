import type { ManuscriptState } from "../domain/manuscript";
import { createStoryMap, type StoryMap } from "../domain/story-map";

export interface StoryMapQuery {
  readonly manuscript: ManuscriptState;
}

export class StoryMapService {
  build(query: StoryMapQuery): StoryMap {
    return createStoryMap(query.manuscript);
  }
}
