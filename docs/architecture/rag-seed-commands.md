# RAG 시드 명령어 정리

`rag-seed` 스크립트로 Gemini 후보 생성 → Places 검증 → Supabase `rag_places` 저장 시 사용하는 명령어 모음.

---

## 1. 전체 돌리기

**전체 지역 × 전체 카테고리** (17지역 × 4타입 = 68개 작업)

```bash
npm run rag-seed:all
```

또는

```bash
npm run rag-seed -- --all
```

- 시간·API 호출 많음. 429 나오면 대기 후 재시도됨.

---

## 2. Tier별 돌리기

| 명령어 | 대상 | 작업 수 |
|--------|------|--------|
| `npm run rag-seed:tier1` | 오사카·도쿄·교토 × food/spot/shop/stay | 12 |
| `npm run rag-seed:tier2` | 후쿠오카·오키나와·삿포로·고베·나라 × 4타입 | 20 |
| `npm run rag-seed:tier3` | 나고야·히로시마·하코네·요코하마·가나자와·벳푸·가마쿠라·닛코 × 4타입 | 32 |

```bash
npm run rag-seed:tier1
npm run rag-seed:tier2
npm run rag-seed:tier3
```

또는

```bash
npm run rag-seed -- --tier 1
npm run rag-seed -- --tier 2
npm run rag-seed -- --tier 3
```

---

## 3. 지역별 돌리기 (한 지역 × 4카테고리)

**한 지역**에 대해 food, spot, shop, stay **4개 타입을 순서대로** 돌리려면 각각 실행:

```bash
# 오사카
npm run rag-seed -- --region osaka --type food
npm run rag-seed -- --region osaka --type spot
npm run rag-seed -- --region osaka --type shop
npm run rag-seed -- --region osaka --type stay

# 도쿄
npm run rag-seed -- --region tokyo --type food
npm run rag-seed -- --region tokyo --type spot
npm run rag-seed -- --region tokyo --type shop
npm run rag-seed -- --region tokyo --type stay

# 교토
npm run rag-seed -- --region kyoto --type food
npm run rag-seed -- --region kyoto --type spot
npm run rag-seed -- --region kyoto --type shop
npm run rag-seed -- --region kyoto --type stay
```

(다른 지역도 `--region <지역명>` 으로 동일하게 반복.)

---

## 4. 지역 + 카테고리별 돌리기 (단건)

**한 지역 × 한 카테고리**만 실행할 때:

```bash
npm run rag-seed -- --region <지역> --type <카테고리>
```

### 지역 (region)

| region | 한글 | tier |
|--------|------|------|
| osaka | 오사카 | 1 |
| tokyo | 도쿄 | 1 |
| kyoto | 교토 | 1 |
| fukuoka | 후쿠오카 | 2 |
| okinawa | 오키나와 | 2 |
| sapporo | 삿포로 | 2 |
| kobe | 고베 | 2 |
| nara | 나라 | 2 |
| nagoya | 나고야 | 3 |
| hiroshima | 히로시마 | 3 |
| hakone | 하코네 | 3 |
| yokohama | 요코하마 | 3 |
| kanazawa | 가나자와 | 3 |
| beppu | 벳푸 | 3 |
| kamakura | 가마쿠라 | 3 |
| nikko | 닛코 | 3 |

### 카테고리 (type)

| type | 설명 | tier1 목표 | tier2 | tier3 |
|------|------|------------|-------|-------|
| food | 음식점 | 100 | 50 | 25 |
| spot | 관광/명소 | 50 | 25 | 15 |
| shop | 쇼핑 | 30 | 15 | 10 |
| stay | 숙소 | 20 | 10 | 5 |

### 예시

```bash
# 오사카 음식점 100개
npm run rag-seed -- --region osaka --type food
# 또는
npm run rag-seed:full

# 도쿄 관광
npm run rag-seed -- --region tokyo --type spot

# 교토 숙소
npm run rag-seed -- --region kyoto --type stay

# 후쿠오카 쇼핑
npm run rag-seed -- --region fukuoka --type shop
```

---

## 5. 옵션

| 옵션 | 설명 |
|------|------|
| `--replace` | 해당 region+type 기존 행 삭제 후 새로 삽입 (없으면 upsert) |
| `--dry-run` | DB 저장 없이 후보 생성·검증·리포트만 |
| `--limit N` | 목표 개수 무시하고 N개만 생성 (테스트용) |

예시:

```bash
npm run rag-seed -- --region osaka --type food --replace
npm run rag-seed -- --region osaka --type food --limit 20
npm run rag-seed -- --region osaka --type food --dry-run
```

---

## 6. 저장 위치

- **DB**: Supabase (`.env`의 `VITE_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 프로젝트)
- **테이블**: `rag_places`
- **Rejected 목록**: `scripts/output/rag-rejected-<region>-<type>.json`
  - 단건 실행·배치(tier1 등) 모두 리젝트가 있으면 이 경로에 저장됨.
  - 내용: `name_ko`, `name_ja`, `reject_reason` (원인별 요약은 완료 시 터미널에 출력).

## 7. 완료 리포트 (리젝트 요약)

배치 실행 후 터미널에 다음이 출력됨:

- **리젝트 원인**: `no_result`(Places 검색 결과 없음), `name_mismatch`(이름 불일치) 등 원인별 건수
- **리젝트 있는 조합**: `region/type`별로 rejected 건수와 해당 json 파일명
- 상세 목록은 `scripts/output/rag-rejected-<region>-<type>.json` 에서 확인.
