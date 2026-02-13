# handleSaveItem Stale Closure 버그 수정 기록

**수정일**: 2025-02-09  
**대상 파일**: `src/components/TravelPlanner.jsx`  
**함수**: `handleSaveItem` (line 831 ~ 975)

---

## 1. 버그 요약

### 증상
- 상세 다이얼로그(DetailDialog)에서 주소 수정 후 확인 → 다이얼로그 닫기 → 다시 열면 **주소가 사라짐**
- React 상태는 정상 반영되지만, Supabase에 저장되는 데이터가 **stale(구버전)** 임

### 근본 원인
`handleSaveItem`만 다른 CRUD 핸들러와 다른 패턴을 사용하고 있었음:

- **다른 핸들러** (handleAddDay, performDeleteItem 등): `updateCustomData` updater **내부**에서 `nextSnapshot`을 캡처 → 그 값을 Supabase에 저장
- **handleSaveItem만**: updater **외부**에서 `const nextState = computeNext(customData)`로 계산 → **클로저에 갇힌 stale `customData`** 를 기준으로 Supabase에 저장

`customData`는 React state이므로 비동기 갱신. `handleSaveItem` 호출 시점의 `customData`는 이전 렌더의 값일 수 있어, 최신 변경이 반영되지 않은 데이터가 저장됨.

---

## 2. 수정 내용

### 2-1. nextSnapshot 캡처 패턴 적용

**수정 전**
```javascript
const computeNext = (prev) => { /* ... */ return { ...next }; };

const nextState = computeNext(customData);   // ← stale customData 사용!
updateCustomData(() => nextState);

if (tripId && !isLegacy && debouncedSaveRef.current) {
  saveSchedule(tripId, nextState);           // ← stale 데이터 저장
}
```

**수정 후**
```javascript
let nextSnapshot = null;

updateCustomData((prev) => {
  const computeNext = (p) => { /* ... */ return { ...next }; };
  const result = computeNext(prev);   // ← updater가 전달한 최신 prev 사용
  nextSnapshot = result;              // ← updater 내부에서 캡처
  return result;
});

if (tripId && !isLegacy && nextSnapshot) {
  saveSchedule(tripId, nextSnapshot); // ← 최신 데이터 저장
}
```

### 2-2. computeNext 위치 변경

- **수정 전**: updater 바깥에 `computeNext` 정의, 인자로 `customData` 전달
- **수정 후**: updater **내부**에 `computeNext` 정의, 인자로 `prev` 전달

`prev`는 `updateCustomData`가 넘겨주는 **가장 최신** customData이므로, 이 값으로 계산한 결과만 Supabase에 저장됨.

### 2-3. 저장 조건 변경

- **수정 전**: `debouncedSaveRef.current` 존재 여부로 저장 여부 판단
- **수정 후**: `nextSnapshot` 존재 여부로 저장 여부 판단

저장할 데이터(`nextSnapshot`)가 실제로 있는지 확인한 뒤 저장하도록 변경.

### 2-4. 에러 로그 메시지 변경

- **수정 전**: `'[TravelPlanner] Schedule save failed:'`
- **수정 후**: `'[TravelPlanner] Immediate save after edit failed:'`

handleSaveItem 경로에서 실패했음을 구분하기 쉽게 수정.

### 2-5. useCallback deps에서 customData 제거

- **수정 전**: `[..., customData, tripId, isLegacy, tripMeta]`
- **수정 후**: `[..., tripId, isLegacy, tripMeta]`

이제 `customData`를 클로저에서 사용하지 않으므로 deps에서 제거.

---

## 3. 변경된 코드 블록 (line 단위)

| 항목 | line | 내용 |
|------|------|------|
| 추가 | 856 | `let nextSnapshot = null;` |
| 변경 | 858~936 | `updateCustomData((prev) => { ... })` - updater 내부에서 `computeNext(prev)` 호출 및 `nextSnapshot = result` |
| 변경 | 939 | `if (tripId && !isLegacy && nextSnapshot)` (기존 `debouncedSaveRef.current` → `nextSnapshot`) |
| 변경 | 932 | `.catch` 내 `'[TravelPlanner] Immediate save after edit failed:'` |
| 변경 | 975 | deps 배열에서 `customData` 제거 |

---

## 4. 동일 패턴 사용 중인 다른 핸들러

다음 핸들러들은 이미 올바른 `nextSnapshot` 패턴을 사용 중:

- `handleAddDay` (line ~640)
- `handleDeleteDay` (line ~712)
- `handleReorderConfirm` (line ~805)
- `performDeleteItem` (line ~978)
- `runBulkDeleteWithPayload` (line ~1261)
- `replaceSchedule` (line ~1385)

---

## 5. 테스트 체크리스트

- [ ] 상세 다이얼로그에서 주소 수정 → 확인 → 닫기 → 다시 열기 → **주소 유지**
- [ ] 주소 수정 후 새로고침 → **주소 유지**
- [ ] 시간표 선택 후 저장 유지 확인
- [ ] 시간 수정 후 저장 유지 확인
- [ ] 일정 추가(extraItems) → 저장 유지 확인
- [ ] 기존 일정 수정(sections overlay) → 저장 유지 확인
