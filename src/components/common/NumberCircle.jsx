/**
 * ── NumberCircle ──
 * 타임라인 번호 원. primary 단일 색.
 * TravelPlanner 타임라인에서는 타임테이블 스타일로 전환되어 미사용.
 * 번호가 필요한 UI(AddPlacePage, FullMapDialog 등)에서는 이 컴포넌트 사용.
 *
 * 숫자 정중앙:
 *  - fontSize: size * 0.5 (22px → 11px)
 *  - lineHeight: 1 (descender 제거)
 *  - paddingTop: 1px (font optical center 보정 — 대부분의 sans-serif에서 숫자는 수학적 중앙보다 살짝 위에 렌더링)
 */
export default function NumberCircle({ number, size = 22, isNow, style }) {
  const fs = Math.round(size * 0.5);
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "var(--radius-circle)",
        background: "var(--color-primary)",
        color: "var(--color-on-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${fs}px`,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        paddingTop: "1px",
        flexShrink: 0,
        boxShadow: isNow
          ? "0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent)"
          : "none",
        ...style,
      }}
    >
      {number}
    </div>
  );
}
