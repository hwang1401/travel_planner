# 일정 삭제 버그 수정 작업 보고서

**작업일**: 2026-02-09  
**대상 파일**: `src/components/TravelPlanner.jsx`  
**작업 범위**: 일정 삭제/편집/이동 시 데이터 무결성 버그 5건 수정

---

## 배경

일정 삭제가 간헐적으로 실패하는 문제가 보고됨. 근본 원인은 아이템이 3개의 저장소(`extraItems`, `sections overlay`, `_extraDays`)에 분산 저장되는 구조에서, 화면에 표시되는 merge된 인덱스와 실제 raw 배열 인덱스가 불일치하는 것이었음.

---

## 수정 내역

### 1. `sanitizeScheduleData` 유틸리티 함수 추가

**문제**: 편집 저장 시 `_extra` 아이템이 `sections overlay`에 흡수되어, 새로고침 후 동일 아이템이 2개로 복제되는 데이터 오염 발생.

**수정**: 컴포넌트 외부에 `sanitizeScheduleData()` 함수를 새로 작성.
- `overlay.sections` 안의 아이템 중 `extraItems`에도 존재하는 것(`time|desc` 매칭)을 overlay에서 제거
- `_extraDays` 내부 sections에서도 동일 로직 적용
- 적용 위치 2곳:
  - **초기 로드** (~221행): `setCustomData(sanitizeScheduleData(schedData))`
  - **리얼타임 수신** (~261행): `setCustomData(sanitizeScheduleData(rtData))`

```javascript
// 적용 예시
setCustomData(sanitizeScheduleData(schedData));
```

---

### 2. `handleSaveItem`의 `_extra` 필터링

**문제**: `nextForSave` 계산 시 merge된 `displayedItems`에 `_extra` 아이템이 포함되어 서버에 저장됨 → 새로고침 후 아이템 복제.

**수정** (~746행): `baseItems` 생성 시 `_extra` 플래그가 있는 아이템을 필터링.

```javascript
// Before
const baseItems = Array.isArray(displayedItems) ? [...displayedItems] : [];

// After
const baseItems = Array.isArray(displayedItems)
  ? displayedItems.filter((it) => it && !it._extra)
  : [];
```

---

### 3. `performDeleteItem` 전면 재작성

**문제**: 화면 인덱스(`itemIdx`)로 raw 배열을 `splice` → 범위 밖이면 무동작 → "삭제되었습니다" 토스트만 뜨고 실제 삭제 안 됨.

**수정** (~800–880행): identity 기반(`time + desc`)으로 전면 재작성.
- **3곳 모두에서 삭제**: `extraItems`, `sections overlay`, `_extraDays`
- 삭제 후 `nextSnapshot` 캡처 → **즉시 `saveSchedule` 호출** (debounce 우회)
- 의존성 배열에 `tripId`, `isLegacy` 추가

```javascript
// 삭제 로직 핵심 구조
// 1) extraItems에서 time+desc 매칭으로 삭제
// 2) sections overlay 전체 순회하며 매칭 삭제
// 3) _extraDays sections 순회하며 매칭 삭제
// 4) 즉시 saveSchedule 호출
```

---

### 4. 리얼타임 skip 메커니즘을 타임스탬프 기반으로 변경

**문제**: `skipNextRealtimeRef`(boolean)가 저장 1회 = 이벤트 1회만 skip. 편집 후 debounced + immediate save가 이벤트 2개 생성 시, 또는 공유 여행에서 상대방 이벤트가 먼저 도착 시 skip이 소비되어 삭제가 원복됨.

**수정**:
- `skipNextRealtimeRef = useRef(false)` → `lastSaveTimestampRef = useRef(0)` 으로 교체
- 모든 `saveSchedule` 호출 지점(4곳)에서 `lastSaveTimestampRef.current = Date.now()` 기록
- 리얼타임 수신 시 마지막 저장 후 2초 이내 이벤트는 무시

```javascript
// 리얼타임 핸들러
if (Date.now() - lastSaveTimestampRef.current < 2000) return;
```

**영향받는 위치**: 총 6곳
| 위치 | 용도 |
|------|------|
| ~171행 | ref 선언 |
| ~251행 | 리얼타임 핸들러 (수신 시 체크) |
| ~273행 | `persistSchedule` (debounced 저장) |
| ~773행 | `handleSaveItem` (즉시 저장) |
| ~871행 | `performDeleteItem` (즉시 저장) |
| ~1053행 | 일괄 삭제 (즉시 저장) |

---

### 5. `handleMoveToDay` standalone 경로를 `extraItems`로 통일

**문제**: standalone 여행에서 "다른 Day로 이동" 시 `_extraDays.sections`에 직접 삽입 → 삭제 시 `extraItems`에서만 찾아 삭제 실패.

**수정** (~910–986행):
- **Source 삭제**: 기존 인덱스 기반 → identity 기반으로 변경 (3곳 모두 삭제)
- **Target 추가**: standalone/비-standalone 경로를 통일하여 항상 `extraItems`에 추가
- `_extra` 대신 `_custom: true` 플래그 사용 (merge 시 자동으로 `_extra` 부여)

```javascript
// Target: 항상 extraItems에 추가 (통일)
const itemToAdd = { ...item, _custom: true };
delete itemToAdd._extra;
next[targetDayIdx].extraItems = [...next[targetDayIdx].extraItems, itemToAdd];
```

---

## 수정 전후 비교

| 시나리오 | Before | After |
|----------|--------|-------|
| extra 아이템 사이에 있는 원본 아이템 삭제 | splice 범위 밖 → 삭제 실패 | identity 매칭 → 정상 삭제 |
| 편집 후 새로고침 | extra 아이템 복제 누적 | `_extra` 필터링 + sanitize로 방지/복구 |
| Day 이동 후 삭제 (standalone) | extraItems에서 못 찾음 → 실패 | 3곳 모두 탐색 + extraItems 통일 |
| 공유 여행에서 삭제 후 원복 | skip boolean 1회 소비 → 원복 | 2초 윈도우로 안정적 skip |
| 기존 오염 데이터 | 수동 정리 필요 | 로드 시 자동 sanitize |

---

## 테스트 체크리스트

- [ ] 새 일정 추가 후 삭제
- [ ] 편집 후 삭제
- [ ] 편집 → 새로고침 → 아이템 복제 여부 확인
- [ ] "다른 Day로 이동" 후 해당 아이템 삭제
- [ ] standalone 여행에서 위 시나리오 반복
- [ ] 공유 여행에서 삭제 시 원복 여부
- [ ] 일괄 삭제 동작 확인
- [ ] 리얼타임 동기화 (다른 사용자 변경 2초 후 정상 수신)
