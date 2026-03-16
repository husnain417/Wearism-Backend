// src/middleware/validateUUID.js
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function validateUUID(request, reply) {
    if (!request.params) return;

    for (const [key, value] of Object.entries(request.params)) {
        if (key.toLowerCase().endsWith('id')) {
            if (value && !UUID_REGEX.test(value)) {
                return reply.status(400).send({
                    success: false,
                    error: 'Invalid ID format.',
                });
            }
        }
    }
}
