import test from 'node:test';
import assert from 'node:assert/strict';
import { AiModelBroker } from '../dist/application/ai-model-broker.js';
import { AiExecutionFallback } from '../dist/application/ai-execution-fallback.js';

test('execution falls through and records provider health state', async () => {
 const broker=new AiModelBroker(); broker.setResources([{provider:'first',model:'a',configured:true,healthy:true,capabilities:{contextWindow:128000}},{provider:'second',model:'b',configured:true,healthy:true,capabilities:{contextWindow:128000}}]);
 const runner=new AiExecutionFallback(broker); let calls=0;
 const result=await runner.execute({task:'writing',input:'hello',maxAttempts:2},async(_input,context)=>{calls+=1;if(calls===1)throw new Error('temporary provider failure');return context.resource.provider;});
 assert.equal(result.value,'second'); assert.equal(result.attempts,2); assert.equal(result.failures.length,1); assert.equal(runner.getRoutingState().get('first','a').totalFailures,1); assert.equal(runner.getRoutingState().get('second','b').totalSuccesses,1);
});

test('non-retryable failures stop immediately', async()=>{const broker=new AiModelBroker();broker.setResources([{provider:'only',model:'a',configured:true,healthy:true,capabilities:{contextWindow:128000}}]);const runner=new AiExecutionFallback(broker);await assert.rejects(()=>runner.execute({task:'editing',input:'x'},async()=>{throw new Error('invalid request');}),/AI execution failed/);assert.equal(runner.getRoutingState().get('only','a').totalFailures,1);});
