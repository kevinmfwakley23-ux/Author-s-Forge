const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('public/index.html', 'utf8');
const app = fs.readFileSync('public/app.js', 'utf8');
const command = fs.readFileSync('public/forge-command-center.js', 'utf8');
const workbench = fs.readFileSync('public/forge-workbench.js', 'utf8');
const server = fs.readFileSync('src/studio-server.ts', 'utf8');
const creativeAgentRoutes = fs.readFileSync('src/application/studio-creative-agent-routes.ts', 'utf8');
const imageLabRoutes = fs.readFileSync('src/application/studio-image-lab-routes.ts', 'utf8');
const publishingPromotionRoutes = fs.readFileSync('src/application/studio-publishing-promotion-routes.ts', 'utf8');

test('Studio loads the command center and additive workbench', () => {
  assert.match(index, /forge-command-center\.js/);
  assert.match(index, /forge-workbench\.js/);
  assert.match(command, /forge-workbench\.js/);
  assert.match(workbench, /Story Architecture/);
  assert.match(workbench, /Intelligent Editing/);
  assert.match(workbench, /Voice & Author Profile/);
  assert.match(workbench, /Cover Studio production geometry/);
  assert.match(workbench, /Project Health/);
  assert.match(workbench, /Versions & Recovery/);
  assert.match(workbench, /provider visibility/);
});

test('core Studio controls have one browser owner', () => {
  for (const id of ['arch-run', 'book-run', 'edit-run', 'voice-run', 'cover-run', 'health-refresh', 'export-project']) {
    assert.match(app, new RegExp(`\\$\\("#${id}"\\)\\?\\.addEventListener`), `${id} must remain owned by app.js`);
    assert.doesNotMatch(workbench, new RegExp(`\\$\\('#${id}'\\)\\?\\.addEventListener`), `${id} must not be rebound by the additive workbench`);
  }
  assert.match(app, /\/cover\/plan/);
  assert.match(workbench, /server-authoritative KDP geometry/);
});

test('Cover Studio exposes real AI creative direction without bypassing author approval', () => {
  assert.match(workbench, /AI Cover Creative Director/);
  assert.match(workbench, /\/agent\/cover-direction/);
  assert.match(workbench, /Nothing was saved or approved/);
  assert.match(workbench, /Apply candidate to cover fields/);
  assert.match(workbench, /Spine text remains title\/author controlled by Cover Studio/);
  assert.match(creativeAgentRoutes, /coverDirection\.propose/);
  assert.match(creativeAgentRoutes, /authorApprovalRequired/);
  assert.match(publishingPromotionRoutes, /createStudioCreativeAgentRoutes/);
  assert.match(publishingPromotionRoutes, /await creativeAgent\(req, res, url, projectId\)/);
});

test('Studio retains real application controls and provider boundaries', () => {
  assert.match(server, /\/api\/projects\/\$\{projectId\}\/ai\/draft/);
  assert.match(imageLabRoutes, /\/api\/projects\/\$\{projectId\}\/ai\/image/);
  assert.match(imageLabRoutes, /\/api\/projects\/\$\{projectId\}\/ai\/images/);
  assert.match(publishingPromotionRoutes, /createStudioImageLabRoutes/);
  assert.match(publishingPromotionRoutes, /await imageLab\(req, res, url, projectId\)/);
  assert.doesNotMatch(server, /if\(url\.pathname===`\/api\/projects\/\$\{projectId\}\/ai\/image`/);
  assert.match(server, /\/api\/projects\/\$\{projectId\}\/export/);
  assert.match(command, /\/api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/ai\/draft/);
  assert.match(command, /SpeechRecognition/);
  assert.match(workbench, /projectUrl\('\/goals'\)/);
});

test('Studio project export remains bound to the canonical package endpoint', () => {
  assert.match(app, /\/package/);
  assert.match(app, /Complete Forge project package downloaded/);
  assert.doesNotMatch(app, /formatVersion:1/);
  assert.doesNotMatch(app, /payload=\{packageName/);
});

test('Studio workbench contains no fake provider result path', () => {
  assert.doesNotMatch(workbench, /mock.*ai|fake.*ai|placeholder.*response/i);
  assert.match(workbench, /Provider failures fail explicitly/);
  assert.match(workbench, /real configured AI provider/);
  assert.match(workbench, /candidate only/i);
});
