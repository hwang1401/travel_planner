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
  xs:    "2px",   // --spacing-sp20
  sm:    "4px",   // --spacing-sp40
  ms:    "6px",   // --spacing-sp60  — 칩 갭, 타이트 아이콘-텍스트 갭
  md:    "8px",   // --spacing-sp80
  ml:    "10px",  // --spacing-sp100 — 폼 요소 내부 갭, 입력 세로 패딩
  lg:    "12px",  // --spacing-sp120
  lx:    "14px",  // --spacing-sp140 — 입력/컨테이너 가로 패딩
  xl:    "16px",  // --spacing-sp160
  xxl:   "20px",  // --spacing-sp200
  xxxl:  "24px",  // --spacing-sp240
  xxxxl: "32px",  // --spacing-sp320 — 페이지 하단 여유 패딩
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
  food: { icon: "fire", bg: "var(--color-type-food-bg)", border: "var(--color-type-food-border)", text: "var(--color-type-food-text)" },
  spot: { icon: "pin", bg: "var(--color-type-spot-bg)", border: "var(--color-type-spot-border)", text: "var(--color-type-spot-text)" },
  shop: { icon: "shopping", bg: "var(--color-type-shop-bg)", border: "var(--color-type-shop-border)", text: "var(--color-type-shop-text)" },
  move: { icon: "navigation", bg: "var(--color-type-move-bg)", border: "var(--color-type-move-border)", text: "var(--color-type-move-text)" },
  flight: { icon: "plane", bg: "var(--color-type-flight-bg)", border: "var(--color-type-flight-border)", text: "var(--color-type-flight-text)" },
  stay: { icon: "home", bg: "var(--color-type-stay-bg)", border: "var(--color-type-stay-border)", text: "var(--color-type-stay-text)" },
  info: { icon: "flash", bg: "var(--color-type-info-bg)", border: "var(--color-type-info-border)", text: "var(--color-type-info-text)" },
};

/* ── Category Colors ──
 * Maps Korean category labels → color config.
 * Used in DetailDialog, badges, etc.
 */
export const CATEGORY_COLORS = {
  "식사": { bg: "var(--color-type-food-bg)", color: "var(--color-type-food-text)", border: "var(--color-type-food-border)" },
  "관광": { bg: "var(--color-type-spot-bg)", color: "var(--color-type-spot-text)", border: "var(--color-type-spot-border)" },
  "쇼핑": { bg: "var(--color-type-shop-bg)", color: "var(--color-type-shop-text)", border: "var(--color-type-shop-border)" },
  "쇼핑 · 간식": { bg: "var(--color-type-shop-bg)", color: "var(--color-type-shop-text)", border: "var(--color-type-shop-border)" },
  "숙소": { bg: "var(--color-type-stay-bg)", color: "var(--color-type-stay-text)", border: "var(--color-type-stay-border)" },
  "교통": { bg: "var(--color-type-info-bg)", color: "var(--color-type-info-text)", border: "var(--color-type-info-border)" },
  "항공": { bg: "var(--color-type-flight-bg)", color: "var(--color-type-flight-text)", border: "var(--color-type-flight-border)" },
  "정보": { bg: "var(--color-type-info-bg)", color: "var(--color-type-info-text)", border: "var(--color-type-info-border)" },
};

/* ── Type Label Map ── */
export const TYPE_LABELS = {
  food: "식사", spot: "관광", shop: "쇼핑", move: "교통", flight: "항공", stay: "숙소", info: "정보",
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
  warning: "var(--color-warning)",
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
