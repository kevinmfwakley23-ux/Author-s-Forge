import { randomUUID } from "node:crypto";
import type { FileSpecializedCreationStore } from "../infrastructure/file-specialized-creation-store";
import type { SpecializedArtifactKind, SpecializedOfficeProject, SpecializedRevision } from "../domain/specialized-creation-office";
import { SpecializedCreationProductionEngine, type SpecializedPreflightReport, type SpecializedRenderedArtifact } from "./specialized-creation-production-engine";
import { renderEmbeddedPdf, renderEmbeddedSvg } from "./specialized-creation-embedded-renderer";
import { renderSpecializedJpegFromPng } from "./specialized-creation-jpeg";
import { mergeSpecializedPreflight, prepareSpecializedProjectForArtifact, specializedProductionSafetyIssues } from "./specialized-creation-production-safety";

export class SpecializedCreationScopedArtifactService {
  constructor(private readonly store:FileSpecializedCreationStore,private readonly production=new SpecializedCreationProductionEngine()) {}

  async render(input:{forgeProjectId:string;specializedProjectId:string;documentIds:readonly string[];profileId:string;kind:SpecializedArtifactKind;now?:string}):Promise<{project:SpecializedOfficeProject;artifact:SpecializedRenderedArtifact;preflight:SpecializedPreflightReport}> {
    const project=await this.store.get(input.forgeProjectId,input.specializedProjectId);if(!project)throw new Error("Specialized project not found.");
    const ids=[...new Set(input.documentIds)];if(!ids.length)throw new Error("Scoped production requires at least one document id.");
    const documents=ids.map(id=>{const document=project.documents.find(item=>item.id===id);if(!document)throw new Error(`Specialized document \"${id}\" not found.`);return document;});
    const profile=project.productionProfiles.find(item=>item.id===input.profileId);if(!profile)throw new Error(`Production profile \"${input.profileId}\" not found.`);
    const scoped:SpecializedOfficeProject={...project,documents};
    const now=input.now??new Date().toISOString(),preflight=mergeSpecializedPreflight(this.production.preflight(scoped,profile,now,project),specializedProductionSafetyIssues(scoped,input.kind,profile));if(!preflight.ready)throw new Error(`Production blocked by ${preflight.blocking} preflight error(s): ${preflight.issues.filter(issue=>issue.severity==="error").map(issue=>issue.code).join(", ")}`);
    const prepared=prepareSpecializedProjectForArtifact(scoped,input.kind,profile);
    const artifact=input.kind==="pdf"?renderEmbeddedPdf(prepared):input.kind==="svg"?renderEmbeddedSvg(prepared):input.kind==="jpeg"?renderSpecializedJpegFromPng(this.production.render(prepared,profile,"png",project)):this.production.render(prepared,profile,input.kind,project);
    const revisions:SpecializedRevision[]=[];for(const documentId of ids){const revision=project.revisions.filter(item=>item.documentId===documentId).at(-1);if(!revision)throw new Error(`Production document \"${documentId}\" has no durable revision.`);revisions.push(revision);}
    const revisionId=revisions.map(revision=>revision.id).join("+");
    const record={id:`artifact-${randomUUID()}`,projectId:project.id,revisionId,profileId:profile.id,kind:input.kind,fileName:artifact.fileName,mimeType:artifact.mimeType,byteLength:artifact.byteLength,sha256:artifact.sha256,createdAt:now};
    const saved=await this.store.save({...project,artifacts:[...project.artifacts,record],stage:"production",updatedAt:now});
    return {project:saved,artifact,preflight};
  }
}