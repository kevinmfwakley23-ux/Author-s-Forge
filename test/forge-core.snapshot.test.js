import test from 'node:test';
import assert from 'node:assert/strict';
import { createForgeCore, FORGE_CORE_FORMAT_VERSION } from '../dist/application/forge-core.js';

test('core readiness requires configured AI resources', () => {
 const core=createForgeCore();
 assert.equal(core.readiness().ready,false);
 core.registerAiModels([{provider:'p',model:'m',configured:true,healthy:true,capabilities:{contextWindow:128000}}]);
 assert.equal(core.readiness().ready,true);
});

test('core snapshot restores memory and routing state together', () => {
 const core=createForgeCore();
 core.registerAiModels([{provider:'p',model:'m',configured:true,healthy:true,capabilities:{contextWindow:128000},usedTokens:40}]);
 core.routing.recordUsage('p','m',60);
 const snapshot=core.snapshot('project-1');
 assert.equal(snapshot.formatVersion,FORGE_CORE_FORMAT_VERSION);
 const restored=createForgeCore();
 restored.registerAiModels([{provider:'p',model:'m',configured:true,healthy:true,capabilities:{contextWindow:128000}}]);
 restored.restore(snapshot);
 assert.equal(restored.routing.get('p','m').totalTokens,100);
});
