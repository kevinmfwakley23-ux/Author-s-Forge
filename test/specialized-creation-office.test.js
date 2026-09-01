const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { FileSpecializedCreationStore } = require('../dist/infrastructure/file-specialized-creation-store.js');
const { ProjectMemoryStore } = require('../dist/application/project-memory-store.js');
const { SpecializedCreationOfficeService } = require('../dist/application/specialized-creation-office-service.js');
const { composeSpecializedProject, tcgSetStatistics, addTcgPlaytestSnapshot, resolveTcgTemplateTokens, reflowDocument } = require('../dist/application/specialized-creation-mode-composer.js');

async function fixture(fakeAi) {
  const dir = await mkdtemp(join(tmpdir(), 'forge-specialized-'));
  const store = new FileSpecializedCreationStore(join(dir, 'specialized.json'));
  const memory = new ProjectMemoryStore();
  const office = new SpecializedCreationOfficeService(store, memory, undefined, fakeAi);
  return { dir, store, memory, office };
}
const fakeAi = async () => ({ text: JSON.stringify({ summary: 'Tighten the hierarchy while preserving author copy.', payload: { recommendation: 'Increase headline contrast.' } }), provider:'fixture-provider', model:'fixture-model', requestId:'req-059' });

const validModeData = {
  'comic-book': { issueTitle:'Forge Comic', issueNumber:'1', pages:[{ page:1, pageTurnIntent:'Reveal on next page', panels:[{ id:'p1', page:1, order:1, description:'Hero enters', dialogue:[{speaker:'Hero',text:'We begin.'}], captions:['Night falls.'], sfx:['THOOM'], assetIds:[] }] }] },
  'greeting-card': { recipient:'Alex', relationship:'friend', occasion:'thank you', tone:'warm', message:'Your kindness mattered more than you know.', signature:'Kevin' },
  'birthday-card': { recipient:'Alex', relationship:'friend', occasion:'birthday', tone:'playful', milestone:'30', message:'Here is to another great trip around the sun.', signature:'Kevin' },
  invitation: { eventType:'Launch Party', primaryNames:['Author’s Forge'], date:'2026-09-15', startTime:'18:00', timezone:'America/Denver', venue:'Forge Hall', address:'100 Main Street', rsvpMethod:'example.test/rsvp', rsvpDeadline:'2026-09-10', details:'Doors open at 5:30.' },
  flyer: { objective:'Drive launch attendance', audience:'Local writers', headline:'Build the Book', subhead:'Author’s Forge launch night', details:'Live demos and production walkthroughs.', primaryCta:'Reserve your seat', destination:'example.test/forge', secondaryActions:['Share with a writer'], disclaimer:'' },
  'trading-card-game': { gameTitle:'Forge Realms', setId:'FR1', setName:'First Spark', fields:[{key:'name',label:'Name',type:'text',required:true},{key:'type',label:'Type',type:'text',required:true},{key:'rules',label:'Rules',type:'text',required:true},{key:'cost',label:'Cost',type:'number',required:true}], templates:[{id:'base',name:'Base',tokens:{frame:'iron',accent:'#333'}},{id:'hero',name:'Hero',parentId:'base',tokens:{accent:'#555'}}], cards:[{id:'c1',collectorNumber:'001',templateId:'hero',fields:{name:'Smith',type:'Hero',rules:'When played, draw one card.',cost:2}},{id:'c2',collectorNumber:'002',templateId:'base',fields:{name:'Anvil',type:'Relic',rules:'Gain one armor.',cost:3}}], playtestSnapshots:[] },
};

for (const mode of Object.keys(validModeData)) {
  test(`${mode} completes durable structured content -> composition -> preflight -> production`, async () => {
    const fx = await fixture(fakeAi);
    try {
      let project = await fx.office.create({ id:`${mode}-work`, forgeProjectId:'forge-project', mode, title:`${mode} title`, brief:`Professional ${mode} brief`, audience:'test audience', now:'2026-09-01T03:00:00.000Z' });
      project = await fx.office.setModeData('forge-project', project.id, validModeData[mode], 'test mode data', '2026-09-01T03:01:00.000Z');
      const document = composeSpecializedProject(project, project.productionProfiles[0], '2026-09-01T03:02:00.000Z');
      project = await fx.office.saveDocument('forge-project', project.id, document, 'test composition', '2026-09-01T03:02:00.000Z');
      const report = fx.office.preflight(project);
      assert.equal(report.ready, true, JSON.stringify(report.issues));
      const primaryKind = mode === 'comic-book' ? 'cbz' : mode === 'trading-card-game' ? 'json' : 'pdf';
      const rendered = await fx.office.render('forge-project', project.id, primaryKind, undefined, '2026-09-01T03:03:00.000Z');
      assert.equal(rendered.artifact.byteLength > 100, true);
      assert.match(rendered.artifact.sha256, /^[0-9a-f]{64}$/);
      if (primaryKind === 'cbz') assert.equal(Buffer.from(rendered.artifact.bytesBase64,'base64').subarray(0,2).toString('binary'), 'PK');
      if (primaryKind === 'pdf') assert.equal(Buffer.from(rendered.artifact.bytesBase64,'base64').subarray(0,5).toString(), '%PDF-');
      const restarted = new SpecializedCreationOfficeService(new FileSpecializedCreationStore(join(fx.dir,'specialized.json')), new ProjectMemoryStore(), undefined, fakeAi);
      const restored = await restarted.get('forge-project', project.id);
      assert.ok(restored);
      assert.equal(restored.revisions.length, 1);
      assert.equal(restored.artifacts.length, 1);
    } finally { await rm(fx.dir,{recursive:true,force:true}); }
  });
}

test('AI uses governed proposal boundary and never applies before explicit approval', async () => {
  const fx=await fixture(fakeAi);
  try {
    let project=await fx.office.create({id:'ai-card',forgeProjectId:'forge-project',mode:'greeting-card',title:'AI Card',brief:'Warm card'});
    const result=await fx.office.propose('forge-project','ai-card',{projectId:'forge-project',kind:'copy',instruction:'Suggest a warmer hierarchy.'});
    project=await fx.office.get('forge-project','ai-card');
    assert.equal(project.proposals[0].status,'proposed');
    assert.equal(result.ai.provider,'fixture-provider');
    assert.equal(project.modeData.message,'');
    project=await fx.office.approveProposal('forge-project','ai-card',result.proposal.id,false);
    assert.equal(project.proposals[0].status,'approved');
    assert.equal(project.modeData.message,'');
  } finally { await rm(fx.dir,{recursive:true,force:true}); }
});

test('TCG templates inherit, statistics describe the set, and snapshots preserve playtest card IDs', () => {
  const data=validModeData['trading-card-game'];
  assert.deepEqual(resolveTcgTemplateTokens(data,'hero'),{frame:'iron',accent:'#555'});
  const stats=tcgSetStatistics(data);
  assert.equal(stats.cardCount,2);
  assert.equal(stats.numeric.cost.average,2.5);
  const next=addTcgPlaytestSnapshot(data,'First tabletop test','2026-09-01T04:00:00.000Z');
  assert.equal(next.playtestSnapshots.length,1);
  assert.deepEqual(next.playtestSnapshots[0].cardIds,['c1','c2']);
});

test('reflow creates a new document without mutating source geometry', async () => {
  const fx=await fixture(fakeAi);
  try {
    let project=await fx.office.create({id:'flyer-reflow',forgeProjectId:'forge-project',mode:'flyer',title:'Flyer',brief:'Reflow test'});
    project=await fx.office.setModeData('forge-project','flyer-reflow',validModeData.flyer);
    const doc=composeSpecializedProject(project);
    const originalWidth=doc.surfaces[0].widthInches;
    const reflowed=reflowDocument(doc,4,6,'2026-09-01T05:00:00.000Z');
    assert.equal(doc.surfaces[0].widthInches,originalWidth);
    assert.equal(reflowed.surfaces[0].widthInches,4);
    assert.notEqual(reflowed.id,doc.id);
  } finally { await rm(fx.dir,{recursive:true,force:true}); }
});
