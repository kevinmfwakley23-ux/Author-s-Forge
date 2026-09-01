const test=require('node:test');
const assert=require('node:assert/strict');
const {createSpecializedOfficeProject}=require('../dist/domain/specialized-creation-office.js');
const {renderEmbeddedPdf,renderEmbeddedSvg}=require('../dist/application/specialized-creation-embedded-renderer.js');

test('hidden composition elements stay absent from SVG and PDF production',()=>{
  let project=createSpecializedOfficeProject({id:'hidden-proof',forgeProjectId:'forge',mode:'flyer',title:'Hidden Proof',brief:'Hidden layers must not leak into final artifacts.'});
  const surface={id:'flyer',kind:'front',label:'Flyer',widthInches:8.5,heightInches:11,bleedInches:.125,safeMarginInches:.25,readingOrder:1,elements:[
    {id:'visible',kind:'text',role:'headline',box:{x:.5,y:.5,width:5,height:.5},text:'VISIBLE-PRODUCTION-COPY',locked:false,zIndex:1,rotationDegrees:0,style:{fontSizePt:14,fill:'#111111'},metadata:{}},
    {id:'hidden',kind:'text',role:'body',box:{x:.5,y:1.2,width:5,height:.5},text:'HIDDEN-SHOULD-NEVER-EXPORT',locked:false,zIndex:2,rotationDegrees:0,style:{fontSizePt:12,fill:'#111111'},metadata:{hidden:true}},
  ]};
  const document={formatVersion:1,id:'hidden-doc',projectId:project.id,title:'Hidden Proof',mode:'flyer',surfaces:[surface],styleTokens:{},createdAt:'2026-09-01T13:00:00.000Z',updatedAt:'2026-09-01T13:00:00.000Z'};
  project={...project,documents:[document]};
  const svg=Buffer.from(renderEmbeddedSvg(project).bytesBase64,'base64').toString('utf8');
  const pdf=Buffer.from(renderEmbeddedPdf(project).bytesBase64,'base64').toString('binary');
  assert.match(svg,/VISIBLE-PRODUCTION-COPY/);assert.doesNotMatch(svg,/HIDDEN-SHOULD-NEVER-EXPORT/);
  assert.match(pdf,/VISIBLE-PRODUCTION-COPY/);assert.doesNotMatch(pdf,/HIDDEN-SHOULD-NEVER-EXPORT/);
});
