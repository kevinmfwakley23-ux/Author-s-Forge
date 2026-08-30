import { createHash } from "node:crypto";
import { createCharacterStateProposal, reviewCharacterStateProposal, type CharacterStateChangeProposal } from "../domain/character-state-proposal";
import { CHARACTER_FIELDS, type CharacterRecord } from "../domain/character-bible";

export type CharacterStateProposalGenerator = (request: { system: string; user: string }) => Promise<string>;

export interface CharacterStateProposalRequest { readonly projectId: string; readonly character: CharacterRecord; readonly sceneId: string; readonly sceneContent: string; readonly instruction?: string; readonly now?: string; }

/** Extracts proposed character changes from manuscript evidence. Extraction never mutates canon. */
export class CharacterStateProposalService {
  constructor(private readonly generator: CharacterStateProposalGenerator) {}

  async propose(request: CharacterStateProposalRequest): Promise<CharacterStateChangeProposal> {
    if (request.character.projectId !== request.projectId) throw new Error("Character does not belong to the requested project.");
    if (!request.sceneId.trim() || !request.sceneContent.trim()) throw new Error("Character state extraction requires a scene and manuscript content.");
    const raw = await this.generator({
      system: "You are Author's Forge's character-memory extraction engine. Return JSON only. Extract only changes explicitly supported by the supplied manuscript. Never invent facts. Never change canon silently. Allowed fields: " + CHARACTER_FIELDS.join(", ") + ". Return {confidence:number,rationale:string,changes:object,evidence:[{quote:string,start?:number,end?:number,rationale:string}]}.",
      user: [`CHARACTER CURRENT STATE:\n${JSON.stringify(request.character.profile)}`, `SCENE:\n${request.sceneContent}`, request.instruction ? `AUTHOR INSTRUCTION:\n${request.instruction}` : "", "Return only evidence-grounded changes that should be reviewed by the author."].filter(Boolean).join("\n\n"),
    });
    const parsed = parseJson(raw);
    const changes = parsed.changes && typeof parsed.changes === "object" && !Array.isArray(parsed.changes) ? parsed.changes as Record<string, unknown> : {};
    const changedFields = Object.keys(changes).filter((field): field is typeof CHARACTER_FIELDS[number] => (CHARACTER_FIELDS as readonly string[]).includes(field));
    if (!changedFields.length) throw new Error("Character extraction returned no supported changes.");
    const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && typeof (item as Record<string, unknown>).quote === "string").map((item) => ({ quote: String(item.quote), ...(typeof item.start === "number" ? { start: item.start } : {}), ...(typeof item.end === "number" ? { end: item.end } : {}), rationale: String(item.rationale ?? "Manuscript evidence") })) : [];
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    return createCharacterStateProposal({ id: `character-state-${request.character.id}-${request.sceneId}-${sha256(request.sceneContent).slice(0, 12)}`, projectId: request.projectId, characterId: request.character.id, sceneId: request.sceneId, confidence, changes, changedFields, evidence, rationale: String(parsed.rationale ?? "Evidence-grounded character state change proposal."), sourceContentSha256: sha256(request.sceneContent), createdAt: request.now ?? new Date().toISOString() });
  }

  review(proposal: CharacterStateChangeProposal, decision: "accepted" | "rejected", now?: string, note?: string): CharacterStateChangeProposal { return reviewCharacterStateProposal(proposal, decision, { reviewedAt: now, note }); }
}
function parseJson(value: string): Record<string, unknown> { const fenced=value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? value; const start=fenced.indexOf("{"); const end=fenced.lastIndexOf("}"); if(start<0||end<=start) throw new Error("Character extraction provider did not return a JSON object."); const parsed=JSON.parse(fenced.slice(start,end+1)); if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)) throw new Error("Character extraction result was not an object."); return parsed as Record<string, unknown>; }
export function sha256(value:string):string{return createHash("sha256").update(value,"utf8").digest("hex");}
