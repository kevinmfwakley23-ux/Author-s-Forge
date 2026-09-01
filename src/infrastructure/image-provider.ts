import { buildProjectContext } from "../application/context-pipeline";
import type { ProjectBrainQuery } from "../application/project-brain";
import type { ProjectMemoryStore } from "../application/project-memory-store";

export type ImageGenerationSize="1024x1024"|"1536x1024"|"1024x1536"|"2048x2048"|"2048x1152"|"auto";
export type ImageGenerationQuality="low"|"medium"|"high"|"auto";
export interface ImageGenerationRequest { readonly prompt:string; readonly size?:ImageGenerationSize; readonly quality?:ImageGenerationQuality; readonly background?:"opaque"|"transparent"|"auto"; }
export interface ImageGenerationResult { readonly provider:"openai"; readonly model:string; readonly mimeType:"image/png"; readonly bytesBase64:string; readonly dataUri:string; readonly requestId?:string; readonly size:ImageGenerationSize; readonly quality:ImageGenerationQuality; }
export interface ProjectImageGenerationRequest extends ImageGenerationRequest { readonly memory:ProjectMemoryStore; readonly context:ProjectBrainQuery; readonly contextBudget?:number; }

export async function generateImage(request:ImageGenerationRequest):Promise<ImageGenerationResult>{
  const key=process.env.OPENAI_API_KEY?.trim();if(!key)throw new Error("No real image provider is configured. Configure OPENAI_API_KEY; Forge never fabricates generated images.");
  const model=process.env.OPENAI_IMAGE_MODEL?.trim()||"gpt-image-2";const size=request.size??"1024x1024",quality=request.quality??"medium",background=request.background??"opaque";
  const response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify({model,prompt:required(request.prompt,"Image prompt"),size,quality,background,output_format:"png",n:1})});
  const payload=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok){const error=payload.error&&typeof payload.error==="object"?String((payload.error as Record<string,unknown>).message??""):"";throw new Error(error||`OpenAI image generation failed (${response.status}).`);}
  const data=Array.isArray(payload.data)?payload.data:[],first=data[0] as Record<string,unknown>|undefined,bytes=typeof first?.b64_json==="string"?first.b64_json.trim():"";if(!bytes)throw new Error("OpenAI image generation returned no image bytes.");
  return Object.freeze({provider:"openai",model,mimeType:"image/png",bytesBase64:bytes,dataUri:`data:image/png;base64,${bytes}`,requestId:response.headers.get("x-request-id")??undefined,size,quality});
}

export async function generateProjectImage(request:ProjectImageGenerationRequest):Promise<ImageGenerationResult>{
  const context=buildProjectContext(request.memory,{query:request.context,budget:request.contextBudget});
  const prompt=["AUTHOR'S FORGE PROJECT CONTEXT",context.system,"IMAGE REQUEST",request.prompt,"Do not render production-critical card text, labels, logos, collector numbers, rules text, or UI into the image. Those remain editable composition elements in Forge."].filter(Boolean).join("\n\n");
  return generateImage({prompt,size:request.size,quality:request.quality,background:request.background});
}
function required(value:string,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);return value.trim();}
