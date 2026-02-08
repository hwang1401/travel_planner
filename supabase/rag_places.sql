-- ══════════════════════════════════════════════════════════
-- RAG: rag_places table (Phase 1)
-- Run in Supabase SQL Editor after schema.sql
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rag_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  region TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  name_ja TEXT,
  type TEXT NOT NULL CHECK (type IN ('food', 'spot', 'shop', 'stay', 'info')),
  description TEXT,
  address TEXT,
  lat NUMERIC,
  lon NUMERIC,
  price_range TEXT,
  opening_hours TEXT,
  tags TEXT[] DEFAULT '{}',
  typical_duration_min INT,
  recommended_time TEXT CHECK (recommended_time IN ('morning', 'noon', 'evening', 'any')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'api')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region, name_ko)
);

CREATE INDEX IF NOT EXISTS idx_rag_places_region ON rag_places(region);
CREATE INDEX IF NOT EXISTS idx_rag_places_type ON rag_places(type);
CREATE INDEX IF NOT EXISTS idx_rag_places_tags ON rag_places USING GIN(tags);

ALTER TABLE rag_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rag_places_read" ON rag_places;
CREATE POLICY "rag_places_read" ON rag_places
  FOR SELECT USING (true);

COMMENT ON TABLE rag_places IS 'RAG: places for itinerary generation (Japan-focused)';
