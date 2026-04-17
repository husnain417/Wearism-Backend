import { randomUUID } from 'node:crypto';
import { supabase } from '../../config/supabase.js';
import { aiQueue } from '../../services/aiQueue.js';
import { syncOutfitPhotoRatingsForUser } from '../../services/outfitPhotoRatingsMaterializer.js';

function toNullIfBlank(value) {
    if (value == null) return null;
    const str = String(value).trim();
    return str === '' ? null : str;
}

export const outfitPhotoRatingsService = {
    async create(userId, body, file) {
        if (!file) throw { statusCode: 400, message: 'Image file is required.' };

        const ratingId = randomUUID();
        const imagePath = `${userId}/outfit-ratings/${ratingId}.jpg`;
        const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);

        const { error: uploadError } = await supabase.storage
            .from('wardrobe')
            .upload(imagePath, buffer, {
                contentType: 'image/jpeg',
                upsert: true,
            });
        if (uploadError) throw uploadError;

        const { data: signedData, error: signedError } = await supabase.storage
            .from('wardrobe')
            .createSignedUrl(imagePath, 60 * 60 * 24 * 365);
        if (signedError) throw signedError;

        const { data: aiResult, error: aiError } = await supabase
            .from('ai_results')
            .insert({
                user_id: userId,
                task_type: 'outfit_photo_rating',
                status: 'pending',
            })
            .select('id')
            .single();
        if (aiError || !aiResult) throw aiError || new Error('Failed to create ai_results row');

        const row = {
            id: ratingId,
            user_id: userId,
            image_url: signedData.signedUrl,
            image_path: imagePath,
            gender: toNullIfBlank(body?.gender) || 'unspecified',
            occasion: toNullIfBlank(body?.occasion) || 'casual',
            weather: toNullIfBlank(body?.weather) || 'mild',
            season: toNullIfBlank(body?.season) || 'spring',
            style_preference: toNullIfBlank(body?.style_preference) || 'any',
            mode_used: toNullIfBlank(body?.mode) || 'heavyweight',
            ai_result_id: aiResult.id,
            status: 'pending',
        };

        const { data: rating, error: ratingError } = await supabase
            .from('outfit_photo_ratings')
            .insert(row)
            .select()
            .single();
        if (ratingError || !rating) throw ratingError || new Error('Failed to create rating row');

        try {
            await aiQueue.queueOutfitPhotoRating({
                ratingId,
                userId,
                imageUrl: signedData.signedUrl,
                aiResultId: aiResult.id,
                gender: row.gender,
                occasion: row.occasion,
                weather: row.weather,
                season: row.season,
                stylePreference: row.style_preference,
                mode: row.mode_used,
            });
        } catch (err) {
            await supabase
                .from('outfit_photo_ratings')
                .update({
                    status: 'failed',
                    error_message: err.message || 'Queueing failed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', ratingId);

            await supabase
                .from('ai_results')
                .update({
                    status: 'failed',
                    error_message: err.message || 'Queueing failed',
                })
                .eq('id', aiResult.id);

            throw { statusCode: 503, message: err.message || 'Failed to queue outfit photo rating.' };
        }

        return rating;
    },

    async listRecent(userId, limit = 5) {
        await syncOutfitPhotoRatingsForUser(userId, 10);

        const { data, error } = await supabase
            .from('outfit_photo_ratings')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    async getOne(userId, ratingId) {
        await syncOutfitPhotoRatingsForUser(userId, 10);

        const { data, error } = await supabase
            .from('outfit_photo_ratings')
            .select('*')
            .eq('id', ratingId)
            .eq('user_id', userId)
            .single();

        if (error || !data) throw { statusCode: 404, message: 'Rating not found.' };
        return data;
    },
};
