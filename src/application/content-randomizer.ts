import { randomizeContent, validateRandomizerResult } from "../domain/content-randomizer";
import type { RandomizerRequest, RandomizerResult } from "../domain/content-randomizer";
export class ContentRandomizerService { generate(request:RandomizerRequest):RandomizerResult{return validateRandomizerResult(randomizeContent(request));} }
