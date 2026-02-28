-- 015_vendor.sql

-- Vendor profiles — extends a regular user into a vendor
CREATE TABLE public.vendor_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_name      TEXT NOT NULL,
  brand_logo_url  TEXT,
  brand_logo_path TEXT,
  description     TEXT,
  website_url     TEXT,
  status          vendor_status_enum DEFAULT 'pending',
  total_sales     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Products — listed by vendors
CREATE TABLE public.products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id       UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  listing_type    listing_type_enum DEFAULT 'vendor',

  -- For resale listings — links to original wardrobe item
  wardrobe_item_id UUID REFERENCES public.wardrobe_items(id) ON DELETE SET NULL,

  name            TEXT NOT NULL,
  description     TEXT,
  category        clothing_category_enum,
  subcategory     TEXT,
  colors          TEXT[],
  sizes           TEXT[],          -- available sizes e.g. ['S', 'M', 'L', 'XL']
  price           DECIMAL(10,2) NOT NULL,
  stock_quantity  INTEGER DEFAULT 0,
  image_urls      TEXT[],          -- array of Supabase Storage URLs
  image_paths     TEXT[],          -- for deletion
  status          product_status_enum DEFAULT 'draft',

  -- AI-generated embedding for recommendation engine
  embedding       vector(512),

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
