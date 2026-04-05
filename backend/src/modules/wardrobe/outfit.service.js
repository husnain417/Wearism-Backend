import { supabase } from '../../config/supabase.js';
import { parsePagination, paginatedResult } from '../../utils/pagination.js';

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
                    wardrobe_items ( id, name, image_url, category, subcategory, colors, fashionclip_main_category )
                )
            `)
            .eq('id', outfitId)
            .eq('user_id', userId)
            .is('deleted_at', null)
            .single();

        if (error) throw { statusCode: 404, message: 'Outfit not found.' };

        // Mobile + clients expect flat `items` (sorted); Supabase returns outfit_items → wardrobe_items
        const rows = data.outfit_items ?? [];
        const items = rows
            .filter((row) => row.wardrobe_items)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((row) => ({ ...row.wardrobe_items }));

        return { ...data, items };
    },

    // ── LIST OUTFITS ──────────────────────────────────────
    async listOutfits(userId, query) {
        const { page, limit, from } = parsePagination(query);
        const { occasion, status } = query;

        let supabaseQuery = supabase
            .from('outfits')
            .select('*, outfit_items(count)', { count: 'exact' })
            .eq('user_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);

        if (occasion) supabaseQuery = supabaseQuery.eq('occasion', occasion);
        if (status) supabaseQuery = supabaseQuery.eq('status', status);

        const { data, error, count } = await supabaseQuery;
        if (error) throw error;

        return paginatedResult(data || [], count || 0, page, limit);
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
