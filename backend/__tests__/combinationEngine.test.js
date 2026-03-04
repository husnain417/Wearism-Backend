import { jest } from '@jest/globals';

// ─────────────────────────────────────────────────────────────
// combinationEngine.test.js
// Pure unit tests — no mocks needed, no DB, no HTTP
// ─────────────────────────────────────────────────────────────

import { generateCombinations } from '../src/modules/recommendations/combinationEngine.js';

// ── Helpers ──────────────────────────────────────────────────
const makeItem = (id, category, colors = ['black'], season = null) => ({
    id,
    category,
    colors,
    season,
});

// ─────────────────────────────────────────────────────────────
describe('combinationEngine — generateCombinations()', () => {

    // ── Empty / too few items ─────────────────────────────────
    describe('guard conditions', () => {
        it('returns [] when items array is empty', () => {
            expect(generateCombinations([])).toEqual([]);
        });

        it('returns [] when only 1 classified item exists', () => {
            const items = [makeItem('t1', 'tops')];
            expect(generateCombinations(items)).toEqual([]);
        });

        it('returns [] when all items have category=null (unclassified)', () => {
            const items = [
                { id: 'x1', category: null, colors: [], season: null },
                { id: 'x2', category: null, colors: [], season: null },
            ];
            expect(generateCombinations(items)).toEqual([]);
        });

        it('returns [] when only bottoms are present (no tops or dresses)', () => {
            const items = [
                makeItem('b1', 'bottoms'),
                makeItem('b2', 'bottoms'),
            ];
            expect(generateCombinations(items)).toEqual([]);
        });
    });

    // ── Top + Bottom combinations ─────────────────────────────
    describe('top + bottom combinations', () => {
        it('generates 1 combo for 1 top + 1 bottom', () => {
            const items = [makeItem('t1', 'tops'), makeItem('b1', 'bottoms')];
            const result = generateCombinations(items);
            expect(result).toHaveLength(1);
            expect(result[0].item_ids).toContain('t1');
            expect(result[0].item_ids).toContain('b1');
        });

        it('generates 4 combos for 2 tops × 2 bottoms', () => {
            const items = [
                makeItem('t1', 'tops'), makeItem('t2', 'tops'),
                makeItem('b1', 'bottoms'), makeItem('b2', 'bottoms'),
            ];
            const result = generateCombinations(items);
            expect(result).toHaveLength(4);
        });

        it('includes occasion in every combination', () => {
            const items = [makeItem('t1', 'tops'), makeItem('b1', 'bottoms')];
            const result = generateCombinations(items, { occasion: 'formal' });
            expect(result[0].occasion).toBe('formal');
        });

        it('occasion is undefined when not provided', () => {
            const items = [makeItem('t1', 'tops'), makeItem('b1', 'bottoms')];
            const result = generateCombinations(items);
            expect(result[0].occasion).toBeUndefined();
        });
    });

    // ── Optional outerwear attachment ─────────────────────────
    describe('outerwear attachment', () => {
        it('adds outerwear to combo when available', () => {
            const items = [
                makeItem('t1', 'tops'),
                makeItem('b1', 'bottoms'),
                makeItem('o1', 'outerwear'),
            ];
            const result = generateCombinations(items);
            expect(result[0].item_ids).toContain('o1');
        });

        it('prefers neutral outerwear when base has no neutrals', () => {
            const items = [
                makeItem('t1', 'tops', ['red']),
                makeItem('b1', 'bottoms', ['green']),
                makeItem('o1', 'outerwear', ['pink']),
                makeItem('o2', 'outerwear', ['black']), // neutral — should be preferred
            ];
            const result = generateCombinations(items);
            // o2 (black) should be picked as it's neutral
            expect(result[0].item_ids).toContain('o2');
            expect(result[0].item_ids).not.toContain('o1');
        });

        it('returns any outerwear when base already has a neutral', () => {
            const items = [
                makeItem('t1', 'tops', ['black']), // neutral base — any outerwear ok
                makeItem('b1', 'bottoms', ['white']),
                makeItem('o1', 'outerwear', ['red']),
            ];
            const result = generateCombinations(items);
            expect(result[0].item_ids).toContain('o1');
        });
    });

    // ── Footwear attachment ───────────────────────────────────
    describe('footwear attachment', () => {
        it('adds footwear to top+bottom combo when available', () => {
            const items = [
                makeItem('t1', 'tops'),
                makeItem('b1', 'bottoms'),
                makeItem('f1', 'footwear'),
            ];
            const result = generateCombinations(items);
            expect(result[0].item_ids).toContain('f1');
        });

        it('adds footwear to dress combo', () => {
            const items = [
                makeItem('d1', 'dresses'),
                makeItem('f1', 'footwear'),
            ];
            const result = generateCombinations(items);
            expect(result[0].item_ids).toContain('d1');
            expect(result[0].item_ids).toContain('f1');
        });
    });

    // ── Dress combinations ────────────────────────────────────
    describe('dress combinations', () => {
        it('generates 1 combo for 1 dress (dress-only, no footwear)', () => {
            const items = [makeItem('d1', 'dresses'), makeItem('d2', 'dresses')];
            // No tops or bottoms — only dress combos
            const result = generateCombinations(items);
            expect(result).toHaveLength(2);
            result.forEach(r => expect(r.item_ids).toHaveLength(1));
        });

        it('generates dress combos AND top+bottom combos in same wardrobe', () => {
            const items = [
                makeItem('d1', 'dresses'),
                makeItem('t1', 'tops'),
                makeItem('b1', 'bottoms'),
            ];
            const result = generateCombinations(items);
            // 1 dress combo + 1 top+bottom combo = 2 total
            expect(result).toHaveLength(2);
        });
    });

    // ── Hard cap ─────────────────────────────────────────────
    describe('max combinations cap', () => {
        it('caps result at 20 by default', () => {
            // 5 tops × 5 bottoms = 25 combos → should be capped at 20
            const items = [
                ...Array.from({ length: 5 }, (_, i) => makeItem(`t${i}`, 'tops')),
                ...Array.from({ length: 5 }, (_, i) => makeItem(`b${i}`, 'bottoms')),
            ];
            const result = generateCombinations(items);
            expect(result).toHaveLength(20);
        });

        it('respects custom maxCombinations option', () => {
            const items = [
                ...Array.from({ length: 4 }, (_, i) => makeItem(`t${i}`, 'tops')),
                ...Array.from({ length: 4 }, (_, i) => makeItem(`b${i}`, 'bottoms')),
            ];
            const result = generateCombinations(items, { maxCombinations: 5 });
            expect(result).toHaveLength(5);
        });
    });

    // ── Season filtering ──────────────────────────────────────
    describe('season filtering', () => {
        it('includes items matching the requested season', () => {
            const items = [
                makeItem('t1', 'tops', ['white'], 'summer'),
                makeItem('b1', 'bottoms', ['black'], 'summer'),
            ];
            const result = generateCombinations(items, { season: 'summer' });
            expect(result).toHaveLength(1);
        });

        it('includes all_season items regardless of filter', () => {
            const items = [
                makeItem('t1', 'tops', ['white'], 'all_season'),
                makeItem('b1', 'bottoms', ['black'], 'summer'),
            ];
            const result = generateCombinations(items, { season: 'summer' });
            expect(result).toHaveLength(1);
        });

        it('includes items with season=null regardless of filter', () => {
            const items = [
                makeItem('t1', 'tops', ['white'], null),
                makeItem('b1', 'bottoms', ['black'], 'summer'),
            ];
            const result = generateCombinations(items, { season: 'summer' });
            expect(result).toHaveLength(1);
        });

        it('excludes items from a different season', () => {
            const items = [
                makeItem('t1', 'tops', ['white'], 'winter'),
                makeItem('b1', 'bottoms', ['black'], 'summer'),
            ];
            // t1 is winter, b1 is summer — no valid top+bottom pair for 'summer'
            const result = generateCombinations(items, { season: 'summer' });
            expect(result).toHaveLength(0);
        });

        it('returns all items when no season filter is set', () => {
            const items = [
                makeItem('t1', 'tops', ['white'], 'winter'),
                makeItem('b1', 'bottoms', ['black'], 'summer'),
            ];
            const result = generateCombinations(items); // no season
            expect(result).toHaveLength(1);
        });
    });

    // ── Mixed: classified + unclassified ─────────────────────
    describe('skips unclassified items', () => {
        it('ignores items with category=null when building combos', () => {
            const items = [
                makeItem('t1', 'tops'),
                makeItem('b1', 'bottoms'),
                { id: 'u1', category: null, colors: [], season: null }, // unclassified
            ];
            const result = generateCombinations(items);
            const allIds = result.flatMap(r => r.item_ids);
            expect(allIds).not.toContain('u1');
        });
    });
});
