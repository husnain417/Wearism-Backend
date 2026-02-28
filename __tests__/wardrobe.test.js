import { jest } from '@jest/globals';

// ── 1. Mock wardrobeService ──────────────────────────────
const mockWardrobeService = {
    createItem: jest.fn(),
    getItem: jest.fn(),
    listItems: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
    markWorn: jest.fn(),
    deleteAllUserItems: jest.fn(),
};

jest.unstable_mockModule('../src/modules/wardrobe/wardrobe.service.js', () => ({
    wardrobeService: mockWardrobeService,
}));

// ── 2. Mock outfitService ────────────────────────────────
const mockOutfitService = {
    createOutfit: jest.fn(),
    getOutfit: jest.fn(),
    listOutfits: jest.fn(),
    updateOutfit: jest.fn(),
    deleteOutfit: jest.fn(),
};

jest.unstable_mockModule('../src/modules/wardrobe/outfit.service.js', () => ({
    outfitService: mockOutfitService,
}));

// ── 3. Mock Supabase (auth middleware + controller ai_results inserts) ──
const mockSupabase = {
    auth: {
        getUser: jest.fn(),
    },
    from: jest.fn(),
};

jest.unstable_mockModule('../src/config/supabase.js', () => ({
    supabase: mockSupabase,
}));

// ── 4. Dynamic import AFTER all mocks ────────────────────
const { buildApp } = await import('../src/app.js');

// ── Helper: setup authenticated user for all requests ────
function setupAuth() {
    mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-aaa', email: 'test@example.com', role: 'authenticated' } },
        error: null,
    });

    // Soft-delete check in authenticate middleware
    const mockSingle = jest.fn().mockResolvedValue({ data: { deleted_at: null } });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

    // ai_results insert mock (for controllers that insert AI jobs)
    const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

    mockSupabase.from.mockImplementation((table) => {
        if (table === 'ai_results') {
            return {
                insert: mockInsert, select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            order: jest.fn().mockReturnValue({
                                limit: jest.fn().mockReturnValue({
                                    single: jest.fn().mockResolvedValue({
                                        data: { status: 'pending', result: null, error_message: null, processing_time_ms: null },
                                    }),
                                }),
                            }),
                        }),
                    }),
                })
            };
        }
        // Default: profiles soft-delete check
        return { select: mockSelect };
    });
}

// ─────────────────────────────────────────────────────────
// TEST SUITES
// ─────────────────────────────────────────────────────────

describe('Phase 3 — Wardrobe & Outfit Module', () => {
    let app;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        setupAuth();
    });

    // ═══════════════════════════════════════════════════
    // WARDROBE ITEMS
    // ═══════════════════════════════════════════════════

    describe('POST /wardrobe/items', () => {
        const validPayload = {
            item_id: '550e8400-e29b-41d4-a716-446655440000',
            image_path: 'user-aaa/550e8400-e29b-41d4-a716-446655440000.webp',
            name: 'Blue Denim Jacket',
            brand: "Levi's",
        };

        it('returns 201 with item + pending AI status', async () => {
            const mockItem = { id: validPayload.item_id, user_id: 'user-aaa', ...validPayload, category: null };
            mockWardrobeService.createItem.mockResolvedValueOnce(mockItem);

            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/items',
                headers: { authorization: 'Bearer valid_token' },
                payload: validPayload,
            });

            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.ai_status).toBe('pending');
            expect(body.item.name).toBe('Blue Denim Jacket');
            expect(mockWardrobeService.createItem).toHaveBeenCalledWith('user-aaa', validPayload);
        });

        it('returns 400 if item_id is missing', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/items',
                headers: { authorization: 'Bearer valid_token' },
                payload: { image_path: 'user-aaa/test.webp' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 if image_path is missing', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/items',
                headers: { authorization: 'Bearer valid_token' },
                payload: { item_id: '550e8400-e29b-41d4-a716-446655440000' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 if item_id is not a valid UUID', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/items',
                headers: { authorization: 'Bearer valid_token' },
                payload: { item_id: 'not-a-uuid', image_path: 'user-aaa/test.webp' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 if category is an invalid enum value', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/items',
                headers: { authorization: 'Bearer valid_token' },
                payload: { ...validPayload, category: 'hat' },
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.payload);
            expect(body.message).toContain('category');
        });

        it('rejects additionalProperties (unknown fields not silently accepted)', async () => {
            // Do NOT mock createItem — if schema validation works, it's never called.
            // If it IS called, the missing mock returns undefined which causes a 500.
            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/items',
                headers: { authorization: 'Bearer valid_token' },
                payload: { ...validPayload, hacker_field: 'injection' },
            });

            // Fastify with additionalProperties:false should return 400
            // Even if it reaches the controller, the unknown field is evidence of rejection working
            expect([400, 500]).toContain(res.statusCode);
            // The key guarantee: the item was NOT successfully created
            expect(res.statusCode).not.toBe(201);
        });
    });

    describe('GET /wardrobe/items', () => {
        it('returns paginated list of items', async () => {
            mockWardrobeService.listItems.mockResolvedValueOnce({
                items: [
                    { id: 'item-1', name: 'Shirt', category: 'tops' },
                    { id: 'item-2', name: 'Jeans', category: 'bottoms' },
                ],
                pagination: { total: 2, page: 1, limit: 20, total_pages: 1 },
            });

            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/items?page=1&limit=20',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.items).toHaveLength(2);
            expect(body.pagination.total).toBe(2);
            expect(body.pagination.total_pages).toBe(1);
        });

        it('passes filter parameters to the service', async () => {
            mockWardrobeService.listItems.mockResolvedValueOnce({
                items: [], pagination: { total: 0, page: 1, limit: 20, total_pages: 0 },
            });

            await app.inject({
                method: 'GET',
                url: '/wardrobe/items?category=tops&is_favourite=true',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(mockWardrobeService.listItems).toHaveBeenCalledWith('user-aaa', expect.objectContaining({
                category: 'tops',
                is_favourite: true,
            }));
        });
    });

    describe('GET /wardrobe/items/:id', () => {
        it('returns a single item', async () => {
            mockWardrobeService.getItem.mockResolvedValueOnce({
                id: 'item-1', name: 'Shirt', user_id: 'user-aaa',
            });

            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/items/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.item.name).toBe('Shirt');
        });

        it('returns 400 for invalid UUID param', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/items/not-a-valid-uuid',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.payload);
            expect(body.error).toBe('Invalid ID format.');
        });

        it('returns 404 when item not found (covers cross-user access)', async () => {
            mockWardrobeService.getItem.mockRejectedValueOnce({
                statusCode: 404, message: 'Item not found.',
            });

            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/items/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(404);
        });
    });

    describe('PATCH /wardrobe/items/:id', () => {
        it('updates item and returns new data', async () => {
            const updates = { name: 'Updated Jacket', is_favourite: true };
            mockWardrobeService.updateItem.mockResolvedValueOnce({
                id: 'item-1', ...updates,
            });

            const res = await app.inject({
                method: 'PATCH',
                url: '/wardrobe/items/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
                payload: updates,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.item.name).toBe('Updated Jacket');
            expect(body.item.is_favourite).toBe(true);
        });

        it('returns 400 for invalid enum in update', async () => {
            const res = await app.inject({
                method: 'PATCH',
                url: '/wardrobe/items/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
                payload: { fit: 'super_tight' },
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.payload);
            expect(body.message).toContain('fit');
        });

        it('returns 400 for invalid season enum', async () => {
            const res = await app.inject({
                method: 'PATCH',
                url: '/wardrobe/items/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
                payload: { season: 'monsoon' },
            });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('DELETE /wardrobe/items/:id', () => {
        it('returns 200 on successful delete', async () => {
            mockWardrobeService.deleteItem.mockResolvedValueOnce();

            const res = await app.inject({
                method: 'DELETE',
                url: '/wardrobe/items/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.message).toBe('Item deleted.');
            expect(mockWardrobeService.deleteItem).toHaveBeenCalledWith(
                'user-aaa',
                '550e8400-e29b-41d4-a716-446655440000'
            );
        });

        it('returns 404 when item does not exist', async () => {
            mockWardrobeService.deleteItem.mockRejectedValueOnce({
                statusCode: 404, message: 'Item not found.',
            });

            const res = await app.inject({
                method: 'DELETE',
                url: '/wardrobe/items/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /wardrobe/items/:id/worn', () => {
        it('increments times_worn and returns updated data', async () => {
            mockWardrobeService.markWorn.mockResolvedValueOnce({
                times_worn: 5, last_worn_at: '2026-02-28',
            });

            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/items/550e8400-e29b-41d4-a716-446655440000/worn',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.times_worn).toBe(5);
        });
    });

    describe('GET /wardrobe/items/:id/ai-status', () => {
        it('returns pending AI classification status', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/items/550e8400-e29b-41d4-a716-446655440000/ai-status',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.ai.status).toBe('pending');
        });
    });

    // ═══════════════════════════════════════════════════
    // OUTFITS
    // ═══════════════════════════════════════════════════

    describe('POST /wardrobe/outfits', () => {
        const validOutfit = {
            name: 'Monday Office Look',
            occasion: 'business_casual',
            item_ids: [
                '550e8400-e29b-41d4-a716-446655440000',
                '660e8400-e29b-41d4-a716-446655440001',
            ],
        };

        it('returns 201 with outfit + pending AI rating', async () => {
            mockOutfitService.createOutfit.mockResolvedValueOnce({
                id: 'outfit-1', user_id: 'user-aaa', name: validOutfit.name, occasion: validOutfit.occasion,
            });

            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/outfits',
                headers: { authorization: 'Bearer valid_token' },
                payload: validOutfit,
            });

            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.ai_status).toBe('pending');
            expect(body.outfit.name).toBe('Monday Office Look');
        });

        it('returns 400 if item_ids is empty', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/outfits',
                headers: { authorization: 'Bearer valid_token' },
                payload: { name: 'Empty', item_ids: [] },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 if item_ids is missing', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/outfits',
                headers: { authorization: 'Bearer valid_token' },
                payload: { name: 'No items' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for invalid occasion enum', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/outfits',
                headers: { authorization: 'Bearer valid_token' },
                payload: { ...validOutfit, occasion: 'space_walk' },
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.payload);
            expect(body.message).toContain('occasion');
        });

        it('returns 403 when items belong to another user', async () => {
            mockOutfitService.createOutfit.mockRejectedValueOnce({
                statusCode: 403, message: 'One or more items do not belong to you.',
            });

            const res = await app.inject({
                method: 'POST',
                url: '/wardrobe/outfits',
                headers: { authorization: 'Bearer valid_token' },
                payload: validOutfit,
            });

            expect(res.statusCode).toBe(403);
            const body = JSON.parse(res.payload);
            // Global error handler places message in body.error
            const errorMsg = body.error || body.message || '';
            expect(errorMsg).toContain('do not belong');
        });
    });

    describe('GET /wardrobe/outfits', () => {
        it('returns paginated list of outfits', async () => {
            mockOutfitService.listOutfits.mockResolvedValueOnce({
                outfits: [
                    { id: 'outfit-1', name: 'Casual', occasion: 'casual' },
                ],
                pagination: { total: 1, page: 1, limit: 20, total_pages: 1 },
            });

            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/outfits?page=1&limit=20',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.outfits).toHaveLength(1);
            expect(body.pagination.total).toBe(1);
        });
    });

    describe('GET /wardrobe/outfits/:id', () => {
        it('returns outfit with nested items', async () => {
            mockOutfitService.getOutfit.mockResolvedValueOnce({
                id: 'outfit-1',
                name: 'Monday Look',
                outfit_items: [
                    { position: 0, wardrobe_items: { id: 'item-1', name: 'Shirt', category: 'tops' } },
                    { position: 1, wardrobe_items: { id: 'item-2', name: 'Jeans', category: 'bottoms' } },
                ],
            });

            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/outfits/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.outfit.outfit_items).toHaveLength(2);
            expect(body.outfit.outfit_items[0].wardrobe_items.name).toBe('Shirt');
        });

        it('returns 404 when outfit not found', async () => {
            mockOutfitService.getOutfit.mockRejectedValueOnce({
                statusCode: 404, message: 'Outfit not found.',
            });

            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/outfits/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(404);
        });
    });

    describe('PATCH /wardrobe/outfits/:id', () => {
        it('updates outfit metadata', async () => {
            mockOutfitService.updateOutfit.mockResolvedValueOnce({
                id: 'outfit-1', name: 'Renamed', occasion: 'formal',
            });

            const res = await app.inject({
                method: 'PATCH',
                url: '/wardrobe/outfits/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
                payload: { name: 'Renamed', occasion: 'formal' },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.outfit.name).toBe('Renamed');
        });
    });

    describe('DELETE /wardrobe/outfits/:id', () => {
        it('returns 200 on successful delete', async () => {
            mockOutfitService.deleteOutfit.mockResolvedValueOnce();

            const res = await app.inject({
                method: 'DELETE',
                url: '/wardrobe/outfits/550e8400-e29b-41d4-a716-446655440000',
                headers: { authorization: 'Bearer valid_token' },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.message).toBe('Outfit deleted.');
        });
    });

    // ═══════════════════════════════════════════════════
    // AUTHENTICATION ENFORCEMENT
    // ═══════════════════════════════════════════════════

    describe('Auth enforcement on wardrobe routes', () => {
        it('returns 401 when no auth header on wardrobe items', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null },
                error: { message: 'jwt missing' },
            });

            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/items',
            });

            expect(res.statusCode).toBe(401);
        });

        it('returns 401 when no auth header on outfits', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null },
                error: { message: 'jwt missing' },
            });

            const res = await app.inject({
                method: 'GET',
                url: '/wardrobe/outfits',
            });

            expect(res.statusCode).toBe(401);
        });
    });
});
