import { AiModelBroker, AiModelResource, AiModelSelectionRequest } from './ai-model-broker';
import { AiRoutingState } from './ai-routing-state';

export interface AiExecutionRequest extends AiModelSelectionRequest { readonly input: unknown; readonly maxAttempts?: number; }
export interface AiExecutionContext { readonly resource: AiModelResource; readonly attempt: number; }
export interface AiExecutionFailure { readonly provider:string; readonly model:string; readonly error:string; readonly retryable:boolean; }
export interface AiExecutionResult<T> { readonly value:T; readonly resource:AiModelResource; readonly attempts:number; readonly failures:readonly AiExecutionFailure[]; }
export type AiExecutor<T>=(input:unknown,context:AiExecutionContext)=>Promise<T>;

export class AiExecutionFallback {
 constructor(private readonly broker:AiModelBroker, private readonly state = new AiRoutingState()) {}
 async execute<T>(request:AiExecutionRequest,executor:AiExecutor<T>):Promise<AiExecutionResult<T>>{
  const failures:AiExecutionFailure[]=[]; const maxAttempts=Math.max(1,Math.min(request.maxAttempts??8,this.broker.listResources().length||1));
  for(let attempt=1;attempt<=maxAttempts;attempt+=1){
   const selection=this.broker.rank(request).find(candidate=>!failures.some(f=>f.provider===candidate.resource.provider&&f.model===candidate.resource.model));
   if(!selection)break;
   const started=Date.now();
   try{const value=await executor(request.input,{resource:selection.resource,attempt}); this.state.recordSuccess(selection.resource.provider,selection.resource.model,Date.now()-started,0); return{value,resource:selection.resource,attempts:attempt,failures};}
   catch(error){const message=this.message(error);const retryable=this.isRetryable(error);failures.push({provider:selection.resource.provider,model:selection.resource.model,error:message,retryable});this.state.recordFailure(selection.resource.provider,selection.resource.model,error,new Date().toISOString(),retryable?this.cooldownFor(failures.length):0);if(!retryable)break;}
  }
  if(!failures.length)throw new Error(`AI execution failed: no eligible AI resources for ${request.task}.`);
  throw new Error(`AI execution failed after ${failures.length} attempt(s): ${failures.map(f=>`${f.provider}/${f.model}: ${f.error}`).join('; ')}`);
 }
 getRoutingState():AiRoutingState{return this.state;}
 private cooldownFor(attempt:number):number{return Math.min(120000,Math.max(5000,attempt*5000));}
 private message(error:unknown):string{return error instanceof Error?error.message:String(error);}
 private isRetryable(error:unknown):boolean{return /timeout|timed out|temporar|rate.?limit|429|503|502|504|overloaded|unavailable|network|connection|econn|reset|quota/i.test(this.message(error).toLowerCase());}
}
