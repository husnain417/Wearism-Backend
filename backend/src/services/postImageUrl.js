import { supabase } from '../config/supabase.js';

export function signedUrlForPostImage(imagePath) {
    if (!imagePath) return null;
    const { data } = supabase.storage
        .from('posts')
        .getPublicUrl(imagePath);
    return data?.publicUrl ?? null;
}
