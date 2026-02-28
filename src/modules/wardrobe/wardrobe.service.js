import { supabase } from '../../config/supabase.js';

export const wardrobeService = {
    // ── CREATE ITEM ──────────────────────────────────────
    async createItem(userId, { item_id, image_path, name, brand, category, condition, purchase_price }) {
        // SECURITY: validate that the image_path starts with the user's own folder
        // Prevents a user from registering another user's uploaded image as their own
        if (!image_path.startsWith(`${userId}/`)) {
            throw { statusCode: 403, message: 'Image path does not belong to this user.' };
        }

        // Wardrobe size limit — prevent storage quota abuse
        const MAX_WARDROBE_SIZE = 500;
        const { count } = await supabase
            .from('wardrobe_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('deleted_at', null);

        if (count >= MAX_WARDROBE_SIZE) {
            throw {
                statusCode: 400,
                message: `Wardrobe limit reached (${MAX_WARDROBE_SIZE} items). Delete some items to add more.`,
            };
        }

        // Generate a signed URL for the stored image
        const { data: signedData, error: signedError } = await supabase.storage
            .from('wardrobe')
            .createSignedUrl(image_path, 60 * 60 * 24 * 365); // 1 year

        if (signedError) throw signedError;

        // Insert wardrobe item — AI fields are null until classification completes
        const { data, error } = await supabase
            .from('wardrobe_items')
            .insert({
                id: item_id, // use the UUID the mobile app generated
                user_id: userId,
                image_url: signedData.signedUrl,
                image_path,
                name: name || null,
                brand: brand || null,
                category: category || null,
                condition: condition || 'good',
                purchase_price: purchase_price || null,
                // AI fields intentionally null — filled by classification worker
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ── GET SINGLE ITEM ───────────────────────────────────
    async getItem(userId, itemId) {
        const { data, error } = await supabase
            .from('wardrobe_items')
            .select('*')
            .eq('id', itemId)
            .eq('user_id', userId) // always scope to the requesting user
            .is('deleted_at', null)
            .single();

        if (error) throw { statusCode: 404, message: 'Item not found.' };
        return data;
    },

    // ── LIST ITEMS (with filters + pagination) ────────────
    async listItems(userId, { category, season, is_favourite, is_for_sale, page, limit }) {
        let query = supabase
            .from('wardrobe_items')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        // Apply optional filters
        if (category) query = query.eq('category', category);
        if (season) query = query.eq('season', season);
        if (is_favourite !== undefined) query = query.eq('is_favourite', is_favourite);
        if (is_for_sale !== undefined) query = query.eq('is_for_sale', is_for_sale);

        // Pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            items: data,
            pagination: {
                total: count,
                page,
                limit,
                total_pages: Math.ceil(count / limit),
            },
        };
    },

    // ── UPDATE ITEM ───────────────────────────────────────
    async updateItem(userId, itemId, updates) {
        // Strip undefined values
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );

        if (Object.keys(cleanUpdates).length === 0) {
            throw { statusCode: 400, message: 'No valid fields provided.' };
        }

        const { data, error } = await supabase
            .from('wardrobe_items')
            .update(cleanUpdates)
            .eq('id', itemId)
            .eq('user_id', userId) // security: only update own items
            .is('deleted_at', null)
            .select()
            .single();

        if (error) throw { statusCode: 404, message: 'Item not found or not yours.' };
        return data;
    },

    // ── DELETE ITEM (soft + storage cleanup) ─────────────
    async deleteItem(userId, itemId) {
        // First fetch to get the image_path for storage deletion
        const { data: item, error: fetchError } = await supabase
            .from('wardrobe_items')
            .select('image_path')
            .eq('id', itemId)
            .eq('user_id', userId)
            .is('deleted_at', null)
            .single();

        if (fetchError) throw { statusCode: 404, message: 'Item not found.' };

        // Soft delete the DB record
        const { error: deleteError } = await supabase
            .from('wardrobe_items')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', itemId)
            .eq('user_id', userId);

        if (deleteError) throw deleteError;

        // Delete the actual image from Supabase Storage
        if (item.image_path) {
            await supabase.storage
                .from('wardrobe')
                .remove([item.image_path]);
        }
    },

    // ── MARK WORN (increment times_worn) ─────────────────
    async markWorn(userId, itemId) {
        const { data, error } = await supabase
            .from('wardrobe_items')
            .update({
                times_worn: supabase.rpc('increment', { row_id: itemId }),
                last_worn_at: new Date().toISOString().split('T')[0],
            })
            .eq('id', itemId)
            .eq('user_id', userId)
            .select('times_worn, last_worn_at')
            .single();

        if (error) throw error;
        return data;
    },

    // ── DELETE ALL USER ITEMS (called on account deletion) ─
    async deleteAllUserItems(userId) {
        // Get all image paths for storage cleanup
        const { data: items } = await supabase
            .from('wardrobe_items')
            .select('image_path')
            .eq('user_id', userId)
            .not('image_path', 'is', null);

        // Delete all images from storage
        if (items && items.length > 0) {
            const paths = items.map(i => i.image_path).filter(Boolean);
            await supabase.storage.from('wardrobe').remove(paths);
        }
        // DB records cascade-deleted automatically via FK
    },
};
