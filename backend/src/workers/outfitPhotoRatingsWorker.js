import { supabase } from '../config/supabase.js';
import { materializeOutfitPhotoRatingByAiResult } from '../services/outfitPhotoRatingsMaterializer.js';

const POLL_INTERVAL_MS = 5000;

export async function startOutfitPhotoRatingsWorker(logger) {
    logger.info('Outfit photo ratings worker started');

    setInterval(async () => {
        await processOutfitPhotoRatings(logger);
    }, POLL_INTERVAL_MS);
}

async function processOutfitPhotoRatings(logger) {
    try {
        const { data: rows, error } = await supabase
            .from('ai_results')
            .select('id, task_type, status, result, error_message, created_at')
            .eq('task_type', 'outfit_photo_rating')
            .in('status', ['pending', 'processing', 'completed', 'failed'])
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        if (!rows || rows.length === 0) return;

        await Promise.allSettled(rows.map(async (row) => {
            try {
                await materializeOutfitPhotoRatingByAiResult(row);
            } catch (err) {
                logger.error({ err, aiResultId: row.id }, 'Outfit photo rating materialization failed');
            }
        }));
    } catch (err) {
        logger.error({ err }, 'Outfit photo ratings worker poll error');
    }
}
