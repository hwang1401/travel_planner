import { useState, useCallback, Children } from 'react';
import Icon from './Icon';
import BottomSheet from './BottomSheet';

/*
 * ── Field Component (Figma Design System) ──
 *
 * Types:  outlined (default), filled
 * Sizes:  xlg(40px), lg(36px), md(32px)
 * States: default, hovered, focused, disabled, active
 *
 * Supports: input, textarea, select (via as prop)
 * select uses a custom BottomSheet dropdown instead of native <select>
 */

const SIZE_MAP = {
  xlg: { height: 'var(--height-xlg, 40px)', fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', letterSpacing: 'var(--typo-label-1-n---regular-letter-spacing)', iconSize: 20, px: 'var(--spacing-sp160, 16px)', radius: 'var(--radius-md, 8px)' },
  lg:  { height: 'var(--height-lg, 36px)',  fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', letterSpacing: 'var(--typo-label-1-n---regular-letter-spacing)', iconSize: 18, px: 'var(--spacing-sp140, 14px)', radius: 'var(--radius-md, 8px)' },
  md:  { height: 'var(--height-md, 32px)',  fontSize: 'var(--typo-label-2-regular-size)',     fontWeight: 'var(--typo-label-2-regular-weight)', lineHeight: 'var(--typo-label-2-regular-line-height)', letterSpacing: 'var(--typo-label-2-regular-letter-spacing)', iconSize: 16, px: 'var(--spacing-sp120, 12px)', radius: 'var(--radius-md, 8px)' },
};

/* ── Extract options from <option> children ── */
function extractOptions(children) {
  const opts = [];
  Children.forEach(children, (child) => {
    if (child && child.props !== undefined) {
      opts.push({
        value: child.props.value !== undefined ? child.props.value : '',
        label: typeof child.props.children === 'string' ? child.props.children : String(child.props.children ?? ''),
      });
    }
  });
  return opts;
}

export default function Field({
  as = 'input',       // 'input' | 'textarea' | 'select'
  label,
  helper,
  error,
  required = false,
  size = 'lg',
  variant = 'outlined', // 'outlined' | 'filled'
  iconLeft,
  iconRight,
  disabled = false,
  style: customStyle = {},
  className = '',
  children,            // for <select> options
  value,
  onChange,
  placeholder,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const s = SIZE_MAP[size] || SIZE_MAP.lg;
  const isTextarea = as === 'textarea';
  const isSelect = as === 'select';

  // Extract options for custom select
  const options = isSelect ? extractOptions(children) : [];
  const selectedLabel = isSelect
    ? (options.find((o) => String(o.value) === String(value))?.label || '')
    : '';

  // State-based border color (error overrides focus/hover)
  const borderColor = error
    ? 'var(--color-error)'
    : disabled
      ? 'var(--color-surface-container)'
      : (focused || sheetOpen)
        ? 'var(--color-primary)'
        : hovered
          ? 'var(--color-outline)'
          : 'var(--color-outline-variant)';

  // Background
  const bg = variant === 'filled'
    ? (disabled ? 'var(--color-surface-container)' : 'var(--color-surface-container-lowest)')
    : 'transparent';

  // Field wrapper style
  const fieldStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    height: isTextarea ? 'auto' : s.height,
    minHeight: isTextarea ? s.height : undefined,
    padding: isTextarea ? `10px ${s.px}` : `0 ${s.px}`,
    border: `1px solid ${borderColor}`,
    borderRadius: s.radius,
    background: bg,
    transition: 'border-color var(--transition-fast)',
    boxSizing: 'border-box',
    overflow: 'hidden',
    cursor: isSelect && !disabled ? 'pointer' : undefined,
  };

  // Input style (the actual input/textarea)
  const inputStyle = {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    fontFamily: 'inherit',
    color: disabled ? 'var(--color-on-surface-variant2)' : 'var(--color-on-surface)',
    padding: 0,
    margin: 0,
    ...(isTextarea ? { resize: 'vertical', minHeight: '40px' } : {}),
  };

  // Handle select option pick
  const handleSelectOption = useCallback((optValue) => {
    if (onChange) {
      // Create synthetic event-like object
      onChange({ target: { value: optValue } });
    }
    setSheetOpen(false);
  }, [onChange]);

  // Handle select field click
  const handleSelectClick = useCallback(() => {
    if (!disabled) setSheetOpen(true);
  }, [disabled]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', minWidth: '60px', ...customStyle }} className={className}>
      {/* Label — 입력 박스와 같은 왼쪽 시작(0). TimePicker와 동일하게 라벨/필드 왼쪽 정렬 */}
      {label && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          paddingBottom: 'var(--spacing-sp40, 4px)',
        }}>
          <span style={{
            fontSize: 'var(--typo-caption-2-bold-size)',
            fontWeight: 'var(--typo-caption-2-bold-weight)',
            lineHeight: 'var(--typo-caption-2-bold-line-height)',
            color: disabled ? 'var(--color-on-surface-variant2)' : 'var(--color-on-surface-variant)',
          }}>
            {label}
          </span>
          {required && (
            <span style={{ color: 'var(--color-error)', fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)' }}>*</span>
          )}
        </div>
      )}

      {/* Field */}
      {isSelect ? (
        /* ── Custom Select (tap to open BottomSheet) ── */
        <>
          <div
            style={fieldStyle}
            onClick={handleSelectClick}
            onMouseEnter={() => !disabled && setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {iconLeft && <Icon name={iconLeft} size={s.iconSize} style={{ flexShrink: 0, opacity: disabled ? 0.4 : 1 }} />}
            <span style={{
              ...inputStyle,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: selectedLabel ? (disabled ? 'var(--color-on-surface-variant2)' : 'var(--color-on-surface)') : 'var(--color-on-surface-variant2)',
            }}>
              {selectedLabel || placeholder || '선택'}
            </span>
            <Icon name="chevronDown" size={s.iconSize} style={{ flexShrink: 0, opacity: disabled ? 0.4 : 0.6, pointerEvents: 'none' }} />
          </div>

          {/* BottomSheet dropdown */}
          {sheetOpen && (
            <BottomSheet onClose={() => setSheetOpen(false)} maxHeight="40vh" zIndex="var(--z-confirm)">
              <div style={{ padding: '4px 0 0' }}>
                {label && (
                  <div style={{
                    padding: '4px 20px 12px',
                    borderBottom: '1px solid var(--color-outline-variant)',
                  }}>
                    <span style={{
                      fontSize: 'var(--typo-body-2-n---bold-size)',
                      fontWeight: 'var(--typo-body-2-n---bold-weight)',
                      color: 'var(--color-on-surface)',
                    }}>
                      {label}
                    </span>
                  </div>
                )}
                <div style={{ overflowY: 'auto', maxHeight: 'calc(50vh - 80px)' }}>
                  {options.map((opt, i) => {
                    const isActive = String(opt.value) === String(value);
                    return (
                      <div
                        key={i}
                        onClick={() => handleSelectOption(opt.value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '13px 20px',
                          cursor: 'pointer',
                          background: isActive ? 'var(--color-primary-container)' : 'transparent',
                          transition: 'background 0.1s',
                          borderBottom: i < options.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                        }}
                      >
                        <span style={{
                          flex: 1,
                          fontSize: 'var(--typo-label-1-n---regular-size)',
                          fontWeight: isActive ? 'var(--typo-label-1-n---bold-weight)' : 'var(--typo-label-1-n---regular-weight)',
                          color: isActive ? 'var(--color-on-primary-container)' : 'var(--color-on-surface)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {opt.label}
                        </span>
                        {isActive && (
                          <Icon name="check" size={16} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </BottomSheet>
          )}
        </>
      ) : (
        /* ── Input / Textarea ── */
        <div
          style={fieldStyle}
          onMouseEnter={() => !disabled && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {iconLeft && <Icon name={iconLeft} size={s.iconSize} style={{ flexShrink: 0, opacity: disabled ? 0.4 : 1 }} />}
          {isTextarea ? (
            <textarea
              style={inputStyle}
              disabled={disabled}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              {...rest}
              onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
              onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
            />
          ) : (
            <input
              style={inputStyle}
              disabled={disabled}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              {...rest}
              onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
              onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
            />
          )}
          {iconRight && <Icon name={iconRight} size={s.iconSize} style={{ flexShrink: 0, opacity: disabled ? 0.4 : 1 }} />}
        </div>
      )}

      {/* Helper/Error: 있을 때만 표시. 라벨/입력과 같은 왼쪽(0) 정렬 */}
      {helper && !error && (
        <div style={{ paddingTop: 'var(--spacing-sp40, 4px)' }}>
          <span style={{
            fontSize: 'var(--typo-caption-1-regular-size)',
            fontWeight: 'var(--typo-caption-1-regular-weight)',
            color: 'var(--color-on-surface-variant2)',
          }}>
            {helper}
          </span>
        </div>
      )}
      {error && (
        <div style={{ paddingTop: 'var(--spacing-sp40, 4px)' }}>
          <span style={{
            fontSize: 'var(--typo-caption-1-regular-size)',
            fontWeight: 'var(--typo-caption-1-regular-weight)',
            color: 'var(--color-error)',
          }}>
            {error}
          </span>
        </div>
      )}
    </div>
  );
}
