/**
 * ── Card Component ──
 * Consistent container for grouping content with proper spacing,
 * border radius, and visual hierarchy.
 *
 * Variants:
 *   elevated  — subtle shadow (default)
 *   outlined  — border, no shadow
 *   filled    — filled background, no border/shadow
 *   flat      — no decoration, just padding
 *
 * Sizes:
 *   sm — 12px padding
 *   md — 16px padding (default)
 *   lg — 20px padding
 */

const VARIANT_STYLES = {
  elevated: {
    background: "var(--color-surface-container-lowest)",
    border: "none",
    boxShadow: "var(--shadow-normal)",
  },
  outlined: {
    background: "var(--color-surface-container-lowest)",
    border: "1px solid var(--color-outline-variant)",
    boxShadow: "none",
  },
  filled: {
    background: "var(--color-surface-container-lowest)",
    border: "none",
    boxShadow: "none",
  },
  flat: {
    background: "transparent",
    border: "none",
    boxShadow: "none",
  },
};

const PADDING_MAP = {
  none: "0",
  sm: "var(--spacing-sp120, 12px)",
  md: "var(--spacing-sp160, 16px)",
  lg: "var(--spacing-sp200, 20px)",
};

export default function Card({
  variant = "elevated",
  padding = "md",
  radius = "var(--radius-lg, 12px)",
  children,
  style,
  onClick,
  ...rest
}) {
  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.elevated;
  const p = PADDING_MAP[padding] || PADDING_MAP.md;

  return (
    <div
      onClick={onClick}
      style={{
        ...v,
        padding: p,
        borderRadius: radius,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow var(--transition-fast, 150ms ease)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
