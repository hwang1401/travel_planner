-- ══════════════════════════════════════════════════════════
-- RAG: rag_places INSERT/UPDATE 허용 (RLS)
-- 스크립트(npm run rag-seed)가 anon 키로 삽입할 수 있도록.
-- Supabase SQL Editor에서 실행.
-- ══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "rag_places_insert" ON rag_places;
CREATE POLICY "rag_places_insert" ON rag_places
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "rag_places_update" ON rag_places;
CREATE POLICY "rag_places_update" ON rag_places
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "rag_places_delete" ON rag_places;
CREATE POLICY "rag_places_delete" ON rag_places
  FOR DELETE USING (true);
