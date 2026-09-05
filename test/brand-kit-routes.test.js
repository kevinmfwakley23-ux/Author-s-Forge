"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { Readable } = require("node:stream");
const { FileBrandKitStore } = require("../dist/infrastructure/file-brand-kit-store");
const { createSpecializedBrandKitRoutes } = require("../dist/application/specialized-brand-kit-routes");

function req(method,payload){const raw=payload===undefined?"":JSON.stringify(payload),request=Readable.from(raw?[raw]:[]);request.method=method;request.headers={};return request;}
function capture(){let status=0,raw="";return{res:{writeHead(code){status=code;},end(value){raw+=value?String(value):"";}},result:()=>({status,json:raw?JSON.parse(raw):undefined})};}
async function call(handler,method,path,projectId,payload){const c=capture();assert.equal(await handler(req(method,payload),c.res,new URL(path,"http://localhost"),projectId),true);return c.result();}
function documentFixture(){return{formatVersion:1,id:"doc-1",projectId:"specialized-1",title:"Flyer",mode:"flyer",surfaces:[{id:"front",kind:"front",label:"Front",widthInches:8.5,heightInches:11,bleedInches:.125,safeMarginInches:.25,readingOrder:1,elements:[{id:"headline",kind:"text",role:"headline",box:{x:1,y:1,width:6,height:1},text:"Launch",locked:false,zIndex:1,rotationDegrees:0,style:{fontFamily:"Comic Sans MS",fontSizePt:30,fill:"#ff0000"},metadata:{}}]}],styleTokens:{},createdAt:"2026-09-04T12:00:00.000Z",updatedAt:"2026-09-04T12:00:00.000Z"};}

test("Brand Kit routes keep application as an explicit unsaved candidate",async t=>{const root=await mkdtemp(join(tmpdir(),"forge-brand-routes-"));t.after(()=>rm(root,{recursive:true,force:true}));const projectId="forge-1",document=documentFixture(),sourceSnapshot=JSON.stringify(document);const specialized={async get(forgeProjectId,id){return forgeProjectId===projectId&&id==="specialized-1"?{id,forgeProjectId,documents:[document]}:undefined;}};const store=new FileBrandKitStore(join(root,"brand-kits.json"));const handler=createSpecializedBrandKitRoutes(store,specialized);
  const created=await call(handler,"POST",`/api/projects/${projectId}/brand-kits`,projectId,{id:"brand-1",name:"Launch Brand",colors:[{id:"primary",label:"Primary",role:"primary",value:"#123456"}],fonts:[{id:"display",label:"Display",family:"Georgia",role:"display",weights:[400,700]}],guidelines:["Keep brand marks consistent."],restrictions:{enforceColors:true,enforceFonts:true,requireApprovedBrandAssets:true,lockedElementRoles:["brand"]}});assert.equal(created.status,201);assert.equal(created.json.id,"brand-1");
  const audit=await call(handler,"POST",`/api/projects/${projectId}/brand-kits/brand-1/audit`,projectId,{specializedProjectId:"specialized-1",documentId:"doc-1"});assert.equal(audit.status,200);assert.equal(audit.json.report.compliant,false);
  const proposal=await call(handler,"POST",`/api/projects/${projectId}/brand-kits/brand-1/propose-application`,projectId,{specializedProjectId:"specialized-1",documentId:"doc-1"});assert.equal(proposal.status,200);assert.equal(proposal.json.persisted,false);assert.match(proposal.json.nextStep,/Persist it only through the existing Specialized Creation document revision endpoint/i);assert.equal(proposal.json.proposal.candidate.surfaces[0].elements[0].style.fontFamily,"Georgia");assert.equal(proposal.json.proposal.candidate.surfaces[0].elements[0].style.fill,"#123456");assert.equal(JSON.stringify(document),sourceSnapshot,"route proposal must not mutate saved source document");
});