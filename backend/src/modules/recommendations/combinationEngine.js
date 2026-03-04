// src/modules/recommendations/combinationEngine.js

const MAX_COMBINATIONS = 20; // hard cap per refresh

// Categories required for a valid outfit combination
const REQUIRED_CATEGORIES = ['tops', 'bottoms'];
const OPTIONAL_CATEGORIES = ['outerwear', 'footwear', 'accessories'];

// Special handling for dresses — they replace tops + bottoms
const DRESS_CATEGORIES = ['dresses'];

/**
 * Takes classified wardrobe items, returns outfit combinations.
 * Each combination is an array of item IDs.
 *
 * @param {Array} items - wardrobe items (must have id, category, colors, season)
 * @param {Object} options - { occasion, season, maxCombinations }
 * @returns {Array} - array of { item_ids, occasion }
 */
export function generateCombinations(items, options = {}) {
    const { occasion, season, maxCombinations = MAX_COMBINATIONS } = options;

    // Only work with classified items — skip items where AI hasn't run yet
    const classified = items.filter(item => item.category !== null);

    if (classified.length < 2) return [];

    // Group by category
    const byCategory = groupByCategory(classified);

    // Apply season filter if provided
    const filterBySeason = (itemList) => {
        if (!season) return itemList;
        return itemList.filter(i =>
            i.season === season || i.season === 'all_season' || i.season === null
        );
    };

    const combinations = [];

    // ── DRESS COMBINATIONS ─────────────────────────────
    // Dresses replace tops + bottoms entirely
    const dresses = filterBySeason(byCategory['dresses'] || []);
    for (const dress of dresses) {
        if (combinations.length >= maxCombinations) break;

        const combo = { item_ids: [dress.id] };

        // Add optional footwear
        const footwear = filterBySeason(byCategory['footwear'] || []);
        if (footwear.length > 0) {
            combo.item_ids.push(footwear[0].id);
        }

        combinations.push({ item_ids: combo.item_ids, occasion });
    }

    // ── TOP + BOTTOM COMBINATIONS ──────────────────────
    const tops = filterBySeason(byCategory['tops'] || []);
    const bottoms = filterBySeason(byCategory['bottoms'] || []);
    const outerArray = filterBySeason(byCategory['outerwear'] || []);
    const footwearArr = filterBySeason(byCategory['footwear'] || []);

    for (const top of tops) {
        for (const bottom of bottoms) {
            if (combinations.length >= maxCombinations) break;

            const item_ids = [top.id, bottom.id];

            // Optionally add one outerwear item
            if (outerArray.length > 0) {
                // Prefer items whose colours complement the top/bottom
                const compatible = findCompatible(outerArray, [top, bottom]);
                if (compatible) item_ids.push(compatible.id);
            }

            // Optionally add one footwear item
            if (footwearArr.length > 0) {
                item_ids.push(footwearArr[0].id);
            }

            combinations.push({ item_ids, occasion });
        }
        if (combinations.length >= maxCombinations) break;
    }

    return combinations;
}


// ── HELPERS ────────────────────────────────────────────

function groupByCategory(items) {
    return items.reduce((acc, item) => {
        const cat = item.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});
}

// Basic colour compatibility: prefer neutral-with-neutral or
// neutral-with-accent. This is a heuristic — real scoring is done by AI.
const NEUTRALS = ['black', 'white', 'grey', 'beige', 'navy', 'brown'];

function findCompatible(candidates, baseItems) {
    const baseColors = baseItems.flatMap(i => i.colors || []);
    const hasNeutralBase = baseColors.some(c => NEUTRALS.includes(c));

    // If base has neutrals, any outerwear works — return first
    if (hasNeutralBase) return candidates[0];

    // Otherwise prefer neutral outerwear to avoid colour clashes
    const neutral = candidates.find(c =>
        (c.colors || []).some(col => NEUTRALS.includes(col))
    );
    return neutral || candidates[0];
}
