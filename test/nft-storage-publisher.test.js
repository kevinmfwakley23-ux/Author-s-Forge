const test = require('node:test');
const assert = require('node:assert/strict');
const { createProject } = require('../.forge-build/domain/project.js');
const { createNftCollection, generateNftItems, attachNftArtwork } = require('../.forge-build/domain/nft-creation.js');
const { NftStoragePublisherService } = require('../.forge-build/application/nft-storage-publisher.js');

function readyCollection() {
  let collection = createNftCollection({
    id: 'pinata-test', forgeProjectId: 'forge-pinata', title: 'Pinata Test', symbol: 'PTEST', description: 'Storage adapter test.',
    collectionType: 'one-of-one', tokenStandard: 'erc-721', chain: 'base', supply: 1, storageMode: 'ipfs', royaltyBps: 0,
    audience: 'Test collectors', artisticThesis: 'Test original art', styleGuide: 'Consistent test style', rightsNote: 'Author owns the test image.',
    now: '2026-09-04T18:00:00.000Z',
  });
  collection = generateNftItems(collection, '2026-09-04T18:01:00.000Z');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlMZtQAAAAASUVORK5CYII=';
  return attachNftArtwork(collection, '1', { imageUri: png, sourceAssetId: 'author-nft-test' }, '2026-09-04T18:02:00.000Z');
}

test('IPFS publisher plans honestly and refuses execution without configured Pinata JWT', async () => {
  const collection = readyCollection();
  const project = createProject({ id: 'forge-pinata', title: 'Pinata project', now: '2026-09-04T18:00:00.000Z' });
  const projects = { load: async () => project, save: async () => {}, create: async () => {}, exists: async () => true };
  const service = new NftStoragePublisherService(projects, {});
  const plan = service.plan(collection, {});
  assert.equal(plan.configured, false);
  assert.equal(plan.mediaUploadsRequired, 1);
  assert.equal(plan.estimatedUploads, 3);
  await assert.rejects(() => service.publish(collection, { execute: true, confirmExternalPublish: true }), /PINATA_JWT is not configured/);
});

test('IPFS publisher verifies provider CIDs and records a verified Project Brain receipt', async () => {
  const collection = readyCollection();
  let project = createProject({ id: 'forge-pinata', title: 'Pinata project', now: '2026-09-04T18:00:00.000Z' });
  const projects = {
    load: async () => project,
    save: async (value) => { project = value; },
    create: async () => {},
    exists: async () => true,
  };
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    const cid = `bafy-test-${calls.length}`;
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: { cid } }) };
  };
  const service = new NftStoragePublisherService(projects, { PINATA_JWT: 'unit-test-jwt' }, fakeFetch);
  const receipt = await service.publish(collection, { execute: true, confirmExternalPublish: true });
  assert.equal(receipt.provider, 'pinata-public-ipfs');
  assert.equal(receipt.media[0].uri, 'ipfs://bafy-test-1');
  assert.equal(receipt.metadata[0].uri, 'ipfs://bafy-test-2');
  assert.equal(receipt.manifest.uri, 'ipfs://bafy-test-3');
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.url === 'https://uploads.pinata.cloud/v3/files'));
  const saved = project.memories.find((memory) => memory.relevanceTags.includes('pinata'));
  assert.ok(saved);
  assert.equal(saved.authority, 'verified');
  assert.match(saved.content, /bafy-test-3/);
});

test('IPFS publisher refuses to silently ingest remote HTTP artwork', () => {
  let collection = createNftCollection({
    id: 'remote-art', forgeProjectId: 'forge-pinata', title: 'Remote Art', symbol: 'REMOTE', description: 'Remote art test.',
    collectionType: 'one-of-one', tokenStandard: 'erc-721', chain: 'base', supply: 1, storageMode: 'ipfs', audience: 'Audience', artisticThesis: 'Thesis', styleGuide: 'Style', rightsNote: 'Rights note',
  });
  collection = generateNftItems(collection);
  collection = attachNftArtwork(collection, '1', { imageUri: 'https://example.com/art.png', sourceAssetId: 'author-nft-remote' });
  const service = new NftStoragePublisherService({ load: async () => null, save: async () => {}, create: async () => {}, exists: async () => false }, { PINATA_JWT: 'jwt' });
  const plan = service.plan(collection, {});
  assert.equal(plan.blockedRemoteMedia, 1);
});
