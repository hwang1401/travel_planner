/**
 * ── PlaceCard (Timetable Row) ──
 * 
 * 레이아웃:
 *   [시간 38px] [8px] [3px 컬러바] [8px] [제목 + 부가정보] [chevron]
 *
 * 좌우 패딩 없음 — 부모 컨테이너가 수평 여백 담당.
 * 행 간 구분: border-bottom + 세로 패딩 14px.
 */
import Icon from '../common/Icon';
import { getTypeConfig } from '../../styles/tokens';

export default function PlaceCard({ item, order, isNow, isClickable, onClick, isLast }) {
  if (!item) return null;

  const cfg = getTypeConfig(item.type);
  const placeName = item.detail?.name || item.desc || "";
  const subInfo = item.sub || "";

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--spacing-sp80)",
        padding: "14px 0",
        borderBottom: isLast ? "none" : "1px solid var(--color-surface-dim)",
        cursor: isClickable ? "pointer" : "default",
        transition: "background 0.15s",
        background: isNow ? "color-mix(in srgb, var(--color-primary) 4%, transparent)" : "transparent",
      }}
      onMouseEnter={(e) => { if (isClickable) e.currentTarget.style.background = isNow ? "color-mix(in srgb, var(--color-primary) 8%, transparent)" : "var(--color-surface-container-low)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isNow ? "color-mix(in srgb, var(--color-primary) 4%, transparent)" : "transparent"; }}
    >
      {/* 시간: 38px 우측정렬 */}
      <span style={{
        width: "38px",
        flexShrink: 0,
        textAlign: "right",
        fontSize: "var(--typo-caption-1-medium-size)",
        fontWeight: "var(--typo-caption-1-medium-weight)",
        color: isNow ? "var(--color-primary)" : "var(--color-on-surface-variant)",
        fontVariantNumeric: "tabular-nums",
        lineHeight: "20px",
        whiteSpace: "nowrap",
      }}>
        {item.time}
      </span>

      {/* 컬러바: 3px */}
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
          {isClickable && (
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
