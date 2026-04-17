import { supabase } from '../config/supabase.js';

function toJsonbArray(value) {
    return Array.isArray(value) ? value : [];
}

function cleanNullable(value) {
    return value == null ? null : value;
}

async function updateRatingFromAiResult(aiRow) {
    const result = aiRow?.result || {};
    const updates = {
        status: aiRow.status,
        error_message: aiRow.error_message || null,
        mode_used: cleanNullable(result.mode_used),
        rating: cleanNullable(result.rating),
        color_score: cleanNullable(result.color_score),
        proportion_score: cleanNullable(result.proportion_score),
        style_score: cleanNullable(result.style_score),
        compatibility_score: cleanNullable(result.compatibility_score),
        breakdown: cleanNullable(result.breakdown),
        feedback: toJsonbArray(result.feedback),
        strengths: toJsonbArray(result.strengths),
        improvements: toJsonbArray(result.improvements),
        dominant_aesthetic: cleanNullable(result.dominant_aesthetic),
        color_harmony_type: cleanNullable(result.color_harmony_type),
        items_analyzed: cleanNullable(result.items_analyzed),
        num_items: cleanNullable(result.num_items),
        warnings: toJsonbArray(result.warnings),
        latency_s: cleanNullable(result.latency_s),
        model_version: cleanNullable(result.model_version),
        updated_at: new Date().toISOString(),
    };

    await supabase
        .from('outfit_photo_ratings')
        .update(updates)
        .eq('ai_result_id', aiRow.id);
}

export async function materializeOutfitPhotoRatingByAiResult(aiRow) {
    if (!aiRow || aiRow.task_type !== 'outfit_photo_rating') {
        return { skipped: true, reason: 'not_outfit_photo_rating' };
    }

    if (aiRow.status === 'pending' || aiRow.status === 'processing') {
        await supabase
            .from('outfit_photo_ratings')
            .update({
                status: aiRow.status,
                error_message: null,
                updated_at: new Date().toISOString(),
            })
            .eq('ai_result_id', aiRow.id);
        return { updated: true, status: aiRow.status };
    }

    if (aiRow.status === 'completed' || aiRow.status === 'failed') {
        await updateRatingFromAiResult(aiRow);
        return { updated: true, status: aiRow.status };
    }

    return { skipped: true, reason: 'unsupported_status' };
}

export async function syncOutfitPhotoRatingsForUser(userId, limit = 10) {
    const { data: pendingRows, error } = await supabase
        .from('outfit_photo_ratings')
        .select('ai_result_id')
        .eq('user_id', userId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !pendingRows || pendingRows.length === 0) return;

    const aiIds = pendingRows.map((row) => row.ai_result_id).filter(Boolean);
    if (aiIds.length === 0) return;

    const { data: aiRows } = await supabase
        .from('ai_results')
        .select('id, task_type, status, result, error_message')
        .in('id', aiIds);

    for (const aiRow of aiRows || []) {
        await materializeOutfitPhotoRatingByAiResult(aiRow);
    }
}
