import { AiModelBroker, AiModelResource, AiModelSelectionRequest } from './ai-model-broker';
import { rankCostConsciousCandidates, type AiCostRoutingMode } from './ai-cost-routing-policy';
import { AiRoutingState } from './ai-routing-state';

export interface AiExecutionRequest extends AiModelSelectionRequest { readonly input: unknown; readonly maxAttempts?: number; readonly estimatedOutputTokens?: number; readonly routingMode?: AiCostRoutingMode; }
export interface AiExecutionContext { readonly resource: AiModelResource; readonly attempt: number; readonly remainingAttempts: number; }
export interface AiExecutionFailure { readonly provider:string; readonly model:string; readonly error:string; readonly retryable:boolean; readonly attempt:number; readonly latencyMs:number; }
export interface AiExecutionResult<T> { readonly value:T; readonly resource:AiModelResource; readonly attempts:number; readonly failures:readonly AiExecutionFailure[]; readonly latencyMs:number; }
export type AiExecutor<T>=(input:unknown,context:AiExecutionContext)=>Promise<T>;

/** Executes ordered broker candidates and feeds observed runtime facts back into the shared routing state. */
export class AiExecutionFallback {
 constructor(private readonly broker:AiModelBroker, private readonly state = new AiRoutingState()) {}
 async execute<T>(request:AiExecutionRequest,executor:AiExecutor<T>):Promise<AiExecutionResult<T>>{
  const failures:AiExecutionFailure[]=[];
  const configured=this.broker.listResources().length;
  const maxAttempts=Math.max(1,Math.min(request.maxAttempts??8,configured||1));
  const startedAll=Date.now();
  for(let attempt=1;attempt<=maxAttempts;attempt+=1){
   const ranked=rankCostConsciousCandidates(this.broker.rank(request),request);
   const selection=ranked.map(candidate=>candidate.selection).find(candidate=>!failures.some(f=>f.provider===candidate.resource.provider&&f.model===candidate.resource.model));
   if(!selection)break;
   const started=Date.now();
   try{
    const value=await executor(request.input,{resource:selection.resource,attempt,remainingAttempts:maxAttempts-attempt});
    const latencyMs=Date.now()-started;
    const tokens=Math.max(0,request.estimatedInputTokens??0)+Math.max(0,request.estimatedOutputTokens??0);
    this.state.recordSuccess(selection.resource.provider,selection.resource.model,latencyMs,tokens);
    this.syncBrokerState();
    return{value,resource:selection.resource,attempts:attempt,failures,latencyMs:Date.now()-startedAll};
   }catch(error){
    const latencyMs=Date.now()-started; const message=this.message(error); const retryable=this.isRetryable(error);
    failures.push({provider:selection.resource.provider,model:selection.resource.model,error:message,retryable,attempt,latencyMs});
    this.state.recordFailure(selection.resource.provider,selection.resource.model,error,new Date().toISOString(),retryable?this.cooldownFor(failures.length):0);
    this.syncBrokerState();
    if(!retryable)break;
   }
  }
  this.syncBrokerState();
  if(!failures.length)throw new Error(`AI execution failed: no eligible AI resources for ${request.task}.`);
  throw new Error(`AI execution failed after ${failures.length} attempt(s): ${failures.map(f=>`${f.provider}/${f.model}: ${f.error}`).join('; ')}`);
 }
 getRoutingState():AiRoutingState{return this.state;}
 private syncBrokerState():void{
  this.broker.applyRoutingTelemetry(this.state.snapshot().map(s=>({provider:s.provider,model:s.model,consecutiveFailures:s.consecutiveFailures,totalTokens:s.totalTokens,lastLatencyMs:s.lastLatencyMs,cooldownUntil:s.cooldownUntil})));
 }
 private cooldownFor(attempt:number):number{return Math.min(120000,Math.max(5000,attempt*5000));}
 private message(error:unknown):string{return error instanceof Error?error.message:String(error);}
 private isRetryable(error:unknown):boolean{return /timeout|timed out|temporar|rate.?limit|429|503|502|504|overloaded|unavailable|network|connection|econn|reset|quota/i.test(this.message(error).toLowerCase());}
}
