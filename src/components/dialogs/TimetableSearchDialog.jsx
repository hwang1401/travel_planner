import { useState, useMemo, useEffect } from 'react';
import BottomSheet from '../common/BottomSheet';
import Icon from '../common/Icon';
import { TIMETABLE_DB } from '../../data/timetable';
import { SPACING } from '../../styles/tokens';

/* ── 시간표 검색·선택 (교통 move 전용) ──
 * 노선을 검색해서 선택하면 onSelect(routeId) 호출 후 닫힘.
 * 높이 고정(60vh) — 검색결과 유무와 관계없이 동일.
 */
const FIELD_HEIGHT = 'var(--height-lg, 36px)';
const FIELD_PX = 'var(--spacing-sp140, 14px)';
const FIELD_RADIUS = 'var(--radius-md, 8px)';

export default function TimetableSearchDialog({ onClose, onSelect }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    return TIMETABLE_DB.filter((r) => {
      const label = (r.label || '').toLowerCase();
      const station = (r.station || '').toLowerCase();
      const direction = (r.direction || '').toLowerCase();
      return label.includes(q) || station.includes(q) || direction.includes(q);
    });
  }, [query]);

  const handleSelect = (routeId) => {
    onSelect(routeId);
    onClose();
  };

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

  const wrapperStyle = {
    position: 'fixed',
    ...(viewportRect != null ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height } : { inset: 0 }),
    zIndex: 1100,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  };

  return (
    <div style={wrapperStyle}>
      <BottomSheet onClose={onClose} title="시간표 검색" maxHeight={viewportRect != null && viewportRect.height < window.innerHeight - 80 ? `${Math.max(240, viewportRect.height * 0.9)}px` : '85vh'} minHeight="60vh" zIndex={1100}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ padding: `${SPACING.lg} ${SPACING.xxl}`, flexShrink: 0, borderBottom: '1px solid var(--color-outline-variant)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: SPACING.md,
            height: FIELD_HEIGHT, padding: `0 ${FIELD_PX}`,
            border: '1px solid var(--color-outline-variant)',
            borderRadius: FIELD_RADIUS,
            background: 'var(--color-surface-container-lowest)',
          }}>
            <Icon name="search" size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="노선·역명 검색 (예: 하카타, 오사카, 난바)"
              autoFocus
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 'var(--typo-label-1-n---regular-size)',
                fontWeight: 'var(--typo-label-1-n---regular-weight)',
                color: 'var(--color-on-surface)',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
        <ul
          style={{
            margin: 0,
            padding: `${SPACING.md} 0`,
            listStyle: 'none',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          {!(query || '').trim() ? (
            <li style={{ padding: SPACING.xxl, textAlign: 'center', color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-body-2-size)' }}>
              역명 또는 노선명을 입력해주세요
            </li>
          ) : filtered.length === 0 ? (
            <li style={{ padding: SPACING.xxl, textAlign: 'center', color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-body-2-size)' }}>
              검색 결과 없음
            </li>
          ) : (
            filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(r.id)}
                  style={{
                    width: '100%',
                    padding: `${SPACING.lx} ${SPACING.xxl}`,
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-on-surface)',
                    fontSize: 'var(--typo-body-2-size)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontWeight: 'var(--typo-body-2-bold-weight)' }}>{r.label}</span>
                  {(r.station || r.direction) && (
                    <span style={{ display: 'block', marginTop: SPACING.xs, color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-caption-2-size)' }}>
                      {r.station}{r.station && r.direction ? ' · ' : ''}{r.direction}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </BottomSheet>
    </div>
  );
}
