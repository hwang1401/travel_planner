/**
 * ── PlaceCard (Timetable Row) ──
 * 
 * 레이아웃:
 *   [체크(선택모드)] [시간 38px(탭→시간수정)] [8px] [3px 컬러바] [8px] [제목 + 부가정보] [chevron]
 *
 * 좌우 패딩 없음 — 부모 컨테이너가 수평 여백 담당.
 * 행 간 구분: border-bottom + 세로 패딩(SPACING.xl).
 */
import { useRef, useCallback } from 'react';
import Icon from '../common/Icon';
import Checkbox from '../common/Checkbox';
import { getTypeConfig, SPACING } from '../../styles/tokens';

const LONG_PRESS_MS = 500;

export default function PlaceCard({
  item, order, isNow, isClickable, onClick, isLast,
  onTimeClick,
  onLongPress,
  isSelected,
  selectionMode,
}) {
  if (!item) return null;

  const cfg = getTypeConfig(item.type);
  const placeName = item.detail?.name || item.desc || "";
  const subInfo = item.sub || "";

  /* ── 롱프레스 핸들러 ── */
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (!onLongPress) return;
    longPressTriggered.current = false;
    const t = e.touches[0];
    startPos.current = { x: t.clientX, y: t.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress(item);
    }, LONG_PRESS_MS);
  }, [onLongPress, item]);

  const handleTouchMove = useCallback((e) => {
    if (!longPressTimer.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - startPos.current.x);
    const dy = Math.abs(t.clientY - startPos.current.y);
    if (dx > 10 || dy > 10) clearLongPress();
  }, [clearLongPress]);

  const handleTouchEnd = useCallback(() => { clearLongPress(); }, [clearLongPress]);

  const handleMouseDown = useCallback((e) => {
    if (!onLongPress || e.button !== 0) return;
    longPressTriggered.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress(item);
    }, LONG_PRESS_MS);
  }, [onLongPress, item]);

  const handleMouseUp = useCallback(() => { clearLongPress(); }, [clearLongPress]);
  const handleMouseLeaveAll = useCallback((e) => {
    clearLongPress();
    // 호버 스타일 복원
    e.currentTarget.style.background = isSelected
      ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
      : isNow ? "color-mix(in srgb, var(--color-primary) 4%, transparent)" : "transparent";
  }, [clearLongPress, isSelected, isNow]);

  const handleClick = useCallback((e) => {
    if (longPressTriggered.current) { longPressTriggered.current = false; return; }
    if (selectionMode) {
      // 선택 모드에서는 탭 = 선택 토글
      onLongPress?.(item);
      return;
    }
    if (isClickable) onClick?.();
  }, [selectionMode, onLongPress, item, isClickable, onClick]);

  const handleTimeClick = useCallback((e) => {
    e.stopPropagation();
    if (selectionMode) { onLongPress?.(item); return; }
    if (onTimeClick) onTimeClick(item);
  }, [onTimeClick, item, selectionMode, onLongPress]);

  return (
    <div
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeaveAll}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--spacing-sp80)",
        padding: `${SPACING.xl} 0`,
        borderBottom: isLast ? "none" : "1px solid var(--color-surface-dim)",
        cursor: isClickable || selectionMode ? "pointer" : "default",
        transition: "background 0.15s",
        background: isSelected
          ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
          : isNow
            ? "color-mix(in srgb, var(--color-primary) 4%, transparent)"
            : "transparent",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onMouseEnter={(e) => {
        if (!isSelected && (isClickable || selectionMode))
          e.currentTarget.style.background = isNow
            ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
            : "var(--color-surface-container-lowest)";
      }}
    >
      {/* 선택 모드: 체크마크 */}
      {selectionMode && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', paddingTop: '2px' }}>
          <Checkbox checked={!!isSelected} onChange={() => onLongPress?.(item)} size={18} />
        </div>
      )}

      {/* 시간: 38px 우측정렬 — 탭 시 시간 수정 */}
      <span
        onClick={handleTimeClick}
        style={{
          width: "38px",
          flexShrink: 0,
          textAlign: "right",
          fontSize: "var(--typo-caption-1-medium-size)",
          fontWeight: "var(--typo-caption-1-medium-weight)",
          color: isNow ? "var(--color-primary)" : "var(--color-on-surface-variant)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: "20px",
          whiteSpace: "nowrap",
          cursor: onTimeClick && !selectionMode ? "pointer" : "default",
          borderRadius: "4px",
          ...(onTimeClick && !selectionMode ? {
            transition: "background 0.15s",
          } : {}),
        }}
        onMouseEnter={(e) => { if (onTimeClick && !selectionMode) e.currentTarget.style.background = "var(--color-surface-container-lowest)"; }}
        onMouseLeave={(e) => { if (onTimeClick && !selectionMode) e.currentTarget.style.background = "transparent"; }}
      >
        {item.time}
      </span>

      {/* 컬러바: 타입 구분용 */}
      <div style={{
        width: "3px",
        flexShrink: 0,
        borderRadius: "var(--radius-xsm)",
        background: cfg.text,
        opacity: isNow ? 1 : 0.6,
        alignSelf: "stretch",
        minHeight: "20px",
      }} />

      {/* 콘텐츠 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-sp40)",
          minHeight: "20px",
        }}>
          <p style={{
            margin: 0,
            fontSize: "var(--typo-label-2-medium-size)",
            fontWeight: "var(--typo-label-2-medium-weight)",
            color: "var(--color-on-surface)",
            lineHeight: "20px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}>
            {placeName}
          </p>
          {isClickable && !selectionMode && (
            <Icon
              name="chevronRight"
              size={12}
              style={{ opacity: 0.3, flexShrink: 0, color: "var(--color-on-surface-variant2)" }}
            />
          )}
        </div>

        {subInfo && (
          <p style={{
            margin: "var(--spacing-sp20) 0 0",
            fontSize: "var(--typo-caption-2-regular-size)",
            fontWeight: "var(--typo-caption-2-regular-weight)",
            color: "var(--color-on-surface-variant2)",
            lineHeight: "var(--typo-caption-2-regular-line-height)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {subInfo}
          </p>
        )}
      </div>
    </div>
  );
}
