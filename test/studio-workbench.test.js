const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('public/index.html', 'utf8');
const app = fs.readFileSync('public/app.js', 'utf8');
const command = fs.readFileSync('public/forge-command-center.js', 'utf8');
const workbench = fs.readFileSync('public/forge-workbench.js', 'utf8');
const server = fs.readFileSync('src/studio-server.ts', 'utf8');
const imageLabRoutes = fs.readFileSync('src/application/studio-image-lab-routes.ts', 'utf8');
const publishingPromotionRoutes = fs.readFileSync('src/application/studio-publishing-promotion-routes.ts', 'utf8');

test('Studio loads the command center and integrated workbench', () => {
  assert.match(index, /forge-command-center\.js/);
  assert.match(command, /forge-workbench\.js/);
  assert.match(workbench, /Story Architecture/);
  assert.match(workbench, /Intelligent Editing/);
  assert.match(workbench, /Voice & Author Profile/);
  assert.match(workbench, /Cover Studio/);
  assert.match(workbench, /Project Health/);
  assert.match(workbench, /Versions & Recovery/);
  assert.match(workbench, /Provider & Studio Settings/);
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
  assert.match(workbench, /\/api\/projects\/\$\{projectId\}\/memory/);
});

test('Studio project export is bound to the canonical v2 package endpoint', () => {
  assert.match(workbench, /api\(projectUrl\('\/package'\)\)/);
  assert.match(workbench, /pkg\.manifest\?\.formatVersion/);
  assert.doesNotMatch(workbench, /formatVersion:1/);
  assert.doesNotMatch(workbench, /payload=\{packageName/);
});

test('Studio workbench contains no fake provider result path', () => {
  assert.doesNotMatch(workbench, /mock.*ai|fake.*ai|placeholder.*response/i);
  assert.match(workbench, /api\(projectUrl\('\/ai\/architecture'\)/);
  assert.match(workbench, /Project-Brain-aware architecture candidate returned/);
  assert.match(workbench, /Nothing was added to manuscript or canon; review and approve the plan before applying it/);
  assert.match(workbench, /fails explicitly/);
});
