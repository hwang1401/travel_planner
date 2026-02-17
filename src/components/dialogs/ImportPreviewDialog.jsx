import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useBackClose } from '../../hooks/useBackClose';
import Icon from "../common/Icon";
import Button from "../common/Button";
import Tab from "../common/Tab";
import { getTypeConfig, SPACING, RADIUS } from "../../styles/tokens";
import { TYPE_LABELS } from "../../styles/tokens";
import { detectConflicts } from "../../utils/scheduleParser";

/* ── helpers ── */
function getDayExistingItems(day) {
  if (!day?.sections) return [];
  return day.sections.flatMap((sec) => sec.items || []);
}

function hasPlaceInfo(item) {
  if (!item) return false;
  const d = item.detail;
  return !!(d && (d.address || d.tip || d.timetable || d.image || d.placeId || d.lat));
}

/* ── Shared row component matching PlaceCard layout ── */
function ItemRow({ item, isLast, canClick, onClick, right, conflictInfo }) {
  const cfg = getTypeConfig(item.type);
  const placeName = item.detail?.name || item.desc || "";
  const tipText = item.detail?.tip || item.sub || "";
  const subInfo = tipText ? tipText.split('\n')[0] : "";
  const hasConflict = !!conflictInfo;

  return (
    <div
      onClick={canClick ? onClick : undefined}
      style={{
        display: "flex", alignItems: "flex-start",
        gap: "var(--spacing-sp80)",
        padding: `${SPACING.ml} 0`,
        margin: hasConflict ? `0 -${SPACING.lg}` : undefined,
        paddingLeft: hasConflict ? SPACING.lg : undefined,
        paddingRight: hasConflict ? SPACING.lg : undefined,
        background: hasConflict ? "color-mix(in srgb, var(--color-error) 6%, transparent)" : "transparent",
        borderBottom: isLast ? "none" : `1px solid ${hasConflict ? "color-mix(in srgb, var(--color-error) 12%, transparent)" : "var(--color-surface-dim)"}`,
        cursor: canClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {right}

      {/* 시간 */}
      <span style={{
        width: "38px", flexShrink: 0, textAlign: "right",
        fontSize: "var(--typo-caption-1-medium-size)",
        fontWeight: "var(--typo-caption-1-medium-weight)",
        color: hasConflict ? "var(--color-error)" : "var(--color-on-surface-variant)",
        fontVariantNumeric: "tabular-nums",
        lineHeight: "20px",
      }}>
        {item.time || "--:--"}
      </span>

      {/* 컬러바 */}
      <div style={{
        width: "3px", flexShrink: 0,
        borderRadius: "var(--radius-xsm)",
        background: hasConflict ? "var(--color-error)" : cfg.text,
        opacity: hasConflict ? 0.8 : 0.6,
        alignSelf: "stretch", minHeight: "20px",
      }} />

      {/* 콘텐츠 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center",
          gap: "var(--spacing-sp40)", minHeight: "20px",
        }}>
          <p style={{
            margin: 0,
            fontSize: "var(--typo-label-2-medium-size)",
            fontWeight: "var(--typo-label-2-medium-weight)",
            color: "var(--color-on-surface)",
            lineHeight: "20px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1, minWidth: 0,
          }}>
            {placeName}
          </p>
          {canClick && (
            <Icon name="chevronRight" size={12}
              style={{ opacity: 0.3, flexShrink: 0, color: "var(--color-on-surface-variant2)" }}
            />
          )}
        </div>
        {subInfo && !hasConflict && (
          <p style={{
            margin: "var(--spacing-sp20) 0 0",
            fontSize: "var(--typo-caption-2-regular-size)",
            fontWeight: "var(--typo-caption-2-regular-weight)",
            color: "var(--color-on-surface-variant2)",
            lineHeight: "var(--typo-caption-2-regular-line-height)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {subInfo}
          </p>
        )}
        {hasConflict && (
          <p style={{
            margin: "var(--spacing-sp20) 0 0",
            fontSize: "var(--typo-caption-2-regular-size)",
            fontWeight: "var(--typo-caption-2-regular-weight)",
            color: "var(--color-error)",
            lineHeight: "var(--typo-caption-2-regular-line-height)",
            display: "flex", alignItems: "center", gap: "3px",
          }}>
            기존 '{conflictInfo.existingDescs[0]}' ({conflictInfo.time})과 시간 겹침
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Import Preview Dialog ── */
export default function ImportPreviewDialog({
  items,          // parsed items
  errors,         // parse errors
  conflicts: initialConflicts,  // { internal, external }
  dayLabel,       // e.g. "Day 1" (fallback)
  existingCount,  // (legacy, unused when allDays provided)
  onAppend,       // (selectedItems, dayIdx) => void
  onCancel,
  onItemClick,    // (item) => void — open PlaceInfoContent
  allDays,        // 전체 Day 배열 (display order)
  initialDayIdx,  // 초기 선택 Day 인덱스
}) {
  useBackClose(true, onCancel);
  const [selected, setSelected] = useState(() => new Set(items.map((_, i) => i)));
  const [selectedDayIdx, setSelectedDayIdx] = useState(initialDayIdx ?? 0);
  const [showExisting, setShowExisting] = useState(false);

  const hasDayTabs = Array.isArray(allDays) && allDays.length > 1;
  const currentDay = hasDayTabs ? allDays[selectedDayIdx] : null;

  // Tab items for Day selector
  const tabItems = useMemo(() => {
    if (!hasDayTabs) return [];
    return allDays.map((d, i) => ({
      label: `D${d.day ?? i + 1}`,
      value: i,
    }));
  }, [allDays, hasDayTabs]);

  // Existing items for the selected day
  const existingItems = useMemo(() => {
    if (!currentDay) return [];
    return getDayExistingItems(currentDay);
  }, [currentDay]);

  const existingItemCount = hasDayTabs ? existingItems.length : (existingCount || 0);

  // Recalculate conflicts when day changes
  const conflicts = useMemo(() => {
    if (!hasDayTabs) return initialConflicts;
    return detectConflicts(items, currentDay);
  }, [items, currentDay, hasDayTabs, initialConflicts]);

  const allSelected = selected.size === items.length;

  const toggleItem = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((_, i) => i)));
  };

  const handleAppend = () => {
    const selectedItems = items.filter((_, i) => selected.has(i));
    if (selectedItems.length > 0) onAppend(selectedItems, selectedDayIdx);
  };

  // Build a map: item index → external conflict info
  const externalConflictMap = new Map();
  for (const c of conflicts.external) {
    const idx = items.findIndex((it) => it.time === c.time && it.desc === c.newDesc);
    if (idx >= 0) externalConflictMap.set(idx, c);
  }

  const buttonDayLabel = `D${currentDay?.day ?? selectedDayIdx + 1}`;

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: SPACING.xxl,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "420px", maxHeight: "80vh",
          background: "var(--color-surface-container-lowest)",
          borderRadius: RADIUS.lg,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "var(--shadow-heavy)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: `${SPACING.xxl} ${SPACING.xxl} ${SPACING.lg}`,
          borderBottom: "1px solid var(--color-outline-variant)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{
              margin: 0, fontSize: "var(--typo-body-1-n---bold-size)",
              fontWeight: "var(--typo-body-1-n---bold-weight)",
              color: "var(--color-on-surface)",
            }}>
              AI 추천 일정
            </h3>
            <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onCancel} />
          </div>

          {/* Day Tab Selector */}
          {hasDayTabs && (
            <div style={{ margin: `${SPACING.md} 0 0`, overflowX: "auto" }}>
              <Tab
                items={tabItems}
                value={selectedDayIdx}
                onChange={setSelectedDayIdx}
                variant="pill"
                size="sm"
              />
            </div>
          )}

          {/* Existing items accordion */}
          {existingItemCount > 0 && (
            <div style={{ marginTop: SPACING.sm }}>
              <button
                type="button"
                onClick={() => setShowExisting((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: SPACING.sm,
                  margin: 0, padding: `${SPACING.sm} 0`,
                  border: "none", background: "none", cursor: "pointer",
                  fontSize: "var(--typo-caption-2-bold-size)",
                  fontWeight: "var(--typo-caption-2-bold-weight)",
                  color: "var(--color-on-surface-variant2)",
                  fontFamily: "inherit",
                }}
              >
                <Icon
                  name="chevronRight"
                  size={12}
                  style={{
                    transition: "transform 0.15s",
                    transform: showExisting ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                />
                기존 일정 ({existingItemCount}개)
              </button>
              {showExisting && (
                <div style={{
                  borderRadius: RADIUS.md,
                  border: "1px solid var(--color-outline-variant)",
                  overflow: "hidden",
                  background: "var(--color-surface-container-low)",
                  maxHeight: "150px",
                  overflowY: "auto",
                  padding: `0 ${SPACING.lg}`,
                }}>
                  {existingItems.map((item, i) => (
                    <ItemRow
                      key={i}
                      item={item}
                      isLast={i === existingItems.length - 1}
                      canClick={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Parse errors */}
        {errors.length > 0 && (
          <div style={{ padding: `${SPACING.md} ${SPACING.xxl} 0` }}>
            <p style={{
              margin: 0, fontSize: "var(--typo-caption-3-regular-size)",
              color: "var(--color-on-surface-variant2)",
            }}>
              {errors.length}개 줄 무시됨: {errors.slice(0, 2).join(", ")}
              {errors.length > 2 && ` 외 ${errors.length - 2}개`}
            </p>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{
          flex: 1, overflowY: "auto", padding: `${SPACING.lg} ${SPACING.xxl}`,
        }}>
          {/* Select all */}
          <label style={{
            display: "flex", alignItems: "center", gap: SPACING.ms,
            fontSize: "var(--typo-caption-2-regular-size)",
            color: "var(--color-on-surface-variant2)",
            cursor: "pointer", userSelect: "none",
            marginBottom: SPACING.lg,
          }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              style={{
                width: 16, height: 16, margin: 0, cursor: "pointer",
                accentColor: "var(--color-primary)",
              }}
            />
            전체 선택
          </label>

          {/* New items */}
          <div style={{
            borderRadius: RADIUS.md,
            border: "1px solid var(--color-outline-variant)",
            overflow: "hidden",
            padding: `0 ${SPACING.lg}`,
          }}>
            {items.map((item, i) => {
              const isLast = i === items.length - 1;
              const isChecked = selected.has(i);
              const conflictInfo = externalConflictMap.get(i);
              const canShowInfo = hasPlaceInfo(item);
              return (
                <div
                  key={i}
                  style={{
                    opacity: isChecked ? 1 : 0.35,
                    transition: "opacity 0.15s",
                  }}
                >
                  <ItemRow
                    item={item}
                    isLast={isLast}
                    canClick={canShowInfo}
                    onClick={() => onItemClick?.(item)}
                    conflictInfo={conflictInfo}
                    right={
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(i)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: 16, height: 16, margin: 0, marginTop: 2,
                          cursor: "pointer", flexShrink: 0,
                          accentColor: "var(--color-primary)",
                        }}
                      />
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: `${SPACING.lg} ${SPACING.xxl} ${SPACING.xxl}`,
          borderTop: "1px solid var(--color-outline-variant)",
          display: "flex", gap: SPACING.md,
        }}>
          <Button
            variant="neutral" size="lg"
            onClick={onCancel}
            style={{ flex: 1, borderColor: "var(--color-outline-variant)" }}
          >
            취소
          </Button>
          <Button
            variant="primary" size="lg"
            onClick={handleAppend}
            disabled={selected.size === 0}
            style={{ flex: 1 }}
          >
            {hasDayTabs
              ? `${buttonDayLabel}에 추가 (${selected.size}개)`
              : existingItemCount > 0
                ? `선택 추가 (${selected.size}개)`
                : `일정 추가 (${selected.size}개)`}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
