import { supabase } from '../../config/supabase.js';
import { parsePagination, paginatedResult } from '../../utils/pagination.js';

export const wardrobeService = {
    // ── CREATE ITEM ──────────────────────────────────────
    async createItem(userId, { item_id, name, brand, condition, purchase_price }, file) {
        // item_id is required — the mobile generates it as a UUID before sending
        if (!item_id) throw { statusCode: 400, message: 'item_id is required.' };

        // Derive the storage path — always owned by this user
        const image_path = `${userId}/${item_id}.jpg`;

        // Upload the image to Supabase Storage (bucket: wardrobe)
        if (file) {
            const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
            const { error: uploadError } = await supabase.storage
                .from('wardrobe')
                .upload(image_path, buffer, {
                    contentType: 'image/jpeg',
                    upsert: true,
                });
            if (uploadError) throw uploadError;
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

        // Generate a signed URL for the stored image (1-year TTL)
        const { data: signedData, error: signedError } = await supabase.storage
            .from('wardrobe')
            .createSignedUrl(image_path, 60 * 60 * 24 * 365);

        if (signedError) throw signedError;

        // Insert wardrobe item — AI fields are null until classification completes
        const { data, error } = await supabase
            .from('wardrobe_items')
            .insert({
                id: item_id,
                user_id: userId,
                image_url: signedData.signedUrl,
                image_path,
                name: name || null,
                brand: brand || null,
                condition: condition || 'good',
                purchase_price: purchase_price || null,
                wardrobe_slot: null,
                fashionclip_main_category: null,
                fashionclip_sub_category: null,
                fashionclip_attributes: null,
                is_accessory: false,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ── BATCH CREATE ITEMS ────────────────────────────────
    async batchCreateItems(userId, itemIds, files) {
        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            throw { statusCode: 400, message: 'item_ids must be a non-empty array.' };
        }
        if (itemIds.length > 20) {
            throw { statusCode: 400, message: 'Maximum 20 items per batch.' };
        }
        if (files.length !== itemIds.length) {
            throw { statusCode: 400, message: `Expected ${itemIds.length} files but received ${files.length}.` };
        }

        // Wardrobe size limit — check upfront for the whole batch
        const MAX_WARDROBE_SIZE = 500;
        const { count } = await supabase
            .from('wardrobe_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('deleted_at', null);

        if ((count || 0) + itemIds.length > MAX_WARDROBE_SIZE) {
            throw {
                statusCode: 400,
                message: `Wardrobe limit would be exceeded. You have ${count} items; limit is ${MAX_WARDROBE_SIZE}.`,
            };
        }

        // Upload each image and prepare DB rows
        const rows = [];
        for (let i = 0; i < itemIds.length; i++) {
            const item_id = itemIds[i];
            const file = files[i];
            const image_path = `${userId}/${item_id}.jpg`;

            if (file) {
                const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
                const { error: uploadError } = await supabase.storage
                    .from('wardrobe')
                    .upload(image_path, buffer, { contentType: 'image/jpeg', upsert: true });
                if (uploadError) throw uploadError;
            }

            const { data: signedData, error: signedError } = await supabase.storage
                .from('wardrobe')
                .createSignedUrl(image_path, 60 * 60 * 24 * 365);
            if (signedError) throw signedError;

            rows.push({
                id: item_id,
                user_id: userId,
                image_url: signedData.signedUrl,
                image_path,
                condition: 'good',
            });
        }

        // Single batch insert for all rows
        const { data, error } = await supabase
            .from('wardrobe_items')
            .insert(rows)
            .select();

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
    async listItems(userId, query) {
        const { page, limit, from } = parsePagination(query);
        const { slot, season, is_favourite, is_for_sale } = query;

        let supabaseQuery = supabase
            .from('wardrobe_items')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);

        // Apply optional filters
        if (slot) supabaseQuery = supabaseQuery.eq('wardrobe_slot', slot);
        if (season) supabaseQuery = supabaseQuery.eq('season', season);
        if (is_favourite !== undefined) supabaseQuery = supabaseQuery.eq('is_favourite', is_favourite);
        if (is_for_sale !== undefined) supabaseQuery = supabaseQuery.eq('is_for_sale', is_for_sale);

        const { data, error, count } = await supabaseQuery;
        if (error) throw error;

        return paginatedResult(data || [], count || 0, page, limit);
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
