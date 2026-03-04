# RAG (일정 생성용 장소 데이터) 설정

일정 생성 시 선호도·여행지에 맞는 장소를 검색해 프롬프트에 넣는 RAG를 사용하려면 Supabase에 테이블과 시드 데이터를 넣어야 합니다.

## 1. 테이블 생성

Supabase 대시보드 → **SQL Editor**에서 아래 순서로 실행하세요.

1. **`supabase/rag_places.sql`**  
   - `rag_places` 테이블 생성, 인덱스, RLS 정책  
   - (기존 `schema.sql`은 이미 적용된 상태라고 가정)

2. **`supabase/rag_places_confidence.sql`**  
   - `confidence`, `google_place_id`, `rating`, `review_count` 컬럼 추가 (RAG 파이프라인용)

3. **`supabase/rag_places_seed_osaka.sql`**  
   - 오사카 지역 28곳 시드 (region=osaka, tags: 현지인맛집, 가성비, 아이동반 등)  
   - 같은 SQL을 다시 실행해도 `ON CONFLICT (region, name_ko) DO NOTHING`으로 중복은 들어가지 않습니다.

## 2. 동작 확인

- 여행지에 **오사카**를 넣고 일정 생성 시, RAG가 `rag_places`에서 region=osaka인 장소를 검색해 프롬프트에 포함합니다.
- 선호도에 "현지인 맛집", "가성비", "아이랑" 등을 넣으면 규칙 기반으로 태그가 추출되고, 해당 태그가 있는 장소만 검색됩니다.
- 교토·도쿄·후쿠오카는 지역 매핑은 되어 있지만, 시드 데이터는 오사카만 있으므로 해당 지역 시드를 추가하기 전에는 RAG 결과가 비어 있습니다.

## 3. 환경 변수

RAG는 기존 Supabase 클라이언트를 사용합니다.  
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 설정되어 있으면 별도 설정 없이 동작합니다.

## 4. 검증된 데이터 수집 (파이프라인)

AI 후보 생성 → Google Places 검증 → DB 삽입 파이프라인은 **`docs/rag-pipeline.md`** 및 `scripts/rag-seed.js`를 참고하세요.
