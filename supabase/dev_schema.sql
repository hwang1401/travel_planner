-- =====================================================
-- TravelUnu: 개발계 스키마 (운영계에서 추출)
-- 데이터 없이 구조만 생성
-- =====================================================

-- 1. Functions (테이블/정책에서 참조하므로 먼저 생성)

CREATE OR REPLACE FUNCTION public.get_my_trip_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.increment_schedule_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    NEW.version := COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
  END;
  $$;

CREATE OR REPLACE FUNCTION public.join_trip_by_share_code(p_share_code text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_trip_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_trip_id FROM trips WHERE share_code = p_share_code;
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Invalid share code';
  END IF;

  INSERT INTO trip_members (trip_id, user_id, role)
  VALUES (v_trip_id, v_user_id, 'editor')
  ON CONFLICT (trip_id, user_id) DO NOTHING;

  RETURN v_trip_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_trip_schedule(p_trip_id uuid, p_data jsonb, p_updated_by uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

-- 2. Tables

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    email text,
    name text,
    avatar_url text,
    provider text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rag_places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region text NOT NULL,
    name_ko text NOT NULL,
    name_ja text,
    type text NOT NULL,
    description text,
    address text,
    lat numeric,
    lon numeric,
    price_range text,
    opening_hours text,
    tags text[] DEFAULT '{}'::text[],
    typical_duration_min integer,
    recommended_time text,
    source text DEFAULT 'manual'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    confidence text DEFAULT 'unverified'::text,
    google_place_id text,
    rating numeric,
    review_count integer,
    image_url text,
    business_status text,
    image_urls text[] DEFAULT '{}'::text[],
    short_address text,
    CONSTRAINT rag_places_confidence_check CHECK ((confidence = ANY (ARRAY['verified'::text, 'unverified'::text, 'rejected'::text, 'auto_verified'::text]))),
    CONSTRAINT rag_places_recommended_time_check CHECK ((recommended_time = ANY (ARRAY['morning'::text, 'noon'::text, 'evening'::text, 'any'::text]))),
    CONSTRAINT rag_places_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'ai'::text, 'api'::text]))),
    CONSTRAINT rag_places_type_check CHECK ((type = ANY (ARRAY['food'::text, 'spot'::text, 'shop'::text, 'stay'::text, 'info'::text])))
);

COMMENT ON TABLE public.rag_places IS 'RAG: places for itinerary generation (Japan-focused)';
COMMENT ON COLUMN public.rag_places.confidence IS 'verified=Places API 매칭됨, unverified=미검증, rejected=매칭 실패, auto_verified=일정 생성 시 자동 검증·등록';
COMMENT ON COLUMN public.rag_places.google_place_id IS 'Google Places place_id';
COMMENT ON COLUMN public.rag_places.review_count IS 'Places API user_ratings_total';
COMMENT ON COLUMN public.rag_places.image_url IS 'Supabase Storage public URL for place photo (uploaded from Google Places Photos API)';

CREATE TABLE IF NOT EXISTS public.trip_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid,
    title text NOT NULL,
    caption text DEFAULT ''::text,
    image_url text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    category text DEFAULT '기타'::text
);

CREATE TABLE IF NOT EXISTS public.trip_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'editor'::text,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trip_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])))
);

CREATE TABLE IF NOT EXISTS public.trip_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    destinations jsonb DEFAULT '[]'::jsonb,
    start_date date,
    end_date date,
    cover_color text DEFAULT 'linear-gradient(135deg, #3A7DB5, #5BAEE6)'::text,
    owner_id uuid NOT NULL,
    share_code text DEFAULT encode(extensions.gen_random_bytes(6), 'hex'::text),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cover_image text
);

-- 3. Primary Keys

ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.rag_places ADD CONSTRAINT rag_places_pkey PRIMARY KEY (id);
ALTER TABLE public.trip_documents ADD CONSTRAINT trip_documents_pkey PRIMARY KEY (id);
ALTER TABLE public.trip_members ADD CONSTRAINT trip_members_pkey PRIMARY KEY (id);
ALTER TABLE public.trip_schedules ADD CONSTRAINT trip_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.trips ADD CONSTRAINT trips_pkey PRIMARY KEY (id);

-- 4. Unique Constraints

ALTER TABLE public.rag_places ADD CONSTRAINT rag_places_region_name_ko_key UNIQUE (region, name_ko);
ALTER TABLE public.trip_members ADD CONSTRAINT trip_members_trip_id_user_id_key UNIQUE (trip_id, user_id);
ALTER TABLE public.trip_schedules ADD CONSTRAINT trip_schedules_trip_id_key UNIQUE (trip_id);
ALTER TABLE public.trips ADD CONSTRAINT trips_share_code_key UNIQUE (share_code);

-- 5. Foreign Keys

ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trip_documents ADD CONSTRAINT trip_documents_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
ALTER TABLE public.trip_members ADD CONSTRAINT trip_members_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
ALTER TABLE public.trip_members ADD CONSTRAINT trip_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.trip_schedules ADD CONSTRAINT trip_schedules_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
ALTER TABLE public.trip_schedules ADD CONSTRAINT trip_schedules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);
ALTER TABLE public.trips ADD CONSTRAINT trips_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);

-- 6. Indexes

CREATE INDEX IF NOT EXISTS idx_rag_places_region ON public.rag_places USING btree (region);
CREATE INDEX IF NOT EXISTS idx_rag_places_tags ON public.rag_places USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_rag_places_type ON public.rag_places USING btree (type);

-- 7. Triggers

CREATE TRIGGER trip_schedules_version_increment BEFORE UPDATE ON public.trip_schedules FOR EACH ROW EXECUTE FUNCTION public.increment_schedule_version();

-- 8. Auth trigger (회원가입 시 profiles 자동 생성)

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Row Level Security

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies

-- profiles
CREATE POLICY profiles_read ON public.profiles FOR SELECT USING (true);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((id = auth.uid()));

-- rag_places
CREATE POLICY rag_places_read ON public.rag_places FOR SELECT USING (true);

-- trip_documents
CREATE POLICY trip_documents_delete ON public.trip_documents FOR DELETE USING ((trip_id IN ( SELECT trips.id FROM public.trips WHERE (trips.owner_id = auth.uid()))));
CREATE POLICY trip_documents_insert ON public.trip_documents FOR INSERT WITH CHECK (true);
CREATE POLICY trip_documents_select ON public.trip_documents FOR SELECT USING ((trip_id IN ( SELECT public.get_my_trip_ids() AS get_my_trip_ids)));
CREATE POLICY trip_documents_update ON public.trip_documents FOR UPDATE USING ((trip_id IN ( SELECT trips.id FROM public.trips WHERE (trips.owner_id = auth.uid()))));

-- trip_members
CREATE POLICY trip_members_delete ON public.trip_members FOR DELETE USING (((trip_id IN ( SELECT trips.id FROM public.trips WHERE (trips.owner_id = auth.uid()))) OR (user_id = auth.uid())));
CREATE POLICY trip_members_insert ON public.trip_members FOR INSERT WITH CHECK (((trip_id IN ( SELECT trips.id FROM public.trips WHERE (trips.owner_id = auth.uid()))) OR (user_id = auth.uid())));
CREATE POLICY trip_members_select ON public.trip_members FOR SELECT USING ((trip_id IN ( SELECT public.get_my_trip_ids() AS get_my_trip_ids)));

-- trip_schedules
CREATE POLICY trip_schedules_delete ON public.trip_schedules FOR DELETE USING ((trip_id IN ( SELECT trips.id FROM public.trips WHERE (trips.owner_id = auth.uid()))));
CREATE POLICY trip_schedules_insert ON public.trip_schedules FOR INSERT WITH CHECK ((trip_id IN ( SELECT trip_members.trip_id FROM public.trip_members WHERE ((trip_members.user_id = auth.uid()) AND (trip_members.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));
CREATE POLICY trip_schedules_select ON public.trip_schedules FOR SELECT USING ((trip_id IN ( SELECT public.get_my_trip_ids() AS get_my_trip_ids)));
CREATE POLICY trip_schedules_update ON public.trip_schedules FOR UPDATE USING ((trip_id IN ( SELECT trip_members.trip_id FROM public.trip_members WHERE ((trip_members.user_id = auth.uid()) AND (trip_members.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));

-- trips
CREATE POLICY trips_delete_owner ON public.trips FOR DELETE USING ((owner_id = auth.uid()));
CREATE POLICY trips_insert_authenticated ON public.trips FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (owner_id = auth.uid())));
CREATE POLICY trips_select_member ON public.trips FOR SELECT USING (((owner_id = auth.uid()) OR (id IN ( SELECT public.get_my_trip_ids() AS get_my_trip_ids))));
CREATE POLICY trips_update_owner ON public.trips FOR UPDATE USING ((owner_id = auth.uid()));
