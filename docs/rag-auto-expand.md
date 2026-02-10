# RAG 자동 확장 — 구현 문서

AI 일정 생성 시 RAG에 매칭되지 않은 장소를 Google Places로 검증·등록하여, **사용자가 쓸수록 RAG 데이터가 자동으로 성장**하도록 한 기능입니다.

---

## 1. 배경·목표

- **문제**: RAG에 38도시 약 1,600곳만 등록되어 있어, AI가 "라멘 스타디움" 같은 유명 장소를 추천해도 RAG에 없으면 이미지/placeId/주소가 붙지 않음.
- **목표**: 일정 생성 시 **미매칭 장소(food/spot/shop/stay)** 를 백그라운드로 Google Places 검증 후 `rag_places`에 등록·이미지 수집. 이번 사용자는 보강 없이 보지만, **다음에 같은 장소가 추천되면** 이미지/주소/placeId가 붙어 나옴.
- **원칙**:
  - 사용자 경험 차단 없음: 일정은 즉시 표시, 검증·등록은 **fire-and-forget**.
  - move/flight/info는 장소가 아니므로 제외.
  - 검증 실패 시 DB에 넣지 않고 로그만.
  - 일정당 최대 10건 상한 (비용/타임아웃 관리).
  - 자동 등록 장소는 `confidence = 'auto_verified'` 로 구분.

---

## 2. 구현 요약

### 2.1 스키마

- **파일**: `supabase/rag_places_confidence_auto_verified.sql`
- **내용**: `rag_places.confidence` CHECK 제약에 `'auto_verified'` 추가.
- **실행**: Supabase SQL Editor에서 해당 파일 내용 실행.

```sql
ALTER TABLE rag_places DROP CONSTRAINT IF EXISTS rag_places_confidence_check;
ALTER TABLE rag_places ADD CONSTRAINT rag_places_confidence_check
  CHECK (confidence IN ('verified', 'unverified', 'rejected', 'auto_verified'));
```

---

### 2.2 클라이언트 (geminiService.js)

- **함수**: `enqueueUnmatchedPlacesForVerification(days, ragPlaces)`
  - `injectRAGData(days, ragPlaces)` 직후에 호출.
  - `days`를 순회하며 **RAG 매칭 안 된** 항목 중 **type이 food/spot/shop/stay** 인 것만 수집 (최대 10건, desc 기준 중복 제거).
  - **regionHint**: 첫 번째 day의 `label` 사용 (예: "Day 1 오사카").
  - **POST** `{ places: [{ desc, type }, ...], regionHint }` → `VITE_SUPABASE_URL/functions/v1/verify-and-register-places`
  - **Authorization**: `Bearer VITE_SUPABASE_ANON_KEY`
  - **await 하지 않음** (fire-and-forget). 에러 시 콘솔 로그만.

- **호출 위치** (2곳):
  1. 단일 요청 분기: `injectRAGData(days, ragPlaces)` 다음 줄.
  2. 청크 병합 분기: `injectRAGData(allDays, ragPlaces)` 다음 줄.

---

### 2.3 Edge Function (Supabase)

- **경로**: `supabase/functions/verify-and-register-places/index.ts`
- **런타임**: Deno (Supabase Edge Functions).

**동작**:

1. **요청**: POST body `{ places: Array<{ desc, type }>, regionHint?: string }`
2. **CORS**: 모든 응답에 CORS 헤더, OPTIONS → 204.
3. **각 place에 대해**:
   - **Places API** `places:searchText` 호출 (쿼리: `place.desc + ' 日本'`, locationBias는 regionHint → REGION_CENTERS 좌표).
   - **이름 유사도** 체크 (normalizeForMatch + nameSimilar 단순 버전).
   - **region**: Places 응답의 lat/lon으로 `findRegionByCoords` (50km 이내 가장 가까운 region).
   - **중복**: `google_place_id` 로 기존 행 조회 → 있으면 skip.
   - **INSERT**: `rag_places` upsert (`onConflict: 'region,name_ko'`), `confidence: 'auto_verified'`, `source: 'api'`.
   - **사진**: Place Details에서 photos 조회 → 해상도 가장 큰 사진 선택 → media URL로 다운로드 → Supabase Storage `rag/{region}/{placeId}.jpg` 업로드 → `image_url` UPDATE.
4. **응답**: 202 Accepted, `{ ok: true, registered }`.

**환경 변수** (Supabase Edge Function Secrets):

- `GOOGLE_PLACES_API_KEY`: Google Places API 키.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase에서 자동 주입.

**참고 코드**: `scripts/rag-seed.js` (검증·이름 유사도), `scripts/rag-photos.js` (사진 수집), `src/services/ragService.js` (REGION_CENTERS, findRegionByCoords).

---

### 2.4 환경·CORS

- **클라이언트**: 기존 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 사용. 별도 env 없음.
- **Edge Function**: Dashboard → Edge Functions → Secrets 에서 `GOOGLE_PLACES_API_KEY` 설정.
- **CORS**: Edge Function에서 모든 응답에 `Access-Control-Allow-Origin` 등 설정.

---

## 3. 수동으로 해야 할 작업

1. **DB 마이그레이션**: Supabase SQL Editor에서 `supabase/rag_places_confidence_auto_verified.sql` 실행.
2. **시크릿**: Supabase Dashboard → Edge Functions → Edge Function Secrets → Name `GOOGLE_PLACES_API_KEY`, Value에 Google Places API 키 입력 후 저장.
3. **배포**: 터미널에서  
   `supabase login` (최초 1회)  
   `supabase functions deploy verify-and-register-places --project-ref <프로젝트_REF>`

(Supabase CLI 미설치 시: `brew install supabase/tap/supabase`)

---

## 4. 데이터 흐름

```
[앱] 일정 생성 요청
  → AI 응답 (days)
  → injectRAGData(days, ragPlaces)  // 매칭된 항목에 이미지/주소/placeId 부여
  → enqueueUnmatchedPlacesForVerification(days, ragPlaces)  // 미매칭 10건 수집
  → POST /functions/v1/verify-and-register-places (fire-and-forget)
  → UI에는 days 즉시 반환 (대기 없음)

[Edge Function] POST 수신
  → 202 반환
  → 각 place: Places searchText → 이름 유사도 → findRegionByCoords
  → 기존 google_place_id 없으면: rag_places INSERT (auto_verified)
  → 사진 다운로드 → Storage 업로드 → image_url UPDATE
  → 실패 시 해당 건만 skip, 로그만
```

---

## 5. 관련 파일 목록

| 구분 | 파일 |
|------|------|
| 스키마 | `supabase/rag_places_confidence_auto_verified.sql` |
| 클라이언트 | `src/services/geminiService.js` (enqueueUnmatchedPlacesForVerification, 호출 2곳) |
| Edge Function | `supabase/functions/verify-and-register-places/index.ts` |
| 참고 | `scripts/rag-seed.js`, `scripts/rag-photos.js`, `src/services/ragService.js` |
| env 예시 | `.env.example` (GOOGLE_PLACES_API_KEY 주석) |

---

## 6. 비용·제한

- 일정당 미매칭 최대 10건 → Text Search + Photo 약 10건씩.
- Google Maps Platform 월 $200 무료 크레딧 범위 내 사용 가능.
- Edge Function 타임아웃(~60초) 고려해 10건 이내로 처리.
