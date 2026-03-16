-- 024_marketplace.sql  PART 1

DO $$ BEGIN
  CREATE TYPE vendor_status_enum AS ENUM ('pending','approved','suspended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE product_condition_enum AS ENUM ('new','like_new','good','fair','poor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE product_status_enum AS ENUM ('draft','active','sold','archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE order_status_enum AS ENUM (
    'pending_confirmation','confirmed','shipped','delivered','completed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE product_category_enum AS ENUM (
    'tops','bottoms','outerwear','footwear','accessories','dresses',
    'bags','jewelry','activewear','swimwear','other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 024_marketplace.sql  PART 2
-- ═══════════════════════════════════════════════════
-- vendor_profiles (1-to-1 with profiles)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  shop_name        TEXT NOT NULL CHECK (char_length(shop_name) BETWEEN 2 AND 100),
  shop_description TEXT,
  shop_logo_url    TEXT,
  shop_logo_path   TEXT,
  shop_banner_url  TEXT,
  shop_banner_path TEXT,

  contact_email    TEXT NOT NULL,
  contact_phone    TEXT,
  business_address TEXT,

  status           vendor_status_enum DEFAULT 'pending',
  rejection_reason TEXT,
  approved_at      TIMESTAMPTZ,

  -- Denormalised stats (maintained by triggers)
  total_sales      INT DEFAULT 0,
  total_revenue    NUMERIC(12,2) DEFAULT 0,
  products_count   INT DEFAULT 0,
  avg_rating       NUMERIC(3,2) DEFAULT 0,
  rating_count     INT DEFAULT 0,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Read approved vendors"
    ON public.vendor_profiles FOR SELECT
    USING (status = 'approved' OR auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Vendors manage own profile"
    ON public.vendor_profiles FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_user   ON public.vendor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_status ON public.vendor_profiles(status);

DROP TRIGGER IF EXISTS trg_vendor_profiles_updated_at ON public.vendor_profiles;
CREATE TRIGGER trg_vendor_profiles_updated_at
  BEFORE UPDATE ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ═══════════════════════════════════════════════════
-- products
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id         UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  wardrobe_item_id  UUID REFERENCES public.wardrobe_items(id) ON DELETE SET NULL,

  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 150),
  description       TEXT,
  category          product_category_enum NOT NULL,
  brand             TEXT,
  condition         product_condition_enum DEFAULT 'new',

  price             NUMERIC(10,2) NOT NULL CHECK (price > 0),
  original_price    NUMERIC(10,2),
  currency          VARCHAR(3) DEFAULT 'PKR',

  stock_quantity    INT DEFAULT 1 CHECK (stock_quantity >= 0),
  is_resale         BOOLEAN DEFAULT FALSE,
  status            product_status_enum DEFAULT 'draft',

  -- Denormalised primary image for fast list queries
  primary_image_url TEXT,

  tags              TEXT[],
  ai_attributes     TEXT[],
  wardrobe_slot     VARCHAR(20),

  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add missing columns if the table already existed
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS condition         product_condition_enum DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS original_price    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency          VARCHAR(3) DEFAULT 'PKR',
  ADD COLUMN IF NOT EXISTS is_resale         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT,
  ADD COLUMN IF NOT EXISTS tags              TEXT[],
  ADD COLUMN IF NOT EXISTS ai_attributes     TEXT[],
  ADD COLUMN IF NOT EXISTS wardrobe_slot     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Read active products"
    ON public.products FOR SELECT
    USING (status = 'active' AND deleted_at IS NULL);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Vendors manage own products"
    ON public.products FOR ALL
    USING (
      deleted_at IS NULL AND
      EXISTS (SELECT 1 FROM public.vendor_profiles
              WHERE id = products.vendor_id AND user_id = auth.uid())
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.vendor_profiles
              WHERE id = products.vendor_id AND user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_products_vendor   ON public.products(vendor_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category, status)           WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_status   ON public.products(status, created_at DESC)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_price    ON public.products(price)                      WHERE status='active' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_resale   ON public.products(is_resale)                  WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_products_tags     ON public.products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_fts      ON public.products USING GIN(to_tsvector('english', name));

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ═══════════════════════════════════════════════════
-- product_images (up to 6 per product)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.product_images (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  image_path  TEXT NOT NULL,
  is_primary  BOOLEAN DEFAULT FALSE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone reads product images"
    ON public.product_images FOR SELECT USING (TRUE);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Vendors manage own product images"
    ON public.product_images FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.vendor_profiles v ON v.id = p.vendor_id
        WHERE p.id = product_images.product_id AND v.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id, sort_order);


-- ═══════════════════════════════════════════════════
-- cart_items
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cart_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id)  ON DELETE CASCADE,
  quantity    INT NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own cart"
    ON public.cart_items FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON public.cart_items(user_id);

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ═══════════════════════════════════════════════════
-- orders
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id         UUID NOT NULL REFERENCES public.profiles(id)        ON DELETE RESTRICT,
  vendor_id        UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE RESTRICT,

  delivery_address TEXT NOT NULL,
  delivery_city    TEXT NOT NULL,
  delivery_phone   TEXT NOT NULL,
  delivery_notes   TEXT,

  subtotal         NUMERIC(12,2) NOT NULL,
  total_amount     NUMERIC(12,2) NOT NULL,
  currency         VARCHAR(3) DEFAULT 'PKR',

  payment_method   VARCHAR(20) DEFAULT 'cash_on_delivery',
  payment_status   VARCHAR(20) DEFAULT 'pending',

  status           order_status_enum DEFAULT 'pending_confirmation',
  cancelled_reason TEXT,

  confirmed_at  TIMESTAMPTZ,
  shipped_at    TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Handle cases where orders table exists but uses user_id instead of buyer_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='orders' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN user_id TO buyer_id;
  END IF;
END $$;

-- Safely add missing columns if the table already existed
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS vendor_id        UUID REFERENCES public.vendor_profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_phone   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes   TEXT,
  ADD COLUMN IF NOT EXISTS subtotal         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_amount     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency         VARCHAR(3) DEFAULT 'PKR',
  ADD COLUMN IF NOT EXISTS payment_method   VARCHAR(20) DEFAULT 'cash_on_delivery',
  ADD COLUMN IF NOT EXISTS payment_status   VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS status           order_status_enum DEFAULT 'pending_confirmation',
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at     TIMESTAMPTZ;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Buyers read own orders"
    ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Vendors read their orders"
    ON public.orders FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.vendor_profiles
              WHERE id = orders.vendor_id AND user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Buyers place orders"
    ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_orders_buyer  ON public.orders(buyer_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON public.orders(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ═══════════════════════════════════════════════════
-- order_items (price snapshot — never changes)
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.order_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       UUID NOT NULL REFERENCES public.orders(id)   ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name   TEXT NOT NULL,
  product_image  TEXT,
  unit_price     NUMERIC(10,2) NOT NULL,
  quantity       INT NOT NULL DEFAULT 1,
  line_total     NUMERIC(12,2) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add missing columns if the table already existed
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_image  TEXT,
  ADD COLUMN IF NOT EXISTS unit_price     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS quantity       INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS line_total     NUMERIC(12,2);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Order parties read order items"
    ON public.order_items FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id AND (
          o.buyer_id = auth.uid() OR
          EXISTS (SELECT 1 FROM public.vendor_profiles v
                  WHERE v.id = o.vendor_id AND v.user_id = auth.uid())
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);


-- ═══════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════

-- vendor products_count
CREATE OR REPLACE FUNCTION public.update_vendor_products_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.vendor_profiles SET products_count = products_count + 1 WHERE id = NEW.vendor_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.vendor_profiles SET products_count = GREATEST(products_count - 1, 0) WHERE id = OLD.vendor_id;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_vendor_products_count
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_vendor_products_count();


-- vendor total_sales + total_revenue on order completed
CREATE OR REPLACE FUNCTION public.update_vendor_sales_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.vendor_profiles
    SET total_sales = total_sales + 1, total_revenue = total_revenue + NEW.total_amount
    WHERE id = NEW.vendor_id;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_vendor_sales_stats
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_vendor_sales_stats();


-- sync wardrobe_item.is_sold when resale product is sold
CREATE OR REPLACE FUNCTION public.sync_wardrobe_item_sold()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'sold' AND OLD.status <> 'sold' AND NEW.wardrobe_item_id IS NOT NULL THEN
    UPDATE public.wardrobe_items
    SET is_sold = TRUE, sold_at = NOW()
    WHERE id = NEW.wardrobe_item_id;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_sync_wardrobe_sold
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_wardrobe_item_sold();


-- ═══════════════════════════════════════════════════
-- wardrobe_items resale columns
-- ═══════════════════════════════════════════════════
ALTER TABLE public.wardrobe_items
  ADD COLUMN IF NOT EXISTS is_sold            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sold_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_listed_for_sale BOOLEAN DEFAULT FALSE;


-- ═══════════════════════════════════════════════════
-- increment_stock RPC (safe stock restore on cancel)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_stock(p_product_id UUID, p_qty INT)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.products
  SET stock_quantity = stock_quantity + p_qty
  WHERE id = p_product_id;
$$;
