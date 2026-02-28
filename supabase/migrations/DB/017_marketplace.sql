-- 017_marketplace.sql

-- Cart items
CREATE TABLE public.cart_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size        TEXT,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id, size)  -- prevent duplicate cart entries
);

-- Orders
CREATE TABLE public.orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- ON DELETE RESTRICT on orders — we keep order history even if user deletes account
  -- Anonymise instead (GDPR compliant approach for financial records)

  status          order_status_enum DEFAULT 'pending',
  total_amount    DECIMAL(10,2) NOT NULL,
  currency        TEXT DEFAULT 'EUR',

  -- Shipping
  shipping_name     TEXT,
  shipping_address  TEXT,
  shipping_city     TEXT,
  shipping_country  TEXT,
  shipping_postcode TEXT,

  -- Payment reference (never store card details — use Stripe payment intent ID)
  payment_intent_id TEXT,
  payment_status    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Order line items
CREATE TABLE public.order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,    -- snapshot at time of purchase
  product_price DECIMAL(10,2) NOT NULL,
  size        TEXT,
  quantity    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
