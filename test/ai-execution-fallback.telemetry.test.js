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
 assert.equal(result.failures[0].failoverEligible,true);
 assert.ok(result.failures[0].latencyMs>=0);
 assert.equal(runner.getRoutingState().get('first','a').totalFailures,1);
 assert.equal(runner.getRoutingState().get('second','b').totalSuccesses,1);
 assert.equal(runner.getRoutingState().get('second','b').totalTokens,30);
 assert.equal(broker.listResources().find(r=>r.provider==='first')?.consecutiveFailures,1);
});

test('fallback quarantines a provider-specific credential failure and continues to another configured resource', async () => {
 const broker=new AiModelBroker();
 broker.setResources([
  {provider:'first',model:'a',configured:true,healthy:true,capabilities:{contextWindow:128000}},
  {provider:'second',model:'b',configured:true,healthy:true,capabilities:{contextWindow:128000}}
 ]);
 const runner=new AiExecutionFallback(broker);
 const attempted=[];
 const result=await runner.execute({task:'writing',input:'hello',maxAttempts:2,estimatedInputTokens:5,estimatedOutputTokens:7},async(_input,ctx)=>{
  attempted.push(`${ctx.resource.provider}/${ctx.resource.model}`);
  if(ctx.resource.provider==='first') throw new Error('Provider request failed (401): invalid API key');
  return ctx.resource.provider;
 });
 assert.equal(result.value,'second');
 assert.deepEqual(attempted,['first/a','second/b']);
 assert.equal(result.failures.length,1);
 assert.equal(result.failures[0].retryable,false);
 assert.equal(result.failures[0].failoverEligible,true);
 const firstState=runner.getRoutingState().get('first','a');
 assert.equal(firstState.totalFailures,1);
 assert.ok(firstState.cooldownUntil);
 assert.ok(Date.parse(firstState.cooldownUntil)>Date.now());
 assert.equal(runner.getRoutingState().get('second','b').totalSuccesses,1);
});

test('fallback stops when a failure is request-fatal rather than provider-specific', async () => {
 const broker=new AiModelBroker();
 broker.setResources([
  {provider:'first',model:'a',configured:true,healthy:true,capabilities:{contextWindow:128000}},
  {provider:'second',model:'b',configured:true,healthy:true,capabilities:{contextWindow:128000}}
 ]);
 const runner=new AiExecutionFallback(broker);
 let calls=0;
 await assert.rejects(
  ()=>runner.execute({task:'writing',input:'hello',maxAttempts:2},async()=>{calls+=1;throw new Error('Request violates an author-defined governance rule.');}),
  /failed after 1 attempt/
 );
 assert.equal(calls,1);
 assert.equal(runner.getRoutingState().get('first','a').totalFailures,1);
 assert.equal(runner.getRoutingState().get('second','b').totalFailures,0);
});
