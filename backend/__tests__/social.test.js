import { jest } from '@jest/globals';

// ─────────────────────────────────────────────────────────────
// social.test.js
// Integration tests for Phase 6 social endpoints:
//   /posts, /posts/:postId/comments, /follows, /feed
//
// Pattern: jest.unstable_mockModule + app.inject (same as
// recommendations.test.js and wardrobe.test.js)
// ─────────────────────────────────────────────────────────────

// ── 1. Mock service modules ───────────────────────────────────
const mockPostsService = {
    createPost: jest.fn(),
    getPost: jest.fn(),
    deletePost: jest.fn(),
    listUserPosts: jest.fn(),
    toggleLike: jest.fn(),
    reportPost: jest.fn(),
};

const mockCommentsService = {
    createComment: jest.fn(),
    listComments: jest.fn(),
    deleteComment: jest.fn(),
};

const mockFollowsService = {
    follow: jest.fn(),
    unfollow: jest.fn(),
    listFollowers: jest.fn(),
    listFollowing: jest.fn(),
    getRelationship: jest.fn(),
};

const mockFeedService = {
    getHomeFeed: jest.fn(),
    getTrendingFeed: jest.fn(),
};

jest.unstable_mockModule('../src/modules/social/posts/posts.service.js',
    () => ({ postsService: mockPostsService }));

jest.unstable_mockModule('../src/modules/social/comments/comments.service.js',
    () => ({ commentsService: mockCommentsService }));

jest.unstable_mockModule('../src/modules/social/follows/follows.service.js',
    () => ({ followsService: mockFollowsService }));

jest.unstable_mockModule('../src/modules/social/feed/feed.service.js',
    () => ({ feedService: mockFeedService }));

// ── 2. Mock Supabase (auth middleware) ───────────────────────
const mockSupabase = {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
};

jest.unstable_mockModule('../src/config/supabase.js', () => ({
    supabase: mockSupabase,
}));

// ── 3. Mock Redis (no real connection in tests) ──────────────
jest.unstable_mockModule('ioredis', () => ({
    Redis: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
        setex: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
    })),
    default: jest.fn(),
}));

// ── 4. Mock aiQueue (not used by social, but app.js imports it) ─
jest.unstable_mockModule('../src/services/aiQueue.js', () => ({
    aiQueue: {
        queueClothingClassification: jest.fn().mockResolvedValue(undefined),
        queueOutfitRating: jest.fn().mockResolvedValue(undefined),
        queueUserAnalysis: jest.fn().mockResolvedValue(undefined),
        queueRecommendationRating: jest.fn().mockResolvedValue(undefined),
    },
}));

// ── 5. Mock trendingScore (setInterval fires on app boot) ────
jest.unstable_mockModule('../src/services/trendingScore.js', () => ({
    refreshTrendingCache: jest.fn().mockResolvedValue(undefined),
    getTrendingPosts: jest.fn().mockResolvedValue([]),
}));

// ── 6. Mock feedCache (used by feed service + follows service) ─
jest.unstable_mockModule('../src/services/feedCache.js', () => ({
    buildUserFeed: jest.fn().mockResolvedValue([]),
    getUserFeed: jest.fn().mockResolvedValue({ posts: [], pagination: {} }),
    invalidateUserFeed: jest.fn().mockResolvedValue(undefined),
    invalidateFollowerFeeds: jest.fn().mockResolvedValue(undefined),
}));

// ── 7. Mock nsfwFilter ───────────────────────────────────────
jest.unstable_mockModule('../src/services/nsfwFilter.js', () => ({
    checkContent: jest.fn().mockReturnValue({ blocked: false, flagged: false, reason: null }),
    checkPost: jest.fn().mockReturnValue({ blocked: false, flagged: false, reason: null }),
}));

// ── 8. Dynamic import AFTER all mocks ────────────────────────
const { buildApp } = await import('../src/app.js');

// ── Shared constants ─────────────────────────────────────────
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INVALID_UUID = 'not-a-valid-uuid';
const USER_ID = 'user-social-001';
const USER_B_ID = 'user-social-002';
const AUTH_HEADER = { authorization: 'Bearer valid_token' };

// ── Auth setup helper ─────────────────────────────────────────
function setupAuth(userId = USER_ID) {
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.from.mockReset();
    mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: 'test@example.com', role: 'authenticated' } },
        error: null,
    });
    const mockSingle = jest.fn().mockResolvedValue({ data: { deleted_at: null } });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockImplementation(() => ({ select: mockSelect }));
}

// ── Sample data ───────────────────────────────────────────────
const samplePost = {
    id: VALID_UUID,
    user_id: USER_ID,
    caption: 'Love this outfit!',
    image_url: null,
    outfit_id: null,
    occasion: 'casual',
    season: 'all_season',
    tags: ['fashion'],
    visibility: 'public',
    likes_count: 0,
    comments_count: 0,
    report_count: 0,
    is_hidden: false,
    is_nsfw_flagged: false,
    created_at: '2026-03-08T00:00:00Z',
    profiles: { id: USER_ID, full_name: 'Test User', avatar_url: null },
};

const sampleComment = {
    id: VALID_UUID,
    post_id: VALID_UUID,
    user_id: USER_ID,
    body: 'Great look!',
    parent_id: null,
    is_hidden: false,
    created_at: '2026-03-08T00:00:00Z',
    replies: [],
    profiles: { id: USER_ID, full_name: 'Test User', avatar_url: null },
};

const sampleFeedResult = {
    posts: [samplePost],
    pagination: { total: 1, page: 1, limit: 20, total_pages: 1 },
    from_cache: false,
};


// ─────────────────────────────────────────────────────────────
// Phase 6 — Social Hub Endpoints
// ─────────────────────────────────────────────────────────────

describe('Phase 6 — Social Hub Endpoints', () => {
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


    // ═══════════════════════════════════════════════════════════
    // A: POST /posts  (create)
    // ═══════════════════════════════════════════════════════════

    describe('POST /posts', () => {
        it('returns 201 with post on success (caption only)', async () => {
            mockPostsService.createPost.mockResolvedValueOnce(samplePost);

            const res = await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { caption: 'Love this outfit!' },
            });

            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.post.id).toBe(VALID_UUID);
            expect(mockPostsService.createPost).toHaveBeenCalledWith(
                USER_ID,
                expect.objectContaining({ caption: 'Love this outfit!' }),
            );
        });

        it('returns 201 with post when outfit_id provided', async () => {
            mockPostsService.createPost.mockResolvedValueOnce({ ...samplePost, outfit_id: VALID_UUID });

            const res = await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { outfit_id: VALID_UUID },
            });

            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.payload).post.outfit_id).toBe(VALID_UUID);
        });

        it('returns 400 when no caption, image_path, or outfit_id provided (anyOf fails)', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { season: 'summer' }, // valid field but no required anyOf field
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for invalid season enum', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { caption: 'hi', season: 'monsoon' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for invalid visibility enum', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { caption: 'hi', visibility: 'everyone' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when caption exceeds 500 chars', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { caption: 'x'.repeat(501) },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when tags array exceeds 10 items', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { caption: 'hi', tags: Array(11).fill('tag') },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when service throws blocked NSFW error', async () => {
            const err = new Error('Post blocked: Blocked term: nude');
            err.statusCode = 400;
            mockPostsService.createPost.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { caption: 'nude' },
            });

            expect(res.statusCode).toBe(400);
            const body = JSON.parse(res.payload);
            expect(body.message || body.error).toMatch(/blocked/i);
        });

        it('strips extra unknown fields (additionalProperties: false) instead of failing', async () => {
            mockPostsService.createPost.mockResolvedValueOnce(samplePost);

            const res = await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { caption: 'hi', hack: true },
            });

            expect(res.statusCode).toBe(201);
            const [userId, payload] = mockPostsService.createPost.mock.calls[0];
            expect(payload).not.toHaveProperty('hack');
        });

        it('returns 401 without auth header', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({ method: 'POST', url: '/posts', payload: { caption: 'hi' } });
            expect(res.statusCode).toBe(401);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // B: GET /posts/:id
    // ═══════════════════════════════════════════════════════════

    describe('GET /posts/:id', () => {
        it('returns 200 with post and viewer_has_liked field', async () => {
            const postWithLike = { ...samplePost, viewer_has_liked: false };
            mockPostsService.getPost.mockResolvedValueOnce(postWithLike);

            const res = await app.inject({
                method: 'GET',
                url: `/posts/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.post.viewer_has_liked).toBe(false);
            expect(mockPostsService.getPost).toHaveBeenCalledWith(VALID_UUID, USER_ID);
        });

        it('returns 400 for invalid UUID param', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/posts/${INVALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.payload).error).toBe('Invalid ID format.');
        });

        it('returns 404 when post not found or hidden', async () => {
            const err = new Error('Post not found.');
            err.statusCode = 404;
            mockPostsService.getPost.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'GET',
                url: `/posts/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 403 for followers_only post when not following', async () => {
            const err = new Error('This post is for followers only.');
            err.statusCode = 403;
            mockPostsService.getPost.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'GET',
                url: `/posts/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(403);
        });

        it('returns 401 without auth', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({ method: 'GET', url: `/posts/${VALID_UUID}` });
            expect(res.statusCode).toBe(401);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // C: DELETE /posts/:id
    // ═══════════════════════════════════════════════════════════

    describe('DELETE /posts/:id', () => {
        it('returns 200 on successful soft delete', async () => {
            mockPostsService.deletePost.mockResolvedValueOnce(undefined);

            const res = await app.inject({
                method: 'DELETE',
                url: `/posts/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload).success).toBe(true);
            expect(mockPostsService.deletePost).toHaveBeenCalledWith(USER_ID, VALID_UUID);
        });

        it('returns 400 for invalid UUID', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: `/posts/${INVALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.payload).error).toBe('Invalid ID format.');
        });

        it('returns 404 when post not found or not owned', async () => {
            const err = new Error('Post not found.');
            err.statusCode = 404;
            mockPostsService.deletePost.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'DELETE',
                url: `/posts/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
        });

        it('service is called with JWT user_id — prevents cross-user deletion', async () => {
            mockPostsService.deletePost.mockResolvedValueOnce(undefined);

            await app.inject({
                method: 'DELETE',
                url: `/posts/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            const [calledUserId] = mockPostsService.deletePost.mock.calls[0];
            expect(calledUserId).toBe(USER_ID);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // D: GET /posts/user/:userId
    // ═══════════════════════════════════════════════════════════

    describe('GET /posts/user/:userId', () => {
        const listResult = {
            data: [samplePost],
            pagination: { total: 1, page: 1, limit: 20, total_pages: 1 },
        };

        it('returns 200 with paginated posts', async () => {
            mockPostsService.listUserPosts.mockResolvedValueOnce(listResult);

            const res = await app.inject({
                method: 'GET',
                url: `/posts/user/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.data).toHaveLength(1);
        });

        it('passes page and limit query params to service', async () => {
            mockPostsService.listUserPosts.mockResolvedValueOnce(listResult);

            await app.inject({
                method: 'GET',
                url: `/posts/user/${VALID_UUID}?page=2&limit=10`,
                headers: AUTH_HEADER,
            });

            expect(mockPostsService.listUserPosts).toHaveBeenCalledWith(
                VALID_UUID, USER_ID,
                expect.objectContaining({ page: 2, limit: 10 }),
            );
        });

        it('returns 400 for limit > 100', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/posts/user/${VALID_UUID}?limit=101`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // E: POST /posts/:id/like  (toggle)
    // ═══════════════════════════════════════════════════════════

    describe('POST /posts/:id/like', () => {
        it('returns 200 with liked: true on first like', async () => {
            mockPostsService.toggleLike.mockResolvedValueOnce({ liked: true });

            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/like`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ success: true, liked: true });
        });

        it('returns 200 with liked: false when unliking', async () => {
            mockPostsService.toggleLike.mockResolvedValueOnce({ liked: false });

            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/like`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload).liked).toBe(false);
        });

        it('returns 400 for invalid UUID', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/posts/${INVALID_UUID}/like`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // F: POST /posts/:id/report
    // ═══════════════════════════════════════════════════════════

    describe('POST /posts/:id/report', () => {
        it('returns 200 with reported: true', async () => {
            mockPostsService.reportPost.mockResolvedValueOnce({ reported: true });

            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/report`,
                headers: AUTH_HEADER,
                payload: { reason: 'spam' },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ success: true, reported: true });
        });

        it('returns 400 when reason is missing', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/report`,
                headers: AUTH_HEADER,
                payload: {},
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for invalid reason enum', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/report`,
                headers: AUTH_HEADER,
                payload: { reason: 'illegal_drugs' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when detail exceeds 300 chars', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/report`,
                headers: AUTH_HEADER,
                payload: { reason: 'spam', detail: 'x'.repeat(301) },
            });

            expect(res.statusCode).toBe(400);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // G: GET /posts/:postId/comments
    // ═══════════════════════════════════════════════════════════

    describe('GET /posts/:postId/comments', () => {
        const listResult = {
            data: [sampleComment],
            pagination: { total: 1, page: 1, limit: 20, total_pages: 1 },
        };

        it('returns 200 with nested comments', async () => {
            mockCommentsService.listComments.mockResolvedValueOnce(listResult);

            const res = await app.inject({
                method: 'GET',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.data[0].replies).toBeDefined();
        });

        it('returns empty array when no comments exist', async () => {
            mockCommentsService.listComments.mockResolvedValueOnce({
                comments: [], pagination: { total: 0, page: 1, limit: 20, total_pages: 0 },
            });

            const res = await app.inject({
                method: 'GET',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload).data).toHaveLength(0);
        });

        it('passes postId from route param to service', async () => {
            mockCommentsService.listComments.mockResolvedValueOnce(listResult);

            await app.inject({
                method: 'GET',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
            });

            expect(mockCommentsService.listComments).toHaveBeenCalledWith(
                VALID_UUID, expect.objectContaining({ page: 1 }),
            );
        });
    });


    // ═══════════════════════════════════════════════════════════
    // H: POST /posts/:postId/comments  (create)
    // ═══════════════════════════════════════════════════════════

    describe('POST /posts/:postId/comments', () => {
        it('returns 201 with created comment', async () => {
            mockCommentsService.createComment.mockResolvedValueOnce(sampleComment);

            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
                payload: { body: 'Great look!' },
            });

            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.payload);
            expect(body.success).toBe(true);
            expect(body.comment.body).toBe('Great look!');
        });

        it('returns 201 with parent_id for reply', async () => {
            const reply = { ...sampleComment, parent_id: VALID_UUID };
            mockCommentsService.createComment.mockResolvedValueOnce(reply);

            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
                payload: { body: 'Agreed!', parent_id: VALID_UUID },
            });

            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.payload).comment.parent_id).toBe(VALID_UUID);
        });

        it('returns 400 when body is missing', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
                payload: {},
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when body exceeds 500 chars', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
                payload: { body: 'x'.repeat(501) },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when body is empty string', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
                payload: { body: '' },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when service rejects reply-to-reply', async () => {
            const err = new Error('Cannot reply to a reply.');
            err.statusCode = 400;
            mockCommentsService.createComment.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
                payload: { body: 'Deep reply', parent_id: VALID_UUID },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when service blocks NSFW comment', async () => {
            const err = new Error('Comment blocked: Blocked term: nude');
            err.statusCode = 400;
            mockCommentsService.createComment.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: `/posts/${VALID_UUID}/comments`,
                headers: AUTH_HEADER,
                payload: { body: 'nude' },
            });

            expect(res.statusCode).toBe(400);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // I: DELETE /posts/:postId/comments/:commentId
    // ═══════════════════════════════════════════════════════════

    describe('DELETE /posts/:postId/comments/:commentId', () => {
        it('returns 200 on successful soft delete', async () => {
            mockCommentsService.deleteComment.mockResolvedValueOnce(undefined);

            const res = await app.inject({
                method: 'DELETE',
                url: `/posts/${VALID_UUID}/comments/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload).success).toBe(true);
        });

        it('service is called with JWT user_id — prevents cross-user deletion', async () => {
            mockCommentsService.deleteComment.mockResolvedValueOnce(undefined);

            await app.inject({
                method: 'DELETE',
                url: `/posts/${VALID_UUID}/comments/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            const [calledUserId] = mockCommentsService.deleteComment.mock.calls[0];
            expect(calledUserId).toBe(USER_ID);
        });

        it('returns 404 when comment not found or not owned', async () => {
            const err = new Error('Comment not found.');
            err.statusCode = 404;
            mockCommentsService.deleteComment.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'DELETE',
                url: `/posts/${VALID_UUID}/comments/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 400 for invalid commentId UUID', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: `/posts/${VALID_UUID}/comments/${INVALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // J: POST /follows/:userId  (follow)
    // ═══════════════════════════════════════════════════════════

    describe('POST /follows/:userId', () => {
        it('returns 200 with following: true on success', async () => {
            mockFollowsService.follow.mockResolvedValueOnce({ following: true });

            const res = await app.inject({
                method: 'POST',
                url: `/follows/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ success: true, following: true });
            expect(mockFollowsService.follow).toHaveBeenCalledWith(USER_ID, VALID_UUID);
        });

        it('returns 400 when service rejects self-follow', async () => {
            const err = new Error('Cannot follow yourself.');
            err.statusCode = 400;
            mockFollowsService.follow.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: `/follows/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when already following', async () => {
            const err = new Error('Already following.');
            err.statusCode = 400;
            mockFollowsService.follow.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'POST',
                url: `/follows/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 for invalid UUID param', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/follows/${INVALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.payload).error).toBe('Invalid ID format.');
        });
    });


    // ═══════════════════════════════════════════════════════════
    // K: DELETE /follows/:userId  (unfollow)
    // ═══════════════════════════════════════════════════════════

    describe('DELETE /follows/:userId', () => {
        it('returns 200 with following: false on success', async () => {
            mockFollowsService.unfollow.mockResolvedValueOnce({ following: false });

            const res = await app.inject({
                method: 'DELETE',
                url: `/follows/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload)).toEqual({ success: true, following: false });
        });

        it('returns 404 if not following', async () => {
            const err = new Error('Follow not found.');
            err.statusCode = 404;
            mockFollowsService.unfollow.mockRejectedValueOnce(err);

            const res = await app.inject({
                method: 'DELETE',
                url: `/follows/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(404);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // L: GET /follows/:userId/followers + /following
    // ═══════════════════════════════════════════════════════════

    describe('GET /follows/:userId/followers and /following', () => {
        const listResult = {
            data: [{ follower_id: USER_B_ID, profiles: { full_name: 'User B' } }],
            pagination: { total: 1, page: 1, limit: 20, total_pages: 1 },
        };

        it('GET /followers returns paginated follower list', async () => {
            mockFollowsService.listFollowers.mockResolvedValueOnce(listResult);

            const res = await app.inject({
                method: 'GET',
                url: `/follows/${VALID_UUID}/followers`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.data).toHaveLength(1);
        });

        it('GET /following returns paginated following list', async () => {
            mockFollowsService.listFollowing.mockResolvedValueOnce({
                data: [{ following_id: USER_B_ID, profiles: { full_name: 'User B' } }],
                pagination: { total: 1, page: 1, limit: 20, total_pages: 1 },
            });

            const res = await app.inject({
                method: 'GET',
                url: `/follows/${VALID_UUID}/following`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload).following).toHaveLength(1);
        });

        it('returns 400 for limit > 50', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/follows/${VALID_UUID}/followers?limit=99`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // M: GET /follows/:userId/relationship
    // ═══════════════════════════════════════════════════════════

    describe('GET /follows/:userId/relationship', () => {
        it('returns mutual: true when both follow each other', async () => {
            mockFollowsService.getRelationship.mockResolvedValueOnce({
                you_follow_them: true,
                they_follow_you: true,
                mutual: true,
            });

            const res = await app.inject({
                method: 'GET',
                url: `/follows/${VALID_UUID}/relationship`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.mutual).toBe(true);
            expect(body.you_follow_them).toBe(true);
        });

        it('returns all false when no relationship exists', async () => {
            mockFollowsService.getRelationship.mockResolvedValueOnce({
                you_follow_them: false, they_follow_you: false, mutual: false,
            });

            const res = await app.inject({
                method: 'GET',
                url: `/follows/${VALID_UUID}/relationship`,
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload).mutual).toBe(false);
        });

        it('service is called with viewer JWT user_id — not spoofable from URL', async () => {
            mockFollowsService.getRelationship.mockResolvedValueOnce({
                you_follow_them: false, they_follow_you: false, mutual: false,
            });

            await app.inject({
                method: 'GET',
                url: `/follows/${VALID_UUID}/relationship`,
                headers: AUTH_HEADER,
            });

            const [viewerId] = mockFollowsService.getRelationship.mock.calls[0];
            expect(viewerId).toBe(USER_ID);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // N: GET /feed/home
    // ═══════════════════════════════════════════════════════════

    describe('GET /feed/home', () => {
        it('returns 200 with posts and from_cache: false on first call', async () => {
            mockFeedService.getHomeFeed.mockResolvedValueOnce(sampleFeedResult);

            const res = await app.inject({
                method: 'GET',
                url: '/feed/home',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.data).toHaveLength(1);
            expect(body.from_cache).toBe(false);
        });

        it('passes page and limit to feedService', async () => {
            mockFeedService.getHomeFeed.mockResolvedValueOnce({ ...sampleFeedResult, from_cache: true });

            await app.inject({
                method: 'GET',
                url: '/feed/home?page=2&limit=10',
                headers: AUTH_HEADER,
            });

            expect(mockFeedService.getHomeFeed).toHaveBeenCalledWith(
                USER_ID,
                expect.objectContaining({ page: 2, limit: 10 }),
            );
        });

        it('service is called with JWT user_id — cannot read another user feed', async () => {
            mockFeedService.getHomeFeed.mockResolvedValueOnce(sampleFeedResult);

            await app.inject({ method: 'GET', url: '/feed/home', headers: AUTH_HEADER });

            const [calledUserId] = mockFeedService.getHomeFeed.mock.calls[0];
            expect(calledUserId).toBe(USER_ID);
        });

        it('returns 400 for limit > 50', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/feed/home?limit=99',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 401 without auth', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({ method: 'GET', url: '/feed/home' });
            expect(res.statusCode).toBe(401);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // O: GET /feed/trending
    // ═══════════════════════════════════════════════════════════

    describe('GET /feed/trending', () => {
        it('returns 200 with scored posts', async () => {
            const trendResult = { posts: [samplePost], pagination: { page: 1, limit: 20 } };
            mockFeedService.getTrendingFeed.mockResolvedValueOnce(trendResult);

            const res = await app.inject({
                method: 'GET',
                url: '/feed/trending',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.payload);
            expect(body.data).toHaveLength(1);
        });

        it('passes page and limit to service', async () => {
            mockFeedService.getTrendingFeed.mockResolvedValueOnce({ posts: [], pagination: {} });

            await app.inject({
                method: 'GET',
                url: '/feed/trending?page=3&limit=5',
                headers: AUTH_HEADER,
            });

            expect(mockFeedService.getTrendingFeed).toHaveBeenCalledWith(
                USER_ID,
                expect.objectContaining({ page: 3, limit: 5 }),
            );
        });

        it('returns 401 without auth', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: null }, error: { message: 'jwt missing' },
            });

            const res = await app.inject({ method: 'GET', url: '/feed/trending' });
            expect(res.statusCode).toBe(401);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // P: Security — Cross-user isolation
    // ═══════════════════════════════════════════════════════════

    describe('Security — JWT ownership enforcement', () => {
        it('createPost uses JWT sub — body user_id cannot override it', async () => {
            mockPostsService.createPost.mockResolvedValueOnce(samplePost);

            await app.inject({
                method: 'POST',
                url: '/posts',
                headers: AUTH_HEADER,
                payload: { caption: 'test', user_id: USER_B_ID }, // injected field, should be ignored
            });

            const [calledUserId] = mockPostsService.createPost.mock.calls[0];
            expect(calledUserId).toBe(USER_ID);
        });

        it('follow uses JWT sub — cannot follow as another user', async () => {
            mockFollowsService.follow.mockResolvedValueOnce({ following: true });

            await app.inject({
                method: 'POST',
                url: `/follows/${VALID_UUID}`,
                headers: AUTH_HEADER,
            });

            const [followerId] = mockFollowsService.follow.mock.calls[0];
            expect(followerId).toBe(USER_ID);
        });
    });


    // ═══════════════════════════════════════════════════════════
    // Q: GDPR — soft-deleted account blocked
    // ═══════════════════════════════════════════════════════════

    describe('GDPR — soft-deleted account is blocked', () => {
        it('returns 403 on any social endpoint when account deleted', async () => {
            mockSupabase.auth.getUser.mockResolvedValueOnce({
                data: { user: { id: USER_ID, email: 'test@example.com', role: 'authenticated' } },
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
                url: '/feed/home',
                headers: AUTH_HEADER,
            });

            expect(res.statusCode).toBe(403);
            expect(JSON.parse(res.payload).error).toBe('This account has been deleted.');
        });
    });
});
