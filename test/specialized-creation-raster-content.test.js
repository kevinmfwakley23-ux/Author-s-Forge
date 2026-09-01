const test=require('node:test');
const assert=require('node:assert/strict');
const {inflateSync}=require('node:zlib');
const jpeg=require('jpeg-js');
const {createSpecializedOfficeProject}=require('../dist/domain/specialized-creation-office.js');
const {SpecializedCreationProductionEngine}=require('../dist/application/specialized-creation-production-engine.js');

function fixture(){
  let project=createSpecializedOfficeProject({id:'raster-content',forgeProjectId:'forge',mode:'comic-book',title:'Raster Content',brief:'Prove production raster contains readable content.',now:'2026-09-01T12:00:00.000Z'});
  const profile={formatVersion:1,id:'raster-2x2',label:'Raster 2 × 2',widthInches:2,heightInches:2,bleedInches:.125,safeMarginInches:.25,dpi:72,colorIntent:'sRGB',artifactKinds:['png'],duplex:false,notes:[]};
  const redJpeg=jpeg.encode({width:2,height:2,data:Buffer.from([255,0,0,255,255,0,0,255,255,0,0,255,255,0,0,255])},100).data;
  const asset={id:'red-art',projectId:project.id,kind:'artwork',name:'Red production proof',uri:`data:image/jpeg;base64,${Buffer.from(redJpeg).toString('base64')}`,mimeType:'image/jpeg',pixelWidth:2,pixelHeight:2,source:'author',sourceReference:'test fixture',approved:true,createdAt:'2026-09-01T12:00:00.000Z'};
  const surface={id:'page-1',kind:'page',label:'Page 1',widthInches:2,heightInches:2,bleedInches:.125,safeMarginInches:.25,readingOrder:1,elements:[
    {id:'glyph-text',kind:'text',role:'headline',box:{x:.3,y:.3,width:.65,height:.55},text:'A',locked:false,zIndex:1,rotationDegrees:0,style:{fontSizePt:18,fill:'#111111'},metadata:{}},
    {id:'art',kind:'image',role:'artwork',box:{x:1.1,y:.3,width:.5,height:.5},assetId:'red-art',locked:false,zIndex:2,rotationDegrees:0,style:{},metadata:{fit:'cover'}},
  ]};
  const document={formatVersion:1,id:'doc-raster',projectId:project.id,title:'Raster Proof',mode:'comic-book',surfaces:[surface],styleTokens:{},createdAt:'2026-09-01T12:00:00.000Z',updatedAt:'2026-09-01T12:00:00.000Z'};
  project={...project,modeData:{issueTitle:'Raster Proof',readingDirection:'ltr',pages:[{page:1,panels:[{id:'panel-1',page:1,order:1,description:'Raster production proof',dialogue:[],captions:[],sfx:[],assetIds:[]}]}]},productionProfiles:[profile],assets:[asset],documents:[document]};
  return {project,profile};
}

function decodeForgePng(base64){
  const bytes=Buffer.from(base64,'base64');assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  let offset=8,width=0,height=0;const idat=[];
  while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset),type=bytes.subarray(offset+4,offset+8).toString('ascii'),data=bytes.subarray(offset+8,offset+8+length);offset+=12+length;if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);}else if(type==='IDAT')idat.push(data);else if(type==='IEND')break;}
  const stride=width*4+1,raw=inflateSync(Buffer.concat(idat));assert.equal(raw.length,stride*height);for(let y=0;y<height;y++)assert.equal(raw[y*stride],0);
  return {width,height,pixel(x,y){const i=y*stride+1+x*4;return [raw[i],raw[i+1],raw[i+2],raw[i+3]];}};
}

function boxPixels(image,x0,y0,x1,y1){const pixels=[];for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)pixels.push(image.pixel(x,y));return pixels;}

test('PNG production raster draws glyph-shaped text instead of a solid placeholder rectangle',()=>{
  const {project,profile}=fixture(),artifact=new SpecializedCreationProductionEngine().render(project,profile,'png'),image=decodeForgePng(artifact.bytesBase64);
  assert.equal(image.width,144);assert.equal(image.height,144);
  const pixels=boxPixels(image,Math.floor(.3*72),Math.floor(.3*72),Math.ceil(.95*72),Math.ceil(.85*72));
  const dark=pixels.filter(([r,g,b])=>r<80&&g<80&&b<80).length,white=pixels.filter(([r,g,b])=>r>245&&g>245&&b>245).length;
  assert.ok(dark>0,'text box must contain rendered dark glyph pixels');
  assert.ok(white>0,'text box must retain white negative space around/inside glyphs');
  assert.ok(dark<pixels.length*.6,'text must not be represented by a mostly solid dark rectangle');
});

test('PNG production raster composites actual approved image pixels',()=>{
  const {project,profile}=fixture(),artifact=new SpecializedCreationProductionEngine().render(project,profile,'png'),image=decodeForgePng(artifact.bytesBase64);
  const [r,g,b,a]=image.pixel(Math.round(1.35*72),Math.round(.55*72));
  assert.ok(r>180&&g<90&&b<90,`expected red artwork pixel, got ${r},${g},${b}`);assert.equal(a,255);
});

test('multi-surface PNG fails honestly instead of silently dropping surfaces',()=>{
  const {project,profile}=fixture(),first=project.documents[0].surfaces[0],second={...first,id:'page-2',label:'Page 2',readingOrder:2,elements:first.elements.map(element=>({...element,id:`page2-${element.id}`}))},two={...project,documents:[{...project.documents[0],surfaces:[first,second]}]};
  assert.throws(()=>new SpecializedCreationProductionEngine().render(two,profile,'png'),/single-surface production artifact.*2 surfaces/i);
});