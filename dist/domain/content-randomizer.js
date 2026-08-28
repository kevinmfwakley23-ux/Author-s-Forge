"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTENT_RANDOMIZER_FORMAT_VERSION = void 0;
exports.randomizeContent = randomizeContent;
exports.validateRandomizerResult = validateRandomizerResult;
exports.CONTENT_RANDOMIZER_FORMAT_VERSION = 1;
const text = (v, label) => { if (typeof v !== "string" || !v.trim())
    throw new Error(`${label} is required.`); return v.trim(); };
function validateItems(items) { const ids = new Set(); return items.map(i => { const id = text(i.id, "Item id"); if (ids.has(id))
    throw new Error(`Duplicate item id "${id}".`); ids.add(id); return { id, category: text(i.category, "Item category"), content: text(i.content, "Item content"), ...(i.tags ? { tags: i.tags.map(x => text(x, "Item tag")) } : {}) }; }); }
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function randomizeContent(input) { if (!Number.isInteger(input.setCount) || input.setCount < 1)
    throw new Error("setCount must be a positive integer."); if (!Number.isInteger(input.itemsPerSet) || input.itemsPerSet < 1)
    throw new Error("itemsPerSet must be a positive integer."); const items = validateItems(input.sourceItems); const seed = input.seed ?? Date.now(); const previous = new Set((input.previousSets ?? []).map(s => s.itemIds.join("|"))); const rnd = mulberry32(seed); const available = [...items]; const sets = []; const globallyUsed = new Set(); for (let s = 0; s < input.setCount; s++) {
    const pool = input.avoidDuplicateItemsAcrossSets ? [...available.filter(i => !globallyUsed.has(i.id))] : [...available];
    if (pool.length < input.itemsPerSet)
        throw new Error("The item pool cannot satisfy the requested number of unique items.");
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected = [];
    if (input.balanceCategories) {
        const groups = new Map();
        for (const item of pool) {
            const group = groups.get(item.category) ?? [];
            group.push(item);
            groups.set(item.category, group);
        }
        const categories = [...groups.keys()];
        let cursor = 0;
        while (selected.length < input.itemsPerSet) {
            const category = categories[cursor++ % categories.length];
            const group = groups.get(category);
            const item = group.shift();
            if (item)
                selected.push(item);
            if (cursor > categories.length * items.length)
                break;
        }
    }
    else
        selected.push(...pool.slice(0, input.itemsPerSet));
    if (selected.length < input.itemsPerSet)
        throw new Error("Unable to balance the requested set.");
    const itemIds = selected.map(i => i.id);
    const key = itemIds.join("|");
    if (previous.has(key)) {
        s--;
        if (s > 1000)
            throw new Error("Unable to generate a set different from previous combinations.");
        continue;
    }
    for (const id of itemIds)
        globallyUsed.add(id);
    sets.push({ id: `set-${s + 1}`, itemIds, categories: [...new Set(selected.map(i => i.category))], seed: Math.floor(rnd() * 0xFFFFFFFF) });
} return { formatVersion: exports.CONTENT_RANDOMIZER_FORMAT_VERSION, sets, usedItemIds: [...globallyUsed], seed }; }
function validateRandomizerResult(result) { if (result.formatVersion !== exports.CONTENT_RANDOMIZER_FORMAT_VERSION)
    throw new Error("Unsupported content randomizer format version."); if (!Number.isInteger(result.seed))
    throw new Error("Randomizer seed must be an integer."); const ids = new Set(); for (const set of result.sets) {
    text(set.id, "Set id");
    if (ids.has(set.id))
        throw new Error(`Duplicate set id "${set.id}".`);
    ids.add(set.id);
    if (!Array.isArray(set.itemIds) || set.itemIds.length === 0)
        throw new Error("Randomizer sets require item ids.");
} return JSON.parse(JSON.stringify(result)); }
//# sourceMappingURL=content-randomizer.js.map