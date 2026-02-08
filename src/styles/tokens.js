/**
 * ── Design Tokens (JS) ──
 * Centralized design constants used across components.
 * Mirrors CSS custom properties for JS-side usage.
 *
 * RULE: Never hardcode colors, spacing, or font sizes in components.
 *       Always import from here or use CSS var(--token).
 *
 * JS에서 디자인 토큰 참조: 이 파일의 SPACING, RADIUS, COLOR를 import하여 사용.
 * (새 코드·리뷰 반영 시 일관성 유지)
 */

/* ── Spacing (mirrors --spacing-sp*) ── */
export const SPACING = {
  xs: "2px",   // --spacing-sp20
  sm: "4px",   // --spacing-sp40
  md: "8px",   // --spacing-sp80
  lg: "12px",  // --spacing-sp120
  xl: "16px",  // --spacing-sp160
  xxl: "20px", // --spacing-sp200
  xxxl: "24px",// --spacing-sp240
};

/* ── Border Radius (mirrors --radius-*) ── */
export const RADIUS = {
  xs: "2px",   // --radius-xsm
  sm: "4px",   // --radius-sm
  md: "8px",   // --radius-md
  lg: "12px",  // --radius-lg
  xl: "16px",  // --radius-xlg
  full: "999px", // --radius-circle
};

/* ── Type Config ──
 * Canonical color config for schedule item types.
 * bg     = chip/badge background
 * border = chip/badge border
 * text   = chip/badge text & marker color
 * icon   = Icon component name
 */
export const TYPE_CONFIG = {
  food: { icon: "fire", bg: "#FFF3EC", border: "#FDDCC8", text: "#C75D20" },
  spot: { icon: "pin", bg: "#EEF6FF", border: "#C8DFF5", text: "#2B6CB0" },
  shop: { icon: "shopping", bg: "#F3F0FF", border: "#D5CCF5", text: "#6B46C1" },
  move: { icon: "navigation", bg: "#F5F5F4", border: "#E0DFDC", text: "#6B6B67" },
  stay: { icon: "home", bg: "#F0FAF4", border: "#C6F0D5", text: "#2A7D4F" },
  info: { icon: "flash", bg: "#FFFDE8", border: "#F0EAAC", text: "#8A7E22" },
};

/* ── Category Colors ──
 * Maps Korean category labels → color config.
 * Used in DetailDialog, badges, etc.
 */
export const CATEGORY_COLORS = {
  "식사": { bg: "#FFF3EC", color: "#C75D20", border: "#FDDCC8" },
  "관광": { bg: "#EEF6FF", color: "#2B6CB0", border: "#C8DFF5" },
  "쇼핑": { bg: "#F3F0FF", color: "#6B46C1", border: "#D5CCF5" },
  "쇼핑 · 간식": { bg: "#F3F0FF", color: "#6B46C1", border: "#D5CCF5" },
  "숙소": { bg: "#F0FAF4", color: "#2A7D4F", border: "#C6F0D5" },
  "교통": { bg: "#FFFDE8", color: "#8A7E22", border: "#F0EAAC" },
  "정보": { bg: "#FFFDE8", color: "#8A7E22", border: "#F0EAAC" },
};

/* ── Type Label Map ── */
export const TYPE_LABELS = {
  food: "식사", spot: "관광", shop: "쇼핑", move: "교통", stay: "숙소", info: "정보",
};

/* ── Helper: get config by type key ── */
export function getTypeConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.info;
}

/* ── Helper: get category color by label ── */
export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || {
    bg: "var(--color-surface-container-low)",
    color: "var(--color-on-surface-variant)",
    border: "var(--color-outline-variant)",
  };
}

/* ── Semantic CSS variable references (for JS inline styles) ── */
export const COLOR = {
  surface: "var(--color-surface)",
  surfaceLowest: "var(--color-surface-container-lowest)",
  surfaceLow: "var(--color-surface-container-low)",
  surfaceDim: "var(--color-surface-dim)",
  onSurface: "var(--color-on-surface)",
  onSurfaceVariant: "var(--color-on-surface-variant)",
  onSurfaceVariant2: "var(--color-on-surface-variant2)",
  primary: "var(--color-primary)",
  primaryContainer: "var(--color-primary-container)",
  onPrimary: "var(--color-on-primary)",
  outline: "var(--color-outline)",
  outlineVariant: "var(--color-outline-variant)",
  error: "var(--color-error)",
};

/* ── Typography (CSS var references) ── */
export const TYPO = {
  heading1: { size: "var(--typo-heading-1-bold-size)", weight: "var(--typo-heading-1-bold-weight)" },
  heading2: { size: "var(--typo-heading-2-bold-size)", weight: "var(--typo-heading-2-bold-weight)" },
  heading3: { size: "var(--typo-heading-3-bold-size)", weight: "var(--typo-heading-3-bold-weight)" },
  body1: { size: "var(--typo-body-1-n---bold-size)", weight: "var(--typo-body-1-n---bold-weight)" },
  body2: { size: "var(--typo-body-2-n---bold-size)", weight: "var(--typo-body-2-n---bold-weight)" },
  label1: { size: "var(--typo-label-1-n---bold-size)", weight: 600 },
  label2: { size: "var(--typo-label-2-medium-size)", weight: 500 },
  caption1: { size: "var(--typo-caption-1-regular-size)", weight: 400 },
  caption2: { size: "var(--typo-caption-2-regular-size)", weight: 400 },
  caption2Bold: { size: "var(--typo-caption-2-bold-size)", weight: "var(--typo-caption-2-bold-weight)" },
};
