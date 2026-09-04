const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachNftArtwork,
  compileNftMetadata,
  createNftCollection,
  generateNftItems,
  nftCollectionPreflight,
  withNftLaunchPlan,
  withNftTraitDefinitions,
} = require('../.forge-build/domain/nft-creation.js');

function collection(overrides = {}) {
  return createNftCollection({
    id: 'royal-beasts',
    forgeProjectId: 'forge-project',
    title: 'Royal Beasts',
    symbol: 'RBEAST',
    description: 'Original collectible creatures built around heraldic fantasy forms.',
    collectionType: 'generative-series',
    tokenStandard: 'erc-721',
    chain: 'base',
    supply: 6,
    seed: 'locked-seed',
    royaltyBps: 500,
    storageMode: 'ipfs',
    audience: 'Collectors who value coherent original fantasy character design.',
    artisticThesis: 'Every creature feels like a lost royal crest made alive.',
    styleGuide: 'Black marble shadows, restrained gold accents, sculptural silhouettes, no text.',
    lore: 'Six houses compete for the last forge crown.',
    rightsNote: 'Original author-directed and AI-assisted artwork only; source provenance must be recorded.',
    now: '2026-09-04T18:00:00.000Z',
    ...overrides,
  });
}

const traits = [
  { id: 'house', label: 'House', values: [{ value: 'Sun', weight: 5 }, { value: 'Moon', weight: 3 }, { value: 'Ash', weight: 2 }] },
  { id: 'crown', label: 'Crown', values: [{ value: 'Gold', weight: 1 }, { value: 'Obsidian', weight: 1 }, { value: 'None', weight: 2 }] },
];

test('NFT manifest generation is deterministic, unique and rarity-ranked', () => {
  const planned = withNftTraitDefinitions(collection(), traits, '2026-09-04T18:01:00.000Z');
  const first = generateNftItems(planned, '2026-09-04T18:02:00.000Z');
  const second = generateNftItems(planned, '2026-09-04T18:03:00.000Z');
  assert.equal(first.items.length, 6);
  assert.deepEqual(first.items.map((item) => item.attributes), second.items.map((item) => item.attributes));
  const signatures = first.items.map((item) => item.attributes.map((a) => `${a.traitId}:${a.value}`).join('|'));
  assert.equal(new Set(signatures).size, signatures.length);
  assert.deepEqual([...first.items.map((item) => item.rarityRank)].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
});

test('NFT generator refuses an impossible unique trait space', () => {
  const tiny = withNftTraitDefinitions(collection({ supply: 5 }), [
    { id: 'tone', label: 'Tone', values: [{ value: 'Light', weight: 1 }, { value: 'Dark', weight: 1 }] },
  ]);
  assert.throws(() => generateNftItems(tiny), /supports only 2 unique combinations/);
});

test('preflight blocks launch metadata until every token has approved artwork', () => {
  let planned = generateNftItems(withNftTraitDefinitions(collection({ supply: 2 }), [
    { id: 'house', label: 'House', values: [{ value: 'Sun', weight: 1 }, { value: 'Moon', weight: 1 }] },
  ]));
  let report = nftCollectionPreflight(planned);
  assert.equal(report.readyForMetadata, false);
  assert.equal(report.issues.filter((issue) => issue.code === 'ARTWORK_MISSING').length, 2);

  planned = attachNftArtwork(planned, '1', { imageUri: 'ipfs://bafy-one/1.png', sourceAssetId: 'asset-one' });
  planned = attachNftArtwork(planned, '2', { imageUri: 'ipfs://bafy-two/2.png', sourceAssetId: 'asset-two' });
  planned = withNftLaunchPlan(planned, {
    mintType: 'scheduled-drop',
    reveal: 'post-mint',
    phases: [{ name: 'Public', audience: 'Public collectors', allowlistRequired: false }],
    story: 'Reveal the houses after the mint window closes.',
    roadmap: ['Publish the provenance archive'],
    communityPlan: ['Show creation process and trait education'],
  });
  report = nftCollectionPreflight(planned);
  assert.equal(report.errors, 0);
  assert.equal(report.readyForMetadata, true);
  assert.equal(report.readyForLaunchPackage, true);
  assert.ok(report.collectorReadiness >= 90);
});

test('metadata compiler emits marketplace-compatible EVM traits and Metaplex Core properties', () => {
  let evm = generateNftItems(withNftTraitDefinitions(collection({ supply: 1, collectionType: 'one-of-one' }), []));
  evm = attachNftArtwork(evm, '1', { imageUri: 'ipfs://bafy-art/one.png', sourceAssetId: 'asset-one' });
  const evmMetadata = compileNftMetadata(evm, '1');
  assert.equal(evmMetadata.name, 'Royal Beasts');
  assert.equal(evmMetadata.image, 'ipfs://bafy-art/one.png');
  assert.deepEqual(evmMetadata.attributes, []);

  let solana = generateNftItems(withNftTraitDefinitions(collection({ supply: 1, collectionType: 'one-of-one', tokenStandard: 'metaplex-core', chain: 'solana', storageMode: 'arweave' }), []));
  solana = attachNftArtwork(solana, '1', { imageUri: 'https://arweave.net/example.png', sourceAssetId: 'asset-solana' });
  const coreMetadata = compileNftMetadata(solana, '1');
  assert.equal(coreMetadata.properties.category, 'image');
  assert.equal(coreMetadata.properties.files[0].uri, 'https://arweave.net/example.png');
});
