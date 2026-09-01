const test=require('node:test');
const assert=require('node:assert/strict');
const jpeg=require('jpeg-js');
const {createSpecializedOfficeProject}=require('../dist/domain/specialized-creation-office.js');
const {renderEmbeddedPdf}=require('../dist/application/specialized-creation-embedded-renderer.js');

test('specialized PDF embeds approved JPEG artwork as an image XObject and paints it',()=>{
  let project=createSpecializedOfficeProject({id:'pdf-art-proof',forgeProjectId:'forge',mode:'trading-card-game',title:'PDF Art Proof',brief:'Prove production PDF contains the approved art pixels.',now:'2026-09-01T12:40:00.000Z'});
  const imageBytes=Buffer.from(jpeg.encode({width:2,height:2,data:Buffer.from([
    220,30,30,255, 30,220,30,255,
    30,30,220,255, 240,220,30,255,
  ])},100).data);
  const asset={id:'approved-art',projectId:project.id,kind:'artwork',name:'Approved proof art',uri:`data:image/jpeg;base64,${imageBytes.toString('base64')}`,mimeType:'image/jpeg',pixelWidth:2,pixelHeight:2,source:'author',sourceReference:'PDF embedding regression fixture',approved:true,createdAt:'2026-09-01T12:40:00.000Z'};
  const surface={id:'card-proof',kind:'card-front',label:'Proof Card',widthInches:2.5,heightInches:3.5,bleedInches:.125,safeMarginInches:.25,readingOrder:1,elements:[
    {id:'art',kind:'image',role:'artwork',box:{x:.25,y:.5,width:2,height:2},assetId:asset.id,locked:false,zIndex:1,rotationDegrees:0,style:{},metadata:{fit:'cover'}},
    {id:'title',kind:'text',role:'title',box:{x:.25,y:.2,width:2,height:.3},text:'Proof Card',locked:false,zIndex:2,rotationDegrees:0,style:{fontSizePt:10,fill:'#111111'},metadata:{}},
  ]};
  const document={formatVersion:1,id:'pdf-art-doc',projectId:project.id,title:'PDF Art Document',mode:'trading-card-game',surfaces:[surface],styleTokens:{},createdAt:'2026-09-01T12:40:00.000Z',updatedAt:'2026-09-01T12:40:00.000Z'};
  project={...project,assets:[asset],documents:[document]};

  const artifact=renderEmbeddedPdf(project),pdf=Buffer.from(artifact.bytesBase64,'base64'),text=pdf.toString('binary');
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  assert.match(text,/\/Subtype \/Image/);
  assert.match(text,/\/Width 2 \/Height 2/);
  assert.match(text,/\/Filter \/DCTDecode/);
  assert.match(text,/\/XObject << \/Im1 \d+ 0 R >>/);
  assert.match(text,/\/Im1 Do/);
  assert.ok(pdf.includes(imageBytes),'PDF must contain the approved JPEG stream bytes, not a placeholder rectangle or asset label.');
});
