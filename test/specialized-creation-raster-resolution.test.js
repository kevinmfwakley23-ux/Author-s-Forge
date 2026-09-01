const test=require('node:test');
const assert=require('node:assert/strict');
const {createSpecializedOfficeProject}=require('../dist/domain/specialized-creation-office.js');
const {composeSpecializedProject}=require('../dist/application/specialized-creation-mode-composer.js');
const {versionProductionProfile}=require('../dist/application/specialized-creation-finishing.js');
const {SpecializedCreationProductionEngine,productionRasterDimensions}=require('../dist/application/specialized-creation-production-engine.js');

function comicData(){return{issueTitle:'Resolution Proof',readingDirection:'ltr',pages:[{page:1,panels:[{id:'p1',page:1,order:1,description:'A production panel.',dialogue:[],captions:['Resolution'],sfx:[],assetIds:[]}]}]};}

test('comic page PNG preserves exact 6.625 × 10.25 inch dimensions at 300 DPI',()=>{
  let project=createSpecializedOfficeProject({id:'raster-comic',forgeProjectId:'forge',mode:'comic-book',title:'Raster Comic',brief:'Exact production raster dimensions'});
  project={...project,modeData:comicData()};
  const profile=versionProductionProfile(project.productionProfiles[0],{artifactKinds:['pdf','cbz','svg','png']},2);
  const document=composeSpecializedProject(project,profile,'2026-09-01T10:00:00.000Z');
  project={...project,documents:[document],productionProfiles:[profile]};
  const artifact=new SpecializedCreationProductionEngine().render(project,profile,'png');
  const bytes=Buffer.from(artifact.bytesBase64,'base64');
  assert.equal(artifact.widthPixels,1988);
  assert.equal(artifact.heightPixels,3075);
  assert.equal(artifact.dpi,300);
  assert.equal(bytes.readUInt32BE(16),1988);
  assert.equal(bytes.readUInt32BE(20),3075);
  assert.deepEqual(productionRasterDimensions(document.surfaces[0],profile),{widthPixels:1988,heightPixels:3075,pixelCount:6113100,estimatedRawBytes:(1988*4+1)*3075});
});

test('production raster budget fails honestly instead of independently clamping dimensions',()=>{
  const surface={id:'huge',kind:'front',label:'Huge',widthInches:40,heightInches:40,bleedInches:0.125,safeMarginInches:0.25,readingOrder:1,elements:[]};
  const profile={formatVersion:1,id:'huge-profile',label:'Huge',widthInches:40,heightInches:40,bleedInches:0.125,safeMarginInches:0.25,dpi:600,colorIntent:'sRGB',artifactKinds:['png'],duplex:false,notes:[]};
  assert.throws(()=>productionRasterDimensions(surface,profile),/will not silently downscale/i);
});
