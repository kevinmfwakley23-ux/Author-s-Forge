import { AiModelBroker, AiModelResource, AiModelSelectionRequest } from './ai-model-broker';

export interface AiExecutionRequest extends AiModelSelectionRequest { readonly input: unknown; readonly maxAttempts?: number; }
export interface AiExecutionContext { readonly resource: AiModelResource; readonly attempt: number; }
export interface AiExecutionFailure { readonly provider:string; readonly model:string; readonly error:string; readonly retryable:boolean; }
export interface AiExecutionResult<T> { readonly value:T; readonly resource:AiModelResource; readonly attempts:number; readonly failures:readonly AiExecutionFailure[]; }
export type AiExecutor<T>=(input:unknown,context:AiExecutionContext)=>Promise<T>;

export class AiExecutionFallback {
 constructor(private readonly broker:AiModelBroker) {}
 async execute<T>(request:AiExecutionRequest,executor:AiExecutor<T>):Promise<AiExecutionResult<T>>{
  const failures:AiExecutionFailure[]=[]; const resources=this.broker.listResources();
  const maxAttempts=Math.max(1,Math.min(request.maxAttempts??8,resources.length||1)); const candidates=this.broker.rank(request).slice(0,maxAttempts);
  for(let index=0;index<candidates.length;index+=1){
   const selection=candidates[index];
   try{return{value:await executor(request.input,{resource:selection.resource,attempt:index+1}),resource:selection.resource,attempts:index+1,failures};}
   catch(error){const message=this.message(error); const retryable=this.isRetryable(error); failures.push({provider:selection.resource.provider,model:selection.resource.model,error:message,retryable}); if(!retryable)break;}
  }
  if(!candidates.length)throw new Error(`AI execution failed: no eligible AI resources for ${request.task}.`);
  throw new Error(`AI execution failed after ${failures.length} attempt(s): ${failures.map(f=>`${f.provider}/${f.model}: ${f.error}`).join('; ')}`);
 }
 private message(error:unknown):string{return error instanceof Error?error.message:String(error);}
 private isRetryable(error:unknown):boolean{return /timeout|timed out|temporar|rate.?limit|429|503|502|504|overloaded|unavailable|network|connection|econn|reset|quota/i.test(this.message(error).toLowerCase());}
}
