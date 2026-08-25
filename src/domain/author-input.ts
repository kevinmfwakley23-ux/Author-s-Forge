export type AuthorInputMode = "typed" | "dictated" | "imported" | "pasted";

export type AuthorInputIntent =
  | "content"
  | "new-chapter"
  | "scene-break"
  | "save-note"
  | "rewrite"
  | "expand"
  | "unknown-command";

export interface TranscriptProvenance {
  readonly provider?: string;
  readonly language?: string;
  readonly capturedAt?: string;
  readonly confidence?: number;
}

export interface AuthorInput {
  readonly id: string;
  readonly mode: AuthorInputMode;
  readonly text: string;
  readonly originalText: string;
  readonly createdAt: string;
  readonly provenance?: TranscriptProvenance;
}

export interface ClassifiedAuthorInput {
  readonly input: AuthorInput;
  readonly intent: AuthorInputIntent;
  readonly commandText?: string;
}

export function createAuthorInput(input: {
  id: string;
  mode: AuthorInputMode;
  text: string;
  createdAt?: string;
  provenance?: TranscriptProvenance;
}): AuthorInput {
  if (!input.id.trim()) throw new Error("Author input id is required.");
  if (!input.text.trim()) throw new Error("Author input text is required.");

  const text = input.text.trim();
  return {
    id: input.id,
    mode: input.mode,
    text,
    originalText: text,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.provenance ? { provenance: { ...input.provenance } } : {})
  };
}
