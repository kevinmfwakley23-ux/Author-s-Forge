const test=require('node:test');
const assert=require('node:assert/strict');
const {createSpecializedOfficeProject}=require('../dist/domain/specialized-creation-office.js');
const {composeSpecializedProject}=require('../dist/application/specialized-creation-mode-composer.js');
const {specializedProductionSafetyIssues}=require('../dist/application/specialized-creation-production-safety.js');
const {createTcgGameStarterData}=require('../dist/application/specialized-creation-tcg-design.js');

function projectWithArt(approved){let project=createSpecializedOfficeProject({id:'tcg-art',forgeProjectId:'forge',mode:'trading-card-game',title:'TCG Art',brief:'Approved art production'}),data=createTcgGameStarterData({gameTitle:'Forge Realms',setId:'FR1',setName:'Origins'});data={...data,cards:[{id:'hero-1',collectorNumber:'001',templateId:'character-base',artworkAssetId:'hero-art',fields:{name:'Nova',type:'Guardian',rules:'Guard an adjacent ally.'}}]};project={...project,modeData:data,assets:[{id:'hero-art',projectId:project.id,kind:'artwork',name:'Nova approved design',uri:'data:image/png;base64,iVBORw0KGgo=',mimeType:'image/png',pixelWidth:1024,pixelHeight:1536,source:'generated',sourceReference:'Original Nova character art',provider:'fixture-provider',model:'fixture-image',requestId:'image-1',approved,createdAt:'2026-09-01T10:00:00.000Z'}]};const document=composeSpecializedProject(project,project.productionProfiles[0],'2026-09-01T10:01:00.000Z');return{...project,documents:[document]};}

test('TCG card composition keeps approved artwork separate from editable rules text',()=>{const project=projectWithArt(true),surface=project.documents[0].surfaces[0],art=surface.elements.find(element=>element.kind==='image'),rules=surface.elements.find(element=>element.role==='rules');assert.equal(art.assetId,'hero-art');assert.equal(rules.kind,'text');assert.equal(rules.text,'Guard an adjacent ally.');assert.equal(specializedProductionSafetyIssues(project,'svg',project.productionProfiles[0]).some(issue=>issue.code.startsWith('IMAGE_ASSET_')),false);});

test('unapproved generated TCG artwork blocks production instead of leaking into artifact',()=>{const project=projectWithArt(false),issues=specializedProductionSafetyIssues(project,'pdf',project.productionProfiles[0]);assert.ok(issues.some(issue=>issue.code==='IMAGE_ASSET_NOT_APPROVED'&&issue.severity==='error'));});
