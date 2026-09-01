const test=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {createSpecializedOfficeProject}=require('../dist/domain/specialized-creation-office.js');
const {composeSpecializedProject}=require('../dist/application/specialized-creation-mode-composer.js');
const {versionProductionProfile}=require('../dist/application/specialized-creation-finishing.js');
const {FileSpecializedCreationStore}=require('../dist/infrastructure/file-specialized-creation-store.js');
const {SpecializedCreationScopedArtifactService}=require('../dist/application/specialized-creation-scoped-artifacts.js');

function comicData(){return {
  issueTitle:'Forge Knights',
  issueNumber:'7',
  readingDirection:'ltr',
  pages:[
    {page:1,pageTurnIntent:'setup',panels:[{id:'p1',page:1,order:1,description:'Mara enters the quiet forge.',dialogue:[],captions:['Night shift.'],sfx:[],assetIds:[]}]},
    {page:2,pageTurnIntent:'reveal',panels:[{id:'p2',page:2,order:1,description:'The furnace wakes.',dialogue:[],captions:['Then the fire answered.'],sfx:[],assetIds:[]}]},
  ],
};}

test('comic production profile can be versioned without mutating the inherited physical profile',()=>{
  const project=createSpecializedOfficeProject({id:'comic-profile',forgeProjectId:'forge',mode:'comic-book',title:'Profile Proof',brief:'Configurable comic print profile'});
  const base=project.productionProfiles[0];
  const custom=versionProductionProfile(base,{label:'US comic proof profile',widthInches:6.75,heightInches:10.5,bleedInches:0.125,safeMarginInches:0.3,dpi:300,artifactKinds:['pdf','cbz','svg']},2);
  assert.notEqual(custom.id,base.id);
  assert.equal(custom.widthInches,6.75);
  assert.equal(custom.heightInches,10.5);
  assert.equal(custom.safeMarginInches,0.3);
  assert.deepEqual(custom.artifactKinds,['pdf','cbz','svg']);
  assert.equal(base.widthInches,6.625);
  assert.equal(base.heightInches,10.25);
  assert.match(custom.notes.at(-1),/revision 2/);
});

test('comic PDF and CBZ are emitted from the same durable document revision and production profile',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'forge-comic-production-'));
  try{
    const store=new FileSpecializedCreationStore(join(dir,'specialized.json'));
    let project=createSpecializedOfficeProject({id:'comic-lineage',forgeProjectId:'forge',mode:'comic-book',title:'Lineage Proof',brief:'PDF and CBZ from one approved comic revision'});
    project={...project,modeData:comicData()};
    const profile=versionProductionProfile(project.productionProfiles[0],{label:'Lineage print profile'},2);
    const document=composeSpecializedProject(project,profile,'2026-09-01T07:00:00.000Z');
    const revision={id:`${document.id}:r1`,projectId:project.id,documentId:document.id,sequence:1,reason:'approved comic composition',actor:'author',document,createdAt:'2026-09-01T07:00:00.000Z'};
    project={...project,documents:[document],productionProfiles:[...project.productionProfiles,profile],revisions:[revision],updatedAt:'2026-09-01T07:00:00.000Z'};
    await store.create(project);
    const service=new SpecializedCreationScopedArtifactService(store);

    const pdf=await service.render({forgeProjectId:'forge',specializedProjectId:project.id,documentIds:[document.id],profileId:profile.id,kind:'pdf',now:'2026-09-01T07:01:00.000Z'});
    const cbz=await service.render({forgeProjectId:'forge',specializedProjectId:project.id,documentIds:[document.id],profileId:profile.id,kind:'cbz',now:'2026-09-01T07:02:00.000Z'});

    const pdfBytes=Buffer.from(pdf.artifact.bytesBase64,'base64');
    const cbzBytes=Buffer.from(cbz.artifact.bytesBase64,'base64');
    assert.equal(pdfBytes.subarray(0,5).toString(),'%PDF-');
    assert.equal(cbzBytes.subarray(0,4).toString('binary'),'PK\x03\x04');
    assert.equal(pdf.artifact.pageCount,2);
    assert.equal(cbz.artifact.pageCount,2);
    assert.deepEqual(pdf.artifact.sourceDocumentIds,[document.id]);
    assert.deepEqual(cbz.artifact.sourceDocumentIds,[document.id]);
    assert.equal(cbzBytes.includes(Buffer.from('001.png')),true);
    assert.equal(cbzBytes.includes(Buffer.from('002.png')),true);
    assert.equal(cbzBytes.includes(Buffer.from('003.png')),false);

    const saved=await store.get('forge',project.id);
    assert.ok(saved);
    const records=saved.artifacts.filter(record=>record.kind==='pdf'||record.kind==='cbz');
    assert.equal(records.length,2);
    assert.deepEqual(new Set(records.map(record=>record.revisionId)),new Set([revision.id]));
    assert.deepEqual(new Set(records.map(record=>record.profileId)),new Set([profile.id]));
    assert.deepEqual(new Set(records.map(record=>record.projectId)),new Set([project.id]));
    assert.equal(records.every(record=>record.byteLength>0&&record.sha256.length===64),true);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
