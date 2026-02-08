-- ══════════════════════════════════════════════════════════
-- RAG: rag_places confidence + Google Places fields
-- Run after rag_places.sql
-- ══════════════════════════════════════════════════════════

ALTER TABLE rag_places
  ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'unverified'
  CHECK (confidence IN ('verified', 'unverified', 'rejected'));

ALTER TABLE rag_places
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

ALTER TABLE rag_places
  ADD COLUMN IF NOT EXISTS rating NUMERIC;

ALTER TABLE rag_places
  ADD COLUMN IF NOT EXISTS review_count INT;

COMMENT ON COLUMN rag_places.confidence IS 'verified=Places API 매칭됨, unverified=미검증, rejected=매칭 실패';
COMMENT ON COLUMN rag_places.google_place_id IS 'Google Places place_id';
COMMENT ON COLUMN rag_places.review_count IS 'Places API user_ratings_total';
