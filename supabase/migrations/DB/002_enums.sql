-- 002_enums.sql
-- All ENUM types for the Wearism system

-- User attributes
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'non_binary', 'prefer_not_to_say');
CREATE TYPE age_range_enum AS ENUM ('13-17', '18-24', '25-34', '35-44', '45-54', '55+');
CREATE TYPE body_type_enum AS ENUM ('slim', 'athletic', 'average', 'curvy', 'plus_size');
CREATE TYPE skin_tone_enum AS ENUM ('fair', 'light', 'medium', 'olive', 'brown', 'dark');

-- Wardrobe
CREATE TYPE clothing_category_enum AS ENUM (
  'tops', 'bottoms', 'dresses', 'outerwear', 'footwear',
  'accessories', 'activewear', 'swimwear', 'underwear', 'sleepwear'
);
CREATE TYPE clothing_fit_enum AS ENUM ('slim', 'regular', 'relaxed', 'oversized');
CREATE TYPE clothing_season_enum AS ENUM ('spring', 'summer', 'autumn', 'winter', 'all_season');
CREATE TYPE clothing_condition_enum AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');

-- Outfits
CREATE TYPE outfit_occasion_enum AS ENUM (
  'casual', 'business_casual', 'formal', 'athletic',
  'outdoor', 'beach', 'evening', 'date_night'
);
CREATE TYPE outfit_status_enum AS ENUM ('draft', 'saved', 'published');

-- Ai 
CREATE TYPE ai_task_enum AS ENUM (
  'clothing_classification', 'outfit_rating',
  'age_estimation', 'height_estimation', 'full_analysis'
);
CREATE TYPE ai_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Social
CREATE TYPE post_status_enum AS ENUM ('published', 'hidden', 'removed');

-- Vendor / Marketplace
CREATE TYPE vendor_status_enum AS ENUM ('pending', 'approved', 'suspended');
CREATE TYPE product_status_enum AS ENUM ('draft', 'active', 'out_of_stock', 'archived');
CREATE TYPE order_status_enum AS ENUM (
  'pending', 'confirmed', 'processing',
  'shipped', 'delivered', 'cancelled', 'refunded'
);
CREATE TYPE listing_type_enum AS ENUM ('vendor', 'resale');
