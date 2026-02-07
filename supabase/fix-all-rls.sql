-- ══════════════════════════════════════════════════════════
-- Comprehensive RLS Fix
-- Run this in Supabase SQL Editor to fix all policies
-- ══════════════════════════════════════════════════════════

-- 1. SECURITY DEFINER helper (bypasses RLS to break recursion)
CREATE OR REPLACE FUNCTION public.get_my_trip_ids()
RETURNS SETOF UUID AS $$
  SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Drop ALL existing policies to start clean
DROP POLICY IF EXISTS "trips_select_member" ON trips;
DROP POLICY IF EXISTS "trips_select_owner" ON trips;
DROP POLICY IF EXISTS "trips_insert_authenticated" ON trips;
DROP POLICY IF EXISTS "trips_update_owner" ON trips;
DROP POLICY IF EXISTS "trips_delete_owner" ON trips;

DROP POLICY IF EXISTS "trip_members_select" ON trip_members;
DROP POLICY IF EXISTS "trip_members_insert" ON trip_members;
DROP POLICY IF EXISTS "trip_members_delete" ON trip_members;

DROP POLICY IF EXISTS "trip_schedules_select" ON trip_schedules;
DROP POLICY IF EXISTS "trip_schedules_insert" ON trip_schedules;
DROP POLICY IF EXISTS "trip_schedules_update" ON trip_schedules;
DROP POLICY IF EXISTS "trip_schedules_delete" ON trip_schedules;

-- 3. Ensure RLS is enabled
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_schedules ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════
-- TRIPS policies
-- ══════════════════════════════════════════════════════════

-- SELECT: owner OR member can read
CREATE POLICY "trips_select_member" ON trips
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT public.get_my_trip_ids())
  );

-- INSERT: authenticated user can create (must be owner)
CREATE POLICY "trips_insert_authenticated" ON trips
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND owner_id = auth.uid()
  );

-- UPDATE: only owner
CREATE POLICY "trips_update_owner" ON trips
  FOR UPDATE USING (owner_id = auth.uid());

-- DELETE: only owner
CREATE POLICY "trips_delete_owner" ON trips
  FOR DELETE USING (owner_id = auth.uid());

-- ══════════════════════════════════════════════════════════
-- TRIP_MEMBERS policies
-- ══════════════════════════════════════════════════════════

-- SELECT: can see members of trips you belong to
CREATE POLICY "trip_members_select" ON trip_members
  FOR SELECT USING (
    trip_id IN (SELECT public.get_my_trip_ids())
  );

-- INSERT: owner can add, or self-join via invite
CREATE POLICY "trip_members_insert" ON trip_members
  FOR INSERT WITH CHECK (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- DELETE: owner can remove, or user can leave
CREATE POLICY "trip_members_delete" ON trip_members
  FOR DELETE USING (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- ══════════════════════════════════════════════════════════
-- TRIP_SCHEDULES policies
-- ══════════════════════════════════════════════════════════

-- SELECT: members can read
CREATE POLICY "trip_schedules_select" ON trip_schedules
  FOR SELECT USING (
    trip_id IN (SELECT public.get_my_trip_ids())
  );

-- INSERT: editor/owner can create
CREATE POLICY "trip_schedules_insert" ON trip_schedules
  FOR INSERT WITH CHECK (
    trip_id IN (
      SELECT trip_id FROM public.trip_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- UPDATE: editor/owner can update
CREATE POLICY "trip_schedules_update" ON trip_schedules
  FOR UPDATE USING (
    trip_id IN (
      SELECT trip_id FROM public.trip_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- DELETE: only owner
CREATE POLICY "trip_schedules_delete" ON trip_schedules
  FOR DELETE USING (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
  );

-- ══════════════════════════════════════════════════════════
-- join_trip_by_share_code function (ensure it exists)
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.join_trip_by_share_code(p_share_code TEXT)
RETURNS UUID AS $$
DECLARE
  v_trip_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find the trip
  SELECT id INTO v_trip_id FROM trips WHERE share_code = p_share_code;
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Invalid share code';
  END IF;

  -- Insert membership (ignore if already exists)
  INSERT INTO trip_members (trip_id, user_id, role)
  VALUES (v_trip_id, v_user_id, 'editor')
  ON CONFLICT (trip_id, user_id) DO NOTHING;

  RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════
-- Verify: check current policies
-- ══════════════════════════════════════════════════════════
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('trips', 'trip_members', 'trip_schedules')
ORDER BY tablename, policyname;
