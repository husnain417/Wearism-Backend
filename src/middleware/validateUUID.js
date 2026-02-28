// src/middleware/validateUUID.js
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function validateUUID(request, reply) {
    const id = request.params?.id;
    if (id && !UUID_REGEX.test(id)) {
        return reply.status(400).send({
            success: false,
            error: 'Invalid ID format.',
        });
    }
}
