# 일본 전역 교통 데이터 소스 (법적으로 이용 가능)

시영 지하철, 버스, 공항버스, 공항철도 등 **공식·오픈데이터** 위주로 정리. (2025~2026 기준)

---

## 1. ODPT (공공교통 오픈데이터센터) — **우선 추천**

| 항목 | 내용 |
|------|------|
| **URL** | https://www.odpt.org/ (일본어) / https://developer.odpt.org/en/ (영문·개발자) |
| **형식** | REST API (JSON), GTFS |
| **조건** | 개발자 등록 후 Consumer Key 발급 |
| **법적** | 오픈데이터·협정회 공식 제공 |

### 포함 노선 예시 (124개 사업자)
- **철도**: JR 동일본(일부), 도쿄 메트로, 도에이 지하철, 쯔쿠바 익스프레스 등
- **버스**: 京福バス, 関東バス, 川崎市バス, 松江市交通局 등
- **공항**: 나리타 익스프레스, 스카이라이너, 케이큐, 하네다 모노레일 등 (Phase 2 계획)
- **페리**: 阪九フェリー 등

### 데이터 예시
- 도쿄 메트로 역별 시간표: https://ckan.odpt.org/dataset/r_station_timetable-tokyometro
- 도에이 지하철·버스·트램 GTFS: https://catalog.data.metro.tokyo.lg.jp/

---

## 2. 공식 PDF / 웹 시간표

### 시영 지하철

| 도시 | 사업자 | PDF/웹 | 비고 |
|------|--------|--------|------|
| **후쿠오카** | 福岡市交通局 | https://subway.city.fukuoka.lg.jp/schedule/print/ | 공항선·하코자키선·나나쿠마선, 오픈데이터 있음 |
| **삿포로** | じょうてつ | https://www.jotetsu.co.jp/bus/times/ | PDF 다운로드 |
| **도쿄** | 도쿄 메트로 / 도에이 | ODPT 참조 | PDF는 역·노선별 확인 |
| **오사카** | 大阪メトロ | 공식 사이트 | GTFS는 별도 확인 필요 |

### JR

| 사업자 | PDF | 비고 |
|--------|-----|------|
| **JR 큐슈** | https://www.jrkyushu.co.jp/english/pdf/ | ✅ 이미 사용 중 |
| **JR 센트럴** | https://global.jr-central.co.jp/en/info/timetable/ | 이미지 PDF → 텍스트 추출 불가 |

### 공항 철도·버스

| 구간 | 사업자 | 소스 |
|------|--------|------|
| **나리타↔도쿄** | N'EX, 스카이라이너 | ODPT(Phase 2), 각사 공식 사이트 |
| **하네다↔도쿄** | 모노레일, 케이큐 | ODPT |
| **후쿠오카공항↔하카타** | 지하철 공항선 | 福岡市地下鉄 PDF |
| **공항 리무진버스** | 東京空港交通 | https://www.limousinebus.co.jp/ja/timetable/ (웹) |

---

## 3. GTFS 오픈데이터 (전국 버스 등)

| 소스 | URL | 라이선스 | 비고 |
|------|-----|----------|------|
| **전국 GTFS 목록** | https://bus-routes.net/gtfs_list.php | CC BY 4.0 / CC0 다수 | 事業者 직접 제공 = 안전 |
| **bustime.jp 원본** | https://bustime.jp/GtfsAgency/gtfs_list/ | 각 데이터별 | bus-routes.net이 여기서 수집 |
| **GTFS Data Repository** | https://gtfs-data.jp/ | 데이터별 상이 | 검색·다운로드용 |

### 제공 형태별 구분
- **事業者 직접** (사업자 직접): 道南バス, 十勝バス, 恵庭市, 福岡市地下鉄 등 — 법적 리스크 낮음  
- **ジョルダン 提供** (조루단 제공): ジョルダン 이용약관 확인 필요  
- **CC BY 4.0 / CC0**: 표시된 라이선스 준수 시 이용 가능

### 대표 사업자 예 (직접 제공)
- 道南バス, 十勝バス, ふらのバス (홋카이도)
- 青森市営バス, 東日本旅客鉄道 (JR 동일본 버스)
- 北海道北見バス, 根室交通
- 福岡市地下鉄 (오픈데이터)

---

## 4. 활용 우선순위 (우리 앱 기준)

1. **ODPT API** — 도쿄권 철도·버스·공항접근 (Consumer Key 발급 후)
2. **후쿠오카 시영 지하철** — PDF 또는 오픈데이터
3. **JR 큐슈 PDF** — 이미 구현됨 ✅
4. **bus-routes.net GTFS** — 事業자 직접 제공 + CC BY/CC0 명시된 데이터 위주
5. **기타 공식 PDF** — 운영자별 사이트에서 수동 확인

---

## 5. 주의사항

- **ジョルダン(조루단) 제공 GTFS**: 원천이 조루단이면 해당 사이트 이용약관 확인 필요
- **에키탄(Ekitan)**: 데이터 가공·재배포 금지 → 사용 자제
- **상업 이용**: ODPT·GTFS 모두 라이선스 확인 후 사용 (ODPT는 개발자 등록 시 약관 확인)

---

## 6. 파이프라인 확장 아이디어

| 소스 | 구현 방식 | 상태 |
|------|-----------|------|
| ODPT | `odpt-collector.js` (Phase 2), REST API 호출 | Phase 2 |
| GTFS | `gtfs-parser.js` — 로컬 zip/디렉토리 CSV 파싱 | ✅ 구현됨 |
| 공식 PDF | 현재 `pdf-parser.js` 확장 | ✅ JR 큐슈 등 |
| 福岡市 Excel | `fukuoka-subway-collector.js` | ✅ 공항선·博多↔天神 |

---

## 7. 지역별 전략

자세한 내용: [docs/regional-transit-strategy.md](./regional-transit-strategy.md)
