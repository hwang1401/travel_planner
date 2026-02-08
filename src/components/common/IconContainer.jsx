/**
 * ── IconContainer ──
 * 옵션 리스트용 아이콘 wrapper. 가이드: 40x40, radius-md 또는 circle.
 */
import Icon from './Icon';

export default function IconContainer({ name, size = 20, variant = "square", style }) {
  const isRound = variant === "round";
  return (
    <div
      style={{
        width: "40px",
        height: "40px",
        borderRadius: isRound ? "var(--radius-circle)" : "var(--radius-md)",
        background: "var(--color-surface-container-low)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <Icon name={name} size={size} />
    </div>
  );
}
