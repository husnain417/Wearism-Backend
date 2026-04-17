export const createStorySchema = {
    body: {
        type: 'object',
        required: ['story_id', 'image_path'],
        properties: {
            story_id: { type: 'string', format: 'uuid' },
            image_path: { type: 'string', maxLength: 500 },
            file: { type: 'object' },
        },
        additionalProperties: false,
    },
};
