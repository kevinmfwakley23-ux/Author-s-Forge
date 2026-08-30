import test from 'node:test';
import assert from 'node:assert/strict';
import { AiModelBroker } from '../dist/application/ai-model-broker.js';
import { AiExecutionFallback } from '../dist/application/ai-execution-fallback.js';

test('fallback updates broker state after retryable failure and success', async () => {
 const broker=new AiModelBroker();
 broker.setResources([
  {provider:'first',model:'a',configured:true,healthy:true,capabilities:{contextWindow:128000}},
  {provider:'second',model:'b',configured:true,healthy:true,capabilities:{contextWindow:128000}}
 ]);
 const runner=new AiExecutionFallback(broker); let calls=0;
 const result=await runner.execute({task:'writing',input:'hello',maxAttempts:2,estimatedInputTokens:10,estimatedOutputTokens:20},async(_input,ctx)=>{
  calls+=1;
  if(calls===1) throw new Error('temporary provider failure');
  return ctx.resource.provider;
 });
 assert.equal(result.value,'second');
 assert.equal(result.attempts,2);
 assert.equal(result.failures[0].attempt,1);
 assert.equal(result.failures[0].retryable,true);
 assert.ok(result.failures[0].latencyMs>=0);
 assert.equal(runner.getRoutingState().get('first','a').totalFailures,1);
 assert.equal(runner.getRoutingState().get('second','b').totalSuccesses,1);
 assert.equal(runner.getRoutingState().get('second','b').totalTokens,30);
 assert.equal(broker.listResources().find(r=>r.provider==='first')?.consecutiveFailures,1);
});
