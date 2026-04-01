// src/utils/pagination.js

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

/**
 * Parse and sanitise pagination params from request query.
 * Fastify coerceTypes handles string→int, this handles clamping.
 */
export function parsePagination(query) {
    const page  = Math.max(1, parseInt(query.page  || 1, 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit || DEFAULT_LIMIT, 10)));
    const from  = (page - 1) * limit;
    return { page, limit, from };
}

/**
 * Build standardised pagination metadata.
 */
export function buildPagination(total, page, limit) {
    return {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        has_next:    page < Math.ceil(total / limit),
        has_prev:    page > 1,
    };
}

/**
 * Wrap a list result in the standard paginated response shape.
 */
export function paginatedResult(data, total, page, limit) {
    return {
        success:    true,
        data:       data || [],
        pagination: buildPagination(total, page, limit),
    };
}
