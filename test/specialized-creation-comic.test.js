const test=require('node:test');
const assert=require('node:assert/strict');
const {
  appendComicPanelArtCandidate,
  comicAccessibleReadingSequence,
  comicBrainContextRequest,
  comicModePreflight,
  comicPacingSummary,
  setComicAuthoringReadingDirection,
  setComicPagePacingIntent,
  setComicPanelLayout,
  setComicPanelLetteringSemantics,
  setComicPanelPacingIntent,
}=require('../dist/application/specialized-creation-comic.js');

const baseComic={
  issueTitle:'Forge Knights',
  issueNumber:'1',
  pages:[{
    page:1,
    pageTurnIntent:'quiet setup',
    panels:[
      {id:'p1',page:1,order:1,description:'Hero enters the forge.',dialogue:[{speaker:'Mara',text:'Keep the fire low.'}],captions:['Night shift.'],sfx:['CLANG'],assetIds:['art-v1']},
      {id:'p2',page:1,order:2,description:'The doors burst open.',dialogue:[],captions:[],sfx:['BOOM'],assetIds:[]},
    ],
  }],
};

test('comic authoring semantics preserve stable hierarchy while adding reading direction and pacing intent',()=>{
  let comic=setComicAuthoringReadingDirection(baseComic,'rtl');
  comic=setComicPagePacingIntent(comic,1,'reveal','turn-page reveal');
  comic=setComicPanelPacingIntent(comic,1,'p2','splash');
  assert.equal(comic.readingDirection,'rtl');
  assert.equal(comic.pages[0].pageTurnIntent,'turn-page reveal');
  assert.equal(comic.pages[0].panels[1].pacingIntent,'splash');
  assert.deepEqual(comic.pages[0].panels.map(panel=>panel.id),['p1','p2']);
});

test('comic panel layout uses renderer-independent normalized geometry and pacing summary exposes relative emphasis',()=>{
  let comic=setComicPanelLayout(baseComic,1,'p1',{x:0,y:0,width:1,height:0.35,gutterInches:0.12,templateId:'wide-top'});
  comic=setComicPanelLayout(comic,1,'p2',{x:0,y:0.4,width:1,height:0.6,gutterInches:0.12,templateId:'splash-bottom'});
  const summary=comicPacingSummary(comic);
  assert.equal(summary[0].panelCount,2);
  assert.equal(summary[0].panels[0].relativeArea,0.35);
  assert.equal(summary[0].panels[1].relativeArea,0.6);
  assert.throws(()=>setComicPanelLayout(comic,1,'p1',{x:0.8,y:0,width:0.4,height:0.5}),/fit normalized page coordinates/);
});

test('comic lettering semantics retain speaker source, tail target, semantic role, and explicit reading order',()=>{
  const comic=setComicPanelLetteringSemantics(baseComic,1,'p1',[
    {id:'letter-dialogue-1',kind:'dialogue',sourceIndex:0,readingOrder:1,speaker:'Mara',tailTarget:{x:0.3,y:0.55}},
    {id:'letter-caption-1',kind:'caption',sourceIndex:0,readingOrder:2},
    {id:'letter-sfx-1',kind:'sfx',sourceIndex:0,readingOrder:3},
  ]);
  const panel=comic.pages[0].panels[0];
  assert.equal(panel.dialogue[0].text,'Keep the fire low.');
  assert.equal(panel.letteringSemantics[0].speaker,'Mara');
  assert.deepEqual(panel.letteringSemantics[0].tailTarget,{x:0.3,y:0.55});
  assert.deepEqual(panel.letteringSemantics.map(item=>item.kind),['dialogue','caption','sfx']);
});

test('comic preflight catches ambiguous speaker/tail and lettering reading-order anomalies without flattening script',()=>{
  let comic={...baseComic,pages:[{...baseComic.pages[0],panels:[{...baseComic.pages[0].panels[0],dialogue:[{speaker:'Mara',text:'Keep the fire low.'},{speaker:'',text:'Who said that?'}]}]}]};
  comic=setComicPanelLetteringSemantics(comic,1,'p1',[
    {id:'d1',kind:'dialogue',sourceIndex:0,readingOrder:2,speaker:'Someone Else'},
    {id:'d2',kind:'dialogue',sourceIndex:1,readingOrder:4},
  ]);
  const issues=comicModePreflight(comic);
  const codes=new Set(issues.map(item=>item.code));
  assert.equal(codes.has('COMIC_SPEAKER_MISSING'),true);
  assert.equal(codes.has('COMIC_SPEAKER_AMBIGUOUS'),true);
  assert.equal(codes.has('COMIC_TAIL_TARGET_MISSING'),true);
  assert.equal(codes.has('COMIC_LETTERING_READING_ORDER'),true);
  assert.equal(comic.pages[0].panels[0].dialogue[0].text,'Keep the fire low.');
});

test('comic art candidates append non-destructively so prior panel assets remain available',()=>{
  const v2=appendComicPanelArtCandidate(baseComic,1,'p1','art-v2');
  const duplicate=appendComicPanelArtCandidate(v2,1,'p1','art-v2');
  assert.deepEqual(v2.pages[0].panels[0].assetIds,['art-v1','art-v2']);
  assert.deepEqual(duplicate.pages[0].panels[0].assetIds,['art-v1','art-v2']);
  assert.deepEqual(baseComic.pages[0].panels[0].assetIds,['art-v1']);
});

test('comic panel continuity request explicitly asks shared Brain for visual identity, location, props, style, continuity and dialogue voice',()=>{
  const request=comicBrainContextRequest(baseComic,1,'p1');
  assert.equal(request.capability,'comic-panel');
  assert.equal(request.panelId,'p1');
  assert.deepEqual(request.requestedContext,['characters','visual-identities','locations','props','style','continuity','dialogue-voice']);
});


test('comic accessibility sequence preserves panel descriptions, semantic roles, speakers, and deterministic reading order',()=>{
  let comic=setComicPanelLetteringSemantics(baseComic,1,'p1',[
    {id:'letter-dialogue-1',kind:'dialogue',sourceIndex:0,readingOrder:2,speaker:'Mara',tailTarget:{x:0.3,y:0.55}},
    {id:'letter-caption-1',kind:'caption',sourceIndex:0,readingOrder:1},
    {id:'letter-sfx-1',kind:'sfx',sourceIndex:0,readingOrder:3},
  ]);
  comic=setComicPanelLetteringSemantics(comic,1,'p2',[
    {id:'letter-sfx-2',kind:'sfx',sourceIndex:0,readingOrder:4},
  ]);
  const sequence=comicAccessibleReadingSequence(comic);
  assert.deepEqual(sequence.map(item=>item.kind),['caption','dialogue','sfx','sfx']);
  assert.equal(sequence[0].panelDescription,'Hero enters the forge.');
  assert.equal(sequence[1].speaker,'Mara');
  assert.equal(sequence[1].text,'Keep the fire low.');
  assert.equal(sequence[3].panelId,'p2');
  assert.equal(Object.isFrozen(sequence),true);
});

test('comic preflight reports structured lettering sources missing explicit accessible reading semantics',()=>{
  const issues=comicModePreflight(baseComic);
  const missing=issues.filter(item=>item.code==='COMIC_LETTERING_SEMANTICS_MISSING');
  assert.equal(missing.length,4);
  assert.equal(missing.every(item=>item.severity==='warning'),true);
});
