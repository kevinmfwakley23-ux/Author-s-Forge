const test=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {createSpecializedOfficeProject}=require('../dist/domain/specialized-creation-office.js');
const {composeSpecializedProject}=require('../dist/application/specialized-creation-mode-composer.js');
const {FileSpecializedCreationStore}=require('../dist/infrastructure/file-specialized-creation-store.js');
const {SpecializedCreationScopedArtifactService}=require('../dist/application/specialized-creation-scoped-artifacts.js');

test('identical production bytes never erase earlier artifact lineage records',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'forge-artifact-lineage-'));
  try{
    const store=new FileSpecializedCreationStore(join(dir,'specialized.json'));
    let project=createSpecializedOfficeProject({id:'lineage-proof',forgeProjectId:'forge',mode:'flyer',title:'Lineage Proof',brief:'Every production run remains attributable.'});
    project={...project,modeData:{objective:'Announce',audience:'Readers',headline:'Forge Release',details:'Production proof.',primaryCta:'Read now',destination:'example.test',secondaryActions:[]}};
    const document=composeSpecializedProject(project,project.productionProfiles[0],'2026-09-01T13:05:00.000Z');
    const revision={id:`${document.id}:r1`,projectId:project.id,documentId:document.id,sequence:1,reason:'approved composition',actor:'author',document,createdAt:'2026-09-01T13:05:00.000Z'};
    project={...project,documents:[document],revisions:[revision],updatedAt:'2026-09-01T13:05:00.000Z'};await store.create(project);
    const service=new SpecializedCreationScopedArtifactService(store),profile=project.productionProfiles[0];
    const first=await service.render({forgeProjectId:'forge',specializedProjectId:project.id,documentIds:[document.id],surfaceId:'flyer',profileId:profile.id,kind:'svg',now:'2026-09-01T13:06:00.000Z'});
    const second=await service.render({forgeProjectId:'forge',specializedProjectId:project.id,documentIds:[document.id],surfaceId:'flyer',profileId:profile.id,kind:'svg',now:'2026-09-01T13:07:00.000Z'});
    assert.equal(first.artifact.sha256,second.artifact.sha256,'fixture intentionally proves identical bytes across runs');
    const saved=await store.get('forge',project.id);assert.ok(saved);const records=saved.artifacts.filter(record=>record.kind==='svg');
    assert.equal(records.length,2);assert.equal(new Set(records.map(record=>record.id)).size,2);assert.deepEqual(records.map(record=>record.revisionId),[revision.id,revision.id]);assert.deepEqual(records.map(record=>record.createdAt),['2026-09-01T13:06:00.000Z','2026-09-01T13:07:00.000Z']);
  } finally {await rm(dir,{recursive:true,force:true});}
});
