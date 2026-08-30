import { assessVoiceDrift, buildAuthorVoiceContext, createAuthorVoiceMemory, updateAuthorVoiceMemory, type AuthorVoiceMemory, type VoiceDriftReport } from "../domain/author-voice-memory";

export class AuthorVoiceMemoryService {
  constructor(private readonly projectId: string, private readonly authorId: string) {}

  create(input: { samples: readonly { id: string; label: string; text: string; approved?: boolean; weight?: number }[]; canonicalSampleIds?: readonly string[] }): AuthorVoiceMemory {
    return createAuthorVoiceMemory({ ...input, projectId: this.projectId, authorId: this.authorId });
  }

  update(memory: AuthorVoiceMemory, input: { addSamples?: readonly { id: string; label: string; text: string; approved?: boolean; weight?: number }[]; removeSampleIds?: readonly string[]; canonicalSampleIds?: readonly string[] }): AuthorVoiceMemory {
    if (memory.projectId !== this.projectId || memory.authorId !== this.authorId) throw new Error("Author voice memory belongs to another project or author.");
    return updateAuthorVoiceMemory(memory, input);
  }

  assess(text: string, memory: AuthorVoiceMemory): VoiceDriftReport {
    if (memory.projectId !== this.projectId || memory.authorId !== this.authorId) throw new Error("Author voice memory belongs to another project or author.");
    return assessVoiceDrift(text, memory);
  }

  context(memory: AuthorVoiceMemory): string {
    if (memory.projectId !== this.projectId || memory.authorId !== this.authorId) throw new Error("Author voice memory belongs to another project or author.");
    return buildAuthorVoiceContext(memory);
  }
}
