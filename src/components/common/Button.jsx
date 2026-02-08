import { useState } from 'react';
import Icon from './Icon';

/*
 * ── Button Component (Figma Design System) ──
 *
 * Type mapping:
 *   Filled     → primary, primary-container, secondary
 *   Outlined   → tertiary, neutral
 *   Transparent → ghost-neutral, ghost-primary
 *
 * Sizes:  xsm(24px), sm(28px), md(32px), lg(36px), xlg(40px)
 * Layout: text+icon, text-only, icon-only
 * States: default, hovered, pressed, disabled
 *
 * Icon & text colors change per variant automatically via CSS filter on <img> icons.
 */

/* ── Size Tokens (from design system) ── */
const SIZE_MAP = {
  xsm: { height: 'var(--height-xsm, 24px)', fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)', iconSize: 14, px: '6px', gap: '2px', radius: 'var(--radius-md, 8px)' },
  sm:  { height: 'var(--height-sm, 28px)',  fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 'var(--typo-caption-1-bold-weight)', iconSize: 16, px: '8px', gap: '4px', radius: 'var(--radius-md, 8px)' },
  md:  { height: 'var(--height-md, 32px)',  fontSize: 'var(--typo-label-2-bold-size)', fontWeight: 'var(--typo-label-2-bold-weight)', iconSize: 18, px: '10px', gap: '4px', radius: 'var(--radius-md, 8px)' },
  lg:  { height: 'var(--height-lg, 36px)',  fontSize: 'var(--typo-label-1-n---bold-size)', fontWeight: 'var(--typo-label-1-n---bold-weight)', iconSize: 18, px: '12px', gap: '4px', radius: 'var(--radius-md, 8px)' },
  xlg: { height: 'var(--height-xlg, 40px)', fontSize: 'var(--typo-label-1-n---bold-size)', fontWeight: 'var(--typo-label-1-n---bold-weight)', iconSize: 20, px: '14px', gap: '4px', radius: 'var(--radius-md, 8px)' },
};

/*
 * ── Icon Filter Map ──
 * SVG icons are #48464D by default. We use CSS filter to recolor:
 *   'white'   → brightness(0) invert(1)                   — for filled dark-bg variants
 *   'primary' → specific filter to approximate #8b7bff     — for outlined/ghost-primary
 *   'none'    → keep original #48464D                      — for neutral/ghost-neutral
 *   'faded'   → opacity(0.4)                               — for disabled state
 */
const ICON_FILTERS = {
  white:   'brightness(0) invert(1)',
  primary: 'brightness(0) saturate(100%) invert(56%) sepia(60%) saturate(3000%) hue-rotate(225deg) brightness(100%) contrast(100%)',
  none:    'none',
  faded:   'opacity(0.4)',
};

/* ── Variant Styles (per state) ── */
/* Each variant defines: bg, color (text), border, iconFilter, and optional filter (for hover/press) */
const VARIANT_STYLES = {
  /* ─ FILLED ─ */
  primary: {
    default:  { bg: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', iconFilter: 'white' },
    hovered:  { bg: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', iconFilter: 'white', filter: 'brightness(1.1)' },
    pressed:  { bg: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', iconFilter: 'white', filter: 'brightness(0.9)' },
    disabled: { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant2)', border: 'none', iconFilter: 'faded' },
  },
  'primary-container': {
    default:  { bg: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', border: 'none', iconFilter: 'primary' },
    hovered:  { bg: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', border: 'none', iconFilter: 'primary', filter: 'brightness(0.97)' },
    pressed:  { bg: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', border: 'none', iconFilter: 'primary', filter: 'brightness(0.92)' },
    disabled: { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant2)', border: 'none', iconFilter: 'faded' },
  },
  secondary: {
    default:  { bg: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)', border: 'none', iconFilter: 'none' },
    hovered:  { bg: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)', border: 'none', iconFilter: 'none', filter: 'brightness(0.97)' },
    pressed:  { bg: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)', border: 'none', iconFilter: 'none', filter: 'brightness(0.92)' },
    disabled: { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant2)', border: 'none', iconFilter: 'faded' },
  },

  /* ─ OUTLINED ─ */
  tertiary: {
    default:  { bg: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', iconFilter: 'primary' },
    hovered:  { bg: 'var(--color-primary-hovered)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', iconFilter: 'primary' },
    pressed:  { bg: 'var(--color-primary-pressed)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', iconFilter: 'primary' },
    disabled: { bg: 'transparent', color: 'var(--color-on-surface-variant2)', border: '1px solid var(--color-outline-variant)', iconFilter: 'faded' },
  },
  neutral: {
    default:  { bg: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)', iconFilter: 'none' },
    hovered:  { bg: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)', iconFilter: 'none' },
    pressed:  { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)', iconFilter: 'none' },
    disabled: { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant2)', border: '1px solid var(--color-outline-variant)', iconFilter: 'faded' },
  },

  /* ─ TRANSPARENT (Ghost) ─ */
  'ghost-neutral': {
    default:  { bg: 'transparent', color: 'var(--color-on-surface-variant)', border: 'none', iconFilter: 'none' },
    hovered:  { bg: 'var(--color-surface-container-low)', color: 'var(--color-on-surface-variant)', border: 'none', iconFilter: 'none' },
    pressed:  { bg: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)', border: 'none', iconFilter: 'none' },
    disabled: { bg: 'transparent', color: 'var(--color-on-surface-variant2)', border: 'none', iconFilter: 'faded' },
  },
  'ghost-primary': {
    default:  { bg: 'transparent', color: 'var(--color-primary)', border: 'none', iconFilter: 'primary' },
    hovered:  { bg: 'var(--color-primary-hovered)', color: 'var(--color-primary)', border: 'none', iconFilter: 'primary' },
    pressed:  { bg: 'var(--color-primary-pressed)', color: 'var(--color-primary)', border: 'none', iconFilter: 'primary' },
    disabled: { bg: 'transparent', color: 'var(--color-on-surface-variant2)', border: 'none', iconFilter: 'faded' },
  },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  iconLeft,
  iconRight,
  iconOnly,
  children,
  onClick,
  style: customStyle = {},
  className = '',
  fullWidth = false,
  ...rest
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const variantStyles = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;

  const currentState = disabled ? 'disabled' : pressed ? 'pressed' : hovered ? 'hovered' : 'default';
  const vs = variantStyles[currentState];

  const isIconOnly = !!iconOnly;

  /* ── Compute icon filter from variant state ── */
  const iconFilterValue = ICON_FILTERS[vs.iconFilter] || ICON_FILTERS.none;

  /* ── Icon filter always follows variant (no custom override bypass) ── */
  const iconStyle = iconFilterValue && iconFilterValue !== 'none'
    ? { filter: iconFilterValue }
    : {};

  /* ── Button base styles ── */
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizeConfig.gap,
    height: sizeConfig.height,
    padding: isIconOnly ? '0' : `0 ${sizeConfig.px}`,
    width: isIconOnly ? sizeConfig.height : fullWidth ? '100%' : undefined,
    fontSize: sizeConfig.fontSize,
    fontWeight: sizeConfig.fontWeight,
    fontFamily: 'inherit',
    lineHeight: 1.4,
    letterSpacing: '0.2px',
    borderRadius: isIconOnly ? 'var(--radius-circle, 999px)' : sizeConfig.radius,
    background: vs.bg,
    color: vs.color,
    border: vs.border,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'all var(--transition-fast)',
    flexShrink: 0,
    boxSizing: 'border-box',
    outline: 'none',
    ...(vs.filter ? { filter: vs.filter } : {}),
    ...customStyle,
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={baseStyle}
      className={className}
      disabled={disabled}
      {...rest}
    >
      {iconOnly ? (
        <Icon name={iconOnly} size={sizeConfig.iconSize} style={iconStyle} />
      ) : (
        <>
          {iconLeft && <Icon name={iconLeft} size={sizeConfig.iconSize} style={iconStyle} />}
          {children && <span>{children}</span>}
          {iconRight && <Icon name={iconRight} size={sizeConfig.iconSize} style={iconStyle} />}
        </>
      )}
    </button>
  );
}
