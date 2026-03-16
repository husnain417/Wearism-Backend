const MAX_COMBINATIONS = 20; // hard cap per refresh

// Slots required for a valid outfit combination
const REQUIRED_SLOTS = ['upperwear', 'lowerwear'];
const OPTIONAL_SLOTS = ['outerwear', 'accessories'];

/**
 * Takes classified wardrobe items, returns outfit combinations.
 * Each combination is an array of item IDs.
 *
 * @param {Array} items - wardrobe items (must have id, wardrobe_slot, fashionclip_attributes)
 * @param {Object} options - { occasion, season, maxCombinations }
 * @returns {Array} - array of { item_ids, occasion }
 */
export function generateCombinations(items, options = {}) {
    const { occasion, season, maxCombinations = MAX_COMBINATIONS } = options;

    // Only work with classified items — skip items where AI hasn't run yet
    const classified = items.filter(item => item.wardrobe_slot !== null);

    if (classified.length < 2) return [];

    // Group by slot
    const bySlot = groupBySlot(classified);

    // Season filter — check FashionCLIP attributes
    const filterBySeason = (itemList) => {
        if (!season) return itemList;
        return itemList.filter(i => {
            const attrs = i.fashionclip_attributes || [];
            return attrs.includes(season) ||
                attrs.includes('all-season') ||
                attrs.includes('all_season') ||
                attrs.length === 0; // unclassified or missing attrs — include anyway
        });
    };

    const upperwear = filterBySeason(bySlot['upperwear'] || []);
    const lowerwear = filterBySeason(bySlot['lowerwear'] || []);
    const outerwear = filterBySeason(bySlot['outerwear'] || []);
    const accessories = filterBySeason(bySlot['accessories'] || []);

    if (upperwear.length === 0 || lowerwear.length === 0) {
        return []; // Caller handles error mapping
    }

    const combinations = [];

    // Simple nested loop to generate combinations: Top + Bottom + [Outerwear] + [Accessory]
    for (const top of upperwear) {
        for (const bottom of lowerwear) {
            if (combinations.length >= maxCombinations) break;

            const item_ids = [top.id, bottom.id];

            // Optionally add one outerwear item
            if (outerwear.length > 0) {
                // Heuristic: pick one (could be randomized or color-matched later)
                item_ids.push(outerwear[Math.floor(Math.random() * outerwear.length)].id);
            }

            // Optionally add one accessory/shoes (everything in accessories slot)
            if (accessories.length > 0) {
                item_ids.push(accessories[Math.floor(Math.random() * accessories.length)].id);
            }

            combinations.push({ item_ids, occasion });
        }
        if (combinations.length >= maxCombinations) break;
    }

    return combinations;
}


// ── HELPERS ────────────────────────────────────────────

function groupBySlot(items) {
    return items.reduce((acc, item) => {
        const slot = item.wardrobe_slot || 'accessories';
        if (!acc[slot]) acc[slot] = [];
        acc[slot].push(item);
        return acc;
    }, {});
}

