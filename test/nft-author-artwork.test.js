const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const { attachAuthorNftArtwork } = require('../.forge-build/application/nft-author-artwork.js');
const { createNftCollection, generateNftItems, withNftTraitDefinitions } = require('../.forge-build/domain/nft-creation.js');
const { createProject } = require('../.forge-build/domain/project.js');
const { FileNftCreationStore } = require('../.forge-build/infrastructure/file-nft-creation-store.js');
const { FileProjectStore } = require('../.forge-build/infrastructure/file-project-store.js');

test('author NFT artwork requires explicit rights declaration and records provenance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'forge-nft-author-art-'));
  try {
    const projects = new FileProjectStore(root);
    const nftStore = new FileNftCreationStore(join(root, 'nft-creation.json'));
    await projects.create(createProject({ id: 'nft-author-art', title: 'NFT Author Art' }));
    let collection = createNftCollection({
      id: 'collection', forgeProjectId: 'nft-author-art', title: 'Original One', symbol: 'ONE', description: 'Original artwork.',
      collectionType: 'one-of-one', tokenStandard: 'erc-721', chain: 'base', supply: 1, storageMode: 'ipfs', now: '2026-09-04T18:00:00.000Z',
    });
    collection = generateNftItems(withNftTraitDefinitions(collection, [], '2026-09-04T18:00:01.000Z'), '2026-09-04T18:00:02.000Z');
    await nftStore.create(collection);

    await assert.rejects(() => attachAuthorNftArtwork(nftStore, projects, 'nft-author-art', 'collection', '1', {
      imageUri: 'ipfs://bafy/no-rights.png', sourceReference: 'original-master.png', authorDeclaresRights: false,
    }, '2026-09-04T18:00:03.000Z'), /rights\/provenance declaration is required/i);

    const saved = await attachAuthorNftArtwork(nftStore, projects, 'nft-author-art', 'collection', '1', {
      imageUri: 'ipfs://bafy/original.png', animationUrl: 'ipfs://bafy/original.webm', sourceReference: 'original-master.png', authorDeclaresRights: true,
    }, '2026-09-04T18:00:04.000Z');
    assert.equal(saved.items[0].artworkStatus, 'approved');
    assert.equal(saved.items[0].imageUri, 'ipfs://bafy/original.png');
    assert.equal(saved.items[0].animationUrl, 'ipfs://bafy/original.webm');
    assert.match(saved.items[0].sourceAssetId, /^author-nft-/);

    const project = await projects.load('nft-author-art');
    const record = project.memories.find((memory) => memory.relevanceTags?.includes('nft-artwork'));
    assert.ok(record);
    assert.equal(record.authority, 'working');
    assert.equal(record.class, 'production-memory');
    assert.match(record.content, /original-master\.png/);
    assert.match(record.content, /Author explicitly declared/);
    assert.equal(record.provenance[0].kind, 'author');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
