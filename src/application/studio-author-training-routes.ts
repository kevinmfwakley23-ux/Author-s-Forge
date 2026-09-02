import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { createMemoryRecord } from "../domain/memory";
import { withProjectMemories, type ProjectState } from "../domain/project";
import { ProjectMemoryStore } from "./project-memory-store";

export const AUTHOR_TRAINING_FORMAT_VERSION = 1 as const;

export interface AuthorTrainingQuestion {
  readonly id: string;
  readonly category: "thinking" | "emotion" | "speech" | "storytelling" | "values" | "humor" | "conflict" | "boundaries";
  readonly prompt: string;
  readonly purpose: string;
}

export const AUTHOR_TRAINING_QUESTIONS: readonly AuthorTrainingQuestion[] = Object.freeze([
  { id: "thinking-meaning", category: "thinking", prompt: "When something important happens, what do you usually try to understand first: what happened, why it happened, how it felt, what it means, or what should happen next? Explain in your own words.", purpose: "Reasoning order and meaning-making." },
  { id: "thinking-explain", category: "thinking", prompt: "Explain something you know well as if you were telling a close friend who genuinely wants to understand it.", purpose: "Natural explanation structure and vocabulary." },
  { id: "emotion-vulnerable", category: "emotion", prompt: "When you write about something painful or deeply personal, do you tend to say it directly, soften it, circle around it, use humor, use imagery, or let the reader infer it? Give an example in your own words.", purpose: "Emotional distance and vulnerability." },
  { id: "emotion-joy", category: "emotion", prompt: "Describe a moment of real happiness the way you would naturally tell it, without trying to sound literary.", purpose: "Positive emotional expression and spontaneous cadence." },
  { id: "speech-natural", category: "speech", prompt: "Write a short message exactly the way you would actually say it to someone you trust when you are excited about an idea.", purpose: "Conversational diction, emphasis, and rhythm." },
  { id: "speech-dislike", category: "speech", prompt: "What kinds of words, phrases, tones, or writing habits make something sound unlike you? What should Forge avoid when writing with you?", purpose: "Negative style constraints." },
  { id: "story-scene", category: "storytelling", prompt: "Tell a short true or invented story about someone wanting something and running into a problem. Tell it the way you naturally would.", purpose: "Narrative ordering, detail choice, and pacing." },
  { id: "story-detail", category: "storytelling", prompt: "When you picture a scene, what do you notice first: people, actions, dialogue, surroundings, sensory details, mood, or something else? Explain what makes a scene feel alive to you.", purpose: "Attention and description priorities." },
  { id: "values-reader", category: "values", prompt: "What do you most want readers to feel, understand, question, remember, or do after reading your work?", purpose: "Authorial intent and reader relationship." },
  { id: "values-truth", category: "values", prompt: "What matters more to you when a passage is difficult: emotional truth, factual precision, beauty, clarity, entertainment, realism, hope, discomfort, or something else? Explain how you balance them.", purpose: "Creative values and tradeoffs." },
  { id: "humor", category: "humor", prompt: "What makes you laugh, and what kind of humor sounds natural coming from you? Give a small example if you can.", purpose: "Humor preference and comedic timing." },
  { id: "conflict", category: "conflict", prompt: "When two people disagree in a story, what makes the conflict feel believable to you? How directly should characters say what they mean?", purpose: "Conflict and subtext preferences." },
  { id: "boundaries-intensity", category: "boundaries", prompt: "Are there emotional tones or levels of intensity you do not want Forge to add unless you specifically ask for them?", purpose: "Emotional and tonal boundaries." },
  { id: "boundaries-authorship", category: "boundaries", prompt: "When AI helps you write, what should it protect above everything else so the finished work still feels like yours?", purpose: "Author-control contract." },
]);

type AuthorTrainingGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;
export type StudioAuthorTrainingRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioAuthorTrainingRoutes(
  store: Pick<FileProjectStore, "load" | "save">,
  generator: AuthorTrainingGenerator = generateProjectText,
): StudioAuthorTrainingRouteHandler {
  return async (req, res, url, projectId) => {
    if (url.pathname === `/api/projects/${projectId}/author-training/questions` && req.method === "GET") {
      await requireProject(store, projectId);
      json(res, 200, { formatVersion: AUTHOR_TRAINING_FORMAT_VERSION, questions: AUTHOR_TRAINING_QUESTIONS });
      return true;
    }

    if (url.pathname === `/api/projects/${projectId}/author-training/assess` && req.method === "POST") {
      const project = await requireProject(store, projectId);
      const input = await body(req);
      const answers = normalizeAnswers(input.answers);
      if (answers.length < 6) throw new Error("Answer at least six Author Training questions before requesting an AI assessment.");
      const now = new Date().toISOString();
      const answersMemory = createMemoryRecord({
        id: `author-training-answers-${randomUUID()}`,
        projectId,
        class: "author-memory",
        authority: "authoritative",
        summary: "Author Training — direct author answers",
        content: formatAnswers(answers),
        provenance: [{ kind: "author", reference: "author-training-questionnaire", recordedAt: now }],
        relevanceTags: ["author-voice", "voice-training", "thinking", "emotion", "speech", "storytelling", "values"],
        now,
      });
      let next = withProjectMemories(project, [...project.memories, answersMemory], now);
      await store.save(next);

      const memory = new ProjectMemoryStore();
      memory.restore(next.memories);
      const result = await generator({
        memory,
        context: {
          projectId,
          taskMemoryClasses: ["author-memory", "style-memory", "decision-memory"],
          relevanceTags: ["author-voice", "voice-training"],
          queryTerms: ["author voice", "thinking", "emotion", "speech", "storytelling", "values"],
          includeWorkingState: true,
          limit: 48,
        },
        system: [
          "You are Author's Forge Author Voice assessor.",
          "Analyze only writing collaboration, communication, storytelling and creative preferences expressed by the author.",
          "Do not diagnose personality, mental health, intelligence, trauma, pathology, or other clinical traits.",
          "Separate direct evidence from cautious inference and never invent unsupported preferences.",
          "The goal is to help future AI drafts preserve this author's natural thinking, feeling and speaking while keeping the author in control.",
        ].join(" "),
        user: [
          "Review the author's questionnaire answers in Project Brain and return a practical Author Voice Training Profile.",
          "Use these headings: Core communication voice; Reasoning and meaning-making; Emotional expression; Conversational speech; Storytelling instincts; Humor; Conflict and subtext; Values and reader relationship; What Forge should avoid; Drafting instructions for Forge; Confidence and unanswered areas.",
          "Mark every interpretive point as DIRECTLY STATED or INFERRED FROM ANSWERS.",
          "Do not imitate any named writer. Preserve this author's own patterns.",
        ].join("\n"),
        task: "voice-preservation",
        requiresReasoning: true,
        requiresInstructionFollowing: true,
        temperature: 0.2,
        maxOutputTokens: 5000,
      });

      const assessmentAt = nextTimestamp(next.metadata.updatedAt);
      const assessmentMemory = createMemoryRecord({
        id: `author-training-assessment-${randomUUID()}`,
        projectId,
        class: "style-memory",
        authority: "proposed",
        summary: "AI-assessed Author Voice Training Profile — requires author approval",
        content: result.text,
        provenance: [{ kind: "system", reference: `${result.provider}/${result.model}`, recordedAt: assessmentAt }],
        relatedMemoryIds: [answersMemory.id],
        relevanceTags: ["author-voice", "voice-training", "ai-assessment", "author-approval-required"],
        now: assessmentAt,
      });
      next = withProjectMemories(next, [...next.memories, assessmentMemory], assessmentAt);
      await store.save(next);
      json(res, 200, {
        formatVersion: AUTHOR_TRAINING_FORMAT_VERSION,
        answersMemoryId: answersMemory.id,
        assessmentMemoryId: assessmentMemory.id,
        assessment: result.text,
        provider: result.provider,
        model: result.model,
        answered: answers.length,
        totalQuestions: AUTHOR_TRAINING_QUESTIONS.length,
        authorApprovalRequired: true,
      });
      return true;
    }

    const approval = url.pathname.match(new RegExp(`^/api/projects/${escapeRegExp(projectId)}/author-training/assessments/([A-Za-z0-9_-]+)/approve$`));
    if (approval && req.method === "POST") {
      const project = await requireProject(store, projectId);
      const candidate = project.memories.find((record) => record.id === approval[1]);
      if (!candidate || candidate.class !== "style-memory" || !candidate.relevanceTags.includes("voice-training")) throw new Error("Author Training assessment not found.");
      if (candidate.authority === "authoritative") {
        json(res, 200, candidate);
        return true;
      }
      const memory = new ProjectMemoryStore();
      memory.restore(project.memories);
      memory.promote(candidate.id, "author", "Author approved the AI-assessed Author Voice Training Profile.");
      const next = withProjectMemories(project, memory.toPortableState());
      await store.save(next);
      json(res, 200, next.memories.find((record) => record.id === candidate.id));
      return true;
    }

    return false;
  };
}

function normalizeAnswers(value: unknown): Array<{ question: AuthorTrainingQuestion; answer: string }> {
  if (!Array.isArray(value)) throw new Error("Author Training answers must be an array.");
  const questions = new Map(AUTHOR_TRAINING_QUESTIONS.map((question) => [question.id, question]));
  const seen = new Set<string>();
  const answers: Array<{ question: AuthorTrainingQuestion; answer: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Each Author Training answer must be an object.");
    const input = entry as Record<string, unknown>;
    const questionId = String(input.questionId ?? "").trim();
    const question = questions.get(questionId);
    if (!question) throw new Error(`Unknown Author Training question "${questionId}".`);
    if (seen.has(questionId)) throw new Error(`Duplicate Author Training answer for "${questionId}".`);
    const answer = String(input.answer ?? "").trim();
    if (!answer) continue;
    if (answer.length > 12_000) throw new Error(`Author Training answer "${questionId}" exceeds 12,000 characters.`);
    seen.add(questionId);
    answers.push({ question, answer });
  }
  return answers;
}

function formatAnswers(answers: readonly { question: AuthorTrainingQuestion; answer: string }[]): string {
  return answers.map(({ question, answer }) => [
    `QUESTION ${question.id} [${question.category}]`,
    question.prompt,
    `PURPOSE: ${question.purpose}`,
    "AUTHOR ANSWER:",
    answer,
  ].join("\n")).join("\n\n---\n\n");
}

async function requireProject(store: Pick<FileProjectStore, "load">, projectId: string): Promise<ProjectState> {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
  return project;
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 2 * 1024 * 1024) throw new Error("Author Training request body exceeds 2 MiB limit.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Author Training JSON object body required.");
  return value as Record<string, unknown>;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
function nextTimestamp(previous: string): string {
  const now = Date.now(), prior = Date.parse(previous);
  return new Date(Number.isFinite(prior) && now <= prior ? prior + 1 : now).toISOString();
}
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
