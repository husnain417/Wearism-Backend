-- 001_extensions.sql
-- Enable required PostgreSQL extensions

-- UUID generation for all primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vector similarity search for outfit/clothing embeddings (Phase 5)
CREATE EXTENSION IF NOT EXISTS vector;

-- Trigram search for product name search (Phase 7)
CREATE EXTENSION IF NOT EXISTS pg_trgm;