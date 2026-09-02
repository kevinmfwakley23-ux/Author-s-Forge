#!/usr/bin/env node
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {spawn}=require('node:child_process');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {chromium}=require('@playwright/test');

const HOST='127.0.0.1';
const PORT=6500+Math.floor(Math.random()*200);
const AI_PORT=PORT+250;
const forgeProjectId=`comic-browser-${Date.now()}`;
const comicId='comic-059d';
const tinyRgbPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

const initialComic={
  issueTitle:'Forge Knights',
  issueNumber:'7',
  pages:[
    {page:1,pageTurnIntent:'setup',panels:[
      {id:'p1',page:1,order:1,description:'Mara enters the forge.',dialogue:[{speaker:'Mara',text:'Keep the flame low.'}],captions:['Night shift.'],sfx:[],assetIds:[]},
      {id:'p2',page:1,order:2,description:'A shadow crosses the furnace.',dialogue:[],captions:[],sfx:['KLANG'],assetIds:[]},
    ]},
    {page:2,pageTurnIntent:'reveal',panels:[
      {id:'p3',page:2,order:1,description:'The furnace opens like an eye.',dialogue:[],captions:['Then the fire answered.'],sfx:['WHUMM'],assetIds:[]},
    ]},
  ],
};

function approvedComic(){return {
  issueTitle:'Forge Knights',
  issueNumber:'7',
  readingDirection:'rtl',
  pages:[
    {page:1,pageTurnIntent:'setup',panels:[
      {id:'p2',page:1,order:1,description:'A shadow crosses the furnace.',dialogue:[],captions:[],sfx:['KLANG'],assetIds:[]},
      {id:'p1',page:1,order:2,description:'Mara enters the forge.',dialogue:[{speaker:'Mara',text:'Keep the flame low. Something is listening.'}],captions:['Night shift.'],sfx:[],assetIds:['art-p1'],letteringSemantics:[
        {id:'p1-caption-1',kind:'caption',sourceIndex:0,readingOrder:1},
        {id:'p1-dialogue-1',kind:'dialogue',sourceIndex:0,readingOrder:2,speaker:'Mara',tailTarget:{x:0.32,y:0.58}},
      ]},
    ]},
    {page:2,pageTurnIntent:'reveal',panels:[
      {id:'p3',page:2,order:1,description:'The furnace opens like an eye.',dialogue:[],captions:['Then the fire answered.'],sfx:['WHUMM'],assetIds:[]},
    ]},
    {page:3,pageTurnIntent:'transition',panels:[
      {id:'p4',page:3,order:1,description:'Mara reaches for the emergency bell.',dialogue:[{speaker:'Mara',text:'Wake the guild.'}],captions:[],sfx:[],assetIds:[]},
    ]},
  ],
};}

function json(res,status,value){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));}
async function readBody(req){let raw='';for await(const chunk of req)raw+=String(chunk);return raw?JSON.parse(raw):{};}
function mockAi(){
  const server=createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/v1/chat/completions')return json(res,404,{error:{message:'not found'}});
    await readBody(req);
    return json(res,200,{id:'comic-059d-ai',choices:[{message:{content:JSON.stringify({summary:'Approve one scoped dialogue revision and preserve the existing comic structure.',payload:{modeData:approvedComic()}})}}]});
  });
  return new Promise(resolve=>server.listen(AI_PORT,HOST,()=>resolve(server)));
}
async function wait(url,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){try{if((await fetch(url)).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`Timed out waiting for ${url}`);}
async function call(base,path,method='GET',payload){const response=await fetch(base+path,{method,headers:{'content-type':'application/json'},...(payload!==undefined?{body:JSON.stringify(payload)}:{})});const text=await response.text();assert.equal(response.ok,true,`${method} ${path}: ${text}`);return text?JSON.parse(text):{};}
function startApp(dataDir){return spawn(process.execPath,['dist/specialized-creation-server.js'],{env:{...process.env,HOST,SPECIALIZED_PORT:String(PORT),FORGE_DATA_DIR:dataDir,AI_PROVIDER_ORDER:'omniroute',OMNIROUTE_BASE_URL:`http://${HOST}:${AI_PORT}`,OMNIROUTE_MODEL:'comic-059d-test',OMNIROUTE_BILLING_CLASS:'subscription',OMNIROUTE_API_KEY:'',ROUTER9_BASE_URL:'',KINGS_AI_ENDPOINT:'',OPENAI_API_KEY:'',OLLAMA_BASE_URL:''},stdio:['ignore','pipe','pipe']});}
async function stopApp(app){if(!app)return;app.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,150));}

async function main(){
  const dataDir=await mkdtemp(join(tmpdir(),'forge-comic-059d-'));
  const ai=await mockAi();
  let app=startApp(dataDir),browser;
  try{
    const base=`http://${HOST}:${PORT}`;
    await wait(`${base}/api/health`);
    await call(base,'/api/projects','POST',{id:forgeProjectId,title:'Comic Mission 059D Acceptance'});
    await call(base,`/api/projects/${forgeProjectId}/specialized`,'POST',{id:comicId,mode:'comic-book',title:'Forge Knights #7',brief:'Prove the complete durable comic workflow.',audience:'Comic readers'});
    await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/mode-data`,'PUT',{modeData:initialComic,reason:'Author created issue, pages, panels and structured script'});

    const reordered=await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/comic/reorder-panels`,'POST',{page:1,panelIds:['p2','p1']});
    assert.deepEqual(reordered.modeData.pages[0].panels.map(panel=>panel.id),['p2','p1']);
    assert.deepEqual(reordered.modeData.pages[0].panels.map(panel=>panel.order),[1,2]);
    const directed=await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/comic/reading-direction`,'POST',{direction:'rtl'});
    assert.equal(directed.modeData.readingDirection,'rtl');

    await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/assets`,'POST',{asset:{id:'art-p1',kind:'artwork',name:'Mara Forge Panel',uri:tinyRgbPng,mimeType:'image/png',pixelWidth:1,pixelHeight:1,source:'author',sourceReference:'comic-059d-browser-fixture',approved:true}});
    const proposed=await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/ai/propose`,'POST',{kind:'copy',focus:'page 1 panel p1 dialogue only',instruction:'Revise only Mara’s page 1 panel dialogue. Keep stable page and panel IDs, reading order, art candidate references, and every unrelated line unchanged.'});
    assert.equal(proposed.ai.provider,'omniroute');
    const approved=await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/ai/proposals/${proposed.proposal.id}/approve`,'POST',{apply:true});
    assert.equal(approved.proposals.find(item=>item.id===proposed.proposal.id).status,'approved');
    assert.equal(approved.modeData.pages.length,3,'approved structured proposal should add the authored third page without flattening comic data');
    assert.equal(approved.modeData.pages[0].panels[1].dialogue[0].text,'Keep the flame low. Something is listening.');
    assert.deepEqual(approved.modeData.pages[0].panels[1].assetIds,['art-p1']);
    assert.deepEqual(approved.modeData.pages[0].panels[1].letteringSemantics.map(item=>item.kind),['caption','dialogue']);
    assert.deepEqual(approved.modeData.pages[0].panels[1].letteringSemantics[1].tailTarget,{x:0.32,y:0.58});

    const composed=await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/compose`,'POST',{});
    let document=composed.document;
    assert.equal(document.surfaces.length,3);
    assert.deepEqual(document.surfaces.map(surface=>surface.id),['page-1','page-2','page-3']);
    const page1=document.surfaces[0];
    const dialogue=page1.elements.find(element=>element.kind==='text'&&element.role==='dialogue'&&String(element.text).includes('Something is listening'));
    assert.ok(dialogue,'approved dialogue must remain editable text separate from art');
    const panelShape=page1.elements.find(element=>element.id==='panel-p1');
    assert.ok(panelShape,'stable panel element should exist after reorder and composition');
    const image={id:'image-art-p1',kind:'image',role:'artwork',box:{x:panelShape.box.x+0.08,y:panelShape.box.y+0.7,width:Math.max(0.5,panelShape.box.width-0.16),height:Math.max(0.5,panelShape.box.height-1.0)},assetId:'art-p1',locked:false,zIndex:50,rotationDegrees:0,style:{},metadata:{panelId:'p1',candidate:'approved-author-art'}};
    document={...document,surfaces:document.surfaces.map(surface=>surface.id==='page-1'?{...surface,elements:[...surface.elements,image]}:surface),updatedAt:new Date().toISOString()};
    const saved=await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/documents`,'POST',{document,reason:'Author attached approved panel art while preserving editable lettering'});
    const latestRevision=saved.revisions.at(-1);
    assert.equal(latestRevision.document.surfaces[0].elements.some(element=>element.id==='image-art-p1'&&element.assetId==='art-p1'),true);
    assert.equal(latestRevision.document.surfaces[0].elements.some(element=>element.id===dialogue.id&&element.kind==='text'),true);

    const pdf=await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/render`,'POST',{kind:'pdf',documentIds:[document.id]});
    const cbz=await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}/render`,'POST',{kind:'cbz',documentIds:[document.id]});
    assert.equal(Buffer.from(pdf.artifact.bytesBase64,'base64').subarray(0,5).toString(),'%PDF-');
    const cbzBytes=Buffer.from(cbz.artifact.bytesBase64,'base64');
    assert.equal(cbzBytes.subarray(0,2).toString(),'PK');
    assert.equal(cbzBytes.includes(Buffer.from('001.png')),true);
    assert.equal(cbzBytes.includes(Buffer.from('002.png')),true);
    assert.equal(cbzBytes.includes(Buffer.from('003.png')),true);
    assert.deepEqual(pdf.artifact.sourceDocumentIds,[document.id]);
    assert.deepEqual(cbz.artifact.sourceDocumentIds,[document.id]);

    browser=await chromium.launch({executablePath:process.env.FORGE_BROWSER_EXECUTABLE||chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-gpu']});
    const desktop=await browser.newContext({viewport:{width:1365,height:900}}),page=await desktop.newPage();
    await page.goto(`${base}/?project=${forgeProjectId}`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#mode-summary')?.textContent.includes('comic-book'));
    assert.match(await page.locator('#mode-summary').innerText(),/comic-book/);
    assert.match(await page.locator('#history').innerText(),/production artifacts/);
    assert.ok(await page.locator('#composition-svg [data-element]').count()>0,'browser must render the durable comic composition');
    const pageText=await page.locator('#composition-svg').textContent();
    assert.match(pageText??'',/Something is listening/,'browser render must include approved editable dialogue');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#history')?.textContent.includes('production artifacts'));
    await desktop.close();

    await stopApp(app);app=startApp(dataDir);await wait(`${base}/api/health`);
    const restored=await call(base,`/api/projects/${forgeProjectId}/specialized/${comicId}`);
    assert.equal(restored.modeData.readingDirection,'rtl');
    assert.equal(restored.modeData.pages.length,3);
    assert.deepEqual(restored.modeData.pages[0].panels.map(panel=>panel.id),['p2','p1']);
    assert.equal(restored.assets.some(asset=>asset.id==='art-p1'&&asset.approved===true),true);
    assert.equal(restored.modeData.pages[0].panels[1].letteringSemantics[1].speaker,'Mara');
    assert.deepEqual(restored.modeData.pages[0].panels[1].letteringSemantics[1].tailTarget,{x:0.32,y:0.58});
    assert.equal(restored.revisions.some(revision=>revision.id===latestRevision.id),true);
    assert.equal(restored.artifacts.some(artifact=>artifact.kind==='pdf'),true);
    assert.equal(restored.artifacts.some(artifact=>artifact.kind==='cbz'),true);

    console.log('MISSION 059D COMIC BROWSER ACCEPTANCE PASSED: structured pages/panels + reorder/direction + author-approved AI text + approved art attachment + editable lettering + browser render + PDF/CBZ lineage + reload/restart durability.');
  } finally {
    if(browser)await browser.close().catch(()=>{});
    await stopApp(app);
    ai.close();
    await rm(dataDir,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
