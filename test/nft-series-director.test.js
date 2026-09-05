const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createNftCollection,
  generateNftItems,
  attachNftArtwork,
} = require('../.forge-build/domain/nft-creation.js');
const {
  createNftSeries,
  updateNftSeries,
} = require('../.forge-build/domain/nft-series-director.js');
const { createProject } = require('../.forge-build/domain/project.js');
const { createQaReport } = require('../.forge-build/application/nft-series-director.js');

function collection(id, artUri, sourceId) {
  let value = createNftCollection({
    id,
    forgeProjectId: 'forge-nft-series',
    title: id === 'alpha' ? 'Royal Beasts Alpha' : 'Royal Beasts Beta',
    symbol: id === 'alpha' ? 'RBA' : 'RBB',
    description: 'Original heraldic creature artwork.',
    collectionType: 'one-of-one',
    tokenStandard: 'erc-721',
    chain: 'base',
    supply: 1,
    storageMode: 'ipfs',
    royaltyBps: 500,
    audience: 'Collectors of original heraldic fantasy art',
    artisticThesis: 'Heraldic visual language becomes a living creature system.',
    styleGuide: 'Black, ivory and restrained gold; strong silhouette; engraved texture.',
    rightsNote: 'Original author-owned or explicitly AI-generated/provenance-recorded art only.',
    now: '2026-09-04T18:00:00.000Z',
  });
  value = generateNftItems(value, '2026-09-04T18:01:00.000Z');
  return attachNftArtwork(value, '1', { imageUri: artUri, sourceAssetId: sourceId }, '2026-09-04T18:02:00.000Z');
}

test('NFT Series Director validates sets and preserves explicit release rules', () => {
  const series = createNftSeries({
    id: 'royal-beasts-series',
    forgeProjectId: 'forge-nft-series',
    title: 'Royal Beasts',
    thesis: 'One heraldic universe expressed through distinct releases.',
    audience: 'Collectors of original fantasy art',
    collectionIds: ['alpha', 'beta'],
    sets: [{ id: 'genesis', title: 'Genesis Set', collectionIds: ['alpha', 'beta'], releaseOrder: ['alpha', 'beta'], positioningNote: 'Alpha introduces the visual language; Beta expands it.' }],
    rules: { sharedStylePrinciples: ['restrained gold', 'strong silhouette'], provenanceRequirements: ['rights record or author provenance memory'], minimumDaysBetweenDrops: 21, maxConcurrentLaunches: 1 },
    now: '2026-09-04T18:00:00.000Z',
  });
  assert.deepEqual(series.collectionIds, ['alpha', 'beta']);
  assert.equal(series.rules.minimumDaysBetweenDrops, 21);
  assert.equal(series.sets[0].releaseOrder[1], 'beta');
  assert.throws(() => updateNftSeries(series, { sets: [{ id: 'bad', title: 'Bad', collectionIds: ['outside'], releaseOrder: ['outside'], positioningNote: '' }] }), /outside the series/);
});

test('series QA catches duplicate artwork while accepting explicit author provenance', () => {
  const alpha = collection('alpha', 'ipfs://same-art-cid', 'author-nft-alpha');
  const beta = collection('beta', 'ipfs://same-art-cid', 'author-nft-beta');
  const series = createNftSeries({
    id: 'royal-beasts-series', forgeProjectId: 'forge-nft-series', title: 'Royal Beasts',
    thesis: 'One heraldic universe expressed through distinct releases.', audience: 'Collectors of original fantasy art',
    collectionIds: ['alpha', 'beta'],
    sets: [{ id: 'genesis', title: 'Genesis Set', collectionIds: ['alpha', 'beta'], releaseOrder: ['alpha', 'beta'], positioningNote: 'Distinct release roles.' }],
    rules: { sharedStylePrinciples: ['restrained gold'], provenanceRequirements: ['explicit author or AI provenance'], minimumDaysBetweenDrops: 14, maxConcurrentLaunches: 1 },
    now: '2026-09-04T18:00:00.000Z',
  });
  const project = {
    ...createProject({ id: 'forge-nft-series', title: 'NFT Series QA', now: '2026-09-04T18:00:00.000Z' }),
    memories: [
      { id: 'prov-a', relevanceTags: ['nft-artwork', 'alpha', '1'] },
      { id: 'prov-b', relevanceTags: ['nft-artwork', 'beta', '1'] },
    ],
  };
  const report = createQaReport(series, [alpha, beta], project);
  assert.equal(report.errors, 0);
  assert.equal(report.collectionCount, 2);
  assert.equal(report.approvedArtworkCount, 2);
  assert.equal(report.duplicateArtworkGroups.length, 1);
  assert.ok(report.issues.some((entry) => entry.code === 'DUPLICATE_ARTWORK_URI'));
  assert.equal(report.readyForSeriesLaunch, true);
  assert.ok(report.score < 100);
});
