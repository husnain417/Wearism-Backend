import { outfitService } from './outfit.service.js';
import { supabase } from '../../config/supabase.js';
import { aiQueue } from '../../services/aiQueue.js';

export const outfitController = {
    async createOutfit(request, reply) {
        const outfit = await outfitService.createOutfit(request.user.sub, request.body);

        // Create pending AI result row in DB
        const { data: aiResult } = await supabase
            .from('ai_results')
            .insert({
                user_id: request.user.sub,
                outfit_id: outfit.id,
                task_type: 'outfit_rating',
                status: 'pending',
            })
            .select('id')
            .single();

        // Push to Redis queue — Celery picks this up
        await aiQueue.queueOutfitRating({
            outfitId: outfit.id,
            aiResultId: aiResult.id,
        });

        return reply.status(201).send({
            success: true,
            message: 'Outfit created. AI rating queued.',
            outfit,
            ai_status: 'pending',
        });
    },

    async listOutfits(request, reply) {
        const result = await outfitService.listOutfits(request.user.sub, request.query);
        return reply.send({ success: true, ...result });
    },

    async getOutfit(request, reply) {
        const outfit = await outfitService.getOutfit(request.user.sub, request.params.id);
        return reply.send({ success: true, outfit });
    },

    async updateOutfit(request, reply) {
        const outfit = await outfitService.updateOutfit(
            request.user.sub,
            request.params.id,
            request.body
        );
        return reply.send({ success: true, outfit });
    },

    async deleteOutfit(request, reply) {
        await outfitService.deleteOutfit(request.user.sub, request.params.id);
        return reply.send({ success: true, message: 'Outfit deleted.' });
    },
};
