import { randomUUID } from 'node:crypto';
import { supabase } from '../config/supabase.js';

const SLOT_BY_CATEGORY = {
    tops: 'upperwear',
    top: 'upperwear',
    shirts: 'upperwear',
    shirt: 'upperwear',
    tees: 'upperwear',
    tee: 'upperwear',
    t_shirt: 'upperwear',
    tshirt: 'upperwear',
    sweaters: 'upperwear',
    sweater: 'upperwear',
    hoodies: 'upperwear',
    hoodie: 'upperwear',
    activewear: 'upperwear',
    intimates: 'upperwear',
    bottoms: 'lowerwear',
    bottom: 'lowerwear',
    jeans: 'lowerwear',
    pants: 'lowerwear',
    trousers: 'lowerwear',
    shorts: 'lowerwear',
    skirt: 'lowerwear',
    skirts: 'lowerwear',
    leggings: 'lowerwear',
    dresses: 'lowerwear',
    dress: 'lowerwear',
    outerwear: 'outerwear',
    jacket: 'outerwear',
    jackets: 'outerwear',
    coat: 'outerwear',
    coats: 'outerwear',
    blazer: 'outerwear',
    blazers: 'outerwear',
    accessory: 'accessories',
    accessories: 'accessories',
    jewelry: 'accessories',
    bag: 'accessories',
    bags: 'accessories',
    eyewear: 'accessories',
    hats: 'accessories',
    hat: 'accessories',
    scarves: 'accessories',
    scarf: 'accessories',
    belts: 'accessories',
    belt: 'accessories',
    shoes: 'accessories',
    shoe: 'accessories',
    footwear: 'accessories',
    sneaker: 'accessories',
    sneakers: 'accessories',
    boots: 'accessories',
    boot: 'accessories',
    sandals: 'accessories',
    sandal: 'accessories',
};

const TAG_BY_CATEGORY = {
    tops: 'shirt',
    top: 'shirt',
    shirts: 'shirt',
    shirt: 'shirt',
    tees: 'shirt',
    tee: 'shirt',
    t_shirt: 'shirt',
    tshirt: 'shirt',
    sweaters: 'shirt',
    sweater: 'shirt',
    hoodies: 'shirt',
    hoodie: 'shirt',
    activewear: 'shirt',
    intimates: 'shirt',
    bottoms: 'pants',
    bottom: 'pants',
    jeans: 'pants',
    pants: 'pants',
    trousers: 'pants',
    shorts: 'pants',
    skirt: 'pants',
    skirts: 'pants',
    leggings: 'pants',
    dresses: 'dress',
    dress: 'dress',
    outerwear: 'jacket',
    jacket: 'jacket',
    jackets: 'jacket',
    coat: 'coat',
    coats: 'coat',
    blazer: 'jacket',
    blazers: 'jacket',
    shoe: 'shoes',
    shoes: 'shoes',
    footwear: 'shoes',
    sneaker: 'shoes',
    sneakers: 'shoes',
    boots: 'shoes',
    boot: 'shoes',
    sandals: 'shoes',
    sandal: 'shoes',
    accessory: 'accessories',
    accessories: 'accessories',
    jewelry: 'accessories',
    bag: 'accessories',
    bags: 'accessories',
    eyewear: 'accessories',
    hats: 'accessories',
    hat: 'accessories',
    scarves: 'accessories',
    scarf: 'accessories',
    belts: 'accessories',
    belt: 'accessories',
};

const ACCESSORY_CATEGORIES = new Set([
    'accessory', 'accessories', 'jewelry', 'bag', 'bags', 'eyewear', 'hat', 'hats',
    'scarf', 'scarves', 'belt', 'belts', 'shoe', 'shoes', 'footwear', 'sneaker',
    'sneakers', 'boot', 'boots', 'sandal', 'sandals',
]);

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function titleize(value) {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .trim();
}

function dedupeCompact(values) {
    const seen = new Set();
    const out = [];
    for (const raw of values) {
        const value = titleize(raw);
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
    }
    return out.slice(0, 12);
}

function scoreFromLookup(value, lookup, fallback = 0) {
    const normalized = normalizeText(value);
    if (!normalized) return fallback;
    return lookup[normalized] ?? fallback;
}

function derivePatternStrength(attrs) {
    const contrastScore = scoreFromLookup(attrs?.pattern_contrast, {
        none: 0,
        low: 0.2,
        subtle: 0.25,
        medium: 0.55,
        moderate: 0.55,
        high: 0.85,
        bold: 1,
    });
    const scaleScore = scoreFromLookup(attrs?.pattern_scale, {
        none: 0,
        fine: 0.2,
        small: 0.35,
        medium: 0.6,
        large: 0.85,
        oversized: 1,
    });
    return Number(((contrastScore + scaleScore) / 2).toFixed(3));
}

function deriveTextureScore(attrs) {
    return Number(scoreFromLookup(attrs?.texture_visual, {
        smooth: 0.2,
        soft: 0.35,
        matte: 0.3,
        textured: 0.65,
        woven: 0.6,
        ribbed: 0.7,
        fuzzy: 0.8,
        chunky: 0.85,
        glossy: 0.45,
    }, 0).toFixed(3));
}

function normalizeFormalityScore(value) {
    if (value == null || Number.isNaN(Number(value))) return 0;
    const numeric = Number(value);
    if (numeric <= 1) return Number(numeric.toFixed(3));
    if (numeric <= 5) return Number((numeric / 5).toFixed(3));
    if (numeric <= 10) return Number((numeric / 10).toFixed(3));
    return 1;
}

function buildAttributeArray(attrs = {}) {
    return dedupeCompact([
        ...(Array.isArray(attrs.style_keywords) ? attrs.style_keywords : []),
        ...(Array.isArray(attrs.occasion_tags) ? attrs.occasion_tags : []),
        ...(Array.isArray(attrs.season_tags) ? attrs.season_tags : []),
        ...(Array.isArray(attrs.secondary_colors) ? attrs.secondary_colors : []),
        attrs.pattern,
        attrs.material_estimate,
        attrs.fit,
        attrs.color_family,
        attrs.texture_visual,
    ]);
}

function toSegmentRow({
    userId,
    sourceItem,
    aiResultId,
    segment,
    index,
}) {
    const attrs = segment?.gemma_attributes ?? {};
    const mainCategory = String(attrs?.category || segment?.label || 'unknown').trim() || 'unknown';
    const mainKey = normalizeText(mainCategory);
    const subCategory = String(attrs?.subcategory || '').trim() || null;
    const wardrobeSlot = SLOT_BY_CATEGORY[mainKey] || 'accessories';
    const tag = TAG_BY_CATEGORY[mainKey] || (subCategory ? titleize(subCategory).toLowerCase() : 'accessories');
    const sourceImageUrl = sourceItem?.source_image_url || sourceItem?.image_url || null;
    const sourceImagePath = sourceItem?.source_image_path || sourceItem?.image_path || null;

    return {
        id: index === 0 ? sourceItem.id : randomUUID(),
        user_id: userId,
        image_url: segment?.image_url || sourceItem?.image_url || null,
        image_path: segment?.segmented_image_path || sourceItem?.image_path || null,
        fashionclip_main_category: mainCategory,
        fashionclip_sub_category: subCategory,
        fashionclip_attributes: buildAttributeArray(attrs),
        wardrobe_slot: wardrobeSlot,
        tag,
        is_accessory: ACCESSORY_CATEGORIES.has(mainKey),
        color_dominant_rgb: attrs?.dominant_colors_rgb ?? null,
        pattern_strength: derivePatternStrength(attrs),
        texture_score: deriveTextureScore(attrs),
        formality_score: normalizeFormalityScore(attrs?.formality_score),
        sam_label: segment?.label || null,
        sam_confidence: segment?.sam_confidence ?? null,
        fashionclip_description: segment?.fashionclip_description || null,
        source_ai_result_id: aiResultId,
        source_upload_item_id: sourceItem.id,
        segment_index: index,
        source_image_url: sourceImageUrl,
        source_image_path: sourceImagePath,
        is_source_upload: index === 0,
        deleted_at: null,
    };
}

async function markAiResultMaterialized(aiResultId, errorMessage = null) {
    const updates = {
        materialized_at: new Date().toISOString(),
        materialization_error: errorMessage,
    };
    await supabase
        .from('ai_results')
        .update(updates)
        .eq('id', aiResultId);
}

export async function materializeCompletedClassification(aiRow, logger = console) {
    if (!aiRow || aiRow.status !== 'completed' || aiRow.task_type !== 'clothing_classification') {
        return { skipped: true, reason: 'not_completed_classification' };
    }

    const segments = Array.isArray(aiRow?.result?.segments) ? aiRow.result.segments : [];

    const { data: sourceItem, error: sourceError } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('id', aiRow.wardrobe_item_id)
        .single();

    if (sourceError || !sourceItem) {
        throw new Error(`Source wardrobe item not found for ai_result ${aiRow.id}`);
    }

    if (segments.length <= 1) {
        const first = segments[0];
        if (first?.image_url || first?.segmented_image_path) {
            await supabase
                .from('wardrobe_items')
                .update({
                    image_url: first?.image_url || sourceItem.image_url,
                    image_path: first?.segmented_image_path || sourceItem.image_path,
                    source_ai_result_id: aiRow.id,
                    source_upload_item_id: sourceItem.id,
                    segment_index: 0,
                    source_image_url: sourceItem?.source_image_url || sourceItem?.image_url || null,
                    source_image_path: sourceItem?.source_image_path || sourceItem?.image_path || null,
                    is_source_upload: true,
                    deleted_at: null,
                })
                .eq('id', sourceItem.id);
        }

        await markAiResultMaterialized(aiRow.id, null);
        return { updated: 1, inserted: 0, mode: 'single' };
    }

    const rows = segments.map((segment, index) => toSegmentRow({
        userId: aiRow.user_id,
        sourceItem,
        aiResultId: aiRow.id,
        segment,
        index,
    }));

    const [firstRow, ...otherRows] = rows;
    const { id: _firstRowId, ...firstRowUpdates } = firstRow;

    const { error: firstError } = await supabase
        .from('wardrobe_items')
        .update(firstRowUpdates)
        .eq('id', sourceItem.id);

    if (firstError) throw firstError;

    if (otherRows.length > 0) {
        const { error: upsertError } = await supabase
            .from('wardrobe_items')
            .upsert(otherRows, {
                onConflict: 'source_upload_item_id,segment_index',
            });

        if (upsertError) throw upsertError;
    }

    const staleSegmentIndexes = otherRows.length > 0
        ? otherRows.map((row) => row.segment_index)
        : [];

    const { data: existingRows } = await supabase
        .from('wardrobe_items')
        .select('id, segment_index')
        .eq('source_upload_item_id', sourceItem.id)
        .neq('id', sourceItem.id);

    const staleIds = (existingRows || [])
        .filter((row) => !staleSegmentIndexes.includes(row.segment_index))
        .map((row) => row.id);

    if (staleIds.length > 0) {
        await supabase
            .from('wardrobe_items')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', staleIds);
    }

    await markAiResultMaterialized(aiRow.id, null);

    logger.info?.({
        aiResultId: aiRow.id,
        sourceUploadItemId: sourceItem.id,
        segments: segments.length,
    }, 'Wardrobe AI materialization completed');

    return {
        updated: 1,
        inserted: otherRows.length,
        mode: 'multi',
    };
}

export async function materializeCompletedClassificationById(aiResultId, logger = console) {
    const { data: aiRow, error } = await supabase
        .from('ai_results')
        .select('id, user_id, task_type, status, result, wardrobe_item_id, materialized_at')
        .eq('id', aiResultId)
        .single();

    if (error || !aiRow) {
        throw error || new Error(`ai_result ${aiResultId} not found`);
    }

    return materializeCompletedClassification(aiRow, logger);
}
