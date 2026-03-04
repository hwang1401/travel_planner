# GTFS → 타임테이블 DB 파이프라인

일본 내 공개 GTFS 데이터를 파싱해 `TIMETABLE_DB`와 동일한 포맷의 JSON을 생성하는 절차입니다.

---

## 1. GTFS 소스

- **Transitland**: [transit.land](https://transit.land/) — 일본 포함 전 세계 GTFS 피드 링크 제공.
- **일본 지자체·사철**: JR, 도쿄 메트로, 오사카 지하철 등 일부는 GTFS를 공개하지 않을 수 있음. 공개처는 피드 URL을 수집해 `scripts/gtfs-feeds.json` 등으로 관리할 수 있음.
- **다운로드**: GTFS는 보통 ZIP으로 제공됨. 압축 해제 후 `routes.txt`, `trips.txt`, `stop_times.txt`, `stops.txt`, `calendar.txt` 등이 있음.

---

## 2. 스크립트 사용

```bash
# GTFS 디렉터리(압축 해제된 폴더) 경로 지정
node scripts/gtfs-to-timetable.cjs path/to/gtfs-directory

# 출력: stdout 또는 scripts/output/gtfs-timetable.json
```

- **입력**: GTFS 폴더 경로 (또는 ZIP 경로 — 스크립트에서 압축 해제 후 처리 가능).
- **출력**: `docs/timetable-data-guide.md`와 동일한 구조의 노선 배열 JSON.  
  - `id`, `label`, `station`, `direction`, `trains` (time, name, dest, note), `highlights` (선택).

---

## 3. 변환 로직 요약

1. **routes.txt** — 노선 ID·이름.
2. **trips.txt** — trip_id, route_id, direction_id, shape_id 등.
3. **stop_times.txt** — trip_id, stop_id, arrival_time, departure_time, stop_sequence.
4. **stops.txt** — stop_id, stop_name.

→ trip별로 stop_sequence 순으로 정거장을 나열하고, 인접 정거장 구간(출발역 → 도착역)별로 `departure_time` 리스트를 모은다.  
→ 우리 포맷: 한 구간당 하나의 노선 객체. `label`은 "출발역명 → 도착역명 (노선명)" 형태로 하면 `matchTimetableRoute(desc)`와 매칭 가능.

---

## 4. 출력 후 반영

- 생성된 JSON을 수동 검토한 뒤 `src/data/timetable.js`의 `TIMETABLE_DB`에 병합하거나,
- 별도 JSON 파일로 두고 앱에서 동적 로드하는 방식 선택.

실제 운행 시간표는 노선·시즌에 따라 바뀌므로, 가능하면 공식 사이트 등으로 **반드시 확인**하는 것을 권장합니다.
