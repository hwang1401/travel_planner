/**
 * ── CategoryBadge ──
 * 카테고리 뱃지. CATEGORY_COLORS 기반.
 * 가이드: caption-3-bold, radius-sm, padding 2px 8px.
 */
import { getCategoryColor } from '../../styles/tokens';

export default function CategoryBadge({ category, style }) {
  const cat = getCategoryColor(category);
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        fontSize: "var(--typo-caption-3-bold-size)",
        fontWeight: "var(--typo-caption-3-bold-weight)",
        lineHeight: "var(--typo-caption-3-bold-line-height)",
        background: cat.bg,
        color: cat.color,
        border: `1px solid ${cat.border}`,
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...style,
      }}
    >
      {category}
    </span>
  );
}
