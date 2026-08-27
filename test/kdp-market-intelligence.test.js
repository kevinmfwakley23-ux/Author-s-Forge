const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../.forge-build');

const disclaimer = 'This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance.';

function fixture() {
  return {
    id: 'market-1', projectId: 'project-1', bookId: 'book-1', question: 'Is this niche promising?', market: 'Cozy mystery', researchedAt: '2026-08-27T12:00:00.000Z',
    evidence: [
      { id: 'e1', source: 'Observed retailer listings', observedAt: '2026-08-27T11:00:00.000Z', observation: 'Multiple recent comparable titles are present.', strength: 'strong' },
      { id: 'e2', source: 'Observed pricing sample', observedAt: '2026-08-27T11:05:00.000Z', observation: 'Comparable prices cluster in a visible range.', strength: 'moderate' }
    ],
    signals: [
      { id: 's1', topic: 'comparable-books', label: 'Comparable activity', observation: 'The market has active comparable titles.', direction: 'positive', evidenceIds: ['e1'] },
      { id: 's2', topic: 'pricing', label: 'Pricing pattern', observation: 'Comparable prices show a measurable pattern.', direction: 'mixed', evidenceIds: ['e2'] }
    ],
    comparableTitles: [{ title: 'Example Mystery', author: 'Example Author', price: 4.99, currency: 'USD', observedAt: '2026-08-27T11:10:00.000Z' }],
    assessment: { level: 'promising', rationale: 'Several observable signals are favorable, but market conditions can change.', signals: ['s1', 's2'], limitations: ['The sample is not a sales forecast.'], disclaimer }
  };
}

test('Mission 018 creates evidence-backed market intelligence without sales guarantees', () => {
  const report = api.createKdpMarketIntelligenceReport(fixture());
  assert.equal(report.formatVersion, 1);
  assert.equal(report.evidence.length, 2);
  assert.equal(report.signals.length, 2);
  assert.equal(report.comparableTitles.length, 1);
  assert.equal(report.assessment.level, 'promising');
  assert.equal(report.assessment.disclaimer, disclaimer);
  assert.match(api.summarizeMarketIntelligence(report), /Promising market signals/);
});

test('Mission 018 rejects unsupported or ungrounded market conclusions', () => {
  assert.throws(() => api.createKdpMarketIntelligenceReport({ ...fixture(), signals: [{ ...fixture().signals[0], evidenceIds: ['missing'] }] }), /references missing evidence/);
  assert.throws(() => api.createKdpMarketIntelligenceReport({ ...fixture(), assessment: { ...fixture().assessment, disclaimer: 'This will sell 10000 copies.' } }), /required non-guarantee disclaimer/);
});

test('Mission 018 persists reports without crossing project boundaries', () => {
  const project = api.createProject({ id: 'project-1', title: 'Book Project', now: '2026-08-27T12:00:00.000Z' });
  const report = api.createKdpMarketIntelligenceReport(fixture());
  const updated = api.withProjectKdpMarketIntelligenceReports(project, [report], '2026-08-27T12:01:00.000Z');
  assert.equal(updated.kdpMarketIntelligenceReports.length, 1);
  assert.equal(updated.kdpMarketIntelligenceReports[0].projectId, 'project-1');
  assert.throws(() => api.withProjectKdpMarketIntelligenceReports(project, [{ ...report, projectId: 'other-project' }]), /belongs to another project/);
});
