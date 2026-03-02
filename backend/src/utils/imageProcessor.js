import sharp from 'sharp';

export const imageProcessor = {
    // Compress and resize avatar
    // Input: raw buffer from mobile upload (any format, any size)
    // Output: WebP buffer, max 400x400, under ~50KB
    async processAvatar(inputBuffer) {
        return await sharp(inputBuffer)
            .resize(400, 400, {
                fit: 'cover', // crop to fill, not stretch
                position: 'top', // bias toward face (top of image)
            })
            .webp({ quality: 80 }) // convert to WebP, 80% quality
            .toBuffer();
    },

    // Compress wardrobe item images (used in Phase 3)
    // Wider aspect ratio preserved for clothing photos
    async processWardrobeImage(inputBuffer) {
        return await sharp(inputBuffer)
            .resize(800, 1000, {
                fit: 'inside', // shrink to fit, preserve aspect ratio
                withoutEnlargement: true, // never upscale small images
            })
            .webp({ quality: 82 })
            .toBuffer();
    },
};
