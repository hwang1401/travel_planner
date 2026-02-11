# CRUD 추가 수정 작업 보고서

**작업일**: 2026-02-09  
**선행 작업**: 일정 삭제 버그 수정(schedule-delete-bugfix-report.md) 적용 완료 상태  
**대상 파일**: `src/components/TravelPlanner.jsx`, `src/components/dialogs/EditItemDialog.jsx`  
**작업 범위**: 편집 인덱스 불일치, placeId 유실, Day 삭제 overlay 잔류, 즉시 저장 누락 5건 수정

---

## 배경

삭제 버그 수정 후에도 편집·Day 삭제·일괄 import 등에서 동일한 뿌리(머지된 인덱스 vs raw 배열) 문제와, mutation 후 디바운스만 사용해 서버 반영이 늦거나 realtime으로 덮어씌워지는 문제가 남아 있음. 본 작업으로 identity 기반 편집, placeId 보존, Day 삭제 시 overlay 정리, 주요 mutation에 즉시 저장을 적용함.

---

## 수정 내역

### 1. handleSaveItem 섹션 편집 — 인덱스 불일치 수정

**문제**: 섹션 아이템 편집 시 `itemIdx`가 merge된 화면 인덱스라 raw 배열(`sections[si].items`, `_extraDays`) 크기와 불일치. `newItems[itemIdx] = newItem` 시 범위 밖이면 유령 아이템 추가 또는 수정 미반영.

**수정**: 인덱스 대신 **identity 매칭**(`time + desc`)으로 교체 대상 찾기. 4곳 적용.

| 위치 | 내용 |
|------|------|
| **A** `updateCustomData` 내부 | `newItems`에서 `editTarget?.item`과 `time`·`desc`로 `matchIdx` 찾아 `newItems[matchIdx] = newItem`, 없으면 인덱스 fallback |
| **B** `_extraDays` 동기화 | `itemIdx < edSec.items.length` 조건 제거, 동일 identity 매칭으로 `edNewItems[edMatchIdx] = newItem` |
| **C** `nextForSave` 경로 | `baseItems` 복사본에서 `editTarget?.item`으로 match 후 교체, 없으면 인덱스 fallback |
| **D** `nextForSave` 내 `_extraDays` | `edItems`에서 identity 매칭 후 교체, 조건 완화 |

```javascript
// 수정 패턴 (A, C 예시)
const oldItem = editTarget?.item;
if (oldItem) {
  const matchIdx = newItems.findIndex((it) =>
    it && it.time === oldItem.time && it.desc === oldItem.desc
  );
  if (matchIdx >= 0) newItems[matchIdx] = newItem;
  else if (itemIdx < newItems.length) newItems[itemIdx] = newItem;
} else if (itemIdx < newItems.length) {
  newItems[itemIdx] = newItem;
}
```

---

### 2. EditItemDialog — placeId 유실 수정

**문제**: RAG/AI로 추가된 아이템의 `detail.placeId`가 EditItemDialog 저장 시 `newItem.detail` 구성에서 누락되어, 한 번이라도 편집하면 Google Maps "place_id" 링크가 좌표 fallback으로 바뀜.

**수정** ([EditItemDialog.jsx](src/components/dialogs/EditItemDialog.jsx)):

- **state 추가** (~51행): `const [detailPlaceId] = useState(item?.detail?.placeId || null);`
- **저장 시 포함** (~451행): `newItem.detail`에 `...(detailPlaceId ? { placeId: detailPlaceId } : {})` 추가 (lat/lon 다음)

---

### 3. handleDeleteDay — overlay 잔류 및 인덱스 시프트

**문제**: Day 삭제 시 `_extraDays`만 제거하고 숫자 키 overlay(`customData[dayIdx]`)를 건드리지 않아, 삭제된 Day의 extraItems 등이 다음 Day 인덱스에 유령처럼 붙음. `_dayOverrides`도 인덱스 시프트 없음.

**수정** ([TravelPlanner.jsx](src/components/TravelPlanner.jsx) handleDeleteDay):

1. **숫자 키 overlay 정리**
   - `delete next[dayIdx]` — 삭제된 Day overlay 제거
   - `dayIdx+1` ~ `totalDaysBefore-1` 루프로 한 칸씩 앞으로 시프트 후 마지막 키 정리
2. **_dayOverrides 시프트**  
   - `dayIdx` 제거, `ki > dayIdx`인 키는 `ki - 1`로 재할당
3. **즉시 저장**  
   - `nextSnapshot` 캡처 후 `saveSchedule(tripId, nextSnapshot)` 호출 (기존 `flush()` 제거)

---

### 4. handleBulkImport — 즉시 저장 추가

**문제**: AI 파싱 결과 replace/append 시 `updateCustomData`만 사용. 800ms 디바운스 안에 realtime 이벤트가 오면 파싱 결과가 통째로 원복됨.

**수정**: replace/append 양쪽 `updateCustomData` 콜백에서 `nextSnapshot` 캡처 후, 콜백 밖에서 `lastSaveTimestampRef.current = Date.now()` 및 `saveSchedule(tripId, nextSnapshot)` 호출.

---

### 5. handleAddDay / handleReorderConfirm — 즉시 저장 추가

**문제**:
- **handleAddDay**: 새 Day 추가 후 디바운스만 사용 → 빠르게 다음 작업 시 Day 추가가 서버에 반영되기 전에 덮어쓸 수 있음.
- **handleReorderConfirm**: Day 순서 변경도 디바운스만 사용 → 순서 변경 직후 편집 시 race 가능.

**수정**: 두 핸들러 모두 `nextSnapshot` 캡처 후 즉시 `saveSchedule()` 호출. 의존성 배열에 `tripId`, `isLegacy` 추가.

---

## 수정 전후 비교

| 시나리오 | Before | After |
|----------|--------|-------|
| extra 아이템 사이의 원본 아이템 편집 | 인덱스로 raw 접근 → 유령 추가 또는 미반영 | identity 매칭으로 정확히 해당 아이템만 수정 |
| RAG 장소 편집 후 Google Maps 링크 | placeId 유실 → 좌표 fallback | placeId 보존 |
| Day 1 삭제 후 Day 2(새 index 1) | Day 1 overlay가 index 1에 잔류 → 유령 아이템 | overlay 삭제 + 시프트로 정리 |
| AI 파싱 교체 후 빠른 새로고침 | realtime으로 원복 가능 | 즉시 저장으로 유지 |
| Day 추가 / 순서 변경 직후 | 디바운스에만 의존 | 즉시 저장으로 반영 |

---

## 테스트 체크리스트

### #1 편집 인덱스
- [ ] extra 아이템이 섹션 중간에 있는 Day에서 뒤쪽 아이템 편집 → 해당 아이템만 수정됨
- [ ] 편집 후 새로고침 → 복제 없음
- [ ] 편집 후 다른 아이템 삭제 → 정상 동작

### #2 placeId 보존
- [ ] RAG 장소 추가 → DetailDialog에서 Google Maps 링크가 place_id 기반
- [ ] 해당 아이템 편집(시간만 변경) 후 저장 → 다시 열어도 링크 유지
- [ ] 주소 완전 변경 시에는 현재 단계에서는 placeId 유지 (추후 리셋 로직 추가 가능)

### #3 Day 삭제 overlay
- [ ] Day 3개 중 Day 2에만 수동 추가 아이템 → Day 1 삭제 → 새 Day 1(Day 2)에 유령 아이템 없음
- [ ] Day 1에 편집된 아이템 있는 상태에서 Day 1 삭제 → Day 2에 영향 없음

### #4~5 즉시 저장
- [ ] AI 파싱 결과 교체 → 즉시 새로고침 → 결과 유지
- [ ] Day 추가 → 즉시 새로고침 → Day 유지
- [ ] Day 순서 변경 → 즉시 새로고침 → 순서 유지
