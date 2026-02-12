/**
 * ── TimetablePreview ──
 * 교통 시간표 표시용 공통 컴포넌트.
 * EditItemDialog(compact), DetailDialog(full)에서 동일한 데이터로 통일된 UI 사용.
 *
 * 설정 시간(picked) 주변 3~4개만 표시, 전체는 "전체 보기" 팝업으로.
 *
 * timetable: { station, direction, trains: [{ time, name, picked?, dest?, note? }] }
 * variant: 'compact' | 'full'
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { COLOR, RADIUS, SPACING } from '../../styles/tokens';
import Button from './Button';
import Icon from './Icon';

const VISIBLE_BEFORE = 3;
const VISIBLE_AFTER = 4;
const MAX_VISIBLE = VISIBLE_BEFORE + 1 + VISIBLE_AFTER; // 8개

function getVisibleTrains(trains) {
  if (!trains?.length || trains.length <= MAX_VISIBLE) return { visible: trains, startIdx: 0, hasMore: false };
  const pickedIdx = trains.findIndex((t) => t.picked);
  const centerIdx = pickedIdx >= 0 ? pickedIdx : 0;
  const start = Math.max(0, centerIdx - VISIBLE_BEFORE);
  const end = Math.min(trains.length, start + MAX_VISIBLE);
  const visible = trains.slice(start, end);
  return { visible, startIdx: start, hasMore: true, total: trains.length };
}

export default function TimetablePreview({ timetable, variant = 'full', accentColor, onTimeRowClick }) {
  const [showFullDialog, setShowFullDialog] = useState(false);

  if (!timetable) return null;

  // ── frequency 타입: 배차간격 카드 형식 ──
  if (timetable.type === 'frequency') {
    return <FrequencyCard timetable={timetable} variant={variant} />;
  }

  if (!timetable.trains?.length) return null;
  const { station, direction, trains } = timetable;
  const accent = accentColor || COLOR.primary;
  const canTapTime = typeof onTimeRowClick === 'function';
  const { visible: displayTrains, startIdx = 0, hasMore, total } = getVisibleTrains(trains);

  const handleRowClick = (t, displayIndex) => {
    if (onTimeRowClick) onTimeRowClick(t, startIdx + displayIndex);
  };

  const dialog = showFullDialog && (
    <TimetableDetailDialog
      timetable={{ ...timetable, trains }}
      accentColor={accent}
      onClose={() => setShowFullDialog(false)}
      onTimeRowClick={canTapTime ? (t, i) => { onTimeRowClick(t, i); setShowFullDialog(false); } : undefined}
    />
  );

  if (variant === 'compact') {
    return (
      <>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
          {displayTrains.map((t, i) => (
            <div
              key={i}
              role={canTapTime ? 'button' : undefined}
              tabIndex={canTapTime ? 0 : undefined}
              onClick={canTapTime ? () => handleRowClick(t, i) : undefined}
              onKeyDown={canTapTime ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(t, i); } } : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.md,
                padding: `${SPACING.sm} ${SPACING.ms}`,
                borderRadius: 'var(--radius-md, 8px)',
                background: t.picked ? 'var(--color-primary-container)' : 'transparent',
                fontWeight: t.picked ? 700 : 400,
                cursor: canTapTime ? 'pointer' : 'default',
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
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowFullDialog(true)}
            style={{
              marginTop: SPACING.md,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
              width: '100%', padding: `${SPACING.sm} ${SPACING.ms}`,
              border: '1px dashed var(--color-outline-variant)', borderRadius: 'var(--radius-md, 8px)',
              background: 'transparent', cursor: 'pointer',
              fontSize: 'var(--typo-caption-2-medium-size)', color: 'var(--color-primary)', fontFamily: 'inherit',
            }}
          >
            <Icon name="list" size={18} style={{ color: 'var(--color-primary)' }} />
            전체 시간표 보기 ({total}편)
          </button>
        )}
      </div>
      {dialog}
      </>
    );
  }

  // full: 테이블 형태 (DetailDialog 스타일)
  return (
    <>
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
      {displayTrains.map((t, i) => (
        <div
          key={startIdx + i}
          role={canTapTime ? 'button' : undefined}
          tabIndex={canTapTime ? 0 : undefined}
          onClick={canTapTime ? () => handleRowClick(t, i) : undefined}
          onKeyDown={canTapTime ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(t, i); } } : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sp120)',
            padding: 'var(--spacing-sp120) var(--spacing-sp160)',
            background: COLOR.surfaceLowest,
            borderBottom: i < displayTrains.length - 1 ? `1px solid ${COLOR.outlineVariant}` : 'none',
            borderLeft: t.picked ? `3px solid ${accent}` : '3px solid transparent',
            cursor: canTapTime ? 'pointer' : 'default',
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
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowFullDialog(true)}
          style={{
            width: '100%', padding: `${SPACING.lg} ${SPACING.xl}`,
            border: 'none', borderTop: `1px solid ${COLOR.outlineVariant}`,
            background: 'var(--color-surface-container-lowest)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
            fontSize: 'var(--typo-label-2-medium-size)', color: accent, fontFamily: 'inherit',
          }}
        >
          <Icon name="list" size={18} style={{ color: accent }} />
          전체 시간표 보기 ({total}편)
        </button>
      )}
    </div>
    {dialog}
    </>
  );
}

// ── 전체 시간표 팝업 다이얼로그 ──
function TimetableDetailDialog({ timetable, accentColor, onClose, onTimeRowClick }) {
  const [viewportRect, setViewportRect] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportRect({ top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!timetable?.trains?.length) return null;
  const { station, direction, trains } = timetable;
  const accent = accentColor || COLOR.primary;
  const canTap = typeof onTimeRowClick === 'function';

  const modal = (
    <div
      style={{
        position: 'fixed',
        ...(viewportRect != null ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height } : { inset: 0 }),
        zIndex: 2500,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: SPACING.md,
        padding: `${SPACING.md} ${SPACING.md} ${SPACING.md} ${SPACING.sm}`,
        borderBottom: '1px solid var(--color-outline-variant)',
        flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
        <span style={{ fontWeight: 600, fontSize: 'var(--typo-label-1-bold-size, 15px)', color: 'var(--color-on-surface)', flex: 1 }}>
          전체 시간표
        </span>
      </div>
      <p style={{
        margin: 0, padding: `${SPACING.sm} ${SPACING.xl}`,
        fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)',
      }}>
        {station} → {direction}
      </p>
      <div style={{
        flex: 1, overflowY: 'auto', overscrollBehavior: 'contain',
        borderTop: `1px solid ${COLOR.outlineVariant}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--spacing-sp120)',
          padding: `${SPACING.ms} ${SPACING.lg}`,
          background: COLOR.surfaceLowest,
          borderBottom: `1px solid ${COLOR.outlineVariant}`,
          fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 700, color: COLOR.onSurfaceVariant,
        }}>
          <span style={{ width: '80px', flexShrink: 0 }}>시각</span>
          <span style={{ flex: 1, minWidth: 0 }}>열차명</span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>행선 / 소요</span>
        </div>
        {trains.map((t, i) => (
          <div
            key={i}
            role={canTap ? 'button' : undefined}
            tabIndex={canTap ? 0 : undefined}
            onClick={canTap ? () => onTimeRowClick(t, i) : undefined}
            onKeyDown={canTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTimeRowClick(t, i); } } : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-sp120)',
              padding: `${SPACING.ms} ${SPACING.lg}`,
              background: COLOR.surfaceLowest,
              borderBottom: i < trains.length - 1 ? `1px solid ${COLOR.outlineVariant}` : 'none',
              borderLeft: t.picked ? `3px solid ${accent}` : '3px solid transparent',
              cursor: canTap ? 'pointer' : 'default',
            }}
          >
            <span style={{
              width: '80px', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
              fontSize: 'var(--typo-caption-1-medium-size)',
              color: t.picked ? accent : COLOR.onSurfaceVariant,
            }}>
              {String(t.time).replace(/\s+분\s*$/, '분').trim()}
            </span>
            <span style={{
              flex: 1, minWidth: 0, fontSize: 'var(--typo-label-2-medium-size)',
              color: COLOR.onSurface, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {t.name}
            </span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 'var(--typo-caption-2-regular-size)', color: COLOR.onSurfaceVariant2 }}>
              {t.dest && <span style={{ display: 'block' }}>{t.dest}</span>}
              {t.note && <span style={{ display: 'block', fontSize: 'var(--typo-caption-3-regular-size)' }}>{t.note}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Frequency 타입 카드 ──

function FrequencyCard({ timetable, variant }) {
  const { station, direction, frequency, firstTrain, lastTrain, highlights } = timetable;
  const isCompact = variant === 'compact';

  const rows = [
    { label: '배차간격', value: frequency, icon: '🔄' },
    firstTrain && { label: '첫차', value: firstTrain, icon: '🌅' },
    lastTrain && { label: '막차', value: lastTrain, icon: '🌙' },
  ].filter(Boolean);

  return (
    <div style={{
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      border: `1px solid ${COLOR.outlineVariant}`,
      background: COLOR.surfaceLowest,
    }}>
      {/* 헤더 */}
      {!isCompact && station && (
        <div style={{
          padding: `${SPACING.ms} ${SPACING.md}`,
          borderBottom: `1px solid ${COLOR.outlineVariant}`,
          fontSize: 'var(--typo-caption-2-bold-size)',
          fontWeight: 'var(--typo-caption-2-bold-weight)',
          color: COLOR.onSurfaceVariant,
        }}>
          {station} {direction ? `→ ${direction}` : ''}
        </div>
      )}

      {/* 배차정보 행들 */}
      <div style={{
        display: 'flex',
        flexDirection: isCompact ? 'row' : 'column',
        gap: isCompact ? SPACING.md : 0,
        padding: isCompact ? `${SPACING.ms} ${SPACING.md}` : undefined,
      }}>
        {rows.map((row, i) => (
          <div key={row.label} style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.ms,
            ...(isCompact ? {} : {
              padding: `${SPACING.ms} ${SPACING.md}`,
              borderBottom: i < rows.length - 1 ? `1px solid ${COLOR.outlineVariant}` : 'none',
            }),
          }}>
            <span style={{ fontSize: isCompact ? '14px' : '16px' }}>{row.icon}</span>
            <span style={{
              fontSize: 'var(--typo-caption-2-regular-size)',
              color: COLOR.onSurfaceVariant,
              whiteSpace: 'nowrap',
            }}>
              {row.label}
            </span>
            <span style={{
              fontSize: isCompact ? 'var(--typo-caption-1-medium-size)' : 'var(--typo-label-2-medium-size)',
              fontWeight: 'var(--typo-label-2-medium-weight)',
              color: COLOR.onSurface,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* 하이라이트 */}
      {!isCompact && highlights?.length > 0 && (
        <div style={{
          padding: `${SPACING.ms} ${SPACING.md}`,
          borderTop: `1px solid ${COLOR.outlineVariant}`,
        }}>
          {highlights.map((h, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : `${SPACING.xs} 0 0`,
              fontSize: 'var(--typo-caption-2-regular-size)',
              color: COLOR.onSurfaceVariant,
              lineHeight: 1.4,
            }}>
              {h}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
