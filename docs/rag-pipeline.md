# RAG 데이터 수집 파이프라인

AI로 장소 후보를 생성하고 Google Places API로 실존 검증 후, 검증된 행만 `rag_places`에 넣는 스크립트입니다.

## 사전 요구사항

1. **스키마**: `supabase/rag_places.sql` 실행 후 `supabase/rag_places_confidence.sql` 실행 (confidence, google_place_id, rating, review_count 컬럼 추가).
2. **환경 변수**: 아래 항목을 `.env` 또는 셸에 설정.

## 환경 변수

프로젝트 루트 `.env`에 넣으면 스크립트가 자동으로 읽습니다. (또는 셸에서 export 후 실행)

| 변수 | 설명 |
|------|------|
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console에서 발급. Places API (Legacy) Text Search 사용. |
| `GEMINI_API_KEY` 또는 `VITE_GEMINI_API_KEY` | Gemini API 키 (AI 장소 생성용). |
| `SUPABASE_URL` 또는 `VITE_SUPABASE_URL` | Supabase 프로젝트 URL. |
| `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_ANON_KEY` 또는 `VITE_SUPABASE_ANON_KEY` | Supabase 키. 서비스 롤 권장 (INSERT용). |

## 실행 방법

`.env`에 위 변수 넣은 뒤:

```bash
npm run rag-seed -- --region osaka --type food
# 또는
node scripts/rag-seed.js --region osaka --type food
```

- **--region**: `osaka`, `kyoto`, `tokyo`, `fukuoka` 중 하나.
- **--type**: `food`, `spot`, `shop`, `stay` 중 하나.
- **--replace**: 해당 region+type 기존 행을 삭제한 뒤 새로 삽입. 없으면 upsert만 수행.
- **--dry-run**: DB INSERT 없이 후보 생성·검증·리포트만 수행.

예시:

```bash
node scripts/rag-seed.js --region osaka --type food
node scripts/rag-seed.js --region kyoto --type spot --replace
node scripts/rag-seed.js --region tokyo --type food --dry-run
```

## 파이프라인 흐름

1. **1단계**: Gemini로 region+type에 맞는 장소 후보 JSON 생성 (목표 수량: food 50, spot 30, shop 20, stay 10).
2. **2단계**: 각 후보를 Google Places Text Search로 검색 (name_ja + 지역명). 매칭 시 좌표·주소·영업시간·평점·review_count 보강 → `confidence = verified`. 미매칭 시 `rejected`.
3. **3단계**: verified / rejected 건수 및 rejected 목록을 콘솔에 출력. rejected 목록은 `scripts/output/rag-rejected-<region>-<type>.json` 에 저장.
4. **4단계**: `confidence = verified` 인 행만 Supabase `rag_places`에 upsert (--dry-run 이면 생략).

## 목표 수량 (지역당 type별)

| type | 목표 |
|------|------|
| food | 30~50 |
| spot | 20~30 |
| shop | 10~20 |
| stay | 10 |

## 지원 지역

- osaka (大阪)
- kyoto (京都)
- tokyo (東京)
- fukuoka (福岡)

## 비고

- Google Places API 무료 크레딧($200/월) 범위 내에서 사용. 요청 간 150ms 지연으로 rate limit 완화.
- RAG 조회(`getRAGContext`)는 `confidence = 'verified'` 또는 `confidence IS NULL` 인 행만 사용 (기존 시드와 호환).
