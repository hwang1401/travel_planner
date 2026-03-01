# TravelUNU

AI 기반 여행 일정 플래너. 대화형 AI가 장소를 추천하고, 드래그 앤 드롭으로 일정을 편집하며, 실시간 공동편집을 지원합니다.

**Web** | **iOS** (Capacitor) | **Android** (Capacitor)

---

## 주요 기능

- **AI 채팅 일정 생성** — Gemini 2.5 Flash 기반, 장소 추천 · 일정 자동 생성
- **Google Places 연동** — 주소 검색, 평점, 영업시간, 사진 자동 수집
- **RAG 장소 캐싱** — 검증된 장소 데이터를 DB에 캐싱하여 재사용
- **실시간 공동편집** — Supabase Realtime으로 일정 동기화 + Presence
- **공유 코드 초대** — 링크/코드로 여행 멤버 초대
- **드래그 앤 드롭** — 일정 아이템 정렬, 날짜 간 이동
- **지도 뷰** — Leaflet 기반 일정 장소 시각화
- **문서 관리** — 예약 확인서, 항공권 등 이미지/PDF 첨부
- **Kakao 소셜 로그인** — PKCE OAuth flow
- **PWA + 네이티브 앱** — 웹 설치 및 iOS/Android 네이티브 빌드

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React 19, React Router, Tailwind CSS 4 |
| **Build** | Vite 6 |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| **AI** | Google Gemini 2.5 Flash (Edge Function 프록시) |
| **지도/장소** | Google Maps JS SDK, Google Places API (New) |
| **네이티브** | Capacitor 7 (iOS, Android) |
| **테스트** | Playwright (E2E) |

---

## 프로젝트 구조

```
travelunu/
├── src/
│   ├── components/         # React 컴포넌트
│   │   ├── common/         #   공통 UI (BottomSheet, ImageViewer 등)
│   │   ├── dialogs/        #   다이얼로그 (DetailDialog, AIChatDialog 등)
│   │   ├── map/            #   지도 관련 (FullMapDialog, MapPopup)
│   │   ├── place/          #   장소 정보 (PlaceInfoContent, NearbyPlaceCard)
│   │   ├── schedule/       #   일정 편집 (ScheduleCard, DaySection)
│   │   └── trip/           #   여행 관리 (TripCard, MemberList)
│   ├── contexts/           # React Context (Auth)
│   ├── hooks/              # Custom Hooks (usePresence 등)
│   ├── services/           # 비즈니스 로직
│   │   ├── geminiService.js    # AI 채팅/추천/일정 생성
│   │   ├── ragService.js       # RAG 장소 캐시 조회/관리
│   │   ├── tripService.js      # 여행 CRUD
│   │   ├── scheduleService.js  # 일정 로드/저장 + Realtime
│   │   ├── memberService.js    # 멤버 관리 + Realtime
│   │   ├── documentService.js  # 문서 CRUD
│   │   └── imageService.js     # Storage 이미지 업로드/삭제
│   ├── lib/                # 외부 라이브러리 초기화
│   │   ├── supabase.js         # Supabase 클라이언트
│   │   ├── googleMaps.js       # Google Maps 스크립트 로더
│   │   └── googlePlaces.js     # Places API 래퍼 (검색, 상세, 사진)
│   ├── utils/              # 유틸리티
│   │   ├── platform.js         # isNative(), getPlatform()
│   │   ├── hoursParser.js      # 영업시간 파싱
│   │   ├── itemBuilder.js      # 일정 아이템 빌더
│   │   └── scheduleUtils.js    # 일정 병합, 요약 생성
│   ├── styles/             # 스타일 토큰
│   └── data/               # 정적 데이터 (시간표 등)
├── supabase/
│   └── functions/          # Edge Functions (Deno)
│       ├── gemini-proxy/           # Gemini API 프록시
│       ├── verify-and-register-places/ # 장소 검증 & RAG 등록
│       └── cache-place-photo/      # 장소 사진 캐싱
├── ios/                    # Capacitor iOS 프로젝트
├── android/                # Capacitor Android 프로젝트
├── scripts/                # 데이터 시딩, 시간표 수집 스크립트
├── tests/                  # Playwright E2E 테스트
└── docs/                   # 문서
    └── BACKEND_API_SPEC.md     # 백엔드/API 상세 명세서
```

---

## 시작하기

### 사전 요구사항

- Node.js 20+
- npm 10+
- Supabase 프로젝트 (Auth, Database, Storage, Edge Functions)
- Google Cloud 프로젝트 (Maps JS API, Places API 활성화)
- Gemini API 키

### 설치

```bash
git clone https://github.com/hwang1401/travelunu.git
cd travelunu
npm install
```

### 환경 변수 설정

`.env.example`을 참고하여 `.env.development` 또는 `.env.production` 파일을 생성합니다.

```bash
cp .env.example .env.development
```

| 변수 | 설명 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 공개 키 |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JS SDK 키 (Referrer 제한 설정 필수) |

Edge Function Secrets (Supabase Dashboard 또는 CLI에서 설정):

```bash
supabase secrets set GEMINI_API_KEY=xxx
supabase secrets set GOOGLE_PLACES_API_KEY=xxx
```

### 개발 서버 실행

```bash
npm run dev
```

`http://localhost:5173`에서 접속

### 프로덕션 빌드

```bash
npm run build        # .env.production 사용
npm run preview      # 빌드 결과 로컬 확인
```

---

## 네이티브 앱 빌드

### iOS

```bash
npx vite build --mode development   # 또는 npm run build (production)
npx cap sync ios
npx cap open ios                    # Xcode에서 빌드/실행
```

### Android

```bash
npx vite build --mode development
npx cap sync android
npx cap open android                # Android Studio에서 빌드/실행
```

### Android AAB (릴리스)

```bash
npx vite build --mode development
npx cap sync android
cd android && ./gradlew bundleRelease
# 결과: android/app/build/outputs/bundle/release/app-release.aab
```

> `keystore.properties` 파일이 프로젝트 루트에 필요합니다. `.env.example` 참고.

---

## Edge Functions 배포

```bash
# 개발계
supabase functions deploy gemini-proxy --project-ref <DEV_REF>
supabase functions deploy verify-and-register-places --project-ref <DEV_REF>
supabase functions deploy cache-place-photo --project-ref <DEV_REF>

# 운영계
supabase functions deploy gemini-proxy --project-ref <PROD_REF>
supabase functions deploy verify-and-register-places --project-ref <PROD_REF>
supabase functions deploy cache-place-photo --project-ref <PROD_REF>
```

---

## 브랜치 전략

| 브랜치 | 용도 | 환경 |
|--------|------|------|
| `main` | 운영 배포 | `.env.production` |
| `develop` | 개발/테스트 | `.env.development` |

`develop`에서 작업 → 검증 완료 → `main`에 머지 → 운영 배포

---

## 테스트

```bash
# E2E 테스트 전체 실행
npm run test:e2e

# 개별 Phase 실행
npm run test:e2e:phase1   # 기본 플로우
npm run test:e2e:phase2   # 배치/디테일/엣지
npm run test:e2e:phase3   # 동시성
npm run test:e2e:phase4   # 데이터 무결성
npm run test:e2e:phase5   # 스트레스
```

---

## 아키텍처 개요

```
Client (React + Capacitor)
    │
    ├── Supabase Auth (Kakao OAuth, PKCE)
    ├── Supabase Database (PostgreSQL + RLS + Realtime)
    ├── Supabase Storage (images bucket)
    ├── Supabase Edge Functions
    │   ├── gemini-proxy → Gemini 2.5 Flash API
    │   ├── verify-and-register-places → Google Places API (New)
    │   └── cache-place-photo → Google Places Photos → Storage
    │
    ├── Google Maps JS SDK (클라이언트 사이드)
    │   ├── Autocomplete (주소 검색)
    │   └── Place Details (장소 상세/사진)
    │
    └── Realtime
        ├── trip_schedules 동기화
        ├── trip_members 변경 감지
        └── Presence (온라인 유저)
```

> 상세 API 명세는 [`docs/BACKEND_API_SPEC.md`](docs/BACKEND_API_SPEC.md) 참고

---

## 라이선스

Private repository. All rights reserved.
