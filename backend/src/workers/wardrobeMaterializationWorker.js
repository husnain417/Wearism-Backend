import { supabase } from '../config/supabase.js';
import { materializeCompletedClassification } from '../services/wardrobeMaterializer.js';

const POLL_INTERVAL_MS = 5000;

export async function startWardrobeMaterializationWorker(logger) {
    logger.info('Wardrobe materialization worker started');

    setInterval(async () => {
        await processCompletedAiResults(logger);
    }, POLL_INTERVAL_MS);
}

async function processCompletedAiResults(logger) {
    try {
        const { data: rows, error } = await supabase
            .from('ai_results')
            .select('id, user_id, task_type, status, result, wardrobe_item_id, materialized_at')
            .eq('task_type', 'clothing_classification')
            .eq('status', 'completed')
            .is('materialized_at', null)
            .order('created_at', { ascending: true })
            .limit(10);

        if (error) throw error;
        if (!rows || rows.length === 0) return;

        await Promise.allSettled(rows.map(async (row) => {
            try {
                await materializeCompletedClassification(row, logger);
            } catch (err) {
                logger.error({ err, aiResultId: row.id }, 'Wardrobe AI materialization failed');
                await supabase
                    .from('ai_results')
                    .update({ materialization_error: err.message || String(err) })
                    .eq('id', row.id);
            }
        }));
    } catch (err) {
        logger.error({ err }, 'Wardrobe materialization worker poll error');
    }
}
