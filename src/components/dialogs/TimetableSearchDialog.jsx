import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBackClose } from '../../hooks/useBackClose';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { TIMETABLE_DB } from '../../data/timetable';
import { SPACING, RADIUS } from '../../styles/tokens';

/* ── 시간표 검색·선택 (교통 move 전용) ── 풀스크린 모달 */
const FIELD_HEIGHT = 'var(--height-lg, 36px)';

/** 검색어 오타·동의어 정규화 (쿄토→교토 등) */
const SEARCH_ALIASES = {
  '쿄토': '교토', '쿄토역': '교토',
};
const FIELD_PX = 'var(--spacing-sp140, 14px)';
const FIELD_RADIUS = 'var(--radius-md, 8px)';

export default function TimetableSearchDialog({ onClose, onSelect }) {
  useBackClose(true, onClose);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let q = (query || '').trim().toLowerCase();
    if (!q) return [];
    q = SEARCH_ALIASES[q] || q;
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

  const modal = (
    <div style={{
      position: 'fixed',
      ...(viewportRect != null
        ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height }
        : { inset: 0 }),
      zIndex: 2100,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-surface)',
    }}>
      {/* ── 상단 바 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: SPACING.md,
        padding: `${SPACING.md} ${SPACING.md} ${SPACING.md} ${SPACING.sm}`,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        borderBottom: '1px solid var(--color-outline-variant)',
        flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
        <span style={{ fontWeight: 600, fontSize: 'var(--typo-label-1-bold-size, 15px)', color: 'var(--color-on-surface)' }}>
          시간표 검색
        </span>
      </div>

      {/* ── 검색 필드 ── */}
      <div style={{ padding: `${SPACING.lg} ${SPACING.xl}`, flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACING.md,
          height: FIELD_HEIGHT, padding: `0 ${FIELD_PX}`,
          border: '1px solid var(--color-outline-variant)',
          borderRadius: FIELD_RADIUS,
          background: 'var(--color-surface-container-lowest)',
        }}>
          <Icon name="search" size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
          <input
            type="text"
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
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <Icon name="close" size={14} style={{ opacity: 0.5 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── 결과 리스트 ── */}
      <ul style={{
        margin: 0, padding: `${SPACING.md} 0`, listStyle: 'none',
        overflowY: 'auto', flex: 1, minHeight: 0,
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      }}>
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
  );

  return createPortal(modal, document.body);
}
