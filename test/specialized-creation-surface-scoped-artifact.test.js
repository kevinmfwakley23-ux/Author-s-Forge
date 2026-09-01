const test=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {createSpecializedOfficeProject}=require('../dist/domain/specialized-creation-office.js');
const {composeSpecializedProject}=require('../dist/application/specialized-creation-mode-composer.js');
const {FileSpecializedCreationStore}=require('../dist/infrastructure/file-specialized-creation-store.js');
const {SpecializedCreationScopedArtifactService}=require('../dist/application/specialized-creation-scoped-artifacts.js');

test('multi-surface documents require explicit surface selection for PNG/SVG and preserve lineage',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'forge-surface-scope-'));
  try{
    const store=new FileSpecializedCreationStore(join(dir,'specialized.json'));
    let project=createSpecializedOfficeProject({id:'surface-scope',forgeProjectId:'forge',mode:'greeting-card',title:'Surface Scope',brief:'Export the author-selected face only.'});
    project={...project,modeData:{occasion:'thanks',tone:'warm',recipient:'Alex',message:'Thank you for everything.',signature:'Forge'}};
    const document=composeSpecializedProject(project,project.productionProfiles[0],'2026-09-01T12:45:00.000Z');
    const revision={id:`${document.id}:r1`,projectId:project.id,documentId:document.id,sequence:1,reason:'approved folded card',actor:'author',document,createdAt:'2026-09-01T12:45:00.000Z'};
    project={...project,documents:[document],revisions:[revision],updatedAt:'2026-09-01T12:45:00.000Z'};
    await store.create(project);
    const service=new SpecializedCreationScopedArtifactService(store),profile=project.productionProfiles[0];

    await assert.rejects(()=>service.render({forgeProjectId:'forge',specializedProjectId:project.id,documentIds:[document.id],profileId:profile.id,kind:'png'}),/requires exactly one selected surface/i);
    await assert.rejects(()=>service.render({forgeProjectId:'forge',specializedProjectId:project.id,documentIds:[document.id],profileId:profile.id,kind:'svg'}),/requires exactly one selected surface/i);

    const png=await service.render({forgeProjectId:'forge',specializedProjectId:project.id,documentIds:[document.id],surfaceId:'front',profileId:profile.id,kind:'png',now:'2026-09-01T12:46:00.000Z'});
    const svg=await service.render({forgeProjectId:'forge',specializedProjectId:project.id,documentIds:[document.id],surfaceId:'inside-right',profileId:profile.id,kind:'svg',now:'2026-09-01T12:47:00.000Z'});
    const pngBytes=Buffer.from(png.artifact.bytesBase64,'base64'),svgText=Buffer.from(svg.artifact.bytesBase64,'base64').toString('utf8');
    assert.ok(pngBytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    assert.equal(png.artifact.widthPixels,1500);assert.equal(png.artifact.heightPixels,2100);assert.equal(png.artifact.dpi,300);
    assert.match(svgText,/Thank you for everything\./);
    assert.deepEqual(png.artifact.sourceDocumentIds,[document.id]);assert.deepEqual(svg.artifact.sourceDocumentIds,[document.id]);

    const saved=await store.get('forge',project.id);assert.ok(saved);
    const records=saved.artifacts.filter(record=>record.kind==='png'||record.kind==='svg');
    assert.equal(records.length,2);assert.equal(new Set(records.map(record=>record.id)).size,2);
    assert.ok(records.every(record=>record.revisionId===revision.id&&record.profileId===profile.id));
  } finally {await rm(dir,{recursive:true,force:true});}
});
