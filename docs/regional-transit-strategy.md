# 지역별 교통 데이터 수집 전략

후쿠오카 "전역" 수집 불가 이유와 큐슈·간사이 수집 방안 정리.

---

## 1. 후쿠오카 전역을 못 가져온 이유

### 현재 수집 중인 것

| 구분 | 소스 | 수집 범위 | 비고 |
|------|------|----------|------|
| **지하철** | 福岡市交通局 Excel (CC BY 2.1 JP) | 공항선·하코자키선 전 구간 | 博多↔후쿠오카공항, 博多↔天神 |
| **지하철 나나쿠마선** | nanakuma_timetable.xlsx | ✅ 수집 | 덴진남↔하카타 |
| **버스** | - | **없음** | 西鉄バ스 GTFS는 ジョルダン提供 → 이용약관 확인 필요 |
| **공항버스** | 웹 수집 시도 | 西鉄 PDF는 이미지 기반 → OCR 필요 | web-timetable-collector 추가됨 |

### 구조적 한계

1. **후쿠오카 시내버스**: bus-routes.net 기준 福岡県에 事業者直接 제공 GTFS가 거의 없음. 西鉄バ스(니시테츠 버스)가 메인이나 조루단 제공.
2. **나나쿠마선**: Excel은 제공되나 네트워크 다운로드 타임아웃 이슈로 보류.
3. **공항 리무진버스**: 공식 웹 시간표만 있고 오픈데이터·GTFS 미제공.

---

## 2. 큐슈 지역 수집 방안 (전역 커버)

### ✅ 자동 수집 (GTFS·PDF·Excel)

| 노선 | 소스 | 수집기 |
|------|------|--------|
| JR 큐슈 | 신칸센·소닉·카모메·유후인·키라메키 | `pdf-parser.js` |
| 후쿠오카 지하철 | 空港·箱崎·나나쿠마선 **전 역** (지온, 나카스, 메이노하마, 카이즈카, 록혼마츠, 야쿠인, 하시모토 등) | `fukuoka-subway-collector.js` |
| 長崎県営バス | 長崎駅↔空港·雲仙·佐世保·ハウステンボス | `kyushu-gtfs-collector.js` |
| 鹿児島市営バス | data.bodik.jp (CKAN) | `kyushu-gtfs-collector.js` |

### ✅ Frequency·수동 (배차빈번·GTFS 미제공)

노면전차(나가사키·구마모토·가고시마) 역 좌표는 `stationCoords.js`에 추가되어 주소→역 매핑 지원.

| 지역 | 노선 |
|------|------|
| **福岡** | 西鉄 天神↔太宰府·오무타, 후쿠오카 지하철 |
| **佐賀** | JR 카모메 경유, 西鉄 |
| **長崎** | 노면전차, 県営バ스, 島原鉄道, 松浦鉄道 |
| **熊本** | 노면전차, 熊本電鉄, 南阿蘇鉄道, 九州産交 やまびこ |
| **大分** | JR·소닉·유후인, 亀の井 別府↔由布院 |
| **宮崎** | JR 니치린, 宮崎交通 空港リムジン |
| **鹿児島** | 노면전차, 空港リムジン |

### 🔲 추후 추가

| 대상 | 비고 |
|------|------|
| 長崎電気軌道 (노면전차) | GTFS 미공개, FREQUENCY_ROUTES 사용 |
| 鹿児島市電 (노면전차) | GTFS 미공개 (市バス만 GTFS 있음) |
| 福岡県 コミュニティバス | 久留米·太宰府·柳川 등 (gtfs-data.jp) |
| 阪九フェリー | ODPT Consumer Key |

---

## 3. 간사이 지역 수집 방안

### ODPT (공공교통 오픈데이터센터)

- **URL**: https://developer.odpt.org/
- **조건**: 무료 개발자 등록 → Consumer Key 발급
- **포함**: 京都バス, 京都市バ스, 阪九フェリー 등 GTFS

| 사업자 | 데이터 | 사용 조건 |
|--------|--------|-----------|
| 京都バス | GTFS/GTFS-JP | ODPT 가입 |
| 京都市バス | GTFS | ODPT 가입 |
| 阪九フェリー | GTFS | ODPT 가입 |

### bus-routes.net / gtfs-data.jp

- 大阪府·京都府: 事業者直接 제공 GTFS 목록이 상대적으로 적음.
- 대부분 ジョルダン提供 → 이용약관 확인 후 사용.

### 추가 조사 필요

- ** Osaka Metro (大阪メト로)**: ODPT 카탈로그에 大阪 검색 시 阪九フェリー만 노출. Osaka Metro GTFS는 도쿄처럼 별도 오픈데이터 사이트 있을 수 있음.
- **JR 서일본**: PDF/GTFS 공개 여부 확인.

---

## 4. 실행 우선순위

| 순서 | 작업 | 상태 |
|------|------|------|
| 1 | 후쿠오카 지하철 博多↔天神 추가 | ✅ 완료 |
| 2 | 나나쿠마선 Excel 수집 | ✅ 완료 |
| 3 | GTFS 파서 구현 (로컬 zip 파싱) | TODO |
| 4 | ODPT Consumer Key 발급 후 京都バ스 등 수집 | Phase 2 |
| 5 | 事業者直接 GTFS 선별 (bus-routes.net) 후 수집 | Phase 2 |

---

## 5. GTFS 파서 사용 흐름 (구현 시)

1. ODPT 또는 bus-routes.net에서 GTFS zip 다운로드
2. `output/` 또는 `scripts/collect-timetable/gtfs/` 에 저장
3. `node scripts/collect-timetable/gtfs-parser.js --file=xxx.zip --from=京都駅前 --to=銀閣寺`
4. `output/*.json` 생성 → 기존 transformer·merger로 timetable.js 반영

---

## 6. 참고 링크

- [japan-transit-data-sources.md](./japan-transit-data-sources.md) - 전체 소스 정리
- ODPT 개발자: https://developer.odpt.org/
- bus-routes.net GTFS: https://bus-routes.net/gtfs_list.php
- 福岡市地下鉄 오픈데이터: https://subway.city.fukuoka.lg.jp/subway/about/material.php
