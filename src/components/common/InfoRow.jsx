/**
 * ── InfoRow ──
 * 아이콘 + 텍스트 정보 행. 가이드: 아이콘 marginTop 2px, caption-1, gap sp80.
 */
import Icon from './Icon';

export default function InfoRow({ icon, children, action, empty, style }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--spacing-sp80)",
        alignItems: "flex-start",
        minHeight: "24px",
        ...style,
      }}
    >
      <Icon
        name={icon}
        size={16}
        style={{
          flexShrink: 0,
          marginTop: "2px",
          color: empty
            ? "var(--color-on-surface-variant2)"
            : "var(--color-on-surface-variant)",
        }}
      />
      <span
        style={{
          flex: 1,
          fontSize: "var(--typo-caption-1-regular-size)",
          lineHeight: "var(--typo-caption-1-regular-line-height)",
          color: empty
            ? "var(--color-on-surface-variant2)"
            : "var(--color-on-surface-variant)",
        }}
      >
        {children}
      </span>
      {action != null && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
