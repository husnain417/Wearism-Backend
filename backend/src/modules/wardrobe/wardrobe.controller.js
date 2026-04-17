import { wardrobeService } from './wardrobe.service.js';
import { supabase } from '../../config/supabase.js';
import { aiQueue } from '../../services/aiQueue.js';
import { materializeCompletedClassification } from '../../services/wardrobeMaterializer.js';

export const wardrobeController = {
    // POST /wardrobe/items — accepts multipart/form-data
    async createItem(request, reply) {
        const file = request.body?.file;
        const { item_id, name, brand, condition, purchase_price } = request.body || {};

        // ── STEP 1: Insert wardrobe_items (via wardrobeService) ─────────────────
        console.log(`[Step 1] Inserting wardrobe_items record for item_id: ${item_id}`);
        let item;
        try {
            item = await wardrobeService.createItem(request.user.sub, {
                item_id,
                name,
                brand,
                condition,
                purchase_price: purchase_price ? Number(purchase_price) : undefined,
            }, file);
        } catch (error) {
            console.error(`[Step 1] Failed to insert wardrobe_items:`, error.message || error);
            throw error; // Global error handler catches this and sends 4xx/500
        }

        // Queue AI classification — fire-and-forget so it never blocks the response
        (async () => {
            // ── STEP 2: Insert ai_results ───────────────────────────────────────
            console.log(`[Step 2] Inserting ai_results pending record for item_id: ${item.id}`);
            let aiResultId = null;
            try {
                const { data: aiResult, error: aiError } = await supabase
                    .from('ai_results')
                    .insert({
                        user_id: request.user.sub,
                        wardrobe_item_id: item.id,
                        task_type: 'clothing_classification',
                        status: 'pending',
                        materialized_at: null,
                        materialization_error: null,
                    })
                    .select('id')
                    .single();

                if (aiError || !aiResult) {
                    throw aiError || new Error("No data returned from insert");
                }
                aiResultId = aiResult.id;
            } catch (err) {
                console.error(`[Step 2] Failed to insert ai_results row:`, err.message || err);
                request.log.error({ err }, 'Failed to insert ai_results row');
                return; // Stop background execution: can't queue without ai_result_id
            }

            // ── STEP 3: HTTP call to FastAPI ────────────────────────────────────
            console.log(`[Step 3] Dispatching task to FastAPI Queue for ai_result_id: ${aiResultId}`);
            let success = false;
            try {
                // Attempt 1
                await aiQueue.queueClothingClassification({
                    itemId: item.id,
                    imageUrl: item.image_url,
                    aiResultId: aiResultId,
                });
                success = true;
            } catch (err1) {
                console.warn(`[Step 3] FastAPI call failed on first attempt: ${err1.message}. Retrying in 2 seconds...`);
                // Wait 2 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                try {
                    // Attempt 2
                    console.log(`[Step 3] Attempt 2: Dispatching task to FastAPI Queue...`);
                    await aiQueue.queueClothingClassification({
                        itemId: item.id,
                        imageUrl: item.image_url,
                        aiResultId: aiResultId,
                    });
                    success = true;
                } catch (err2) {
                    console.error(`[Step 3] FastAPI call failed on second attempt:`, err2.message || err2);
                    request.log.error({ err: err2 }, 'AI classification queueing failed completely');
                }
            }

            if (success) {
                console.log(`[Success] Background AI processes successfully initialized!`);
            }
        })();

        return reply.status(201).send({
            success: true,
            message: 'Item added. AI classification queued.',
            item,
            ai_status: 'pending',
        });
    },

    // POST /wardrobe/items/batch — accepts multipart/form-data with multiple images
    async batchCreateItems(request, reply) {
        // Parse item_ids from JSON string sent in the multipart body
        let itemIds;
        try {
            itemIds = JSON.parse(request.body?.item_ids);
        } catch {
            throw { statusCode: 400, message: 'item_ids must be a valid JSON array string.' };
        }

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            throw { statusCode: 400, message: 'item_ids must be a non-empty array.' };
        }

        // Normalise: file field may be a single Buffer or an array of Buffers
        const rawFiles = request.body?.file;
        const files = Array.isArray(rawFiles) ? rawFiles : (rawFiles ? [rawFiles] : []);

        console.log(`[Batch] Creating ${itemIds.length} items for user ${request.user.sub}`);

        let items;
        try {
            items = await wardrobeService.batchCreateItems(request.user.sub, itemIds, files);
        } catch (error) {
            console.error('[Batch] Failed to create items:', error.message || error);
            throw error;
        }

        // Fire background AI jobs for each item — fire-and-forget, never blocks response
        (async () => {
            for (const item of items) {
                try {
                    // Step 2: Insert ai_results pending row
                    const { data: aiResult, error: aiError } = await supabase
                        .from('ai_results')
                        .insert({
                            user_id: request.user.sub,
                            wardrobe_item_id: item.id,
                            task_type: 'clothing_classification',
                            status: 'pending',
                            materialized_at: null,
                            materialization_error: null,
                        })
                        .select('id')
                        .single();

                    if (aiError || !aiResult) throw aiError || new Error('No data from ai_results insert');

                    // Step 3: Queue Celery job (with one retry)
                    let success = false;
                    try {
                        await aiQueue.queueClothingClassification({
                            itemId: item.id,
                            imageUrl: item.image_url,
                            aiResultId: aiResult.id,
                        });
                        success = true;
                    } catch (err1) {
                        console.warn(`[Batch] FastAPI attempt 1 failed for ${item.id}: ${err1.message}. Retrying...`);
                        await new Promise(r => setTimeout(r, 2000));
                        try {
                            await aiQueue.queueClothingClassification({
                                itemId: item.id,
                                imageUrl: item.image_url,
                                aiResultId: aiResult.id,
                            });
                            success = true;
                        } catch (err2) {
                            console.error(`[Batch] FastAPI attempt 2 failed for ${item.id}:`, err2.message);
                        }
                    }

                    if (success) console.log(`[Batch] Queued classification for item ${item.id}`);
                } catch (err) {
                    console.error(`[Batch] Background job setup failed for item ${item.id}:`, err.message || err);
                }
            }
            console.log(`[Batch] Background AI initialised for all ${items.length} items`);
        })();

        return reply.status(201).send({
            success: true,
            message: `${items.length} item(s) added. AI classification queued for all.`,
            items,
            queued: items.length,
        });
    },

    // GET /wardrobe/items
    async listItems(request, reply) {
        const result = await wardrobeService.listItems(request.user.sub, request.query);
        return reply.send(result);
    },

    // GET /wardrobe/items/:id
    async getItem(request, reply) {
        const item = await wardrobeService.getItem(request.user.sub, request.params.id);
        return reply.send({ success: true, item });
    },

    // PATCH /wardrobe/items/:id
    async updateItem(request, reply) {
        const item = await wardrobeService.updateItem(
            request.user.sub,
            request.params.id,
            request.body
        );
        return reply.send({ success: true, item });
    },

    // DELETE /wardrobe/items/:id
    async deleteItem(request, reply) {
        await wardrobeService.deleteItem(request.user.sub, request.params.id);
        return reply.send({ success: true, message: 'Item deleted.' });
    },

    // POST /wardrobe/items/:id/worn
    async markWorn(request, reply) {
        const data = await wardrobeService.markWorn(request.user.sub, request.params.id);
        return reply.send({ success: true, ...data });
    },

    // GET /wardrobe/items/:id/ai-status
    // Mobile polls this to check when classification is done
    async getAiStatus(request, reply) {
        const { data: item } = await supabase
            .from('wardrobe_items')
            .select('id, user_id, source_ai_result_id, source_upload_item_id')
            .eq('id', request.params.id)
            .eq('user_id', request.user.sub)
            .is('deleted_at', null)
            .single();

        if (!item) {
            return reply.send({ success: true, ai: { status: 'not_found' } });
        }

        let data = null;

        // 1) Normal case: ai_result directly linked to this wardrobe row.
        const direct = await supabase
            .from('ai_results')
            .select('id, user_id, task_type, wardrobe_item_id, status, result, error_message, processing_time_ms, materialized_at')
            .eq('wardrobe_item_id', item.id)
            .eq('task_type', 'clothing_classification')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        data = direct.data || null;

        // 2) Materialized segment rows point back to the source ai result.
        if (!data && item.source_ai_result_id) {
            const bySourceAiResult = await supabase
                .from('ai_results')
                .select('id, user_id, task_type, wardrobe_item_id, status, result, error_message, processing_time_ms, materialized_at')
                .eq('id', item.source_ai_result_id)
                .eq('task_type', 'clothing_classification')
                .maybeSingle();

            data = bySourceAiResult.data || null;
        }

        // 3) Fallback to the source upload row, useful if the row was materialized before source_ai_result_id existed.
        if (!data && item.source_upload_item_id && item.source_upload_item_id !== item.id) {
            const bySourceUpload = await supabase
                .from('ai_results')
                .select('id, user_id, task_type, wardrobe_item_id, status, result, error_message, processing_time_ms, materialized_at')
                .eq('wardrobe_item_id', item.source_upload_item_id)
                .eq('task_type', 'clothing_classification')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            data = bySourceUpload.data || null;
        }

        if (data?.status === 'completed' && !data?.materialized_at) {
            try {
                await materializeCompletedClassification(data, request.log);
                const refreshed = await supabase
                    .from('ai_results')
                    .select('id, user_id, task_type, wardrobe_item_id, status, result, error_message, processing_time_ms, materialized_at')
                    .eq('id', data.id)
                    .single();
                return reply.send({ success: true, ai: refreshed.data || data });
            } catch (err) {
                request.log.error({ err, aiResultId: data.id }, 'Opportunistic wardrobe materialization failed');
            }
        }

        return reply.send({ success: true, ai: data || { status: 'not_found' } });
    },

    // POST /wardrobe/items/:id/retry-classification
    // Used by mobile UI to re-trigger the classification job if it fails.
    async retryClassification(request, reply) {
        const itemId = request.params.id;

        const { data: wardrobeItem, error: itemError } = await supabase
            .from('wardrobe_items')
            .select('id, image_url, source_upload_item_id, source_image_url')
            .eq('id', itemId)
            .eq('user_id', request.user.sub)
            .is('deleted_at', null)
            .single();

        if (itemError || !wardrobeItem) {
            return reply.status(404).send({ success: false, message: 'Item not found.' });
        }

        const targetItemId = wardrobeItem.source_upload_item_id || wardrobeItem.id;
        const targetImageUrl = wardrobeItem.source_image_url || wardrobeItem.image_url;

        const { data: aiRow, error: aiError } = await supabase
            .from('ai_results')
            .insert({
                user_id: request.user.sub,
                wardrobe_item_id: targetItemId,
                task_type: 'clothing_classification',
                status: 'pending',
                materialized_at: null,
                materialization_error: null,
            })
            .select('id')
            .single();

        if (aiError || !aiRow) {
            return reply.status(500).send({ success: false, message: 'Failed to create ai_results row.' });
        }

        try {
            await aiQueue.queueClothingClassification({
                itemId: targetItemId,
                imageUrl: targetImageUrl,
                aiResultId: aiRow.id,
            });
        } catch (err) {
            request.log.error({ err }, 'Retry classification queueing failed');
            return reply.status(503).send({ success: false, message: 'Retry queueing failed.' });
        }

        return reply.send({
            success: true,
            ai_status: 'pending',
            ai_result_id: aiRow.id,
        });
    },
};
