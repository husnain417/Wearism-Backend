// src/workers/classificationWorker.js
// Background worker that polls ai_results for pending clothing classification jobs
// For FYP scope, polling is clean and sufficient — production would use Redis + BullMQ

import { supabase } from '../config/supabase.js';
import { aiService } from '../services/aiService.js';

const POLL_INTERVAL = 5000; // check for new jobs every 5 seconds

export async function startClassificationWorker(logger) {
    logger.info('Classification worker started');

    setInterval(async () => {
        await processPendingJobs(logger);
    }, POLL_INTERVAL);
}

async function processPendingJobs(logger) {
    try {
        // Fetch pending clothing classification jobs
        const { data: jobs, error } = await supabase
            .from('ai_results')
            .select('id, user_id, wardrobe_item_id')
            .eq('task_type', 'clothing_classification')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(5); // process up to 5 at a time

        if (error || !jobs || jobs.length === 0) return;

        // Process each job
        await Promise.allSettled(jobs.map(job => processJob(job, logger)));
    } catch (err) {
        logger.error({ err }, 'Worker poll error');
    }
}

async function processJob(job, logger) {
    const startTime = Date.now();

    try {
        // Mark as processing
        await supabase.from('ai_results')
            .update({ status: 'processing' })
            .eq('id', job.id);

        // Get the wardrobe item's image URL
        const { data: item } = await supabase
            .from('wardrobe_items')
            .select('image_url')
            .eq('id', job.wardrobe_item_id)
            .single();

        if (!item) throw new Error('Wardrobe item not found');

        // Call FastAPI
        const result = await aiService.classifyClothing(item.image_url);

        // Update the wardrobe item with AI classification results
        await supabase.from('wardrobe_items').update({
            category: result.category || null,
            subcategory: result.subcategory || null,
            colors: result.colors || [],
            pattern: result.pattern || null,
            fit: result.fit || null,
            fabric: result.fabric || null,
            season: result.season || null,
            embedding: result.embedding || null,
        }).eq('id', job.wardrobe_item_id);

        // Mark AI result as completed
        await supabase.from('ai_results').update({
            status: 'completed',
            result: result,
            processing_time_ms: Date.now() - startTime,
            model_version: result.model_version || '1.0',
        }).eq('id', job.id);

        logger.info({ jobId: job.id }, 'Classification completed');
    } catch (err) {
        logger.error({ jobId: job.id, err: err.message }, 'Classification failed');

        // Mark as failed
        await supabase.from('ai_results').update({
            status: 'failed',
            error_message: err.message,
            processing_time_ms: Date.now() - startTime,
        }).eq('id', job.id);
    }
}
