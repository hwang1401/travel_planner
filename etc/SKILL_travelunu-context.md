---
name: travelunu-context
description: TravelUNU 앱 프로젝트의 전체 컨텍스트. 앱 구조, 기술 스택, 배포 설정, 스토어 등록 정보를 포함한다. TravelUNU, 여행 앱, travelunu, 앱 개발, 스토어 등록, 빌드, 배포, Capacitor, Supabase 관련 작업 시 반드시 이 스킬을 참조할 것. 앱 구조 질문, 기능 추가, 버그 수정, 스토어 제출, 빌드 관련 모든 맥락에서 자동 트리거.
---

# TravelUNU — 프로젝트 컨텍스트

## 프로젝트 개요

**TravelUNU**는 AI 기반 여행 일정 플래너 앱이다. 대화형 AI(Gemini 2.5 Flash)가 장소를 추천하고, 버튼 기반(위/아래 이동, Day 간 이동)으로 일정을 편집하며, Supabase Realtime으로 실시간 공동편집을 지원한다. (드래그 앤 드롭은 미구현)

- **도메인**: https://travelunu.com
- **개인정보처리방침**: https://travelunu.com/privacy.html
- **앱 ID**: `com.travelunu.app`
- **앱 이름**: TravelUNU
- **슬로건**: 함께 만드는 여행 일정
- **설명**: 해외여행 일정을 AI가 추천하고, 친구와 실시간으로 함께 편집하는 여행 플래너
- **가격**: 무료
- **언어**: 한국어 (ko)
- **연락처 이메일**: travelunu@gmail.com
- **개발자**: 황성빈 (hwang1401@gmail.com)
- **GA4 ID**: G-LCB7EY6BFM
- **테마 컬러**: #8b7bff (보라색)
- **폰트**: Pretendard Variable

## 플랫폼

| 플랫폼 | 기술 | 상태 |
|--------|------|------|
| Web (PWA) | Vite 6 + React 19 → Vercel 배포 | 운영 중 |
| iOS | Capacitor 8 → App Store | App Store Connect 앱 생성 완료, 메타데이터 입력 완료, 빌드 업로드 대기 |
| Android | Capacitor 8 → Google Play | 프로덕션 심사 제출 완료 (심사 중, 3~7일 소요) |

## 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| Frontend | React, React Router, Tailwind CSS | 19, 7, 4 |
| Build | Vite | 6 |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) | — |
| AI | Google Gemini 2.5 Flash (Edge Function 프록시) | — |
| 지도 | Leaflet + React-Leaflet | 1.9, 5.0 |
| 장소 검색 | Google Maps JS SDK + Google Places API (New) | — |
| 네이티브 | Capacitor | 8.1 |
| 테스트 | Playwright (E2E, 5 Phase) | 1.58 |
| 인증 | 카카오 소셜 로그인 (Supabase Auth, PKCE flow) | — |

## 프로젝트 구조

```
travelunu/
├── index.html                 # 진입점 (GA4, OG, JSON-LD, PWA, 스플래시)
├── package.json               # name: travel-planner, private
├── capacitor.config.ts        # appId: com.travelunu.app
├── vite.config.js             # React + Tailwind, 수동 청크 분리
├── vercel.json                # SPA rewrite: /(.*) → /
├── .env.development           # 개발 Supabase (xutumbkvuurmvdxnbnmz)
├── .env.production            # 운영 Supabase (rjjfcnstdzwiwpblrxtz)
│
├── src/
│   ├── main.jsx               # ReactDOM, ErrorBoundary, SW 등록, 테마
│   ├── App.jsx                # BrowserRouter, AuthProvider, 라우팅
│   ├── index.css              # Tailwind import + 글로벌 스타일
│   │
│   ├── contexts/
│   │   └── AuthContext.jsx    # Supabase Auth (카카오 OAuth PKCE)
│   │                            - signInWithKakao: 웹=리다이렉트, iOS=ASWebAuthenticationSession, Android=Chrome Custom Tabs
│   │                            - profiles 테이블 연동
│   │
│   ├── services/              # 비즈니스 로직 (7개)
│   │   ├── geminiService.js   # (77KB) AI 채팅, 장소 추천, 일정 자동 생성
│   │   │                        - Edge Function 프록시 경유
│   │   │                        - Function Calling: chat_reply, recommend_places, create_itinerary
│   │   │                        - RAG 컨텍스트 주입
│   │   │                        - 교통 시간표 매칭
│   │   │                        - 속도제한 자동 재시도
│   │   ├── ragService.js      # (27KB) RAG 장소 캐시 조회/관리
│   │   │                        - rag_places 테이블 조회 (region + tags 필터)
│   │   │                        - 38개 리전 좌표 매핑 (일본 + 한국 + 아시아)
│   │   │                        - Haversine 거리 계산
│   │   ├── tripService.js     # 여행 CRUD (trips 테이블)
│   │   │                        - loadTrips, getTrip, createTrip, updateTrip, deleteTrip, duplicateTrip
│   │   │                        - trip_members JOIN으로 멤버 포함 조회
│   │   │                        - COVER_COLORS 8색 순환 그라디언트
│   │   ├── scheduleService.js # 일정 로드/저장 + Realtime 구독
│   │   │                        - trip_schedules 테이블 (JSONB data 필드)
│   │   │                        - save_trip_schedule RPC (원자적 버전 증가)
│   │   │                        - createDebouncedSave (800ms)
│   │   │                        - postgres_changes 실시간 구독
│   │   ├── memberService.js   # 멤버 관리 + Realtime
│   │   │                        - trip_members 테이블
│   │   │                        - 역할: owner, editor, viewer
│   │   │                        - join_trip_by_share_code RPC
│   │   ├── documentService.js # 문서 CRUD (trip_documents 테이블)
│   │   │                        - 카테고리: 예약확인서, 항공권, 기타 등
│   │   └── imageService.js    # Supabase Storage 이미지/PDF 업로드
│   │                            - bucket: "images" (public)
│   │                            - 이미지 자동 리사이즈 (max 1200px, JPEG 0.85)
│   │                            - PDF는 원본 업로드
│   │
│   ├── lib/                   # 외부 라이브러리 초기화
│   │   ├── supabase.js        # Supabase 클라이언트 (PKCE flow, localStorage)
│   │   ├── googleMaps.js      # Google Maps JS SDK 동적 로드
│   │   └── googlePlaces.js    # Places API (New) 래퍼
│   │                            - AutocompleteSuggestion + Place.fetchFields
│   │                            - 세션 토큰 3분 TTL
│   │                            - 레거시 API 폴백 포함
│   │
│   ├── hooks/                 # 커스텀 훅 (4개)
│   │   ├── usePresence.js     # Supabase Realtime Presence (온라인 유저)
│   │   ├── useSnapSheet.js    # 바텀시트 스냅 동작
│   │   ├── useScrollLock.js   # 스크롤 잠금
│   │   └── useBackClose.js    # 뒤로가기로 닫기
│   │
│   ├── components/            # React 컴포넌트 (~80개)
│   │   ├── HomePage.jsx       # 여행 목록 (/)
│   │   ├── LoginPage.jsx      # 카카오 로그인
│   │   ├── TravelPlanner.jsx  # 일정 편집 메인 (/trip/:tripId)
│   │   ├── InvitePage.jsx     # 공유코드 초대 (/invite/:shareCode)
│   │   ├── SettingsPage.jsx   # 설정 (/settings)
│   │   ├── SplashScreen.jsx   # 스플래시 (최소 1.5초)
│   │   │
│   │   ├── common/ (25개)     # 공통 UI
│   │   │   ├── BottomSheet, DraggableSheet  # 바텀시트
│   │   │   ├── Toast, ConfirmDialog, CenterPopup  # 알림/다이얼로그
│   │   │   ├── Button, Checkbox, Field, ChipSelector  # 폼 요소
│   │   │   ├── ImageViewer, ImagePicker  # 이미지
│   │   │   ├── SwipeableRow, PullToRefresh  # 제스처
│   │   │   ├── Skeleton, TripListSkeleton, ScheduleSkeleton  # 로딩
│   │   │   ├── Tab, Card, InfoRow, NumberCircle, CategoryBadge  # 표시
│   │   │   ├── Icon, IconContainer  # 아이콘
│   │   │   ├── PageTransition, PageSplash  # 전환
│   │   │   ├── PwaInstallPrompt  # PWA 설치 프롬프트
│   │   │   ├── LegalDialog  # 이용약관/개인정보처리방침
│   │   │   ├── TimePickerDialog  # 시간 선택
│   │   │   ├── AddressSearch  # 주소 검색
│   │   │   ├── FromToStationField  # 역 선택
│   │   │   ├── TimetablePreview  # 시간표 미리보기
│   │   │   └── EmptyState  # 빈 상태
│   │   │
│   │   ├── dialogs/ (12개)    # 다이얼로그/모달
│   │   │   ├── AIChatDialog          # AI 채팅 (장소 추천, 일정 생성)
│   │   │   ├── DetailDialog          # 일정 아이템 상세
│   │   │   ├── DocumentDialog        # 문서 관리
│   │   │   ├── CreateTripDialog      # 여행 생성
│   │   │   ├── AddDayDialog          # 날짜 추가
│   │   │   ├── ShoppingGuideDialog   # 쇼핑 가이드
│   │   │   ├── ImportPreviewDialog   # 가져오기 미리보기
│   │   │   ├── NearbyPlaceCard       # 주변 장소 카드
│   │   │   ├── AddNearbyPlaceSheet   # 주변 장소 추가
│   │   │   ├── TimetableSearchDialog # 시간표 검색
│   │   │   ├── StationPickerModal, SingleStationPicker  # 역 선택
│   │   │   ├── AddressToStationPicker  # 주소→역 변환
│   │   │   └── FromToTimetablePicker   # 출발-도착 시간표
│   │   │
│   │   ├── schedule/ (3개)    # 일정 편집
│   │   │   ├── PlaceCard             # 장소 카드
│   │   │   ├── AddPlacePage          # 장소 추가
│   │   │   ├── PasteInfoPage         # 정보 붙여넣기
│   │   │   └── TravelTimeConnector   # 이동시간 연결선
│   │   │
│   │   ├── map/ (2개)         # 지도
│   │   │   ├── FullMapDialog         # 전체 지도
│   │   │   └── MapButton             # 지도 버튼
│   │   │
│   │   └── trip/ (1개)        # 여행 관리
│   │       └── CreateTripWizard      # 여행 생성 위자드
│   │
│   ├── utils/                 # 유틸리티
│   │   ├── platform.js        # isNative(), getPlatform() — Capacitor 감지
│   │   ├── hoursParser.js     # 영업시간 파싱/현지화
│   │   ├── itemBuilder.js     # 일정 아이템 빌더
│   │   ├── scheduleUtils.js   # 일정 병합, 요약 생성
│   │   ├── scheduleParser.js  # 일정 파서
│   │   ├── distance.js        # 거리 계산
│   │   ├── openExternal.js    # 외부 링크 열기
│   │   ├── theme.js           # 다크모드 테마
│   │   ├── analytics.js       # GA4 페이지뷰 추적
│   │   ├── fileReader.js      # 파일 읽기
│   │   ├── today.js           # 오늘 날짜
│   │   └── cn.js              # clsx 래퍼
│   │
│   ├── styles/                # 디자인 토큰
│   │   ├── foundation.css     # 기본 변수
│   │   ├── semantic.css       # 시맨틱 토큰
│   │   ├── semantic-dark.css  # 다크모드
│   │   ├── typography.css     # 타이포그래피
│   │   ├── sizing.css         # 사이징
│   │   ├── type-colors.css    # 타입별 컬러
│   │   └── tokens.js          # JS 토큰
│   │
│   └── data/                  # 정적 데이터
│       ├── timetable.js       # (656KB) 일본 교통 시간표
│       ├── timetable-generated.js  # (646KB) 생성된 시간표
│       ├── days.js            # 날짜 데이터
│       ├── locations.js       # 위치 데이터
│       ├── guides.js          # 가이드 데이터
│       ├── legalDocs.js       # 개인정보처리방침 + 이용약관 (마크다운)
│       ├── regionImages.js    # 지역별 이미지
│       ├── stationCoords.js   # 역 좌표
│       ├── storage.js         # 스토리지 유틸
│       └── tripStorage.js     # (레거시) localStorage 기반 여행 저장
│
├── supabase/functions/        # Edge Functions (Deno)
│   ├── gemini-proxy/          # Gemini API 프록시
│   │   └── index.ts             - GEMINI_API_KEY 서버 보관
│   │                            - 모델: gemini-2.5-flash
│   │                            - CORS: travelunu.com, localhost, capacitor://localhost
│   ├── verify-and-register-places/  # 장소 검증 & RAG 자동 등록
│   │   └── index.ts             - Google Places API (New) 서버사이드
│   │                            - rag_places에 자동 삽입
│   │                            - 리전 자동 매핑 (38개 리전)
│   └── cache-place-photo/     # 장소 사진 캐싱
│       └── index.ts             - Places photos → Supabase Storage
│                                - rag_places.image_url/image_urls 업데이트
│                                - 최대 3장, 400px 이상 우선
│
├── ios/App/App/               # iOS 네이티브
│   ├── Info.plist               - Bundle: com.travelunu.app
│   │                            - URL Scheme: com.travelunu.app (딥링크)
│   │                            - Portrait + Landscape 지원
│   ├── AppDelegate.swift        - 표준 Capacitor AppDelegate
│   ├── AuthSessionPlugin.swift  - ASWebAuthenticationSession 커스텀 플러그인
│   │                            - iOS 카카오 OAuth PKCE 콜백 처리
│   └── MyViewController.swift   - 뷰 컨트롤러
│
├── android/                   # Android 네이티브
│   └── app/src/main/
│       └── AndroidManifest.xml  - intent-filter: com.travelunu.app 스킴
│                                - singleTask launchMode
│                                - INTERNET 퍼미션만
│
├── public/                    # 정적 파일
│   ├── manifest.json          # PWA 매니페스트 (192, 512 아이콘)
│   ├── sw.js                  # Service Worker v4
│   │                            - navigation: network-first
│   │                            - 정적 에셋: cache-first
│   ├── privacy.html           # 개인정보처리방침 (독립 HTML)
│   ├── robots.txt             # 전체 허용
│   ├── sitemap.xml            # /, /invite/
│   ├── favicon.png
│   └── icons/                 # 앱 아이콘, 스플래시 이미지
│
├── scripts/                   # 유틸리티 스크립트
│   ├── build-tokens.cjs       # 디자인 토큰 빌드
│   ├── rag-seed.js            # RAG 장소 데이터 시딩
│   └── collect-timetable/     # 교통 시간표 수집 파이프라인
│
├── tests/                     # Playwright E2E (5 Phase)
│   ├── phase1-basic-flow.spec.js
│   ├── phase2-batch-detail-edge.spec.js
│   ├── phase3-concurrent.spec.js
│   ├── phase4-data-integrity.spec.js
│   └── phase5-stress.spec.js
│
├── docs/                      # 문서
│   ├── BACKEND_API_SPEC.md    # 백엔드 API 상세 명세
│   ├── TravelUNU_개인정보처리방침.md
│   ├── TravelUNU_서비스이용약관.md
│   └── (기타 기술 문서 다수)
│
└── tokens/                    # 디자인 토큰 원본
```

## Supabase 데이터베이스 구조

### 테이블

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|----------|
| profiles | 사용자 프로필 | id, name, email, avatar_url |
| trips | 여행 | id, name, destinations(JSONB), start_date, end_date, cover_color, cover_image, owner_id, share_code |
| trip_members | 여행 멤버 | trip_id, user_id, role(owner/editor/viewer), joined_at |
| trip_schedules | 여행 일정 | trip_id, data(JSONB), version, updated_by, updated_at |
| trip_documents | 여행 문서 | trip_id, title, category, caption, image_url |
| rag_places | RAG 장소 캐시 | google_place_id, region, name, tags, lat, lon, image_url, image_urls |

### RPC 함수

| 함수 | 설명 |
|------|------|
| save_trip_schedule | 원자적 일정 저장 + 버전 증가 |
| join_trip_by_share_code | 공유코드로 여행 참여 |

### Supabase 환경

| 환경 | Project Ref | 용도 |
|------|-------------|------|
| 개발 | xutumbkvuurmvdxnbnmz | .env.development |
| 운영 | rjjfcnstdzwiwpblrxtz | .env.production |

### Storage

- **Bucket**: `images` (public)
- **구조**: `trips/{tripId}/cover_*.jpg`, `trips/{tripId}/items/*.jpg`, `trips/{tripId}/docs/*.pdf`, `rag/{region}/{placeId}.jpg`

### Realtime 채널

- `trip-schedule:{tripId}` — 일정 변경 실시간 동기화
- `trip-members:{tripId}` — 멤버 변경 감지
- Presence — 온라인 유저 표시

## 라우팅

| 경로 | 컴포넌트 | 인증 필요 |
|------|----------|----------|
| `/` | HomePage | O |
| `/trip/:tripId` | TravelPlanner | O |
| `/invite/:shareCode` | InvitePage | O |
| `/settings` | SettingsPage | O |
| (미인증) | LoginPage | X |

## 인증 플로우

카카오 소셜 로그인 (Supabase Auth + PKCE):

- **웹**: `supabase.auth.signInWithOAuth({ provider: 'kakao' })` → 리다이렉트
- **iOS**: ASWebAuthenticationSession (AuthSessionPlugin.swift) → PKCE code exchange
- **Android**: Chrome Custom Tabs → appUrlOpen 리스너 → PKCE code exchange
- **콜백 스킴**: `com.travelunu.app://login-callback/`

## 빌드 & 배포

### 웹 (Vercel)

```bash
npm run build          # .env.production 사용
# Vercel 자동 배포 (main 브랜치)
```

### iOS

```bash
npm run build && npx cap sync ios && npx cap open ios
# Xcode에서 Archive → App Store Connect 업로드
```

### Android

```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
# 결과: android/app/build/outputs/bundle/release/app-release.aab
# keystore.properties + travelunu-release.keystore 필요
```

### Edge Functions 배포

```bash
supabase functions deploy gemini-proxy --project-ref <REF>
supabase functions deploy verify-and-register-places --project-ref <REF>
supabase functions deploy cache-place-photo --project-ref <REF>
```

### 브랜치 전략

- `main` → 운영 (.env.production)
- `develop` → 개발 (.env.development)

## 스토어 등록 정보

### Google Play

- **Play Developer Account ID**: 6128576298753943224
- **패키지명**: com.travelunu.app
- **상태**: 프로덕션 심사 제출 완료 (2026-03-02), 심사 중
- **버전**: 1 (1.0), API 24+, 4.43MB
- **개발자 인증 설문**: 제출 완료
- **데이터 안전성**: 모든 항목 입력 완료
  - 수집됨: 이름, 이메일, 사진, 파일/문서, 앱 상호작용, 기타 사용자 생성 콘텐츠, 기기 ID, 앱 내 검색 기록
  - 공유됨: 기기 ID (GA4 → Google 애널리틱스)
  - 계정 삭제: https://travelunu.com/delete-account.html
- **스토어 등록정보**:
  - 짧은 설명: "AI가 추천하고 친구와 함께 만드는 해외여행 일정 플래너"
  - 태그: 지도/내비게이션, 호텔/공유숙박, 항공 여행
  - 스크린샷: store-screenshots/mockup_01~06.png (1080×1920)
  - 그래픽 이미지: feature-graphic.png (1024×500, 사용자 제작)
  - 앱 아이콘: dist/icons/app-icon-512.png

### Apple App Store

- **Bundle ID**: com.travelunu.app
- **Team ID**: 6J8GJJRZN5
- **SKU**: travelunu-ios
- **Apple 개발자 인증**: 완료
- **App Store Connect**: 앱 생성 완료, iOS 앱 1.0 제출 준비 중
- **상태**: 메타데이터 입력 완료, Xcode Archive → 빌드 업로드 대기
- **스토어 등록정보**:
  - 프로모션 텍스트: "AI가 추천하고 친구와 함께 만드는 해외여행 일정 플래너"
  - 키워드: 여행,일정,AI,플래너,해외여행,여행계획,맛집,관광,지도,동선,공유여행,일본여행,유럽여행,자유여행
  - 지원 URL: https://travelunu.com
  - 버전: 1.0
  - 저작권: 2026 Sungbin Hwang
  - 스크린샷: store-screenshots/apple_mockup_01~06.png (1290×2796)
  - 출시 방식: 자동으로 버전 출시
- **앱 심사 메모**: 카카오 로그인 사용으로 테스트 계정 제공 불가 (Korean phone number required)
- **미완료 항목**: 앱 정보(카테고리, 개인정보 URL), 앱이 수집하는 개인정보, Xcode 빌드 업로드

### 공통 필수 정보

- **앱 이름**: TravelUNU
- **개인정보처리방침 URL**: https://travelunu.com/privacy.html
- **계정 삭제 URL**: https://travelunu.com/delete-account.html
- **카테고리**: 여행 (Travel)
- **가격**: 무료
- **연령 등급**: 전체 이용가
- **지원 언어**: 한국어
- **연락처**: travelunu@gmail.com

### 스토어 스크린샷 생성

- **원본 스크린샷**: app_images/ (17개 PNG, 1290×2796)
- **목업 생성 스크립트**: create_mockups.py (Pillow 기반)
- **한국어 폰트**: NotoSansKR-Bold.ttf, NotoSansKR-Regular.ttf (@fontsource/noto-sans-kr에서 woff2→TTF 변환)
- **Google Play용**: store-screenshots/mockup_01~06.png (1080×1920)
- **Apple용**: store-screenshots/apple_mockup_01~06.png (1290×2796)
- **목업 구성**: 그라디언트 배경 + 한국어 헤드라인/서브라인 + 폰 프레임 + 스크린샷
- **6장 테마**: ①홈(보라) ②AI일정결과(남보라) ③지도(남색) ④장소상세(보라) ⑤AI대화(파랑) ⑥일정리스트(짙은보라)

## 주요 기능 요약

1. **AI 채팅 일정 생성** — Gemini 2.5 Flash, 장소 추천 + 일정 자동 구성
2. **Google Places 연동** — 주소 검색, 평점, 영업시간, 사진 자동 수집
3. **RAG 장소 캐싱** — 검증된 장소 DB 캐싱 + 자동 확장 (verify-and-register-places)
4. **실시간 공동편집** — Supabase Realtime + Presence
5. **공유 코드 초대** — 링크/코드로 멤버 초대
6. **일정 편집** — 버튼 기반 위/아래 이동, Day 간 이동 (드래그 앤 드롭 미구현)
7. **지도 뷰** — Leaflet 기반 일정 장소 시각화
8. **문서 관리** — 예약 확인서, 항공권 등 이미지/PDF 첨부
9. **일본 교통 시간표** — 1.3MB 오프라인 시간표 내장
10. **카카오 소셜 로그인** — PKCE OAuth
11. **PWA + 네이티브** — 웹 설치, iOS, Android
12. **다크모드** — 시스템 설정 연동
13. **GA4 분석** — SPA 페이지뷰 추적

## 주의사항

- `geminiService.js`가 77KB로 가장 큰 파일 — AI 핵심 로직 집중
- 교통 시간표 데이터가 1.3MB — 번들 사이즈 영향
- CORS 허용 오리진: travelunu.com, www.travelunu.com, localhost:3000, localhost:5173, capacitor://localhost, http://localhost
- Vite 수동 청크 분리: vendor(react), supabase, map(leaflet)
- 이미지 자동 리사이즈: max 1200px, JPEG quality 0.85
- **드래그 앤 드롭 미구현**: 일정 편집은 버튼 기반 (위/아래 이동 + "다른 Day로 이동"). 스토어 설명이나 기능 소개에서 드래그 앤 드롭 언급 금지
- **스토어 설명 문체**: 기술적/기능적 용어를 그대로 쓰지 말고, 사용자 관점의 자연스러운 마케팅 문체로 작성할 것 (예: "Day간 이동" → "일정 순서를 자유롭게 바꿀 수 있어")

## 남은 작업 (2026-03-02 기준)

### Google Play
- [ ] 심사 통과 대기 (3~7일)
- [ ] 콘텐츠 등급 설문 (IARC)
- [ ] 타겟 잠재고객 설정

### Apple App Store
- [ ] Xcode Archive → App Store Connect 빌드 업로드
- [ ] 앱 정보 페이지: 카테고리(여행), 개인정보 처리방침 URL 입력
- [ ] 앱이 수집하는 개인정보 섹션 입력
- [ ] 앱 심사 제출
- [ ] 심사 통과 대기 (24~48시간)
