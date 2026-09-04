const test = require('node:test');
const assert = require('node:assert/strict');
const { NftMarketIntelligenceService } = require('../.forge-build/application/nft-market-intelligence.js');
const { createNftCollection } = require('../.forge-build/domain/nft-creation.js');

test('NFT Market Signal Lab returns source-backed working evidence without demand prediction', async () => {
  const calls = [];
  const fakeLiveResearch = {
    async research(projectId, input) {
      calls.push({ projectId, input });
      return {
        record: {
          id: 'research-1', projectId, question: input.question, researchedBecause: input.researchedBecause, domain: input.domain, createdAt: '2026-09-04T18:00:00.000Z',
          claims: [
            { id: 'claim-1', projectId, source: 'Marketplace documentation', date: '2026-09-01', url: 'https://example.com/current-nft-tooling', claim: 'Current creator tooling supports scheduled drops and reveal configuration.', confidence: 'high', relevance: 'high', domain: input.domain, researchQuestion: input.question, researchedBecause: input.researchedBecause, createdAt: '2026-09-04T18:00:00.000Z' },
          ],
        },
        persistedMemoryIds: ['research-memory-1'], sourceBacked: true, canonEligible: false, authority: 'working', spendPolicy: 'unrestricted',
      };
    },
  };
  const service = new NftMarketIntelligenceService({}, fakeLiveResearch);
  const collection = createNftCollection({
    id: 'royal-beasts', forgeProjectId: 'forge-project', title: 'Royal Beasts', symbol: 'RBEAST', description: 'Original heraldic fantasy art.',
    collectionType: 'drop', tokenStandard: 'erc-721', chain: 'base', supply: 100, audience: 'Collectors of original fantasy art', artisticThesis: 'Heraldic forms become living creatures.',
  });
  const report = await service.research(collection, 'current reveal, allowlist, and audience signals');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].projectId, 'forge-project');
  assert.equal(calls[0].input.domain, 'market');
  assert.match(calls[0].input.question, /Do not predict token price, investment returns, guaranteed sell-through, or guaranteed demand/);
  assert.equal(report.sourceBacked, true);
  assert.equal(report.authority, 'working');
  assert.equal(report.demandPrediction, false);
  assert.equal(report.investmentAdvice, false);
  assert.equal(report.claims.length, 1);
  assert.equal(report.claims[0].url, 'https://example.com/current-nft-tooling');
  assert.ok(report.positioningQuestions.some((question) => /tested before minting/i.test(question)));
  assert.match(report.note, /does not guarantee demand, sales, liquidity, price appreciation, or investment returns/i);
});
