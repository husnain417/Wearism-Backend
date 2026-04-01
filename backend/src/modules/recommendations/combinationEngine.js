const MAX_COMBINATIONS = 20;

const NEUTRAL_COLORS = ['black', 'white', 'grey', 'beige', 'navy'];

/**
 * Takes classified wardrobe items, returns outfit combinations.
 * Supports Top + Bottom base and Dress base.
 */
export function generateCombinations(items = [], options = {}) {
    if (!items || items.length === 0) return [];
    
    const { occasion, season, maxCombinations = MAX_COMBINATIONS } = options;

    // 1. Normalize and filter classified items
    const classified = items.filter(item => {
        const slot = item.wardrobe_slot || item.category;
        return slot !== null && slot !== undefined;
    });

    if (classified.length === 0) return [];

    // 2. Season filter
    const matchesSeason = (item) => {
        if (!season) return true;
        const itemSeason = item.season || '';
        const attrs = item.fashionclip_attributes || [];
        return itemSeason === season || 
               itemSeason === 'all_season' || 
               itemSeason === 'all-season' ||
               attrs.includes(season) || 
               attrs.includes('all-season') || 
               attrs.includes('all_season') ||
               (attrs.length === 0 && !item.season);
    };

    const filtered = classified.filter(matchesSeason);

    // 3. Group items by logical slots
    const slots = {
        upper: [],
        lower: [],
        dress: [],
        outer: [],
        footwear: [],
        acc: []
    };

    filtered.forEach(item => {
        const s = (item.wardrobe_slot || item.category || '').toLowerCase();
        if (s === 'upperwear' || s === 'tops') slots.upper.push(item);
        else if (s === 'lowerwear' || s === 'bottoms') slots.lower.push(item);
        else if (s === 'dresses') slots.dress.push(item);
        else if (s === 'outerwear') slots.outer.push(item);
        else if (s === 'footwear' || s === 'shoes') slots.footwear.push(item);
        else slots.acc.push(item);
    });

    const combinations = [];

    // 4. Helper for neutral preference
    const pickBest = (list, baseColors) => {
        if (list.length === 0) return null;
        const hasNeutralBase = baseColors.some(c => NEUTRAL_COLORS.includes(c.toLowerCase()));
        if (hasNeutralBase) return list[0]; // Already safe, any will do
        
        const neutral = list.find(i => 
            (i.colors || []).some(c => NEUTRAL_COLORS.includes(c.toLowerCase()))
        );
        return neutral || list[0];
    };

    // 5. Generate Top + Bottom Combinations
    for (const upper of slots.upper) {
        for (const lower of slots.lower) {
            if (combinations.length >= maxCombinations) break;
            
            const baseColors = [...(upper.colors || []), ...(lower.colors || [])];
            const item_ids = [upper.id, lower.id];

            const out = pickBest(slots.outer, baseColors);
            if (out) item_ids.push(out.id);

            const foot = pickBest(slots.footwear, baseColors);
            if (foot) item_ids.push(foot.id);

            combinations.push({ item_ids, occasion });
        }
    }

    // 6. Generate Dress Combinations
    for (const dress of slots.dress) {
        if (combinations.length >= maxCombinations) break;
        
        const baseColors = dress.colors || [];
        const item_ids = [dress.id];

        const out = pickBest(slots.outer, baseColors);
        if (out) item_ids.push(out.id);

        const foot = pickBest(slots.footwear, baseColors);
        if (foot) item_ids.push(foot.id);

        combinations.push({ item_ids, occasion });
    }

    return combinations;
}

