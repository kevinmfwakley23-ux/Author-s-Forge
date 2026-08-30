const test = require('node:test');
const assert = require('node:assert/strict');
const { createForgeCore, FORGE_CORE_FORMAT_VERSION } = require('../.forge-build/application/forge-core.js');

function projectStore() {
 const projects = new Map();
 return {
  async create(project) { projects.set(project.metadata.id, project); },
  async load(id) { return projects.get(id) ?? null; },
  async save(project) { projects.set(project.metadata.id, project); },
  async exists(id) { return projects.has(id); },
 };
}

test('core readiness requires configured AI resources and durable project storage', () => {
 const core=createForgeCore();
 assert.equal(core.readiness().ready,false);
 core.registerAiModels([{provider:'p',model:'m',configured:true,healthy:true,capabilities:{contextWindow:128000}}]);
 assert.equal(core.readiness().aiConfigured,true);
 assert.equal(core.readiness().ready,false);
 const durable=createForgeCore({ projectStore: projectStore() });
 durable.registerAiModels([{provider:'p',model:'m',configured:true,healthy:true,capabilities:{contextWindow:128000}}]);
 assert.equal(durable.readiness().ready,true);
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
