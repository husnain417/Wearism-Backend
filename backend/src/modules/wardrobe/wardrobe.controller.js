import { wardrobeService } from './wardrobe.service.js';
import { supabase } from '../../config/supabase.js';
import { aiQueue } from '../../services/aiQueue.js';

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
        const { data } = await supabase
            .from('ai_results')
            .select('status, result, error_message, processing_time_ms')
            .eq('wardrobe_item_id', request.params.id)
            .eq('task_type', 'clothing_classification')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        return reply.send({ success: true, ai: data || { status: 'not_found' } });
    },
};
