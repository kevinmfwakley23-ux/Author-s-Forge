import type { WorkspaceBook, WorkspaceChapter, WorkspaceScene } from "../domain/studio-workspace";
import { creativeToolById, type CreativeToolDescriptor } from "./creative-tool-registry";

export interface CreativeAgentToolTarget {
  readonly book?: WorkspaceBook;
  readonly chapter?: WorkspaceChapter;
  readonly scene?: WorkspaceScene;
}

export interface CreativeAgentPriorObservation {
  readonly toolId: string;
  readonly response: unknown;
}

/**
 * Build the request body for one registered Forge tool on the server.
 * This deliberately mirrors the established Workbench v3 adapters while moving
 * orchestration authority out of browser JavaScript and into the Forge runtime.
 */
export function buildCreativeAgentToolRequest(
  target: CreativeAgentToolTarget,
  tool: CreativeToolDescriptor,
  goal: string,
  authorValue: string | undefined,
  runId: string,
  observations: readonly CreativeAgentPriorObservation[],
): Readonly<Record<string, unknown>> {
  const lower = goal.toLowerCase();
  const author = optionalText(authorValue, 160) ?? "Author";

  switch (tool.id) {
    case "project.context":
      return { query: goal };
    case "research.live":
      return {
        question: goal,
        researchedBecause: "Author-approved Forge Creative Agent Runtime V4 mission",
        domain: chooseResearchDomain(lower),
        ...(target.book ? { bookId: target.book.id } : {}),
        ...(target.chapter ? { chapterId: target.chapter.id } : {}),
        ...(target.scene ? { sceneId: target.scene.id } : {}),
      };
    case "market.kdp.research":
      return {
        ...(target.book ? { bookId: target.book.id } : {}),
        question: goal,
        market: chooseMarket(goal),
      };
    case "architecture.generate":
      return {
        idea: goal,
        kind: target.book?.kind ?? "novel",
        targetChapters: target.book?.chapters.length ?? 0,
      };
    case "story.chapter-cards.propose": {
      const book = requiredTarget(target.book, "book");
      return {
        bookId: book.id,
        description: goal,
        targetChapters: Math.max(1, book.chapters.length || 1),
        replaceExistingCards: false,
      };
    }
    case "writing.propose": {
      const book = requiredTarget(target.book, "book");
      const chapter = requiredTarget(target.chapter, "chapter");
      const scene = requiredTarget(target.scene, "scene");
      const task = lower.includes("rewrite") || lower.includes("revise")
        ? "rewrite"
        : (scene.content.trim() ? "continue" : "draft");
      return {
        bookId: book.id,
        chapterId: chapter.id,
        sceneId: scene.id,
        task,
        instruction: goal,
        contextQuery: goal,
      };
    }
    case "editing.analyze": {
      const scene = requiredTarget(target.scene, "scene");
      if (!scene.content.trim()) throw new Error("The selected scene has no manuscript text to edit.");
      return {
        manuscriptId: "studio-workspace",
        ...(target.book ? { bookId: target.book.id } : {}),
        ...(target.chapter ? { chapterId: target.chapter.id } : {}),
        sceneId: scene.id,
        title: scene.title || "Agent editorial analysis",
        text: scene.content,
        roles: ["developmental", "continuity", "line", "copy", "proofreading"],
      };
    }
    case "cover.direction.propose":
      return { bookId: requiredTarget(target.book, "book").id, brief: goal };
    case "visual.image.generate":
      return {
        prompt: goal,
        purpose: hasAny(lower, ["cover", "book jacket", "dust jacket"]) ? "cover-art" : "illustration",
        size: "auto",
        quality: "auto",
      };
    case "promotion.campaign.propose": {
      const book = requiredTarget(target.book, "book");
      return {
        bookId: book.id,
        objective: goal,
        audience: `Readers who are a strong fit for this ${book.kind.replace(/-/gu, " ")}`,
        readerPromise: book.description.trim() || goal,
        channels: ["social", "author-site"],
        marketplace: chooseMarket(goal),
      };
    }
    case "production.export":
      return {
        bookId: requiredTarget(target.book, "book").id,
        format: chooseExportFormat(lower),
        pageSize: "6x9",
        author,
      };
    case "memory.record-working": {
      if (!observations.length) {
        throw new Error("Creative Agent must execute at least one workflow operation before recording working evidence.");
      }
      const evidence = observations
        .map((observation) => `${observation.toolId.toUpperCase()}\n${JSON.stringify(observation.response, null, 2)}`)
        .join("\n\n---\n\n");
      return {
        id: `agent-run-${runId}-${observations.length + 1}`,
        class: "creative-note",
        authority: "working",
        summary: `Forge Creative Agent V4: ${goal.slice(0, 140)}`,
        content: [
          `AUTHOR GOAL:\n${goal}`,
          `TARGET: ${target.book?.title ?? "project"}${target.chapter ? ` / ${target.chapter.title}` : ""}${target.scene ? ` / ${target.scene.title}` : ""}`,
          `EXECUTION EVIDENCE:\n${clip(evidence, 12_000)}`,
        ].join("\n\n"),
        reference: "forge-agent-runtime-v4",
        relevanceTags: ["agent-workflow", "creative-workflow", "agent-runtime-v4"],
      };
    }
    default:
      creativeToolById(tool.id);
      throw new Error(`Creative Agent Runtime V4 has no execution adapter for registered tool "${tool.id}".`);
  }
}

function chooseResearchDomain(goal: string): string {
  if (hasAny(goal, ["market", "niche", "sales", "selling", "keyword"])) return "market";
  if (hasAny(goal, ["genre trend", "trend", "popular genre"])) return "genre-trend";
  if (hasAny(goal, ["reader", "audience expectation"])) return "reader-expectation";
  if (hasAny(goal, ["comparable", "comp book", "similar book"])) return "comparable-book";
  if (hasAny(goal, ["publish", "kdp", "retailer"])) return "publishing";
  if (hasAny(goal, ["weather", "climate"])) return "weather";
  if (hasAny(goal, ["legal", "law", "regulation"])) return "legal-environmental";
  if (hasAny(goal, ["medical", "medicine", "science", "scientific"])) return "medical-scientific";
  if (hasAny(goal, ["historical event", "battle", "war", "election"])) return "historical-event";
  if (hasAny(goal, ["historical", "history", "period", "era"])) return "historical-period";
  if (hasAny(goal, ["travel", "distance", "route"])) return "travel-distance";
  if (hasAny(goal, ["setting", "location", "city", "town", "place", "geography"])) return "real-world-location";
  if (hasAny(goal, ["architecture", "building"])) return "architecture";
  return "terminology";
}

function chooseMarket(goal: string): string {
  if (/\b(uk|united kingdom|britain|amazon\.co\.uk)\b/iu.test(goal)) return "Amazon.co.uk";
  if (/\b(canada|amazon\.ca)\b/iu.test(goal)) return "Amazon.ca";
  if (/\b(australia|amazon\.com\.au)\b/iu.test(goal)) return "Amazon.com.au";
  return "Amazon.com";
}

function chooseExportFormat(goal: string): string {
  if (goal.includes("kdp") && goal.includes("epub")) return "kdp-epub";
  if (goal.includes("kdp") && (goal.includes("docx") || goal.includes("word document"))) return "kdp-docx";
  if (goal.includes("kdp")) return "kdp-pdf";
  if (goal.includes("epub")) return "epub";
  if (goal.includes("docx") || goal.includes("word document")) return "docx";
  return "pdf";
}

function requiredTarget<T>(value: T | undefined, label: string): T {
  if (!value) throw new Error(`Creative Agent tool requires ${label} scope.`);
  return value;
}

function optionalText(value: string | undefined, max: number): string | undefined {
  if (value === undefined || value === "") return undefined;
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`Creative Agent text value exceeds ${max} characters.`);
  return normalized || undefined;
}

function hasAny(text: string, values: readonly string[]): boolean {
  return values.some((value) => text.includes(value));
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
}
