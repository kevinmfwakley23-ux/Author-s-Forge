import { AiModelBroker, AiModelResource, AiModelSelectionRequest } from './ai-model-broker';

export interface AiExecutionRequest extends AiModelSelectionRequest { readonly input: unknown; readonly maxAttempts?: number; }
export interface AiExecutionContext { readonly resource: AiModelResource; readonly attempt: number; }
export interface AiExecutionResult<T> { readonly value: T; readonly resource: AiModelResource; readonly attempts: number; readonly failures: readonly { provider: string; model: string; error: string }[]; }
export type AiExecutor<T> = (input: unknown, context: AiExecutionContext) => Promise<T>;

export class AiExecutionFallback {
 constructor(private readonly broker: AiModelBroker) {}
 async execute<T>(request:AiExecutionRequest,executor:AiExecutor<T>):Promise<AiExecutionResult<T>>{
  const failures:{provider:string;model:string;error:string}[]=[];
  const resources=this.broker.listResources();
  const maxAttempts=Math.max(1,Math.min(request.maxAttempts??8,resources.length||1));
  const candidates=this.broker.rank(request).slice(0,maxAttempts);
  for(let index=0;index<candidates.length;index+=1){
   const selection=candidates[index];
   try{return{value:await executor(request.input,{resource:selection.resource,attempt:index+1}),resource:selection.resource,attempts:index+1,failures};}
   catch(error){failures.push({provider:selection.resource.provider,model:selection.resource.model,error:this.message(error)});}
  }
  if(!candidates.length) throw new Error(`AI execution failed: no eligible AI resources for ${request.task}.`);
  const detail=failures.map(f=>`${f.provider}/${f.model}: ${f.error}`).join('; ');
  throw new Error(`AI execution failed after ${failures.length} attempt(s): ${detail}`);
 }
 private message(error:unknown):string{return error instanceof Error?error.message:String(error);}
}
