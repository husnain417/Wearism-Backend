-- Create profiles table
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  -- GDPR: collected only after explicit user action
  height_cm     INTEGER,
  weight_kg     DECIMAL(5,2),
  body_type     TEXT,
  skin_tone     TEXT,
  gender        TEXT,
  age_range     TEXT,
  -- GDPR compliance fields
  gdpr_consent          BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_consent_date     TIMESTAMPTZ,
  gdpr_consent_version  TEXT DEFAULT '1.0',
  data_deletion_requested BOOLEAN DEFAULT FALSE,
  -- Timestamps
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ  -- soft delete for GDPR right to erasure
);
