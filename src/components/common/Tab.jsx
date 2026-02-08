import { useRef, useEffect, useCallback } from 'react';
import Icon from './Icon';

/*
 * ── Tab Component (Figma Design System) ──
 *
 * From Figma: tab-horizontal (3903:6614)
 *
 * Variants:
 *   underline (default) — bottom border indicator (2px), text only or text+icon
 *   pill                — rounded pill-shape active indicator (filled)
 *
 * Sizes (from Figma):
 *   lg — Heading 3 (18px), padding 12px
 *   md — Body 1 Normal (16px), padding 12px
 *   sm — Caption 1 (13px), padding 8px 14px
 *
 * Props:
 *   items       — array of { label, value, icon? }
 *   value       — currently active value
 *   onChange    — (value) => void
 *   variant     — "underline" | "pill"
 *   size        — "sm" | "md" | "lg"
 *   fullWidth   — spread tabs evenly (default false → scrollable)
 *   style       — custom style on the root container
 */

/* ── Size Tokens (from Figma spec) ── */
const SIZE_MAP = {
  sm: {
    fontSize: 'var(--typo-caption-1-bold-size)',
    activeWeight: 'var(--typo-caption-1-bold-weight)',
    inactiveWeight: 'var(--typo-caption-1-regular-weight)',
    lineHeight: 'var(--typo-caption-1-bold-line-height)',
    letterSpacing: 'var(--typo-caption-1-bold-letter-spacing)',
    padding: '8px 14px',
    iconSize: 14,
  },
  md: {
    /* Figma: Body 1 Normal — 16px */
    fontSize: 'var(--typo-body-1-n---bold-size)',
    activeWeight: 'var(--typo-body-1-n---bold-weight)',
    inactiveWeight: 'var(--typo-body-1-n---regular-weight)',
    lineHeight: 'var(--typo-body-1-n---bold-line-height)',
    letterSpacing: 'var(--typo-body-1-n---bold-letter-spacing)',
    padding: '12px 16px',
    iconSize: 16,
  },
  lg: {
    /* Figma: Heading 3 — 18px */
    fontSize: 'var(--typo-heading-3-bold-size)',
    activeWeight: 'var(--typo-heading-3-bold-weight)',
    inactiveWeight: 'var(--typo-heading-3-regular-weight)',
    lineHeight: 'var(--typo-heading-3-bold-line-height)',
    letterSpacing: 'var(--typo-heading-3-bold-letter-spacing)',
    padding: '12px 16px',
    iconSize: 18,
  },
};

export default function Tab({
  items = [],
  value,
  onChange,
  variant = 'underline',
  size = 'md',
  fullWidth = false,
  style: customStyle = {},
}) {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);
  const s = SIZE_MAP[size] || SIZE_MAP.md;

  /* scroll active tab into view when value changes */
  useEffect(() => {
    if (!fullWidth && activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }, [value, fullWidth]);

  const handleClick = useCallback((v) => {
    if (onChange) onChange(v);
  }, [onChange]);

  const isPill = variant === 'pill';

  /* ── Root container ── */
  const rootStyle = {
    display: 'flex',
    gap: 0,
    alignItems: 'stretch',
    ...(isPill
      ? { gap: '6px' }
      : { borderBottom: '1px solid var(--color-outline-variant)' }),
    ...(fullWidth
      ? {}
      : {
          overflowX: 'auto',
          maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
        }),
    ...customStyle,
  };

  return (
    <div ref={scrollRef} style={rootStyle}>
      {items.map((item) => {
        const active = item.value === value;
        const tabStyle = isPill
          ? {
              /* ── Pill variant ── */
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              height: 'auto',
              whiteSpace: 'nowrap',
              border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-outline)',
              background: active ? 'var(--color-primary)' : 'transparent',
              color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
              fontSize: s.fontSize,
              fontWeight: active ? s.activeWeight : s.inactiveWeight,
              lineHeight: s.lineHeight,
              letterSpacing: s.letterSpacing,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              flex: fullWidth ? 1 : 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }
          : {
              /* ── Underline variant (from Figma) ── */
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0px', /* Figma: spacing/sp40 = 0 */
              padding: s.padding,
              borderRadius: 0,
              height: 'auto',
              whiteSpace: 'nowrap',
              border: 'none',
              borderBottom: active
                ? '2px solid var(--color-primary)'
                : '2px solid transparent',
              background: 'none',
              color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant2)',
              fontSize: s.fontSize,
              fontWeight: active ? s.activeWeight : s.inactiveWeight,
              lineHeight: s.lineHeight,
              letterSpacing: s.letterSpacing,
              cursor: 'pointer',
              transition: 'color var(--transition-fast), border-color var(--transition-fast)',
              flex: fullWidth ? 1 : 'none',
              outline: 'none',
              fontFamily: 'inherit',
            };

        return (
          <button
            key={item.value}
            ref={active ? activeRef : null}
            onClick={() => handleClick(item.value)}
            style={tabStyle}
          >
            {item.icon && (
              <Icon
                name={item.icon}
                size={s.iconSize}
                style={{
                  filter: active
                    ? undefined
                    : 'brightness(0) saturate(100%) invert(60%) sepia(0%) saturate(0%) hue-rotate(0deg)',
                }}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
