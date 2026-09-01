/* Source-informed children's story challenge discovery. This is an ideation tool, not a diagnostic system. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  let catalogPromise = null;

  function loadCatalog() {
    if (!catalogPromise) catalogPromise = fetch('/children-story-topics.json', { cache: 'no-cache' }).then(async (response) => {
      if (!response.ok) throw new Error(`Children's story topic catalog failed to load (${response.status}).`);
      const catalog = await response.json();
      if (!catalog || catalog.formatVersion !== 1 || !Array.isArray(catalog.categories)) throw new Error("Children's story topic catalog is invalid.");
      const topics = catalog.categories.flatMap((category) => Array.isArray(category.topics) ? category.topics : []);
      if (topics.length !== 100 || new Set(topics).size !== topics.length || catalog.maxItems !== 100) throw new Error("Children's story topic catalog must contain exactly 100 unique topics.");
      return catalog;
    });
    return catalogPromise;
  }

  function isTopicRequest(instruction) {
    const text = String(instruction || '').trim().toLowerCase();
    const audience = /\b(child|children|childrens|children's|kid|kids|heartwood|picture book|middle grade)\b/.test(text);
    const subject = /\b(issue|issues|struggle|struggles|challenge|challenges|topic|topics|theme|themes|problem|problems|experience|experiences)\b/.test(text);
    const action = /\b(list|compile|show|find|give|create|brainstorm|suggest|identify|generate)\b/.test(text);
    return Boolean(text && audience && subject && action);
  }

  function requestedLimit(instruction) {
    const text = String(instruction || '');
    const patterns = [
      /(?:up to|max(?:imum)?(?: of)?|limit(?: of)?|list(?: of)?|give me|show me|compile(?: a)? list(?: of)?)\s+(\d{1,3})\b/i,
      /\b(\d{1,3})\s+(?:common\s+)?(?:children(?:'s)?|child|kid|kids)?\s*(?:issues|struggles|challenges|topics|themes|problems)\b/i,
    ];
    for (const pattern of patterns) { const match = text.match(pattern); if (match) return Math.max(1, Math.min(100, Number(match[1]))); }
    return 100;
  }

  const flatten = (catalog) => catalog.categories.flatMap((category) => category.topics.map((topic) => ({ topic, category: category.label })));
  function render(catalog, instruction) {
    const limit = requestedLimit(instruction), items = flatten(catalog).slice(0, limit), heartwood = /heartwood/i.test(String(instruction || ''));
    const heading = heartwood ? `Heartwood Jungle story-topic list (${items.length})` : `Children's story-topic list (${items.length})`;
    return [heading, '', ...items.map((item, index) => `${index + 1}. ${item.topic} — ${item.category}`), '', heartwood ? `Heartwood framing: ${catalog.heartwoodGuidance}` : catalog.intendedUse, '', `Source basis: ${catalog.sourceBasis.map((source) => source.organization).filter((value, index, values) => values.indexOf(value) === index).join(', ')}.`].join('\n');
  }

  async function runTopicRequest(instruction, { openCommandCenter = false } = {}) {
    if (!isTopicRequest(instruction)) return false;
    const result = $('#fcc-result'), status = $('#fcc-status');
    if (openCommandCenter) window.forgeCommandCenter?.open?.();
    if (status) status.textContent = "Loading the source-informed children's story topic catalog…";
    try {
      const catalog = await loadCatalog(), limit = requestedLimit(instruction);
      if (result) { result.hidden = false; result.textContent = render(catalog, instruction); }
      if (status) status.textContent = `Children's story topic list ready — ${limit} topic${limit === 1 ? '' : 's'}, no diagnosis and no provider required.`;
    } catch (error) {
      if (result) { result.hidden = false; result.textContent = error instanceof Error ? error.message : "Children's story topic discovery failed."; }
      if (status) status.textContent = "Children's story topic discovery failed safely.";
    }
    return true;
  }

  function interceptClick(event, source) {
    const instruction = source(); if (!isTopicRequest(instruction)) return;
    event.preventDefault(); event.stopImmediatePropagation(); void runTopicRequest(instruction, { openCommandCenter: true });
  }
  function bind() {
    $('#fcc-run')?.addEventListener('click', (event) => interceptClick(event, () => $('#fcc-command')?.value || ''), true);
    $('#dashboard-command-run')?.addEventListener('click', (event) => interceptClick(event, () => $('#dashboard-command')?.value || ''), true);
    $('#fcc-command')?.addEventListener('keydown', (event) => {
      if (!(event.key === 'Enter' && (event.ctrlKey || event.metaKey))) return;
      const instruction = $('#fcc-command')?.value || ''; if (!isTopicRequest(instruction)) return;
      event.preventDefault(); event.stopImmediatePropagation(); void runTopicRequest(instruction);
    }, true);
  }

  window.forgeChildrenStoryTopics = { loadCatalog, isTopicRequest, requestedLimit, runTopicRequest };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();
