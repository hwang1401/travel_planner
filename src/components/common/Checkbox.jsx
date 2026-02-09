import Icon from './Icon';
import cn from '../../utils/cn';

/**
 * ── Checkbox ──
 * 디자인 시스템 체크박스. 선택 시 primary 배경 + 흰색 체크.
 *
 * Props:
 *   checked, onChange, size, disabled, label, style, className
 */
export default function Checkbox({
  checked = false,
  onChange,
  size = 18,
  disabled = false,
  label,
  style,
  className,
}) {
  const iconSize = Math.round(size * 0.55);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={disabled ? undefined : () => onChange?.(!checked)}
      className={cn(
        'inline-flex items-center gap-[var(--spacing-sp60)] border-0 bg-transparent p-0 font-[inherit]',
        disabled ? 'cursor-default' : 'cursor-pointer',
        className,
      )}
      style={style}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center shrink-0 rounded-sm',
          '[transition:background_var(--transition-fast),border-color_var(--transition-fast)]',
          disabled && 'opacity-40',
        )}
        style={{
          width: size,
          height: size,
          border: `2px solid ${checked ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
          background: checked ? 'var(--color-primary)' : 'transparent',
        }}
      >
        {checked && <Icon name="check" size={iconSize} style={{ filter: 'brightness(0) invert(1)' }} />}
      </span>
      {label && (
        <span
          className={cn(
            disabled ? 'text-on-surface-variant2' : 'text-primary',
          )}
          style={{
            fontSize: 'var(--typo-caption-1-regular-size)',
            fontWeight: 'var(--typo-caption-1-bold-weight)',
          }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
