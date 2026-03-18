# travelunu (트래블유앤유)

AI 기반 여행 일정 플래너. AI가 맞춤 일정을 생성하고, 실시간 공동편집으로 함께 여행을 계획할 수 있습니다.

**[App Store](https://apps.apple.com/app/id6744227498)** | **Web** — [travelunu.com](https://travelunu.com)

---

## 주요 기능

- **AI 여행 생성** — 목적지·날짜·취향만 입력하면 AI가 전체 일정 자동 생성
- **AI 채팅** — 대화로 맛집 추천, 코스 변경, 일정 수정
- **실시간 공동편집** — Supabase Realtime으로 일정 동기화 + Presence
- **Google Places 연동** — 주소 검색, 평점, 영업시간, 사진 자동 수집
- **RAG 장소 캐싱** — 검증된 장소 데이터를 DB에 캐싱하여 재사용
- **공유 초대** — 링크/코드로 여행 멤버 초대 (네이티브 공유 지원)
- **드래그 앤 드롭** — 일정 아이템 정렬, 날짜 간 이동
- **지도 뷰** — Leaflet 기반 여행 동선 시각화
- **문서 관리** — 예약 확인서, 항공권 등 이미지/PDF 첨부
- **소셜 로그인** — Kakao, Apple 로그인 (PKCE)
- **게스트 모드** — 로그인 없이 체험 가능, 온보딩 슬라이드 제공
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
│   │   └── trip/           #   여행 관리 (TripCard, CreateTripWizard)
│   ├── contexts/           # React Context (Auth)
│   ├── hooks/              # Custom Hooks (usePresence 등)
│   ├── services/           # 비즈니스 로직
│   │   ├── geminiService.js    # AI 채팅/추천/일정 생성
│   │   ├── ragService.js       # RAG 장소 캐시 조회/관리
│   │   ├── tripService.js      # 여행 CRUD
│   │   ├── scheduleService.js  # 일정 로드/저장 + Realtime
│   │   ├── memberService.js    # 멤버 관리 + 공유
│   │   ├── documentService.js  # 문서 CRUD
│   │   └── imageService.js     # Storage 이미지 업로드/삭제
│   ├── lib/                # 외부 라이브러리 초기화
│   ├── utils/              # 유틸리티
│   ├── styles/             # 스타일 토큰
│   └── data/               # 정적 데이터
├── supabase/
│   └── functions/          # Edge Functions (Deno)
│       ├── gemini-proxy/           # Gemini API 프록시
│       ├── verify-and-register-places/ # 장소 검증 & RAG 등록
│       └── cache-place-photo/      # 장소 사진 캐싱
├── ios/                    # Capacitor iOS 프로젝트
├── android/                # Capacitor Android 프로젝트
├── scripts/                # 빌드/배포 스크립트
│   └── build-ios.sh            # iOS 빌드 자동화 (Archive → IPA → 업로드)
└── docs/                   # 문서
```

---

## 시작하기

### 사전 요구사항

- Node.js 20+
- Supabase 프로젝트 (Auth, Database, Storage, Edge Functions)
- Google Cloud 프로젝트 (Maps JS API, Places API 활성화)

### 설치

```bash
git clone https://github.com/hwang1401/travelunu.git
cd travelunu
npm install
```

### 환경 변수 설정

`.env.example`을 참고하여 `.env.development` 또는 `.env.production` 파일을 생성합니다.

| 변수 | 설명 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 공개 키 |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JS SDK 키 (Referrer 제한 필수) |

Edge Function Secrets:

```bash
supabase secrets set GEMINI_API_KEY=xxx
supabase secrets set GOOGLE_PLACES_API_KEY=xxx
```

### 개발 서버 실행

```bash
npm run dev
```

---

## 네이티브 앱 빌드

### iOS (App Store 배포)

```bash
bash scripts/build-ios.sh --bump   # 빌드 번호 자동 증가 + Archive + IPA + 업로드
```

### iOS (개발/시뮬레이터)

```bash
npx vite build
npx cap sync ios
npx cap open ios   # Xcode에서 Cmd+R
```

### Android

```bash
npx vite build
npx cap sync android
npx cap open android   # Android Studio에서 빌드/실행
```

---

## 브랜치 전략

| 브랜치 | 용도 | 환경 |
|--------|------|------|
| `main` | 운영 배포 | `.env.production` |
| `develop` | 개발/테스트 | `.env.development` |

`develop`에서 작업 → 검증 → `main` 머지 → 운영 배포

---

## 아키텍처

```
Client (React + Capacitor)
    │
    ├── Supabase Auth (Kakao, Apple OAuth + PKCE)
    ├── Supabase Database (PostgreSQL + RLS + Realtime)
    ├── Supabase Storage (images bucket)
    ├── Supabase Edge Functions
    │   ├── gemini-proxy → Gemini 2.5 Flash API
    │   ├── verify-and-register-places → Google Places API (New)
    │   └── cache-place-photo → Google Places Photos → Storage
    │
    ├── Google Maps JS SDK (클라이언트)
    │   ├── Autocomplete (주소 검색)
    │   └── Place Details (장소 상세/사진)
    │
    └── Realtime
        ├── trip_schedules 동기화
        ├── trip_members 변경 감지
        └── Presence (온라인 유저)
```

---

## 라이선스

Private repository. All rights reserved.
