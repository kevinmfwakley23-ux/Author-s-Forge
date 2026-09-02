import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { createStudioAuthorTrainingRoutes } from "./studio-author-training-routes";
import { createStudioLexicalRoutes } from "./studio-lexical-routes";
import { createStudioRhymeRoutes } from "./studio-rhyme-routes";

export type StudioAuthorCraftRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioAuthorCraftRoutes(store: FileProjectStore): StudioAuthorCraftRouteHandler {
  const training = createStudioAuthorTrainingRoutes(store);
  const rhyme = createStudioRhymeRoutes(store);
  const lexical = createStudioLexicalRoutes(store);
  return async (req, res, url, projectId) => {
    if (await training(req, res, url, projectId)) return true;
    if (await rhyme(req, res, url, projectId)) return true;
    return lexical(req, res, url, projectId);
  };
}
