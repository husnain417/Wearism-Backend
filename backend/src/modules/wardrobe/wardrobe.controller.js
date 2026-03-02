import { wardrobeService } from './wardrobe.service.js';
import { supabase } from '../../config/supabase.js';
import { aiQueue } from '../../services/aiQueue.js';

export const wardrobeController = {
    // POST /wardrobe/items
    async createItem(request, reply) {
        const item = await wardrobeService.createItem(request.user.sub, request.body);

        // Create pending AI result row in DB
        const { data: aiResult } = await supabase
            .from('ai_results')
            .insert({
                user_id: request.user.sub,
                wardrobe_item_id: item.id,
                task_type: 'clothing_classification',
                status: 'pending',
            })
            .select('id')
            .single();

        // Push to Redis queue — Celery picks this up
        await aiQueue.queueClothingClassification({
            itemId: item.id,
            imageUrl: item.image_url,
            aiResultId: aiResult.id,
        });

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
        return reply.send({ success: true, ...result });
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
