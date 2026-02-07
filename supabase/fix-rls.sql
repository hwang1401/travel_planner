-- ══════════════════════════════════════════════════════════
-- Fix: infinite recursion in trip_members RLS policy
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. Create a SECURITY DEFINER function to get user's trip IDs
--    This bypasses RLS, breaking the recursion cycle
CREATE OR REPLACE FUNCTION public.get_my_trip_ids()
RETURNS SETOF UUID AS $$
  SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "trip_members_select" ON trip_members;

-- 3. Recreate with the helper function (no recursion)
CREATE POLICY "trip_members_select" ON trip_members
  FOR SELECT USING (
    trip_id IN (SELECT public.get_my_trip_ids())
  );

-- 4. Also fix trips select policy to use the same function
DROP POLICY IF EXISTS "trips_select_member" ON trips;
CREATE POLICY "trips_select_member" ON trips
  FOR SELECT USING (
    id IN (SELECT public.get_my_trip_ids())
  );

-- 5. Fix trip_schedules select policy
DROP POLICY IF EXISTS "trip_schedules_select" ON trip_schedules;
CREATE POLICY "trip_schedules_select" ON trip_schedules
  FOR SELECT USING (
    trip_id IN (SELECT public.get_my_trip_ids())
  );

-- 6. Fix trip_schedules insert policy
DROP POLICY IF EXISTS "trip_schedules_insert" ON trip_schedules;
CREATE POLICY "trip_schedules_insert" ON trip_schedules
  FOR INSERT WITH CHECK (
    trip_id IN (
      SELECT trip_id FROM public.trip_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- 7. Fix trip_schedules update policy
DROP POLICY IF EXISTS "trip_schedules_update" ON trip_schedules;
CREATE POLICY "trip_schedules_update" ON trip_schedules
  FOR UPDATE USING (
    trip_id IN (
      SELECT trip_id FROM public.trip_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );
