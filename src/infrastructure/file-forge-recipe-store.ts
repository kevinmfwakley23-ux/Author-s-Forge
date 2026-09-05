import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { FORGE_RECIPE_FORMAT_VERSION, validateForgeRecipe, validateForgeRecipeRun, type ForgeRecipe, type ForgeRecipeRun } from "../domain/forge-recipes";

const FORGE_RECIPE_STORE_FORMAT_VERSION = 1 as const;

interface ForgeRecipeStoreState {
  readonly formatVersion: typeof FORGE_RECIPE_STORE_FORMAT_VERSION;
  readonly recipes: readonly ForgeRecipe[];
  readonly runs: readonly ForgeRecipeRun[];
}

export class FileForgeRecipeStore {
  private loaded = false;
  private recipes = new Map<string, ForgeRecipe>();
  private runs = new Map<string, ForgeRecipeRun>();

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Forge Recipe store path is required.");
  }

  async listRecipes(projectId: string): Promise<ForgeRecipe[]> {
    await this.load();
    return [...this.recipes.values()]
      .filter((recipe) => recipe.projectId === projectId)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map(cloneRecipe);
  }

  async getRecipe(projectId: string, recipeId: string): Promise<ForgeRecipe | undefined> {
    await this.load();
    const recipe = this.recipes.get(key(projectId, recipeId));
    return recipe ? cloneRecipe(recipe) : undefined;
  }

  async createRecipe(recipe: ForgeRecipe): Promise<ForgeRecipe> {
    await this.load();
    const validated = validateForgeRecipe(recipe);
    const id = key(validated.projectId, validated.id);
    if (this.recipes.has(id)) throw new Error(`Forge Recipe "${validated.id}" already exists in project "${validated.projectId}".`);
    this.recipes.set(id, cloneRecipe(validated));
    await this.save();
    return cloneRecipe(validated);
  }

  async replaceRecipe(recipe: ForgeRecipe): Promise<ForgeRecipe> {
    await this.load();
    const validated = validateForgeRecipe(recipe);
    const id = key(validated.projectId, validated.id);
    if (!this.recipes.has(id)) throw new Error(`Forge Recipe "${validated.id}" not found in project "${validated.projectId}".`);
    this.recipes.set(id, cloneRecipe(validated));
    await this.save();
    return cloneRecipe(validated);
  }

  async deleteRecipe(projectId: string, recipeId: string): Promise<void> {
    await this.load();
    const id = key(projectId, recipeId);
    if (!this.recipes.has(id)) throw new Error(`Forge Recipe "${recipeId}" not found in project "${projectId}".`);
    this.recipes.delete(id);
    await this.save();
  }

  async appendRun(run: ForgeRecipeRun): Promise<ForgeRecipeRun> {
    await this.load();
    const validated = validateForgeRecipeRun(run);
    const id = key(validated.projectId, validated.id);
    if (this.runs.has(id)) throw new Error(`Forge Recipe run "${validated.id}" already exists.`);
    this.runs.set(id, cloneRun(validated));
    await this.save();
    return cloneRun(validated);
  }

  async listRuns(projectId: string, recipeId?: string): Promise<ForgeRecipeRun[]> {
    await this.load();
    return [...this.runs.values()]
      .filter((run) => run.projectId === projectId && (recipeId === undefined || run.recipeId === recipeId))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id))
      .map(cloneRun);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const state = validateStoreState(JSON.parse(raw));
      this.recipes = new Map(state.recipes.map((recipe) => [key(recipe.projectId, recipe.id), cloneRecipe(recipe)]));
      this.runs = new Map(state.runs.map((run) => [key(run.projectId, run.id), cloneRun(run)]));
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.loaded = true;
  }

  private async save(): Promise<void> {
    const state: ForgeRecipeStoreState = {
      formatVersion: FORGE_RECIPE_STORE_FORMAT_VERSION,
      recipes: [...this.recipes.values()].sort((a, b) => a.projectId.localeCompare(b.projectId) || a.id.localeCompare(b.id)).map(cloneRecipe),
      runs: [...this.runs.values()].sort((a, b) => a.projectId.localeCompare(b.projectId) || a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id)).map(cloneRun),
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

function validateStoreState(value: unknown): ForgeRecipeStoreState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Forge Recipe store.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== FORGE_RECIPE_STORE_FORMAT_VERSION) throw new Error("Unsupported Forge Recipe store format.");
  if (!Array.isArray(candidate.recipes) || !Array.isArray(candidate.runs)) throw new Error("Corrupt Forge Recipe store collections.");
  const recipeIds = new Set<string>();
  const recipes = candidate.recipes.map((raw) => {
    const recipe = validateForgeRecipe(raw as ForgeRecipe);
    const id = key(recipe.projectId, recipe.id);
    if (recipeIds.has(id)) throw new Error(`Duplicate Forge Recipe "${recipe.id}" in project "${recipe.projectId}".`);
    recipeIds.add(id);
    return recipe;
  });
  const runIds = new Set<string>();
  const runs = candidate.runs.map((raw) => {
    const run = validateForgeRecipeRun(raw as ForgeRecipeRun);
    const id = key(run.projectId, run.id);
    if (runIds.has(id)) throw new Error(`Duplicate Forge Recipe run "${run.id}".`);
    runIds.add(id);
    return run;
  });
  return { formatVersion: FORGE_RECIPE_STORE_FORMAT_VERSION, recipes, runs };
}

function key(projectId: string, id: string): string {
  if (!projectId.trim() || !id.trim()) throw new Error("Forge Recipe project/id key is required.");
  return `${projectId}\u0000${id}`;
}

function cloneRecipe(recipe: ForgeRecipe): ForgeRecipe {
  return validateForgeRecipe(JSON.parse(JSON.stringify(recipe)) as ForgeRecipe);
}

function cloneRun(run: ForgeRecipeRun): ForgeRecipeRun {
  return validateForgeRecipeRun(JSON.parse(JSON.stringify(run)) as ForgeRecipeRun);
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}
