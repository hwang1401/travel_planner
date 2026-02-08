/**
 * ── TimetablePreview ──
 * 교통 시간표 표시용 공통 컴포넌트.
 * EditItemDialog(compact), DetailDialog(full)에서 동일한 데이터로 통일된 UI 사용.
 *
 * timetable: { station, direction, trains: [{ time, name, picked?, dest?, note? }] }
 * variant: 'compact' | 'full'
 */
import { COLOR, RADIUS } from '../../styles/tokens';

export default function TimetablePreview({ timetable, variant = 'full', accentColor }) {
  if (!timetable?.trains?.length) return null;
  const { station, direction, trains } = timetable;
  const accent = accentColor || COLOR.primary;

  if (variant === 'compact') {
    return (
      <div style={{
        background: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '1px solid var(--color-outline-variant)',
        padding: '10px 12px',
        fontSize: 'var(--typo-caption-2-regular-size)',
      }}>
        <p style={{
          margin: '0 0 6px',
          fontSize: 'var(--typo-caption-2-bold-size)',
          fontWeight: 'var(--typo-caption-2-bold-weight)',
          color: 'var(--color-on-surface-variant)',
        }}>
          {station} → {direction}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {trains.map((t, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 6px',
                borderRadius: 'var(--radius-md, 8px)',
                background: t.picked ? 'var(--color-primary-container)' : 'transparent',
                fontWeight: t.picked ? 700 : 400,
              }}
            >
              <span style={{
                width: '38px',
                flexShrink: 0,
                color: t.picked ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              }}>
                {t.time}
              </span>
              <span style={{
                flex: 1,
                color: t.picked ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
              }}>
                {t.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // full: 테이블 형태 (DetailDialog 스타일)
  return (
    <div style={{
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      border: `1px solid ${COLOR.outlineVariant}`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sp120)',
        padding: 'var(--spacing-sp120) var(--spacing-sp160)',
        background: COLOR.surfaceLowest,
        borderBottom: `1px solid ${COLOR.outlineVariant}`,
        fontSize: 'var(--typo-caption-2-bold-size)',
        fontWeight: 'var(--typo-caption-2-bold-weight)',
        color: COLOR.onSurfaceVariant,
      }}>
        <span style={{ width: '80px', flexShrink: 0 }}>시각</span>
        <span style={{ flex: 1, minWidth: 0 }}>열차명</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>행선 / 소요</span>
      </div>
      {trains.map((t, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sp120)',
            padding: 'var(--spacing-sp120) var(--spacing-sp160)',
            background: COLOR.surfaceLowest,
            borderBottom: i < trains.length - 1 ? `1px solid ${COLOR.outlineVariant}` : 'none',
            borderLeft: t.picked ? `3px solid ${accent}` : '3px solid transparent',
          }}
        >
          <span
            style={{
              width: '80px',
              flexShrink: 0,
              fontSize: 'var(--typo-caption-1-medium-size)',
              fontWeight: 'var(--typo-caption-1-medium-weight)',
              color: t.picked ? accent : COLOR.onSurfaceVariant,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={t.time}
          >
            {String(t.time).replace(/\s+분\s*$/, '분').trim()}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              fontSize: 'var(--typo-label-2-medium-size)',
              fontWeight: t.picked ? 'var(--typo-label-2-bold-weight)' : 'var(--typo-label-2-medium-weight)',
              color: COLOR.onSurface,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {t.name}
            </span>
          </div>
          <div style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'right',
            fontSize: 'var(--typo-caption-2-regular-size)',
            color: COLOR.onSurfaceVariant2,
            lineHeight: 1.4,
          }}>
            {t.dest != null && t.dest !== '' && (
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.dest}
              </span>
            )}
            {t.note && (
              <span style={{ display: 'block', fontSize: 'var(--typo-caption-3-regular-size)', opacity: 0.9 }}>
                {t.note}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
