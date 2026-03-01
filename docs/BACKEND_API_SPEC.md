# TravelUNU Backend & API 명세서

> 최종 업데이트: 2026-03-01

---

## 목차
1. [시스템 아키텍처](#1-시스템-아키텍처)
2. [환경 구성](#2-환경-구성)
3. [Edge Functions (서버 API)](#3-edge-functions-서버-api)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [RLS 정책](#5-rls-정책)
6. [DB 함수 & 트리거](#6-db-함수--트리거)
7. [Storage](#7-storage)
8. [인증 (Auth)](#8-인증-auth)
9. [클라이언트 → API 호출 맵](#9-클라이언트--api-호출-맵)
10. [외부 API](#10-외부-api)
11. [환경 변수](#11-환경-변수)
12. [보안 설정](#12-보안-설정)

---

## 1. 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│  Client (React + Capacitor)                              │
│  Web / iOS (ASWebAuthSession) / Android (Custom Tabs)    │
└──────┬───────────┬──────────────┬────────────────────────┘
       │           │              │
       │  Supabase │   Google     │  Google Maps
       │  Auth     │   Places     │  JS SDK
       │  (Kakao)  │   JS SDK     │  (Autocomplete)
       │           │              │
┌──────▼───────────▼──────────────▼────────────────────────┐
│                    Supabase                               │
│  ┌─────────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │ Edge Funcs  │ │ Realtime │ │      Storage           │ │
│  │             │ │          │ │  images (public)       │ │
│  │ gemini-     │ │ schedule │ │  ├── rag/{region}/     │ │
│  │   proxy     │ │ members  │ │  └── trips/{id}/      │ │
│  │ verify-and- │ │ presence │ └────────────────────────┘ │
│  │   register  │ └──────────┘                            │
│  │ cache-place │                                         │
│  │   -photo    │ ┌──────────────────────────────────────┐ │
│  └──────┬──────┘ │         PostgreSQL                   │ │
│         │        │  profiles | trips | trip_members     │ │
│         │        │  trip_schedules | trip_documents     │ │
│         │        │  rag_places (1,778 prod / 21 dev)   │ │
│         │        └──────────────────────────────────────┘ │
└─────────┼────────────────────────────────────────────────┘
          │
    ┌─────▼──────────────────────┐
    │   External APIs            │
    │  ├── Gemini 2.5 Flash      │
    │  ├── Google Places (New)   │
    │  └── Google Places Photos  │
    └────────────────────────────┘
```

---

## 2. 환경 구성

| 항목 | 운영계 (Production) | 개발계 (Development) |
|------|---------------------|---------------------|
| **Supabase Ref** | `rjjfcnstdzwiwpblrxtz` | `xutumbkvuurmvdxnbnmz` |
| **리전** | Sydney (ap-southeast-2) | Tokyo (ap-northeast-1) |
| **Git 브랜치** | `main` | `develop` |
| **빌드 커맨드** | `npm run build` | `npx vite build --mode development` |
| **env 파일** | `.env.production` | `.env.development` |
| **Auth site_url** | `https://travelunu.com` | `https://travelplanner-dev.vercel.app` |

---

## 3. Edge Functions (서버 API)

Base URL: `{SUPABASE_URL}/functions/v1/`

### 3.1 `gemini-proxy`

AI 요청을 서버에서 프록시하여 Gemini API 키 노출 방지.

| 항목 | 값 |
|------|---|
| **Method** | `POST` |
| **Auth** | `Authorization: Bearer {ANON_KEY}` |
| **CORS** | travelunu.com, localhost:3000/5173, capacitor://localhost |

**Request**: Gemini `generateContent` body를 그대로 전달

**Response**: Gemini API 응답을 그대로 반환

| Status | 의미 |
|--------|------|
| 200 | 정상 (Gemini 응답) |
| 400 | Invalid JSON |
| 405 | POST 외 메서드 |
| 500 | GEMINI_API_KEY 미설정 |
| 502 | Gemini API 연결 실패 |

**Secrets**: `GEMINI_API_KEY`

---

### 3.2 `verify-and-register-places`

AI가 추천한 장소를 Google Places API로 검증하고 `rag_places`에 등록.

| 항목 | 값 |
|------|---|
| **Method** | `POST` |
| **Auth** | `Authorization: Bearer {ANON_KEY}` |
| **Daily Limit** | 50건/일 (auto_verified) |

**Request Body**:
```json
{
  "places": [
    {
      "desc": "이치란 라멘 도톤보리점",  // 장소명 (필수)
      "type": "food",                   // food|spot|shop|stay (필수)
      "address": "...",                 // 선택
      "region": "osaka"                 // 선택
    }
  ],
  "regionHint": "osaka"                 // 선택
}
```

**Response Body**:
```json
{
  "ok": true,
  "registered": 2,
  "daily_limit_reached": false,
  "results": [
    {
      "desc": "이치란 라멘 도톤보리점",
      "address": "1-4-16 Dōtonbori, Chuo Ward, Osaka",
      "short_address": "1-4-16 Dōtonbori, Chuo Ward",
      "lat": 34.668,
      "lon": 135.503,
      "image_url": "https://...supabase.co/storage/v1/.../photo.jpg",
      "image_urls": ["url1", "url2", "url3"],
      "placeId": "ChIJK7TL6RTnAGAR...",
      "rating": 4.3,
      "reviewCount": 8470,
      "opening_hours": "월요일: 24시간 영업; 화요일: ...",
      "business_status": "OPERATIONAL"
    }
  ]
}
```

**처리 흐름**:
1. `rag_places`에서 `name_ko` + `region`으로 캐시 조회
2. 캐시 히트 → `enrichCachedPlace` (rating/image/hours 보완) → 반환
3. 캐시 미스 → Google Text Search (JA+KO 이중 검색, locationBias 50km)
4. 이름 매칭 (정규화, 카타카나→히라가나, LCS 60% 임계값)
5. 리전 검증 (100km 초과 시 거부)
6. Place Details API (ko) → `rag_places` upsert
7. 사진 최대 3장 다운로드 → Storage 업로드

**Secrets**: `GOOGLE_PLACES_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**지원 리전** (39개): 일본 34개 도시, 한국 (seoul, busan, jeju), 아시아 (taipei, bangkok, singapore, hongkong, danang, hanoi)

---

### 3.3 `cache-place-photo`

Google Places 사진을 Supabase Storage에 캐싱.

| 항목 | 값 |
|------|---|
| **Method** | `POST` |
| **Auth** | `Authorization: Bearer {ANON_KEY}` |
| **호출 방식** | Fire-and-forget (클라이언트에서 비동기) |

**Request Body**:
```json
{
  "placeId": "ChIJK7TL6RTnAGAR..."  // Google Place ID (필수)
}
```

**Response Body**:
```json
// 성공
{ "ok": true, "image_url": "https://...", "image_urls": ["url1", "url2", "url3"] }

// 스킵 사유
{ "ok": true, "skipped": true, "reason": "no_rag_record|already_cached|places_api_error|no_photo" }

// 실패
{ "ok": false, "error": "all_uploads_failed" }
```

**처리 흐름**:
1. `rag_places`에서 `google_place_id`로 조회
2. 이미 `image_url` 있으면 스킵
3. Google Places API로 사진 메타데이터 조회
4. `pickTopPhotoNames`: widthPx ≥ 400 우선, 최대 3장
5. `maxWidthPx=1600`으로 다운로드 (80ms 간격)
6. Storage `rag/{region}/{placeId}[_2|_3].jpg` 업로드
7. `rag_places.image_url`, `image_urls` 업데이트

**Secrets**: `GOOGLE_PLACES_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. 데이터베이스 스키마

### 4.1 `profiles`

| Column | Type | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | uuid | NO | — | PK, FK → auth.users(id) CASCADE |
| `email` | text | YES | — | |
| `name` | text | YES | — | |
| `avatar_url` | text | YES | — | |
| `provider` | text | YES | — | "kakao" |
| `created_at` | timestamptz | YES | now() | |

### 4.2 `trips`

| Column | Type | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `name` | text | NO | — | |
| `destinations` | jsonb | YES | '[]' | [{name, lat, lon, ...}] |
| `start_date` | date | YES | — | |
| `end_date` | date | YES | — | |
| `cover_color` | text | YES | 'linear-gradient(...)' | |
| `cover_image` | text | YES | — | |
| `owner_id` | uuid | NO | — | FK → profiles(id) |
| `share_code` | text | YES | encode(gen_random_bytes(6),'hex') | UNIQUE |
| `created_at` | timestamptz | YES | now() | |
| `updated_at` | timestamptz | YES | now() | |

### 4.3 `trip_members`

| Column | Type | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `trip_id` | uuid | NO | — | FK → trips(id) CASCADE |
| `user_id` | uuid | NO | — | FK → profiles(id) CASCADE |
| `role` | text | YES | 'editor' | owner / editor / viewer |
| `joined_at` | timestamptz | YES | now() | |

UNIQUE: (`trip_id`, `user_id`)

### 4.4 `trip_schedules`

| Column | Type | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `trip_id` | uuid | NO | — | FK → trips(id) CASCADE, UNIQUE |
| `data` | jsonb | NO | '{}' | 전체 일정 데이터 |
| `version` | integer | YES | 1 | UPDATE 시 자동 증가 |
| `updated_at` | timestamptz | YES | now() | |
| `updated_by` | uuid | YES | — | FK → profiles(id) |

### 4.5 `trip_documents`

| Column | Type | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `trip_id` | uuid | YES | — | FK → trips(id) CASCADE |
| `title` | text | NO | — | |
| `caption` | text | YES | '' | |
| `image_url` | text | YES | '' | |
| `category` | text | YES | '기타' | |
| `created_at` | timestamptz | YES | now() | |

### 4.6 `rag_places`

| Column | Type | Nullable | Default | 비고 |
|--------|------|----------|---------|------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `region` | text | NO | — | osaka, tokyo 등 |
| `name_ko` | text | NO | — | 한국어 이름 |
| `name_ja` | text | YES | — | 일본어 이름 |
| `type` | text | NO | — | food / spot / shop / stay |
| `description` | text | YES | — | |
| `address` | text | YES | — | 전체 주소 |
| `short_address` | text | YES | — | 짧은 주소 |
| `lat` | numeric | YES | — | |
| `lon` | numeric | YES | — | |
| `price_range` | text | YES | — | |
| `opening_hours` | text | YES | — | "월요일: 11:00 – 23:00; ..." |
| `tags` | text[] | YES | '{}' | {"현지인맛집","가성비"} |
| `typical_duration_min` | integer | YES | — | |
| `recommended_time` | text | YES | — | morning/noon/evening/any |
| `source` | text | YES | 'manual' | manual / ai / api |
| `confidence` | text | YES | 'unverified' | verified / auto_verified / unverified |
| `google_place_id` | text | YES | — | |
| `rating` | numeric | YES | — | |
| `review_count` | integer | YES | — | |
| `image_url` | text | YES | — | 대표 이미지 |
| `image_urls` | text[] | YES | '{}' | 최대 3장 |
| `business_status` | text | YES | — | OPERATIONAL 등 |
| `created_at` | timestamptz | YES | now() | |
| `updated_at` | timestamptz | YES | now() | |

UNIQUE: (`region`, `name_ko`)

### 4.7 인덱스

| 테이블 | 인덱스 | 타입 | 컬럼 |
|--------|--------|------|------|
| rag_places | idx_rag_places_region | btree | region |
| rag_places | idx_rag_places_type | btree | type |
| rag_places | idx_rag_places_tags | GIN | tags |
| trips | trips_share_code_key | UNIQUE | share_code |
| trip_members | trip_members_trip_id_user_id_key | UNIQUE | trip_id, user_id |
| trip_schedules | trip_schedules_trip_id_key | UNIQUE | trip_id |

### 4.8 FK Cascade 규칙

| 테이블.컬럼 | 참조 | ON DELETE |
|-------------|------|-----------|
| profiles.id | auth.users(id) | CASCADE |
| trips.owner_id | profiles(id) | NO ACTION |
| trip_members.trip_id | trips(id) | CASCADE |
| trip_members.user_id | profiles(id) | CASCADE |
| trip_schedules.trip_id | trips(id) | CASCADE |
| trip_documents.trip_id | trips(id) | CASCADE |

---

## 5. RLS 정책

| 테이블 | 정책명 | 명령 | 조건 |
|--------|--------|------|------|
| **profiles** | profiles_read | SELECT | true (공개 읽기) |
| | profiles_update_own | UPDATE | id = auth.uid() |
| **trips** | trips_select_member | SELECT | owner이거나 trip_members |
| | trips_insert_authenticated | INSERT | 인증 + owner_id = self |
| | trips_update_owner | UPDATE | owner_id = auth.uid() |
| | trips_delete_owner | DELETE | owner_id = auth.uid() |
| **trip_members** | trip_members_select | SELECT | trip_id ∈ get_my_trip_ids() |
| | trip_members_insert | INSERT | trip owner이거나 self |
| | trip_members_delete | DELETE | trip owner이거나 self |
| **trip_schedules** | trip_schedules_select | SELECT | trip_id ∈ get_my_trip_ids() |
| | trip_schedules_insert | INSERT | role ∈ (owner, editor) |
| | trip_schedules_update | UPDATE | role ∈ (owner, editor) |
| | trip_schedules_delete | DELETE | trip owner만 |
| **trip_documents** | trip_documents_select | SELECT | trip_id ∈ get_my_trip_ids() |
| | trip_documents_insert | INSERT | true (인증 유저) |
| | trip_documents_update | UPDATE | trip owner |
| | trip_documents_delete | DELETE | trip owner |
| **rag_places** | rag_places_read | SELECT | true (공개 읽기, 쓰기 불가) |

---

## 6. DB 함수 & 트리거

### 함수

| 함수명 | 리턴 | 용도 |
|--------|------|------|
| `get_my_trip_ids()` | uuid[] | 현재 유저가 속한 trip_id 목록 (RLS에서 사용) |
| `handle_new_user()` | trigger | auth.users INSERT → profiles 자동 생성 |
| `increment_schedule_version()` | trigger | trip_schedules UPDATE → version +1 |
| `join_trip_by_share_code(text)` | uuid | 공유 코드로 여행 참여 (editor로 추가) |
| `save_trip_schedule(uuid, jsonb, uuid)` | integer | 일정 atomic upsert, version 반환 |

### 트리거

| 트리거 | 테이블 | 이벤트 | 함수 |
|--------|--------|--------|------|
| on_auth_user_created | auth.users | AFTER INSERT | handle_new_user() |
| trip_schedules_version_increment | trip_schedules | BEFORE UPDATE | increment_schedule_version() |

---

## 7. Storage

**버킷**: `images` (public: true)

### 정책

| 정책 | 명령 | 대상 | 조건 |
|------|------|------|------|
| images_read | SELECT | public | bucket_id = 'images' |
| images_upload | INSERT | authenticated | bucket_id = 'images' |
| images_delete | DELETE | authenticated | bucket_id = 'images' |

### 저장 경로

| 경로 패턴 | 용도 | 생성 주체 |
|-----------|------|-----------|
| `rag/{region}/{placeId}.jpg` | RAG 장소 대표 사진 | Edge Function |
| `rag/{region}/{placeId}_2.jpg` | RAG 장소 추가 사진 | Edge Function |
| `trips/{tripId}/cover_{ts}.jpg` | 여행 커버 이미지 | Client |
| `trips/{tripId}/items/{ts}.jpg` | 일정 아이템 이미지 | Client |
| `trips/{tripId}/docs/{ts}.jpg` | 문서 이미지/PDF | Client |

---

## 8. 인증 (Auth)

| 항목 | 값 |
|------|---|
| **Provider** | Kakao OAuth |
| **Flow** | PKCE (`flowType: 'pkce'`) |
| **Session** | localStorage, autoRefresh |

### 플랫폼별 OAuth 흐름

| 플랫폼 | 방식 | 콜백 |
|--------|------|------|
| **Web** | `signInWithOAuth` 리다이렉트 | `{origin}/` |
| **iOS** | ASWebAuthenticationSession (네이티브 플러그인) | `com.travelunu.app://login-callback/?code=xxx` |
| **Android** | Chrome Custom Tabs + appUrlOpen 리스너 | `com.travelunu.app://login-callback/?code=xxx` |

### 프로필 자동 생성

`auth.users` INSERT → `handle_new_user()` 트리거:
- `name`: Kakao `full_name` 또는 `name`
- `avatar_url`: Kakao `avatar_url` 또는 `picture`
- `provider`: `"kakao"`

---

## 9. 클라이언트 → API 호출 맵

### Edge Function 호출

| 서비스 | Edge Function | 용도 |
|--------|---------------|------|
| geminiService.js | `gemini-proxy` | 모든 AI 요청 (채팅, 추천, 일정 생성) |
| geminiService.js | `verify-and-register-places` | AI 추천 장소 검증 & 등록 |
| ragService.js | `cache-place-photo` | 장소 사진 캐싱 (fire-and-forget) |

### Supabase DB 호출

| 서비스 | 테이블 | 주요 작업 |
|--------|--------|-----------|
| tripService.js | trips, trip_members, trip_schedules | CRUD + 복제 |
| memberService.js | trip_members | 멤버 관리 + Realtime 구독 |
| scheduleService.js | trip_schedules | 일정 로드/저장 + Realtime 구독 |
| documentService.js | trip_documents | 문서 CRUD |
| ragService.js | rag_places | RAG 컨텍스트 조회, 장소 검색, upsert |
| imageService.js | storage.images | 이미지 업로드/삭제 |
| AuthContext.jsx | profiles | 프로필 로드/수정 |

### Realtime 구독

| 채널 | 이벤트 | 용도 |
|------|--------|------|
| `trip-schedule:{tripId}` | postgres_changes (trip_schedules) | 일정 실시간 동기화 |
| `trip-members:{tripId}` | postgres_changes (trip_members) | 멤버 변경 감지 |
| `presence:{tripId}` | Presence sync | 온라인 유저 표시 |

---

## 10. 외부 API

### Google Maps JavaScript SDK (클라이언트)

로드: `maps.googleapis.com/maps/api/js?libraries=places&language=ko`

| 함수 | API | 용도 |
|------|-----|------|
| `getPlacePredictions()` | AutocompleteSuggestion | 주소 자동완성 |
| `getPlaceDetails()` | Place.fetchFields | 장소 상세 (이름, 주소, 좌표, 평점, 시간, 사진) |
| `getPlacePhotos()` | Place.fetchFields({photos}) | 사진만 조회 (maxWidth: 1600) |

### Google Places API New (서버 — Edge Functions)

| 엔드포인트 | 용도 |
|-----------|------|
| `POST places:searchText` | 텍스트 검색 (JA+KO 이중) |
| `GET places/{id}?languageCode=ko` | 장소 상세 |
| `GET {photoName}/media?maxWidthPx=1600` | 사진 다운로드 |

### Gemini API (서버 — Edge Function 프록시)

| 항목 | 값 |
|------|---|
| **모델** | gemini-2.5-flash |
| **엔드포인트** | generativelanguage.googleapis.com/v1beta/models/ |
| **Function Calling** | chat_reply, recommend_places, create_itinerary |

---

## 11. 환경 변수

| 변수 | 스코프 | 설명 |
|------|--------|------|
| `VITE_SUPABASE_URL` | Client | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase 공개 키 |
| `VITE_GOOGLE_MAPS_API_KEY` | Client | Google Maps JS SDK 키 (referrer 제한 필수) |
| `GOOGLE_PLACES_API_KEY` | Edge Function Secret | Google Places API 키 (서버용, 무제한) |
| `GEMINI_API_KEY` | Edge Function Secret | Gemini API 키 |
| `SUPABASE_URL` | Edge Function (자동) | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function Secret | Service Role 키 (RLS 우회) |

---

## 12. 보안 설정

| 항목 | 상태 |
|------|------|
| GitHub 리포 | **Private** |
| CORS | 허용 도메인 목록으로 제한 (travelunu.com, localhost, capacitor) |
| Gemini API 키 | 서버에만 보관 (클라이언트 fallback 제거됨) |
| Google Maps API 키 | HTTP Referrer 제한 설정 |
| Keystore 비밀번호 | `keystore.properties`로 분리 (gitignored) |
| rag_places | SELECT만 공개, 쓰기는 Edge Function(service_role)만 |
| Storage | 읽기 공개, 업로드/삭제는 인증 유저만 |
| Auth Flow | PKCE (implicit보다 안전) |
| .env 파일 | 모두 .gitignore 처리 |
