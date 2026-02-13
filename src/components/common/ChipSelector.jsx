import Icon from './Icon';
import cn from '../../utils/cn';

/**
 * ── ChipSelector ──
 * 칩 버튼 그룹. 단일/다중 선택 지원.
 *
 * Props:
 *   items      — [{ value, label, icon?, disabled?, extra? }]
 *   value      — 선택된 값 (single: any, multi: Set|Array)
 *   onChange   — (value) => void
 *   multi      — boolean (default false)
 *   variant    — "rect" | "pill" (default "rect")
 *   size       — "sm" | "ms" | "md" (default "md")
 *   renderItem — optional (item, selected) => ReactNode
 *   style      — container style override
 */
export default function ChipSelector({
  items = [],
  value,
  onChange,
  multi = false,
  variant = "rect",
  size = "md",
  renderItem,
  style,
  className,
}) {
  const isSelected = (v) => {
    if (multi) {
      if (value instanceof Set) return value.has(v);
      if (Array.isArray(value)) return value.includes(v);
      return false;
    }
    return value === v;
  };

  const handleClick = (v) => {
    if (multi) {
      const next = new Set(value instanceof Set ? value : Array.isArray(value) ? value : []);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange?.(next);
    } else {
      onChange?.(v);
    }
  };

  const isPill = variant === "pill";
  const isSm = size === "sm";
  const isMs = size === "ms";

  return (
    <div className={cn("flex flex-wrap gap-1", className)} style={style}>
      {items.map((item) => {
        const selected = isSelected(item.value);
        if (renderItem) return renderItem(item, selected, () => handleClick(item.value));
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => handleClick(item.value)}
            disabled={item.disabled}
            className={cn(
              'inline-flex items-center justify-center text-center font-[inherit] outline-none',
              '[transition:all_var(--transition-fast)]',
              isSm ? 'gap-0.5 h-7' : isMs ? 'gap-1 h-8 min-w-[40px]' : 'gap-1 h-9 min-w-[44px]',
              isPill ? (isSm ? 'px-3 rounded-full' : isMs ? 'rounded-full' : 'px-1 rounded-full') : (isSm ? 'px-2 rounded-md' : isMs ? 'px-2 rounded-md' : 'px-1 rounded-md'),
              item.disabled ? 'cursor-default opacity-40' : 'cursor-pointer opacity-100',
              /* Border */
              selected
                ? 'border-[1.5px] border-solid border-primary'
                : 'border border-solid border-outline-variant',
              /* Background & Text */
              selected
                ? isPill
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-primary text-on-primary'
                : 'bg-transparent text-on-surface-variant',
            )}
            style={{
              padding: isPill
                ? (isSm ? '4px 12px' : isMs ? '5px 14px' : '4px 12px')
                : `0 ${isSm ? '8px' : isMs ? '10px' : '4px'}`,
              fontSize: isSm
                ? 'var(--typo-caption-2-regular-size)'
                : isMs
                  ? 'var(--typo-label-2-medium-size)'
                  : 'var(--typo-label-2-medium-size)',
              fontWeight: selected
                ? 'var(--typo-label-2-bold-weight)'
                : 'var(--typo-label-2-medium-weight)',
              lineHeight: 1,
            }}
          >
            {item.icon && <Icon name={item.icon} size={isSm ? 11 : isMs ? 13 : 14} />}
            {item.label}
            {item.extra}
          </button>
        );
      })}
    </div>
  );
}
