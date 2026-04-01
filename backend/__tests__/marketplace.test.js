import { jest } from '@jest/globals';

// ── 1. Mock Services ──────────────────────────────────────
const mockVendorsService = {
    register: jest.fn(),
    getMyProfile: jest.fn(),
    updateProfile: jest.fn(),
    getPublicProfile: jest.fn(),
    getDashboardStats: jest.fn(),
};

const mockProductsService = {
    createProduct: jest.fn(),
    browseProducts: jest.fn(),
    getProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
    addProductImage: jest.fn(),
    createResaleListing: jest.fn(),
};

const mockCartService = {
    getCart: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
};

const mockOrdersService = {
    placeOrder: jest.fn(),
    listBuyerOrders: jest.fn(),
    listVendorOrders: jest.fn(),
    updateOrderStatus: jest.fn(),
    cancelOrder: jest.fn(),
};

// ── 2. Mock unstable modules ──────────────────────────────
jest.unstable_mockModule('../src/modules/marketplace/vendors/vendors.service.js', () => ({
    vendorsService: mockVendorsService,
}));
jest.unstable_mockModule('../src/modules/marketplace/products/products.service.js', () => ({
    productsService: mockProductsService,
}));
jest.unstable_mockModule('../src/modules/marketplace/cart/cart.service.js', () => ({
    cartService: mockCartService,
}));
jest.unstable_mockModule('../src/modules/marketplace/orders/orders.service.js', () => ({
    ordersService: mockOrdersService,
}));

// ── 3. Mock Supabase ──────────────────────────────────────
const mockSupabase = {
    auth: {
        getUser: jest.fn(),
    },
    from: jest.fn(),
    storage: {
        from: jest.fn().mockReturnValue({
            createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'mock-url' } }),
        }),
    },
};

jest.unstable_mockModule('../src/config/supabase.js', () => ({
    supabase: mockSupabase,
}));

// ── 4. Mock ioredis ──────────────────────────────────────
jest.unstable_mockModule('ioredis', () => ({
    Redis: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
    })),
    default: jest.fn(),
}));

// ── 5. Dynamic import AFTER mocks ────────────────────────
const { buildApp } = await import('../src/app.js');

// ── Helper: Auth Setup ───────────────────────────────────
function setupAuth(userId = 'user-123') {
    mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: 'test@example.com', role: 'authenticated' } },
        error: null,
    });

    // Profile soft-delete check
    mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
            return {
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: { deleted_at: null } }),
                    }),
                }),
            };
        }
        if (table === 'vendor_profiles') {
            return {
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: { id: 'vendor-123', status: 'approved' } }),
                    }),
                }),
            };
        }
        return { select: jest.fn() };
    });
}

describe('Phase 7 — Marketplace Module', () => {
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
    // VENDORS
    // ═══════════════════════════════════════════════════
    describe('Vendors Module', () => {
        it('POST /vendors/register - should register a new vendor', async () => {
            const payload = { shop_name: 'Test Shop', contact_email: 'shop@test.com' };
            mockVendorsService.register.mockResolvedValueOnce({ id: 'vendor-123', ...payload });

            const res = await app.inject({
                method: 'POST',
                url: '/vendors/register',
                headers: { authorization: 'Bearer token' },
                payload,
            });

            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.payload).success).toBe(true);
            expect(mockVendorsService.register).toHaveBeenCalledWith('user-123', payload);
        });

        it('GET /vendors/me - should get own profile', async () => {
            mockVendorsService.getMyProfile.mockResolvedValueOnce({ id: 'vendor-123', status: 'pending' });

            const res = await app.inject({
                method: 'GET',
                url: '/vendors/me',
                headers: { authorization: 'Bearer token' },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.payload).vendor.status).toBe('pending');
        });

        it('PATCH /vendors/me - approved vendor update', async () => {
            const payload = { shop_name: 'Updated Shop' };
            mockVendorsService.updateProfile.mockResolvedValueOnce({ id: 'vendor-123', ...payload });

            const res = await app.inject({
                method: 'PATCH',
                url: '/vendors/me',
                headers: { authorization: 'Bearer token' },
                payload,
            });

            expect(res.statusCode).toBe(200);
            expect(mockVendorsService.updateProfile).toHaveBeenCalledWith('user-123', payload);
        });

        it('GET /vendors/:vendorId - public profile', async () => {
            mockVendorsService.getPublicProfile.mockResolvedValueOnce({ shop_name: 'Public Shop' });

            const res = await app.inject({
                method: 'GET',
                url: '/vendors/vendor-123',
            });

            expect(res.statusCode).toBe(200);
        });
    });

    // ═══════════════════════════════════════════════════
    // PRODUCTS
    // ═══════════════════════════════════════════════════
    describe('Products Module', () => {
        it('POST /products - vendor creates product', async () => {
            const payload = { name: 'Dress', category: 'dresses', price: 100 };
            mockProductsService.createProduct.mockResolvedValueOnce({ id: 'prod-1', ...payload });

            const res = await app.inject({
                method: 'POST',
                url: '/products',
                headers: { authorization: 'Bearer token' },
                payload,
            });

            if (res.statusCode !== 201) console.error('POST /products failed:', res.payload);
            expect(res.statusCode).toBe(201);
            expect(mockProductsService.createProduct).toHaveBeenCalledWith('vendor-123', payload);
        });

        it('GET /products - browse catalog', async () => {
            mockProductsService.browseProducts.mockResolvedValueOnce({ 
                products: [], pagination: { total: 0, page: 1 } 
            });

            const res = await app.inject({
                method: 'GET',
                url: '/products?category=tops',
            });

            expect(res.statusCode).toBe(200);
            expect(mockProductsService.browseProducts).toHaveBeenCalledWith(expect.objectContaining({ category: 'tops' }));
        });

        it('POST /products/:id/images - upload product image', async () => {
            const payload = { image_path: 'user-123/img.webp' };
            mockProductsService.addProductImage.mockResolvedValueOnce({ id: 'img-1' });

            const res = await app.inject({
                method: 'POST',
                url: '/products/prod-1/images',
                headers: { authorization: 'Bearer token' },
                payload,
            });

            if (res.statusCode !== 201) console.error('POST /products/:id/images failed:', res.payload);
            expect(res.statusCode).toBe(201);
        });
    });

    // ═══════════════════════════════════════════════════
    // CART
    // ═══════════════════════════════════════════════════
    describe('Cart Module', () => {
        it('GET /cart - view cart', async () => {
            mockCartService.getCart.mockResolvedValueOnce({ items: [], subtotal: 0 });

            const res = await app.inject({
                method: 'GET',
                url: '/cart',
                headers: { authorization: 'Bearer token' },
            });

            expect(res.statusCode).toBe(200);
        });

        it('POST /cart/items - add item', async () => {
            const payload = { product_id: '550e8400-e29b-41d4-a716-446655440000', quantity: 2 };
            mockCartService.addItem.mockResolvedValueOnce({ id: 'cart-1' });

            const res = await app.inject({
                method: 'POST',
                url: '/cart/items',
                headers: { authorization: 'Bearer token' },
                payload,
            });

            if (res.statusCode !== 201) console.error('POST /cart/items failed:', res.payload);
            expect(res.statusCode).toBe(201);
            expect(mockCartService.addItem).toHaveBeenCalledWith('user-123', payload);
        });
    });

    // ═══════════════════════════════════════════════════
    // ORDERS
    // ═══════════════════════════════════════════════════
    describe('Orders Module', () => {
        it('POST /orders - place order from cart', async () => {
            const payload = { 
                delivery_address: '123 Main Street', 
                delivery_city: 'New York', 
                delivery_phone: '+1234567890' 
            };
            mockOrdersService.placeOrder.mockResolvedValueOnce({ orders: [{ id: 'order-1' }] });

            const res = await app.inject({
                method: 'POST',
                url: '/orders',
                headers: { authorization: 'Bearer token' },
                payload,
            });

            if (res.statusCode !== 201) console.error('POST /orders failed:', res.payload);
            expect(res.statusCode).toBe(201);
            expect(mockOrdersService.placeOrder).toHaveBeenCalledWith('user-123', payload);
        });

        it('GET /orders/vendor - vendor incoming orders', async () => {
            mockOrdersService.listVendorOrders.mockResolvedValueOnce({ orders: [] });

            const res = await app.inject({
                method: 'GET',
                url: '/orders/vendor',
                headers: { authorization: 'Bearer token' },
            });

            expect(res.statusCode).toBe(200);
            expect(mockOrdersService.listVendorOrders).toHaveBeenCalled();
        });

        it('PATCH /orders/:id/confirm - vendor confirms order', async () => {
            mockOrdersService.updateOrderStatus.mockResolvedValueOnce({ id: 'order-1', status: 'confirmed' });

            const res = await app.inject({
                method: 'PATCH',
                url: '/orders/order-1/confirm',
                headers: { authorization: 'Bearer token' },
            });

            expect(res.statusCode).toBe(200);
            expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith('vendor-123', 'order-1', 'confirmed');
        });
    });

    // ═══════════════════════════════════════════════════
    // SECURITY GUARDS
    // ═══════════════════════════════════════════════════
    describe('Security Guards', () => {
        it('requireVendor - rejects pending/non-vendors from vendor-only routes', async () => {
            // Override setupAuth for this test
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'profiles') {
                    return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { deleted_at: null } }) }) }) };
                }
                if (table === 'vendor_profiles') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({ data: { id: 'vendor-123', status: 'pending' } }),
                            }),
                        }),
                    };
                }
                return { select: jest.fn() };
            });

            const res = await app.inject({
                method: 'POST',
                url: '/products', // requireVendor protected
                headers: { authorization: 'Bearer token' },
                payload: { name: 'Valid Product Name', category: 'tops', price: 10.00 },
            });

            expect(res.statusCode).toBe(403);
            expect(JSON.parse(res.payload).error).toContain('pending');
        });
    });
});
