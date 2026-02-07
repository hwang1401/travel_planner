import { useState } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Field from '../common/Field';
import AddressSearch from '../common/AddressSearch';
import BottomSheet from '../common/BottomSheet';
import { TIMETABLE_DB, findBestTrain } from '../../data/timetable';

/* ── Edit Item Dialog (일정 추가/수정) ── */
export default function EditItemDialog({ item, sectionIdx, itemIdx, dayIdx, onSave, onDelete, onClose, color }) {
  const isNew = !item;
  const [time, setTime] = useState(item?.time || "");
  const [desc, setDesc] = useState(item?.desc || "");
  const [type, setType] = useState(item?.type || "spot");
  const [sub, setSub] = useState(item?.sub || "");
  const [address, setAddress] = useState(item?.detail?.address || "");
  const [detailName, setDetailName] = useState(item?.detail?.name || "");
  const [detailTip, setDetailTip] = useState(item?.detail?.tip || "");
  const [detailPrice, setDetailPrice] = useState(item?.detail?.price || "");
  const [detailHours, setDetailHours] = useState(item?.detail?.hours || "");
  const [detailImage, setDetailImage] = useState(item?.detail?.image || "");

  // Timetable state
  const currentRouteId = item?.detail?.timetable?._routeId || "";
  const [selectedRoute, setSelectedRoute] = useState(currentRouteId);
  const [loadedTimetable, setLoadedTimetable] = useState(item?.detail?.timetable || null);

  const typeOptions = [
    { value: "food", label: "식사" },
    { value: "spot", label: "관광" },
    { value: "shop", label: "쇼핑" },
    { value: "move", label: "→ 이동" },
    { value: "stay", label: "숙소" },
    { value: "info", label: "정보" },
  ];

  const catMap = { food: "식사", spot: "관광", shop: "쇼핑", move: "교통", stay: "숙소", info: "교통" };

  // Generate time options (00:00 to 23:30 in 30-min intervals)
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      timeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  const handleLoadTimetable = (routeId) => {
    if (!routeId) { setLoadedTimetable(null); return; }
    const route = TIMETABLE_DB.find((r) => r.id === routeId);
    if (!route) return;
    const bestIdx = findBestTrain(route.trains, time);
    const trains = route.trains.map((t, i) => ({ ...t, picked: i === bestIdx }));
    setLoadedTimetable({
      _routeId: routeId,
      station: route.station,
      direction: route.direction,
      trains,
    });
    setSelectedRoute(routeId);
  };

  const handleSave = () => {
    if (!time.trim() || !desc.trim()) return;
    const hasDetailContent = detailName.trim() || address.trim() || detailTip.trim() || detailImage.trim() || detailPrice.trim() || detailHours.trim();

    const newItem = {
      time: time.trim(),
      desc: desc.trim(),
      type,
      ...(sub.trim() ? { sub: sub.trim() } : {}),
      _custom: true,
    };

    // Build timetable + highlights from loaded route
    let timetable = loadedTimetable;
    let highlights = item?.detail?.highlights || null;
    if (loadedTimetable?._routeId) {
      const route = TIMETABLE_DB.find((r) => r.id === loadedTimetable._routeId);
      if (route) highlights = route.highlights;
    }

    if (hasDetailContent || timetable) {
      newItem.detail = {
        name: detailName.trim() || desc.trim(),
        category: catMap[type] || "관광",
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(detailTip.trim() ? { tip: detailTip.trim() } : {}),
        ...(detailPrice.trim() ? { price: detailPrice.trim() } : {}),
        ...(detailHours.trim() ? { hours: detailHours.trim() } : {}),
        ...(detailImage.trim() ? { image: detailImage.trim() } : {}),
        ...(timetable ? { timetable } : {}),
        ...(highlights ? { highlights } : {}),
      };
    }

    onSave(newItem, dayIdx, sectionIdx, itemIdx);
  };

  return (
    <BottomSheet
      onClose={onClose}
      maxHeight="85vh"
    >
        {/* Header */}
        <div style={{
          padding: "6px 16px 12px 20px", flexShrink: 0,
          borderBottom: "1px solid var(--color-outline-variant)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
            {isNew ? "일정 추가" : "일정 수정"}
          </h3>
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Time + Type row */}
          <div style={{ display: "flex", gap: "10px" }}>
            <Field as="select" label="시간" required size="lg" variant="outlined"
              value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: 1 }}>
              <option value="">시간 선택</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Field>
            <Field as="select" label="유형" size="lg" variant="outlined"
              value={type} onChange={(e) => setType(e.target.value)} style={{ flex: 1 }}>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Field>
          </div>

          {/* Desc */}
          <Field label="일정명" required size="lg" variant="outlined"
            value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="예: 캐널시티 라멘스타디움" />

          {/* Sub */}
          <Field label="부가 정보" size="lg" variant="outlined"
            value={sub} onChange={(e) => setSub(e.target.value)} placeholder="예: 도보 5분 · 1,000엔" />

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--color-outline-variant)", paddingTop: "10px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "var(--typo-caption-1-bold-size)", fontWeight: "var(--typo-caption-1-bold-weight)", color: "var(--color-on-surface-variant)" }}>상세 정보</p>
          </div>

          {/* Detail name */}
          <Field label="장소명 (상세)" size="lg" variant="outlined"
            value={detailName} onChange={(e) => setDetailName(e.target.value)} placeholder="미입력 시 일정명 사용" />

          {/* Address */}
          <AddressSearch
            label="주소"
            value={address}
            onChange={(addr) => setAddress(addr)}
            placeholder="주소 또는 장소 검색"
            size="lg"
          />

          {/* Hours + Price */}
          <div style={{ display: "flex", gap: "10px" }}>
            <Field label="영업시간" size="lg" variant="outlined"
              value={detailHours} onChange={(e) => setDetailHours(e.target.value)} placeholder="11:00~23:00" style={{ flex: 1 }} />
            <Field label="가격" size="lg" variant="outlined"
              value={detailPrice} onChange={(e) => setDetailPrice(e.target.value)} placeholder="~1,000엔" style={{ flex: 1 }} />
          </div>

          {/* Tip */}
          <Field as="textarea" label="팁 / 메모" size="lg" variant="outlined"
            value={detailTip} onChange={(e) => setDetailTip(e.target.value)} placeholder="참고사항 입력" rows={2} />

          {/* Image URL */}
          <Field label="이미지 경로" size="lg" variant="outlined"
            value={detailImage} onChange={(e) => setDetailImage(e.target.value)} placeholder="/images/filename.jpg" />

          {/* Timetable loader - only for move type */}
          {type === "move" && (
            <>
              <div style={{ borderTop: "1px solid var(--color-outline-variant)", paddingTop: "10px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "var(--typo-caption-1-bold-size)", fontWeight: "var(--typo-caption-1-bold-weight)", color: "var(--color-on-surface-variant)", display: "flex", alignItems: "center", gap: "4px" }}><Icon name="car" size={14} />시간표 불러오기</p>
              </div>
              <Field as="select" label="노선 선택" size="lg" variant="outlined"
                value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}>
                <option value="">시간표 없음</option>
                {TIMETABLE_DB.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </Field>
              <Button variant={selectedRoute ? "primary" : "neutral"} size="md" iconLeft="sync"
                onClick={() => handleLoadTimetable(selectedRoute)}
                disabled={!selectedRoute}
                fullWidth
                style={{ padding: "10px", height: "auto" }}>
                {loadedTimetable ? "시간표 다시 불러오기" : "시간표 불러오기"}
                {time.trim() ? ` (${time.trim()} 기준)` : ""}
              </Button>

              {/* Preview loaded timetable */}
              {loadedTimetable && loadedTimetable.trains && (
                <div style={{
                  background: "var(--color-surface-container-low)", borderRadius: "var(--radius-md, 8px)", border: "1px solid var(--color-outline-variant)",
                  padding: "10px 12px", fontSize: "var(--typo-caption-2-regular-size)",
                }}>
                  <p style={{ margin: "0 0 6px", fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)", color: "var(--color-on-surface-variant)" }}>
                    {loadedTimetable.station} → {loadedTimetable.direction}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {loadedTimetable.trains.map((t, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "4px 6px", borderRadius: "var(--radius-md, 8px)",
                        background: t.picked ? "var(--color-warning-container)" : "transparent",
                        fontWeight: t.picked ? 700 : 400,
                      }}>
                        <span style={{ width: "38px", flexShrink: 0, color: t.picked ? "var(--color-warning)" : "var(--color-on-surface-variant)" }}>{t.time}</span>
                        <span style={{ flex: 1, color: t.picked ? "var(--color-on-surface)" : "var(--color-on-surface-variant)" }}>{t.name}</span>
                        {t.picked && <span style={{
                          fontSize: "var(--typo-caption-3-bold-size)", background: "var(--color-warning-container)", color: "var(--color-on-warning-container)",
                          padding: "1px 5px", borderRadius: "4px", fontWeight: "var(--typo-caption-3-bold-weight)",
                        }}>탑승 예정</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: "0 20px 16px", display: "flex", gap: "8px", flexShrink: 0 }}>
          {!isNew && onDelete && (
            <Button variant="ghost-neutral" size="lg" onClick={() => onDelete(dayIdx, sectionIdx, itemIdx)}>
              삭제
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={handleSave} fullWidth
            disabled={!(time.trim() && desc.trim())}
            style={{ flex: 1 }}>
            {isNew ? "추가" : "저장"}
          </Button>
        </div>
    </BottomSheet>
  );
}
