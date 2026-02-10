-- ══════════════════════════════════════════════════════════
-- RAG: allow confidence = 'auto_verified' (auto-registered from AI schedule)
-- Run after rag_places_confidence.sql
-- ══════════════════════════════════════════════════════════

ALTER TABLE rag_places
  DROP CONSTRAINT IF EXISTS rag_places_confidence_check;

ALTER TABLE rag_places
  ADD CONSTRAINT rag_places_confidence_check
  CHECK (confidence IN ('verified', 'unverified', 'rejected', 'auto_verified'));

COMMENT ON COLUMN rag_places.confidence IS 'verified=Places API 매칭됨, unverified=미검증, rejected=매칭 실패, auto_verified=일정 생성 시 자동 검증·등록';
