// src/modules/recommendations/recommendations.service.js
import { supabase } from '../../config/supabase.js';
import { aiQueue } from '../../services/aiQueue.js';
import { generateCombinations } from './combinationEngine.js';

const MAX_COMBINATIONS = 20;
const RECOMMENDATION_CACHE_HOURS = 6; // don't regenerate if fresh results exist

export const recommendationsService = {

    // ── GENERATE RECOMMENDATIONS ────────────────────────
    // Called when user requests a refresh or has no recommendations yet
    async generateRecommendations(userId, { occasion, season, weather, sample_size = 25 } = {}) {

        // Check if fresh recommendations already exist
        const cacheThreshold = new Date(
            Date.now() - RECOMMENDATION_CACHE_HOURS * 60 * 60 * 1000
        ).toISOString();

        const { count: freshCount } = await supabase
            .from('recommendations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_dismissed', false)
            .is('deleted_at', null)
            .gte('created_at', cacheThreshold);

        if (freshCount > 0) {
            return { message: 'Recent recommendations exist. Use /recommendations to view them.', generated: 0 };
        }

        // Fetch classified wardrobe items
        const { data: items, error } = await supabase
            .from('wardrobe_items')
            .select('id, wardrobe_slot, fashionclip_attributes')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .not('wardrobe_slot', 'is', null); // only classified items

        if (error) throw error;

        if (!items || items.length < 2) {
            throw {
                statusCode: 400,
                message: 'Not enough classified wardrobe items. Add at least 1 upperwear and 1 lowerwear item.',
            };
        }

        // Generate combinations
        const combinations = generateCombinations(items, {
            occasion,
            season,
            maxCombinations: MAX_COMBINATIONS,
        });

        if (combinations.length === 0) {
            throw {
                statusCode: 400,
                message: 'Could not generate combinations. Ensure you have upperwear and lowerwear items in your wardrobe.',
            };
        }

        // Insert recommendation rows + queue AI rating jobs
        const created = [];

        for (const combo of combinations) {
            // Create recommendation record
            const { data: rec, error: recError } = await supabase
                .from('recommendations')
                .insert({
                    user_id: userId,
                    item_ids: combo.item_ids,
                    occasion: combo.occasion || null,
                    ai_status: 'pending',
                })
                .select('id')
                .single();

            if (recError) continue; // skip failed inserts, don't abort all

            // Create ai_results job
            const { data: aiResult } = await supabase
                .from('ai_results')
                .insert({
                    user_id: userId,
                    task_type: 'outfit_rating',
                    status: 'pending',
                })
                .select('id')
                .single();

            // Update recommendation with ai_result_id
            await supabase
                .from('recommendations')
                .update({ ai_result_id: aiResult.id })
                .eq('id', rec.id);

            // Fetch full item details for the AI rating job
            const { data: itemDetails } = await supabase
                .from('wardrobe_items')
                .select('id, wardrobe_slot, fashionclip_main_category, fashionclip_attributes, color_dominant_rgb, pattern_strength, texture_score, formality_score, is_accessory, tag')
                .in('id', combo.item_ids);

            // Queue AI rating job
            await aiQueue.queueRecommendationRating({
                recommendationId: rec.id,
                items: itemDetails,
                aiResultId: aiResult.id,
                userId,
                season,
                occasion,
                weather,
            });

            created.push(rec.id);
        }

        return {
            message: `${created.length} recommendations generated. AI scoring in progress.`,
            generated: created.length,
            recommendation_ids: created,
        };
    },


    // ── LIST RECOMMENDATIONS ─────────────────────────────
    async listRecommendations(userId, { occasion, status, page, limit }) {
        let query = supabase
            .from('recommendations')
            .select(`
        id, item_ids, occasion,
        ai_rating, ai_color_score, ai_proportion_score,
        ai_style_score, ai_feedback, ai_status,
        is_saved, is_dismissed, saved_outfit_id,
        created_at
      `, { count: 'exact' })
            .eq('user_id', userId)
            .eq('is_dismissed', false)
            .is('deleted_at', null)
            .order('ai_rating', { ascending: false, nullsFirst: false });

        // Filter by occasion
        if (occasion) query = query.eq('occasion', occasion);

        // Filter by status: 'scored' shows only completed AI ratings
        if (status === 'scored') query = query.eq('ai_status', 'completed');
        if (status === 'pending') query = query.eq('ai_status', 'pending');

        const from = (page - 1) * limit;
        query = query.range(from, from + limit - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        // Enrich each recommendation with the full item details
        const enriched = await Promise.all(
            (data || []).map(async (rec) => {
                const { data: items } = await supabase
                    .from('wardrobe_items')
                    .select('id, name, image_url, category, subcategory, colors, brand')
                    .in('id', rec.item_ids);

                return { ...rec, items: items || [] };
            })
        );

        return {
            recommendations: enriched,
            pagination: { total: count, page, limit, total_pages: Math.ceil(count / limit) },
        };
    },


    // ── SAVE RECOMMENDATION ──────────────────────────────
    // Creates a full outfit record from the recommendation
    async saveRecommendation(userId, recommendationId) {
        // Fetch the recommendation
        const { data: rec, error } = await supabase
            .from('recommendations')
            .select('*')
            .eq('id', recommendationId)
            .eq('user_id', userId)        // security: own recommendations only
            .is('deleted_at', null)
            .single();

        if (error) throw { statusCode: 404, message: 'Recommendation not found.' };
        if (rec.is_saved) throw { statusCode: 400, message: 'Already saved.' };

        // Create a proper outfit record
        const { data: outfit, error: outfitError } = await supabase
            .from('outfits')
            .insert({
                user_id: userId,
                name: 'AI Recommendation',
                occasion: rec.occasion,
                status: 'saved',
                ai_rating: rec.ai_rating,
                ai_color_score: rec.ai_color_score,
                ai_proportion_score: rec.ai_proportion_score,
                ai_style_score: rec.ai_style_score,
                ai_feedback: rec.ai_feedback,
            })
            .select('id')
            .single();

        if (outfitError) throw outfitError;

        // Create outfit_items junction records
        await supabase.from('outfit_items').insert(
            rec.item_ids.map((itemId, idx) => ({
                outfit_id: outfit.id,
                item_id: itemId,
                position: idx,
            }))
        );

        // Mark recommendation as saved
        await supabase
            .from('recommendations')
            .update({ is_saved: true, saved_outfit_id: outfit.id })
            .eq('id', recommendationId);

        return { outfit_id: outfit.id };
    },


    // ── UNSAVE RECOMMENDATION ────────────────────────────
    async unsaveRecommendation(userId, recommendationId) {
        const { data: rec, error } = await supabase
            .from('recommendations')
            .select('saved_outfit_id')
            .eq('id', recommendationId)
            .eq('user_id', userId)
            .single();

        if (error) throw { statusCode: 404, message: 'Recommendation not found.' };

        // Soft delete the saved outfit
        if (rec.saved_outfit_id) {
            await supabase
                .from('outfits')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', rec.saved_outfit_id)
                .eq('user_id', userId);
        }

        // Mark recommendation as not saved
        await supabase
            .from('recommendations')
            .update({ is_saved: false, saved_outfit_id: null })
            .eq('id', recommendationId);
    },


    // ── DISMISS RECOMMENDATION ───────────────────────────
    // User doesn't like this combo — hide it
    async dismissRecommendation(userId, recommendationId) {
        const { error } = await supabase
            .from('recommendations')
            .update({ is_dismissed: true })
            .eq('id', recommendationId)
            .eq('user_id', userId);

        if (error) throw { statusCode: 404, message: 'Recommendation not found.' };
    },


    // ── GET SINGLE RECOMMENDATION ────────────────────────
    async getRecommendation(userId, recommendationId) {
        const { data: rec, error } = await supabase
            .from('recommendations')
            .select('*')
            .eq('id', recommendationId)
            .eq('user_id', userId)
            .is('deleted_at', null)
            .single();

        if (error) throw { statusCode: 404, message: 'Recommendation not found.' };

        const { data: items } = await supabase
            .from('wardrobe_items')
            .select('id, name, image_url, category, subcategory, colors, brand, season')
            .in('id', rec.item_ids);

        return { ...rec, items: items || [] };
    },
};
