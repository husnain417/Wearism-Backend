import { supabase } from '../../config/supabase.js';

export const outfitService = {
    // ── CREATE OUTFIT ─────────────────────────────────────
    async createOutfit(userId, { name, occasion, item_ids, status }) {
        // Validate that ALL item_ids belong to this user
        // Critical security check — prevent adding other users' items to an outfit
        const { data: items, error: itemsError } = await supabase
            .from('wardrobe_items')
            .select('id')
            .in('id', item_ids)
            .eq('user_id', userId)
            .is('deleted_at', null);

        if (itemsError) throw itemsError;

        if (items.length !== item_ids.length) {
            throw { statusCode: 403, message: 'One or more items do not belong to you.' };
        }

        // Create the outfit record
        const { data: outfit, error: outfitError } = await supabase
            .from('outfits')
            .insert({ user_id: userId, name, occasion, status: status || 'saved' })
            .select()
            .single();

        if (outfitError) throw outfitError;

        // Create junction records — one per item, with position
        const outfitItems = item_ids.map((itemId, index) => ({
            outfit_id: outfit.id,
            item_id: itemId,
            position: index,
        }));

        const { error: junctionError } = await supabase
            .from('outfit_items')
            .insert(outfitItems);

        if (junctionError) throw junctionError;

        return outfit;
    },

    // ── GET OUTFIT WITH ITEMS ─────────────────────────────
    async getOutfit(userId, outfitId) {
        const { data, error } = await supabase
            .from('outfits')
            .select(`
                *,
                outfit_items (
                    position,
                    wardrobe_items ( id, name, image_url, category, subcategory, colors )
                )
            `)
            .eq('id', outfitId)
            .eq('user_id', userId)
            .is('deleted_at', null)
            .single();

        if (error) throw { statusCode: 404, message: 'Outfit not found.' };
        return data;
    },

    // ── LIST OUTFITS ──────────────────────────────────────
    async listOutfits(userId, { occasion, status, page, limit }) {
        let query = supabase
            .from('outfits')
            .select('*, outfit_items(count)', { count: 'exact' })
            .eq('user_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (occasion) query = query.eq('occasion', occasion);
        if (status) query = query.eq('status', status);

        const from = (page - 1) * limit;
        query = query.range(from, from + limit - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            outfits: data,
            pagination: { total: count, page, limit, total_pages: Math.ceil(count / limit) },
        };
    },

    // ── UPDATE OUTFIT ─────────────────────────────────────
    async updateOutfit(userId, outfitId, updates) {
        const { item_ids, ...outfitUpdates } = updates;

        // Update outfit metadata
        if (Object.keys(outfitUpdates).length > 0) {
            await supabase.from('outfits')
                .update(outfitUpdates)
                .eq('id', outfitId)
                .eq('user_id', userId);
        }

        // If item_ids provided, replace all outfit items
        if (item_ids) {
            // Validate ownership of all new items
            const { data: items } = await supabase
                .from('wardrobe_items')
                .select('id')
                .in('id', item_ids)
                .eq('user_id', userId)
                .is('deleted_at', null);

            if (items.length !== item_ids.length) {
                throw { statusCode: 403, message: 'One or more items do not belong to you.' };
            }

            // Delete existing items and re-insert
            await supabase.from('outfit_items').delete().eq('outfit_id', outfitId);
            await supabase.from('outfit_items').insert(
                item_ids.map((id, idx) => ({ outfit_id: outfitId, item_id: id, position: idx }))
            );
        }

        return await this.getOutfit(userId, outfitId);
    },

    // ── DELETE OUTFIT ─────────────────────────────────────
    async deleteOutfit(userId, outfitId) {
        const { error } = await supabase
            .from('outfits')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', outfitId)
            .eq('user_id', userId);

        if (error) throw { statusCode: 404, message: 'Outfit not found.' };
        // outfit_items cascade-deleted via FK
    },
};
