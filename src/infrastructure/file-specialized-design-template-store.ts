import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  SPECIALIZED_DESIGN_TEMPLATE_FORMAT_VERSION,
  validateSpecializedDesignTemplate,
  type SpecializedDesignTemplate,
} from "../domain/specialized-design-template";

export const SPECIALIZED_DESIGN_TEMPLATE_STORE_VERSION = 1 as const;

interface SpecializedDesignTemplateFile {
  readonly formatVersion: typeof SPECIALIZED_DESIGN_TEMPLATE_STORE_VERSION;
  readonly templates: readonly SpecializedDesignTemplate[];
}

interface SharedBackend {
  loaded: boolean;
  templates: SpecializedDesignTemplate[];
  operation: Promise<void>;
}

const backends = new Map<string, SharedBackend>();

export class FileSpecializedDesignTemplateStore {
  private readonly path: string;
  private readonly backend: SharedBackend;

  constructor(path: string) {
    this.path = resolve(path);
    this.backend = backends.get(this.path) ?? {
      loaded: false,
      templates: [],
      operation: Promise.resolve(),
    };
    backends.set(this.path, this.backend);
  }

  async list(forgeProjectId: string): Promise<SpecializedDesignTemplate[]> {
    await this.serial(() => this.loadIfNeeded());
    return this.backend.templates
      .filter((template) => template.forgeProjectId === forgeProjectId)
      .map(clone)
      .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  }

  async get(
    forgeProjectId: string,
    id: string,
  ): Promise<SpecializedDesignTemplate | undefined> {
    await this.serial(() => this.loadIfNeeded());
    const template = this.backend.templates.find(
      (item) => item.forgeProjectId === forgeProjectId && item.id === id,
    );
    return template ? clone(template) : undefined;
  }

  async create(
    input: SpecializedDesignTemplate,
  ): Promise<SpecializedDesignTemplate> {
    const template = validateSpecializedDesignTemplate(input);
    await this.serial(async () => {
      await this.loadIfNeeded();
      if (this.backend.templates.some((item) => item.id === template.id)) {
        throw new Error(`Specialized design template id "${template.id}" already exists.`);
      }
      this.backend.templates.push(clone(template));
      await this.persist();
    });
    return clone(template);
  }

  async save(
    input: SpecializedDesignTemplate,
  ): Promise<SpecializedDesignTemplate> {
    const template = validateSpecializedDesignTemplate(input);
    await this.serial(async () => {
      await this.loadIfNeeded();
      const index = this.backend.templates.findIndex(
        (item) => item.forgeProjectId === template.forgeProjectId && item.id === template.id,
      );
      if (index < 0) throw new Error(`Specialized design template "${template.id}" not found.`);
      this.backend.templates[index] = clone(template);
      await this.persist();
    });
    return clone(template);
  }

  async delete(
    forgeProjectId: string,
    id: string,
  ): Promise<void> {
    await this.serial(async () => {
      await this.loadIfNeeded();
      const next = this.backend.templates.filter(
        (item) => !(item.forgeProjectId === forgeProjectId && item.id === id),
      );
      if (next.length === this.backend.templates.length) {
        throw new Error(`Specialized design template "${id}" not found.`);
      }
      this.backend.templates = next;
      await this.persist();
    });
  }

  private async serial<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.backend.operation;
    let release!: () => void;
    this.backend.operation = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  private async loadIfNeeded(): Promise<void> {
    if (this.backend.loaded) return;
    try {
      const parsed = JSON.parse(
        await readFile(this.path, "utf8"),
      ) as SpecializedDesignTemplateFile;
      if (
        parsed.formatVersion !== SPECIALIZED_DESIGN_TEMPLATE_STORE_VERSION ||
        !Array.isArray(parsed.templates)
      ) {
        throw new Error("Unsupported or corrupt Specialized design template store.");
      }
      this.backend.templates = parsed.templates.map((template) => {
        if (template.formatVersion !== SPECIALIZED_DESIGN_TEMPLATE_FORMAT_VERSION) {
          throw new Error("Unsupported Specialized design template record.");
        }
        return clone(validateSpecializedDesignTemplate(template));
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.backend.templates = [];
    }
    this.backend.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    const payload: SpecializedDesignTemplateFile = {
      formatVersion: SPECIALIZED_DESIGN_TEMPLATE_STORE_VERSION,
      templates: this.backend.templates,
    };
    await writeFile(
      temporaryPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await rename(temporaryPath, this.path);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
