import type { EditedImage, ImageEditInstruction, ImageEditRevision, ImageEditSession, ImageEditingState, ImageOutputFormat, SourceImage } from "../domain/image-editing";
import { applyImageEdit, createImageEditSession, createImageEditingState, createSourceImage, generateImageEditBrief, replaceImageEditSession, validateImageEditingState, validateImageEditSession, withImageEditSession } from "../domain/image-editing";
export interface ImageEditQuery { readonly projectId:string; readonly sourceImageId?:string; }
export class ImageEditingService {
 private readonly states=new Map<string,ImageEditingState>();
 public createSource(input:Parameters<typeof createSourceImage>[0]):SourceImage{return createSourceImage(input);}
 public createSession(input:{id:string;projectId:string;source:SourceImage;now?:string}):ImageEditSession{const session=createImageEditSession(input);let state=this.states.get(session.projectId)??createImageEditingState(session.projectId);this.states.set(session.projectId,withImageEditSession(state,session));return session;}
 public getSession(projectId:string,id:string):ImageEditSession|undefined{return this.states.get(projectId)?.sessions.find(x=>x.id===id);}
 public requireSession(projectId:string,id:string):ImageEditSession{const value=this.getSession(projectId,id);if(!value)throw new Error(`Image edit session "${id}" was not found.`);return value;}
 public list(query:ImageEditQuery):readonly ImageEditSession[]{return(this.states.get(query.projectId)?.sessions??[]).filter(x=>!query.sourceImageId||x.source.id===query.sourceImageId);}
 public edit(projectId:string,sessionId:string,input:{revisionId:string;outputId:string;instructions:readonly ImageEditInstruction[];outputFormat?:ImageOutputFormat;outputUri?:string;actor?:"author"|"ai"|"system";reason:string;now?:string}):{session:ImageEditSession;revision:ImageEditRevision;output:EditedImage}{const current=this.requireSession(projectId,sessionId);const result=applyImageEdit(current,input);const state=this.states.get(projectId)??createImageEditingState(projectId);this.states.set(projectId,replaceImageEditSession(state,result.session));return result;}
 public brief(projectId:string,sessionId:string,instructions:readonly ImageEditInstruction[],format:ImageOutputFormat="png"):string{return generateImageEditBrief(this.requireSession(projectId,sessionId),instructions,format);}
 public toPortableState(projectId:string):ImageEditingState{return JSON.parse(JSON.stringify(this.states.get(projectId)??createImageEditingState(projectId))) as ImageEditingState;}
 public restoreProject(projectId:string,state:ImageEditingState):void{if(state.projectId!==projectId)throw new Error("Image editing state belongs to another project.");const validated=validateImageEditingState(state);this.states.set(projectId,validated);}
}
