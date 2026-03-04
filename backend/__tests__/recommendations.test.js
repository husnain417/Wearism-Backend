import { jest } from '@jest/globals';

// ─────────────────────────────────────────────────────────────
// recommendations.test.js
// Integration tests for all /recommendations/* endpoints
// Uses jest.unstable_mockModule + app.inject (same pattern as
// wardrobe.test.js and auth.test.js)
//
// NOTE ON ARCHITECTURE:
// /recommendations/generate has a rate limit of 5 req/hour per
// IP. app.inject uses 127.0.0.1 for all requests, so any app
// instance will have its quota drained by successful generate
// calls. To avoid cross-contamination we use TWO app instances:
//
//  • `app`           — for all non-generate endpoints
//  • `generateApp`   — all /generate tests (their own quota)
// ─────────────────────────────────────────────────────────────

// ── 1. Mock recommendationsService ───────────────────────────
const mockRecommendationsService = {
    generateRecommendations: jest.fn(),
    listRecommendations: jest.fn(),
    getRecommendation: jest.fn(),
    saveRecommendation: jest.fn(),
    unsaveRecommendation: jest.fn(),
    dismissRecommendation: jest.fn(),
};

jest.unstable_mockModule(
    '../src/modules/recommendations/recommendations.service.js',
    () => ({ recommendationsService: mockRecommendationsService })
);

// ── 2. Mock Supabase (used by authenticate middleware) ────────
const mockSupabase = {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
};

jest.unstable_mockModule('../src/config/supabase.js', () => ({
    supabase: mockSupabase,
}));

// ── 3. Mock aiQueue (no real Redis in tests) ──────────────────
jest.unstable_mockModule('../src/services/aiQueue.js', () => ({
    aiQueue: {
        queueClothingClassification: jest.fn().mockResolvedValue(undefined),
        queueOutfitRating: jest.fn().mockResolvedValue(undefined),
        queueUserAnalysis: jest.fn().mockResolvedValue(undefined),
        queueRecommendationRating: jest.fn().mockResolvedValue(undefined),
    },
}));

// ── 4. Mock ioredis (no real Redis connection) ────────────────
jest.unstable_mockModule('ioredis', () => ({
    Redis: jest.fn().mockImplementation(() => ({
        on: jest.fn(), connect: jest.fn(), disconnect: jest.fn(),
    })),
    default: jest.fn(),
}));

// ── 5. Dynamic import AFTER all mocks ────────────────────────
const { buildApp } = await import('../src/app.js');

// ── Shared constants ──────────────────────────────────────────
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INVALID_UUID = 'not-a-valid-uuid';
const USER_ID = 'user-aaa';
const AUTH_HEADER = { authorization: 'Bearer valid_token' };

let ipCounter = 1;

// ── Auth setup helper ─────────────────────────────────────────
function setupAuth() {
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.from.mockReset();
    mockSupabase.auth.getUser.mockResolvedValue({
        data: {
            user: { id: USER_ID, email: 'test@example.com', role: 'authenticated' },
        },
        error: null,
    });
    const mockSingle = jest.fn().mockResolvedValue({ data: { deleted_at: null } });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockImplementation(() => ({ select: mockSelect }));
}

// ── Sample data ───────────────────────────────────────────────
const sampleRecommendation = {
    id: VALID_UUID,
    item_ids: ['item-1', 'item-2'],
    occasion: 'casual',
    ai_rating: 8.5,
    ai_color_score: 9.0,
    ai_proportion_score: 8.0,
    ai_style_score: 8.5,
    ai_feedback: 'Great combination!',
    ai_status: 'completed',
    is_saved: false,
    is_dismissed: false,
    saved_outfit_id: null,
    created_at: '2026-03-05T00:00:00Z',
    items: [
        { id: 'item-1', name: 'White Shirt', category: 'tops', colors: ['white'], brand: 'Zara' },
        { id: 'item-2', name: 'Black Jeans', category: 'bottoms', colors: ['black'], brand: "Levi's" },
    ],
};


// ─────────────────────────────────────────────────────────────
// Phase 5 — Recommendations Endpoints
// ─────────────────────────────────────────────────────────────

describe('Phase 5 — Recommendations Endpoints', () => {
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

    // ─────────────────────────────────────────────────────────────
    // A: POST /recommendations/generate
    //    Uses its own isolated app instance — every call to /generate
    //    increments the rate-limit counter on 127.0.0.1.
    //    Keeping this separate from other suites prevents quota bleed.
    // ─────────────────────────────────────────────────────────────

    describe('POST /recommendations/generate', () => {
        it('returns 202 with generated count on success', async () => {
            mockRecommendationsService.generateRecommendations.mockResolvedValueOnce({
                message: '8 recommendations generated. AI scoring in progress.',
                generated: 8,
                recommendation_ids: Array.from({ length: 8 }, (_, i) => `rec-${i}`),
            });

            const res = await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: `127.0.1.${ipCounter++}`,
                headers: AUTH_HEADER,
                payload: {},
            });

            expect(res.statusCode).toBe(202);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.generated).toBe(8);
            expect(body.recommendation_ids).toHaveLength(8);
        });

        it('passes occasion and season to the service', async () => {
            mockRecommendationsService.generateRecommendations.mockResolvedValueOnce({
                message: '4 recommendations generated. AI scoring in progress.',
                generated: 4,
                recommendation_ids: ['rec-1', 'rec-2', 'rec-3', 'rec-4'],
            });

            await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: `127.0.1.${ipCounter++}`,
                headers: AUTH_HEADER,
                payload: { occasion: 'formal', season: 'winter' },
            });

            expect(mockRecommendationsService.generateRecommendations).toHaveBeenCalledWith(
                USER_ID,
                expect.objectContaining({ occasion: 'formal', season: 'winter' })
            );
        });

        it('returns 202 with generated:0 on cache hit', async () => {
            mockRecommendationsService.generateRecommendations.mockResolvedValueOnce({
                message: 'Recent recommendations exist. Use /recommendations to view them.',
                generated: 0,
            });

            const res = await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: `127.0.1.${ipCounter++}`,
                headers: AUTH_HEADER,
                payload: {},
            });

            expect(res.statusCode).toBe(202);
            const body = JSON.parse(res.payload);
            expect(body.generated).toBe(0);
            expect(body.message).toContain('Recent recommendations exist');
        });

        it('returns 400 when user has fewer than 2 classified items', async () => {
            const err = new Error('Not enough classified wardrobe items to generate recommendations.');
            err.statusCode = 400;
            mockRecommendationsService.generateRecommendations.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: `127.0.1.${ipCounter++}`,
                headers: AUTH_HEADER,
                payload: {},
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.payload);
            expect(body.message || body.error).toMatch(/classified wardrobe items/i);
        });

        it('returns 400 when no combinations can be formed', async () => {
            const err = new Error('Could not generate combinations. Ensure you have both tops and bottoms (or dresses).');
            err.statusCode = 400;
            mockRecommendationsService.generateRecommendations.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: `127.0.1.${ipCounter++}`,
                headers: AUTH_HEADER,
                payload: {},
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for invalid occasion enum value', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: `127.0.1.${ipCounter++}`,
                headers: AUTH_HEADER,
                payload: { occasion: 'space_walk' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for invalid season enum value', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: `127.0.1.${ipCounter++}`,
                headers: AUTH_HEADER,
                payload: { season: 'monsoon' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('rejects unknown body fields (additionalProperties: false)', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: `127.0.1.${ipCounter++}`,
                headers: AUTH_HEADER,
                payload: { unknown_field: 'hack' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 401 when no auth header provided', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: `127.0.1.${ipCounter++}`,
                payload: {},
            });

            expect(res.statusCode).toBe(401);
        });

        // Rate limit test — must be last in this suite since it exhausts the quota
        it('returns 429 after exhausting the 5-calls/hour limit', async () => {
            const rateLimitIp = `127.0.1.${ipCounter++}`;

            for (let i = 0; i < 5; i++) {
                mockRecommendationsService.generateRecommendations.mockResolvedValueOnce({
                    message: 'ok', generated: 1, recommendation_ids: ['r1'],
                });
                await app.inject({
                    method: 'POST',
                    url: '/recommendations/generate',
                    remoteAddress: rateLimitIp,
                    headers: AUTH_HEADER,
                    payload: {},
                });
            }

            const res = await app.inject({
                method: 'POST',
                url: '/recommendations/generate',
                remoteAddress: rateLimitIp,
                headers: AUTH_HEADER,
                payload: {},
            });

            expect(res.statusCode).toBe(429);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // B: All non-generate endpoints — use the same app instance
    // ─────────────────────────────────────────────────────────────

    describe('Remaining Endpoints', () => {
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        setupAuth();
    });

    // ═══════════════════════════════════════════════════════════
    // GET /recommendations
    // ═══════════════════════════════════════════════════════════

    describe('GET /recommendations', () => {
        const paginatedResult = {
            recommendations: [sampleRecommendation],
            pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
        };

        it('returns 200 with enriched recommendation list', async () => {
            mockRecommendationsService.listRecommendations.mockResolvedValueOnce(paginatedResult);

            const res = await app.inject({
                method: 'GET',
                url: '/recommendations',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.recommendations).toHaveLength(1);
            expect(body.recommendations[0].items).toHaveLength(2);
            expect(body.pagination.total).toBe(1);
        });

        it('defaults: status=scored, page=1, limit=10', async () => {
            mockRecommendationsService.listRecommendations.mockResolvedValueOnce(paginatedResult);

            await app.inject({
                method: 'GET',
                url: '/recommendations',
                headers: AUTH_HEADER,
            });

            expect(mockRecommendationsService.listRecommendations).toHaveBeenCalledWith(
                USER_ID,
                expect.objectContaining({ status: 'scored', page: 1, limit: 10 })
            );
        });

        it('passes occasion filter to service', async () => {
            mockRecommendationsService.listRecommendations.mockResolvedValueOnce({
                recommendations: [], pagination: { total: 0, page: 1, limit: 10, total_pages: 0 },
            });

            await app.inject({
                method: 'GET',
                url: '/recommendations?occasion=formal',
                headers: AUTH_HEADER,
            });

            expect(mockRecommendationsService.listRecommendations).toHaveBeenCalledWith(
                USER_ID,
                expect.objectContaining({ occasion: 'formal' })
            );
        });

        it('passes status=pending to service', async () => {
            mockRecommendationsService.listRecommendations.mockResolvedValueOnce({
                recommendations: [{ ...sampleRecommendation, ai_status: 'pending', ai_rating: null }],
                pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
            });

            await app.inject({
                method: 'GET',
                url: '/recommendations?status=pending',
                headers: AUTH_HEADER,
            });

            expect(mockRecommendationsService.listRecommendations).toHaveBeenCalledWith(
                USER_ID,
                expect.objectContaining({ status: 'pending' })
            );
        });

        it('returns 400 for invalid status enum', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/recommendations?status=unknown',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for limit > 20', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/recommendations?limit=99',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for limit < 1', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/recommendations?limit=0',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for page < 1', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/recommendations?page=0',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 401 without auth', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({ method: 'GET', url: '/recommendations' });
            expect(res.statusCode).toBe(401);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // GET /recommendations/:id
    // ═══════════════════════════════════════════════════════════

    describe('GET /recommendations/:id', () => {
        it('returns 200 with full item details', async () => {
            mockRecommendationsService.getRecommendation.mockResolvedValueOnce(sampleRecommendation);

            const res = await app.inject({
                method: 'GET',
                url: `/recommendations/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.recommendation.items).toHaveLength(2);
            expect(mockRecommendationsService.getRecommendation).toHaveBeenCalledWith(USER_ID, VALID_UUID);
        });

        it('returns 400 for invalid UUID param', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/recommendations/${INVALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.payload);
            expect(body.error).toBe('Invalid ID format.');
        });

        it('returns 404 when recommendation does not exist (covers cross-user access)', async () => {
            const err = new Error('Recommendation not found.');
            err.statusCode = 404;
            mockRecommendationsService.getRecommendation.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'GET',
                url: `/recommendations/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 401 without auth', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({
                method: 'GET',
                url: `/recommendations/${VALID_UUID}`,
            });
            expect(res.statusCode).toBe(401);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // POST /recommendations/:id/save
    // ═══════════════════════════════════════════════════════════

    describe('POST /recommendations/:id/save', () => {
        it('returns 201 with outfit_id on successful save', async () => {
            mockRecommendationsService.saveRecommendation.mockResolvedValueOnce({
                outfit_id: 'new-outfit-uuid',
            });

            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${VALID_UUID}/save`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.message).toContain('saved as outfit');
            expect(body.outfit_id).toBe('new-outfit-uuid');
            expect(mockRecommendationsService.saveRecommendation).toHaveBeenCalledWith(USER_ID, VALID_UUID);
        });

        it('returns 400 if recommendation is already saved', async () => {
            const err = new Error('Already saved.');
            err.statusCode = 400;
            mockRecommendationsService.saveRecommendation.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${VALID_UUID}/save`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.payload);
            expect(body.message || body.error).toMatch(/Already saved/i);
        });

        it('returns 404 for non-existent recommendation (ownership enforcement)', async () => {
            const err = new Error('Recommendation not found.');
            err.statusCode = 404;
            mockRecommendationsService.saveRecommendation.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${VALID_UUID}/save`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 400 for invalid UUID in save route', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${INVALID_UUID}/save`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.payload);
            expect(body.error).toBe('Invalid ID format.');
        });

        it('returns 401 without auth', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${VALID_UUID}/save`,
            });
            expect(res.statusCode).toBe(401);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // DELETE /recommendations/:id/save
    // ═══════════════════════════════════════════════════════════

    describe('DELETE /recommendations/:id/save', () => {
        it('returns 200 on successful unsave', async () => {
            mockRecommendationsService.unsaveRecommendation.mockResolvedValueOnce(undefined);

            const res = await app.inject({
                method: 'DELETE',
                url: `/recommendations/${VALID_UUID}/save`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.message).toContain('unsaved');
            expect(mockRecommendationsService.unsaveRecommendation).toHaveBeenCalledWith(USER_ID, VALID_UUID);
        });

        it('returns 404 when recommendation not found (owns check)', async () => {
            const err = new Error('Recommendation not found.');
            err.statusCode = 404;
            mockRecommendationsService.unsaveRecommendation.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'DELETE',
                url: `/recommendations/${VALID_UUID}/save`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 400 for invalid UUID', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: `/recommendations/${INVALID_UUID}/save`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.payload).error).toBe('Invalid ID format.');
        });

        it('returns 401 without auth', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({
                method: 'DELETE',
                url: `/recommendations/${VALID_UUID}/save`,
            });
            expect(res.statusCode).toBe(401);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // POST /recommendations/:id/dismiss
    // ═══════════════════════════════════════════════════════════

    describe('POST /recommendations/:id/dismiss', () => {
        it('returns 200 on successful dismiss', async () => {
            mockRecommendationsService.dismissRecommendation.mockResolvedValueOnce(undefined);

            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${VALID_UUID}/dismiss`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.message).toContain('dismissed');
            expect(mockRecommendationsService.dismissRecommendation).toHaveBeenCalledWith(USER_ID, VALID_UUID);
        });

        it('returns 404 at route level for DELETE /dismiss (wrong method)', async () => {
            const res = await app.inject({
                method: 'DELETE',    // no DELETE /dismiss route exists
                url: `/recommendations/${VALID_UUID}/dismiss`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 400 for invalid UUID', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${INVALID_UUID}/dismiss`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.payload).error).toBe('Invalid ID format.');
        });

        it('returns 401 without auth', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${VALID_UUID}/dismiss`,
            });
            expect(res.statusCode).toBe(401);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // SECURITY — Ownership & Isolation
    // ═══════════════════════════════════════════════════════════

    describe('Security — ownership scoping', () => {
        it('service is always called with the authenticated user_id (not from params)', async () => {
            mockRecommendationsService.getRecommendation.mockResolvedValueOnce(sampleRecommendation);

            await app.inject({
                method: 'GET',
                url: `/recommendations/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            const [calledWithUserId] = mockRecommendationsService.getRecommendation.mock.calls[0];
            expect(calledWithUserId).toBe(USER_ID);
        });

        it("save uses JWT user_id — cannot save another user's recommendation by guessing UUID", async () => {
            const err = new Error('Recommendation not found.');
            err.statusCode = 404;
            mockRecommendationsService.saveRecommendation.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${VALID_UUID}/save`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
            const [calledWithUserId] = mockRecommendationsService.saveRecommendation.mock.calls[0];
            expect(calledWithUserId).toBe(USER_ID);
        });

        it("dismiss uses JWT user_id — cannot dismiss another user's recommendation", async () => {
            const err = new Error('Recommendation not found.');
            err.statusCode = 404;
            mockRecommendationsService.dismissRecommendation.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: `/recommendations/${VALID_UUID}/dismiss`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
            const [calledWithUserId] = mockRecommendationsService.dismissRecommendation.mock.calls[0];
            expect(calledWithUserId).toBe(USER_ID);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // GDPR — soft-deleted account
    // ═══════════════════════════════════════════════════════════

    describe('GDPR — soft-deleted account is blocked', () => {
        it('returns 403 when user account has been deleted', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: {
                    user: { id: USER_ID, email: 'test@example.com', role: 'authenticated' },
                },
                error: null,
            });

            const mockSingle = jest.fn().mockResolvedValueOnce({
                data: { deleted_at: '2026-01-01T00:00:00Z' },
            });
            const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            mockSupabase.from.mockImplementation(() => ({ select: mockSelect }));

            const res = await app.inject({
                method: 'GET',
                url: '/recommendations',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(403);
            const body = JSON.parse(res.payload);
            expect(body.error).toBe('This account has been deleted.');
        });
    });
});
