# 코드리뷰 후속 작업 정리

코드리뷰에서 짚힌 5가지 항목과 처리 계획/상태.

---

## 1. timetable.js 하드코딩 (가장 큰 리스크)

**상태**: 문서화 완료.

- **조치**
  - `docs/timetable-data-guide.md` 상단에 **"2026년 2월 기준, 정기 업데이트 필요"** 안내 추가.
  - `src/data/timetable.js` 파일 상단 주석에 기준 시점·갱신 필요·관련 docs 링크 명시.
- **장기**
  - `docs/plan-timetable-data-acquisition.md`, `docs/gtfs-timetable-pipeline.md`에 정리된 GTFS 파이프라인으로 전환 검토.

---

## 2. DetailDialog 사진 자동 fetch — 비용 주의

**상태**: 메모리 캐시 적용 완료.

- **조치**
  - `src/lib/googlePlaces.js`에 `_photoCache` Map 추가.
  - `getPlacePhotoFromLocation`, `getPlacePhotoForItem` 호출 시 캐시 키(위경도 또는 item 기준)로 조회 후 hit이면 API 미호출.
  - 캐시 크기 상한 200건, FIFO로 정리.
- **효과**: 같은 장소를 여러 번 열어도 최초 1회만 API 호출.

---

## 3. EditItemDialog / StationPickerModal — 애니메이션·뒤로가기

**상태**: 검토 항목으로 문서화. 필요 시 별도 작업.

- **현재**
  - 둘 다 `createPortal(..., document.body)` + `useScrollLock`(EditItemDialog만) 사용.
  - StationPickerModal: `stationPickerSlideIn` (아래에서 올라오는 진입 애니메이션).
  - EditItemDialog: 별도 진입/퇴장 애니메이션 없음.
  - **브라우저 뒤로가기**: 두 모달 모두 `history.pushState`/`popstate` 미사용 → 뒤로가기 시 모달이 닫히지 않고 이전 페이지로 이동.
- **권장**
  - 진입/퇴장 애니메이션을 두 모달에서 비슷한 패턴으로 맞출지 검토.
  - 모달 오픈 시 `history.pushState`, `popstate`에서 `onClose()` 호출해 뒤로가기로 모달 닫기 지원 여부 검토.

---

## 4. regionImages.js — 전부 빈 문자열

**상태**: 문서화 완료. 동작 변경 없음.

- **조치**
  - `src/data/regionImages.js` 상단 주석에 **"현재 모든 URL이 비어 있어 getRegionImageForAddress()는 항상 null"** 이라고 명시.
  - 실제 이미지를 넣을 경우 채우거나, 사용처(DetailDialog)에서 이 fallback 제거 후 Google Places·업로드 이미지만 사용 가능하다고 안내.
- **선택**: 나중에 지역별 기본 이미지를 넣을 때 `REGION_IMAGE_MAP`만 채우면 됨.

---

## 5. flight 타입 — rag_places 스키마와 불일치

**상태**: 의도 명시 완료.

- **사실**
  - 앱(geminiService, storage, UI): `type`에 `flight`, `move` 포함.
  - `rag_places` 테이블: `type` CHECK는 `('food', 'spot', 'shop', 'stay', 'info')`만 허용. RAG에서 flight/move 장소를 넣을 계획이 없으므로 의도적 불일치.
- **조치**
  - `supabase/rag_places.sql`의 `type` CHECK 위에 주석 추가: "RAG은 장소만; 앱 일정 타입에는 flight, move도 있음(rag_places에는 없음)."

---

## 요약

| # | 항목 | 처리 |
|---|------|------|
| 1 | timetable 하드코딩 | docs + 파일 주석에 기준 시점·정기 갱신·GTFS 전환 안내 |
| 2 | DetailDialog 사진 API 비용 | googlePlaces.js에 place photo 메모리 캐시 추가 |
| 3 | EditItemDialog/StationPickerModal | 애니메이션 일관성·뒤로가기 핸들링 검토 항목으로 문서화 |
| 4 | regionImages.js 빈 URL | 현재 동작(null 반환) 및 사용 방향 주석으로 명시 |
| 5 | flight vs rag_places type | rag_places.sql에 의도 주석 추가 |
