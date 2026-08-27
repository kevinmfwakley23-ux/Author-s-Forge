export const IMAGE_EDITING_FORMAT_VERSION = 1 as const;
export const IMAGE_EDIT_OPERATIONS = ["preserve-face","change-clothing","change-background","change-age","change-medium","change-lighting","remove-objects","add-objects","alter-pose","crop","restore","upscale","stylize"] as const;
export const IMAGE_OUTPUT_FORMATS = ["png","jpeg","webp"] as const;
export type ImageEditOperation = typeof IMAGE_EDIT_OPERATIONS[number];
export type ImageOutputFormat = typeof IMAGE_OUTPUT_FORMATS[number];

export interface SourceImage {
  readonly id: string;
  readonly uri: string;
  readonly label: string;
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  readonly checksum?: string;
  readonly width?: number;
  readonly height?: number;
  readonly createdAt: string;
}
export interface ImageEditInstruction {
  readonly operation: ImageEditOperation;
  readonly instruction?: string;
}
export interface ImageEditRevision {
  readonly id: string;
  readonly sessionId: string;
  readonly sourceImageId: string;
  readonly instructions: readonly ImageEditInstruction[];
  readonly outputId: string;
  readonly outputUri?: string;
  readonly outputFormat: ImageOutputFormat;
  readonly createdAt: string;
  readonly actor: "author" | "ai" | "system";
  readonly reason: string;
}
export interface EditedImage {
  readonly id: string;
  readonly sourceImageId: string;
  readonly revisionId: string;
  readonly uri?: string;
  readonly format: ImageOutputFormat;
  readonly createdAt: string;
}
export interface ImageEditSession {
  readonly id: string;
  readonly projectId: string;
  readonly source: SourceImage;
  readonly revisions: readonly ImageEditRevision[];
  readonly outputs: readonly EditedImage[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface ImageEditingState {
  readonly formatVersion: typeof IMAGE_EDITING_FORMAT_VERSION;
  readonly projectId: string;
  readonly sessions: readonly ImageEditSession[];
}

export function createSourceImage(input:{id:string;uri:string;label:string;mimeType:SourceImage["mimeType"];checksum?:string;width?:number;height?:number;now?:string}):SourceImage {
  identifier(input.id,"Source image id"); const createdAt=timestamp(input.now??new Date().toISOString(),"Source image timestamp");
  const result:SourceImage={id:input.id,uri:text(input.uri,"Source image uri"),label:text(input.label,"Source image label"),mimeType:input.mimeType,createdAt};
  if(input.checksum!==undefined) (result as {checksum?:string}).checksum=text(input.checksum,"Source image checksum");
  if(input.width!==undefined) positiveInteger(input.width,"Source image width");
  if(input.height!==undefined) positiveInteger(input.height,"Source image height");
  if(input.width!==undefined) (result as {width?:number}).width=input.width;
  if(input.height!==undefined) (result as {height?:number}).height=input.height;
  return result;
}
export function createImageEditSession(input:{id:string;projectId:string;source:SourceImage;now?:string}):ImageEditSession { identifier(input.id,"Image edit session id"); identifier(input.projectId,"Image edit project id"); validateSourceImage(input.source); const now=timestamp(input.now??new Date().toISOString(),"Image edit timestamp"); return {id:input.id,projectId:input.projectId,source:cloneSource(input.source),revisions:[],outputs:[],createdAt:now,updatedAt:now}; }
export function applyImageEdit(session:ImageEditSession,input:{revisionId:string;outputId:string;instructions:readonly ImageEditInstruction[];outputFormat?:ImageOutputFormat;outputUri?:string;actor?:"author"|"ai"|"system";reason:string;now?:string}):{session:ImageEditSession;revision:ImageEditRevision;output:EditedImage} {
  validateSession(session); identifier(input.revisionId,"Image edit revision id"); identifier(input.outputId,"Edited image output id"); if(session.revisions.some(x=>x.id===input.revisionId)) throw new Error(`Duplicate image edit revision id "${input.revisionId}".`); if(session.outputs.some(x=>x.id===input.outputId)) throw new Error(`Duplicate edited image output id "${input.outputId}".`);
  const instructions=normalizeInstructions(input.instructions); const now=timestamp(input.now??new Date().toISOString(),"Image edit revision timestamp"); const format=input.outputFormat??"png"; enumValue(format,IMAGE_OUTPUT_FORMATS,"Image output format"); const reason=text(input.reason,"Image edit reason");
  const revision:ImageEditRevision={id:input.revisionId,sessionId:session.id,sourceImageId:session.source.id,instructions,outputId:input.outputId,...(input.outputUri===undefined?{}:{outputUri:text(input.outputUri,"Image output uri")}),outputFormat:format,createdAt:now,actor:input.actor??"author",reason};
  const output:EditedImage={id:input.outputId,sourceImageId:session.source.id,revisionId:input.revisionId,...(input.outputUri===undefined?{}:{uri:text(input.outputUri,"Image output uri")}),format,createdAt:now};
  return {session:{...session,revisions:[...session.revisions,cloneRevision(revision)],outputs:[...session.outputs,cloneOutput(output)],updatedAt:now},revision:cloneRevision(revision),output:cloneOutput(output)};
}
export function generateImageEditBrief(session:ImageEditSession,instructions:readonly ImageEditInstruction[],outputFormat:ImageOutputFormat="png"):string { validateSession(session); const normalized=normalizeInstructions(instructions); return [`Source image: ${session.source.label}`,`Source URI: ${session.source.uri}`,`Source image id: ${session.source.id}`,`Preserve original: YES`,`Output format: ${outputFormat}`,`Operations: ${normalized.map(x=>x.instruction?`${x.operation}: ${x.instruction}`:x.operation).join(" | ")}`].join("\n"); }
export function createImageEditingState(projectId:string):ImageEditingState { identifier(projectId,"Image editing project id"); return {formatVersion:IMAGE_EDITING_FORMAT_VERSION,projectId,sessions:[]}; }
export function withImageEditSession(state:ImageEditingState,session:ImageEditSession):ImageEditingState { validateImageEditSession(session); if(session.projectId!==state.projectId) throw new Error("Image edit session belongs to another project."); if(state.sessions.some(x=>x.id===session.id)) throw new Error(`Duplicate image edit session id "${session.id}".`); return {...state,sessions:[...state.sessions,cloneSession(session)]}; }
export function replaceImageEditSession(state:ImageEditingState,session:ImageEditSession):ImageEditingState { validateImageEditSession(session); if(session.projectId!==state.projectId) throw new Error("Image edit session belongs to another project."); if(!state.sessions.some(x=>x.id===session.id)) throw new Error(`Image edit session "${session.id}" was not found.`); return {...state,sessions:state.sessions.map(x=>x.id===session.id?cloneSession(session):x)}; }
export function validateSourceImage(value:unknown):SourceImage { if(!value||typeof value!=="object") throw new Error("Invalid source image."); const x=value as Record<string,unknown>; identifier(x.id as string,"Source image id"); const mime=x.mimeType; if(mime!=="image/png"&&mime!=="image/jpeg"&&mime!=="image/webp") throw new Error("Invalid source image mime type."); const source=createSourceImage({id:x.id as string,uri:x.uri as string,label:x.label as string,mimeType:mime,checksum:x.checksum as string|undefined,width:x.width as number|undefined,height:x.height as number|undefined,now:x.createdAt as string}); return cloneSource(source); }
export function validateImageEditSession(value:unknown):ImageEditSession { if(!value||typeof value!=="object") throw new Error("Invalid image edit session."); const x=value as ImageEditSession; validateSourceImage(x.source); identifier(x.id,"Image edit session id"); identifier(x.projectId,"Image edit project id"); const createdAt=timestamp(x.createdAt,"Image edit session createdAt"),updatedAt=timestamp(x.updatedAt,"Image edit session updatedAt"); if(updatedAt<createdAt) throw new Error("Image edit session updatedAt cannot precede createdAt."); if(!Array.isArray(x.revisions)||!Array.isArray(x.outputs)) throw new Error("Invalid image edit session collections."); let session=createImageEditSession({id:x.id,projectId:x.projectId,source:x.source,now:createdAt}); for(const revision of x.revisions){validateRevision(revision); if(revision.sessionId!==session.id||revision.sourceImageId!==session.source.id) throw new Error("Image edit revision references an invalid session or source image."); if(session.revisions.some(r=>r.id===revision.id)) throw new Error(`Duplicate image edit revision id "${revision.id}".`); session={...session,revisions:[...session.revisions,cloneRevision(revision)]};} for(const output of x.outputs){validateOutput(output); if(output.sourceImageId!==session.source.id) throw new Error("Edited image references an invalid source image."); if(session.outputs.some(o=>o.id===output.id)) throw new Error(`Duplicate edited image output id "${output.id}".`); session={...session,outputs:[...session.outputs,cloneOutput(output)]};} return {...session,updatedAt}; }
export function validateImageEditingState(value:unknown):ImageEditingState { if(!value||typeof value!=="object") throw new Error("Invalid image editing state."); const x=value as ImageEditingState; if(x.formatVersion!==IMAGE_EDITING_FORMAT_VERSION||!Array.isArray(x.sessions)) throw new Error("Invalid image editing state."); let state=createImageEditingState(x.projectId); for(const session of x.sessions) state=withImageEditSession(state,validateImageEditSession(session)); return state; }
function normalizeInstructions(value:unknown):readonly ImageEditInstruction[]{if(!Array.isArray(value)||value.length===0)throw new Error("At least one image edit instruction is required.");return value.map(item=>{if(!item||typeof item!=="object")throw new Error("Invalid image edit instruction.");const x=item as Record<string,unknown>;enumValue(x.operation,IMAGE_EDIT_OPERATIONS,"Image edit operation");return{operation:x.operation as ImageEditOperation,...(x.instruction===undefined?{}:{instruction:text(x.instruction as string,"Image edit instruction")})};});}
function validateRevision(value:unknown):void{if(!value||typeof value!=="object")throw new Error("Invalid image edit revision.");const x=value as ImageEditRevision;identifier(x.id,"Image edit revision id");identifier(x.sessionId,"Image edit revision session id");identifier(x.sourceImageId,"Image edit source image id");normalizeInstructions(x.instructions);identifier(x.outputId,"Image edit output id");enumValue(x.outputFormat,IMAGE_OUTPUT_FORMATS,"Image output format");timestamp(x.createdAt,"Image edit revision timestamp");if(x.actor!=="author"&&x.actor!=="ai"&&x.actor!=="system")throw new Error("Invalid image edit actor.");text(x.reason,"Image edit reason");if(x.outputUri!==undefined)text(x.outputUri,"Image output uri");}
function validateOutput(value:unknown):void{if(!value||typeof value!=="object")throw new Error("Invalid edited image output.");const x=value as EditedImage;identifier(x.id,"Edited image output id");identifier(x.sourceImageId,"Edited image source image id");identifier(x.revisionId,"Edited image revision id");enumValue(x.format,IMAGE_OUTPUT_FORMATS,"Edited image format");timestamp(x.createdAt,"Edited image timestamp");if(x.uri!==undefined)text(x.uri,"Edited image uri");}
function validateSession(x:ImageEditSession):void{validateImageEditSession(x);}
function cloneSource(x:SourceImage):SourceImage{return{...x};}function cloneRevision(x:ImageEditRevision):ImageEditRevision{return{...x,instructions:x.instructions.map(i=>({...i}))};}function cloneOutput(x:EditedImage):EditedImage{return{...x};}function cloneSession(x:ImageEditSession):ImageEditSession{return{...x,source:cloneSource(x.source),revisions:x.revisions.map(cloneRevision),outputs:x.outputs.map(cloneOutput)};}
function identifier(v:string,l:string):string{if(typeof v!=="string"||!v.trim()||v!==v.trim())throw new Error(`${l} is required and cannot have surrounding whitespace.`);return v;}function text(v:string,l:string):string{if(typeof v!=="string"||!v.trim())throw new Error(`${l} is required.`);return v.trim();}function timestamp(v:string,l:string):string{if(typeof v!=="string"||Number.isNaN(Date.parse(v)))throw new Error(`${l} must be a valid timestamp.`);return new Date(v).toISOString();}function positiveInteger(v:number,l:string):number{if(!Number.isInteger(v)||v<=0)throw new Error(`${l} must be a positive integer.`);return v;}function enumValue(v:unknown,values:readonly string[],l:string):void{if(typeof v!=="string"||!values.includes(v))throw new Error(`${l} is invalid.`);}
