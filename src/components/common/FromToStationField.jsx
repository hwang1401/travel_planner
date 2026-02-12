/**
 * 출발지/도착지 선택 필드 — 공통 UI
 * AddPlacePage, EditItemDialog, DetailDialog 시간표 탭에서 동일한 스타일 사용
 */
import Icon from './Icon';
import { SPACING } from '../../styles/tokens';

const fieldStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.md,
  width: '100%',
  height: 'var(--height-lg, 36px)',
  padding: '0 var(--spacing-sp140, 14px)',
  border: '1px solid var(--color-outline-variant)',
  borderRadius: 'var(--radius-md, 8px)',
  background: 'var(--color-surface-container-lowest)',
  cursor: 'pointer',
  transition: 'border-color var(--transition-fast)',
  boxSizing: 'border-box',
};

const labelStyle = {
  paddingBottom: 'var(--spacing-sp40, 4px)',
  minHeight: 'var(--field-label-row-height, 20px)',
  display: 'flex',
  alignItems: 'center',
  fontSize: 'var(--typo-caption-2-bold-size)',
  fontWeight: 'var(--typo-caption-2-bold-weight)',
  color: 'var(--color-on-surface-variant)',
};

export function FromToStationField({ label, value, placeholder, onClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {label && <div style={labelStyle}>{label}</div>}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        style={fieldStyle}
      >
      <Icon name="navigation" size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 'var(--typo-label-1-n---regular-size)',
          fontWeight: 'var(--typo-label-1-n---regular-weight)',
          color: value ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
        }}
      >
        {value || placeholder}
      </span>
      <Icon name="chevronRight" size={14} style={{ flexShrink: 0, opacity: 0.3 }} />
      </div>
    </div>
  );
}
