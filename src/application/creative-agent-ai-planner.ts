import type { ProjectState } from "../domain/project";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { ProjectMemoryStore } from "./project-memory-store";
import {
  compileCreativeAgentPlan,
  compileCreativeAgentSelectedPlan,
  type CreativeAgentPlan,
  type CreativeAgentPlanInput,
  type CreativeAgentToolSelection,
} from "./creative-agent-plan";
import { creativeToolById, listCreativeTools } from "./creative-tool-registry";

export type CreativeAgentAiPlannerGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;

export interface CreativeAgentAiPlannerResult {
  readonly plan: CreativeAgentPlan;
  readonly plannerUsed: "ai" | "deterministic-fallback";
  readonly provider?: AiGenerationResult["provider"];
  readonly model?: string;
  readonly requestId?: string;
  readonly fallbackReason?: string;
}

/**
 * Optional model-assisted planning. The model may only select registered tool ids.
 * Its output is never executed directly: Forge validates it, recompiles it through
 * the same governance compiler, and falls back visibly to the deterministic planner
 * whenever provider execution or schema validation fails.
 */
export async function compileCreativeAgentPlanWithAi(
  project: ProjectState,
  input: CreativeAgentPlanInput,
  generator: CreativeAgentAiPlannerGenerator = generateProjectText,
): Promise<CreativeAgentAiPlannerResult> {
  const deterministic = compileCreativeAgentPlan(input);
  try {
    const memory = new ProjectMemoryStore();
    for (const record of project.memories) memory.register(record);
    const tools = listCreativeTools().filter((tool) => tool.id !== "memory.record-working").map((tool) => ({
      id: tool.id,
      title: tool.title,
      description: tool.description,
      approvalClass: tool.approvalClass,
      providerRequirement: tool.providerRequirement,
      stateEffect: tool.stateEffect,
      requiredScope: tool.requiredScope,
    }));

    const result = await generator({
      memory,
      context: {
        projectId: project.metadata.id,
        taskMemoryClasses: [
          "author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory",
          "location-memory", "timeline-memory", "style-memory", "research-memory", "decision-memory",
          "creative-note", "open-thread",
        ],
        includeWorkingState: true,
        limit: 128,
      },
      system: [
        "You are the Author's Forge creative workflow planner.",
        "You are planning only. Never execute tools, change project state, approve proposals, or claim a provider operation succeeded.",
        "Return ONLY one valid JSON object with exactly this shape: {\"steps\":[{\"toolId\":\"registered.tool.id\",\"reason\":\"brief reason\"}]}.",
        "Select only tool ids supplied in AVAILABLE TOOLS. Do not invent routes, tools, fields, capabilities, or hidden steps.",
        "Choose the minimum useful sequence for the author's goal. Preserve the requested order when the goal clearly expresses one.",
        "Do not include memory.record-working; Forge adds the final audit-memory step itself.",
        "Do not infer missing book/chapter/scene scope. Forge will surface missing scope as blocked rather than guessing.",
        "If writing.propose is useful, Forge will enforce Project Brain grounding before it.",
        "Consequential operations remain author-reviewed regardless of collaboration mode.",
      ].join(" "),
      user: JSON.stringify({
        authorGoal: input.goal,
        collaborationMode: input.mode,
        availableScope: input.scope,
        availableTools: tools,
        outputSchema: { steps: [{ toolId: "registered.tool.id", reason: "brief reason" }] },
      }, null, 2),
      task: "tool-use",
      temperature: 0,
      maxOutputTokens: 2500,
      requiresInstructionFollowing: true,
    });

    const selections = parseSelections(result.text);
    const plan = compileCreativeAgentSelectedPlan(input, selections);
    return {
      plan,
      plannerUsed: "ai",
      provider: result.provider,
      model: result.model,
      ...(result.requestId ? { requestId: result.requestId } : {}),
    };
  } catch (error) {
    return {
      plan: deterministic,
      plannerUsed: "deterministic-fallback",
      fallbackReason: clippedError(error),
    };
  }
}

function parseSelections(raw: string): readonly CreativeAgentToolSelection[] {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("AI planner returned an empty response.");
  const trimmed = raw.trim();
  const source = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { throw new Error("AI planner did not return valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("AI planner JSON must be an object.");
  const object = parsed as Record<string, unknown>;
  const keys = Object.keys(object);
  if (keys.length !== 1 || keys[0] !== "steps") throw new Error("AI planner JSON may contain only the steps field.");
  if (!Array.isArray(object.steps) || object.steps.length < 1 || object.steps.length > 20) throw new Error("AI planner must return 1 through 20 steps.");

  return object.steps.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`AI planner step ${index + 1} must be an object.`);
    const row = entry as Record<string, unknown>;
    const rowKeys = Object.keys(row);
    if (rowKeys.some((key) => key !== "toolId" && key !== "reason")) throw new Error(`AI planner step ${index + 1} contains unsupported fields.`);
    if (typeof row.toolId !== "string" || !row.toolId.trim()) throw new Error(`AI planner step ${index + 1} requires a toolId.`);
    const toolId = row.toolId.trim();
    if (toolId === "memory.record-working") throw new Error("AI planner cannot place the audit-memory step; Forge owns final audit ordering.");
    creativeToolById(toolId);
    let reason: string | undefined;
    if (row.reason !== undefined && row.reason !== null) {
      if (typeof row.reason !== "string") throw new Error(`AI planner step ${index + 1} reason must be a string.`);
      reason = row.reason.trim();
      if (reason.length > 2_000) throw new Error(`AI planner step ${index + 1} reason exceeds 2,000 characters.`);
    }
    return Object.freeze({ toolId, ...(reason ? { reason } : {}) });
  });
}

function clippedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.replace(/\s+/g, " ").trim() || "AI-enhanced planning failed without a usable error message.";
  return normalized.length > 800 ? `${normalized.slice(0, 797)}...` : normalized;
}
