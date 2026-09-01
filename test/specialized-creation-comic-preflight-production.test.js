const test=require('node:test');
const assert=require('node:assert/strict');
const {createSpecializedOfficeProject}=require('../dist/domain/specialized-creation-office.js');
const {composeSpecializedProject}=require('../dist/application/specialized-creation-mode-composer.js');
const {specializedProductionSafetyIssues,prepareSpecializedProjectForArtifact}=require('../dist/application/specialized-creation-production-safety.js');

test('comic authoring preflight errors block production instead of emitting ambiguous lettering',()=>{
  let project=createSpecializedOfficeProject({id:'comic-preflight-proof',forgeProjectId:'forge',mode:'comic-book',title:'Comic Preflight Proof',brief:'Invalid structured lettering must fail production.'});
  project={...project,modeData:{issueTitle:'Forge Night',readingDirection:'ltr',pages:[{page:1,panels:[{
    id:'panel-1',page:1,order:1,description:'A character speaks.',
    dialogue:[{speaker:'',text:'Who is there?'}],captions:[],sfx:[],assetIds:[],
    letteringSemantics:[{id:'dialogue-1',kind:'dialogue',sourceIndex:0,readingOrder:1}],
  }]}]}};
  project={...project,documents:[composeSpecializedProject(project)]};
  const profile=project.productionProfiles[0],issues=specializedProductionSafetyIssues(project,'pdf',profile);
  assert.ok(issues.some(issue=>issue.code==='COMIC_SPEAKER_MISSING'&&issue.severity==='error'));
  assert.throws(()=>prepareSpecializedProjectForArtifact(project,'pdf',profile),/COMIC_SPEAKER_MISSING/);
});
