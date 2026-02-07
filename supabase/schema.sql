-- ══════════════════════════════════════════════════════════
-- TravelUnu Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ══════════════════════════════════════════════════════════

-- ── 1. Profiles (linked to Supabase Auth users) ──
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  provider TEXT,  -- 'kakao' | 'google'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    NEW.raw_app_meta_data->>'provider'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: create profile after auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 2. Trips ──
CREATE TABLE IF NOT EXISTS trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  destinations JSONB DEFAULT '[]'::jsonb,
  start_date DATE,
  end_date DATE,
  cover_color TEXT DEFAULT 'linear-gradient(135deg, #3A7DB5, #5BAEE6)',
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  share_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ── 3. Trip Members (sharing) ──
CREATE TABLE IF NOT EXISTS trip_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'editor',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);


-- ── 4. Trip Schedules (itinerary data per trip) ──
CREATE TABLE IF NOT EXISTS trip_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);


-- ══════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ══════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_schedules ENABLE ROW LEVEL SECURITY;

-- ── Profiles: users can read any profile, update own ──
CREATE POLICY "profiles_read" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ── Trips: members can read, owner can update/delete ──
CREATE POLICY "trips_select_member" ON trips
  FOR SELECT USING (
    id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY "trips_insert_authenticated" ON trips
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "trips_update_owner" ON trips
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "trips_delete_owner" ON trips
  FOR DELETE USING (owner_id = auth.uid());

-- ── Trip Members: members can read their trip members, owner manages ──
CREATE POLICY "trip_members_select" ON trip_members
  FOR SELECT USING (
    trip_id IN (SELECT trip_id FROM trip_members AS tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY "trip_members_insert" ON trip_members
  FOR INSERT WITH CHECK (
    -- Owner can add members, or self-join via invite
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "trip_members_delete" ON trip_members
  FOR DELETE USING (
    -- Owner can remove members, or user can leave
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- ── Trip Schedules: members can read, editor/owner can write ──
CREATE POLICY "trip_schedules_select" ON trip_schedules
  FOR SELECT USING (
    trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY "trip_schedules_insert" ON trip_schedules
  FOR INSERT WITH CHECK (
    trip_id IN (
      SELECT trip_id FROM trip_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "trip_schedules_update" ON trip_schedules
  FOR UPDATE USING (
    trip_id IN (
      SELECT trip_id FROM trip_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "trip_schedules_delete" ON trip_schedules
  FOR DELETE USING (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
  );


-- ══════════════════════════════════════════════════════════
-- Enable Realtime
-- ══════════════════════════════════════════════════════════
-- Run these in Supabase Dashboard → Database → Replication
-- or use the SQL below:

ALTER PUBLICATION supabase_realtime ADD TABLE trip_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_members;


-- ══════════════════════════════════════════════════════════
-- Helper function: join trip by share_code
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
