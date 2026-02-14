-- ══════════════════════════════════════════════════════════
-- Fix: trip_schedules version auto-increment
-- 동시 편집 시 realtime 이벤트 순서 필터에 version 사용.
-- 현재 version이 항상 1이므로 두 번째 realtime부터 차단됨.
--
-- 실행: Supabase Dashboard → SQL Editor에서 이 파일 전체 실행
-- ══════════════════════════════════════════════════════════

-- 1) UPSERT + version 증가를 원자적으로 처리하는 RPC 함수
CREATE OR REPLACE FUNCTION public.save_trip_schedule(
  p_trip_id UUID,
  p_data JSONB,
  p_updated_by UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_version INTEGER;
BEGIN
  INSERT INTO trip_schedules (trip_id, data, version, updated_at, updated_by)
  VALUES (p_trip_id, p_data, 1, NOW(), p_updated_by)
  ON CONFLICT (trip_id) DO UPDATE SET
    data = EXCLUDED.data,
    version = trip_schedules.version + 1,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by
  RETURNING version INTO v_version;

  RETURN v_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
