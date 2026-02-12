/**
 * 출발지 또는 도착지 중 하나만 변경하는 피커
 *
 * mode='from': 고정된 도착지(to)로 갈 수 있는 출발지 목록
 * mode='to': 고정된 출발지(from)에서 갈 수 있는 도착지 목록
 *
 * onSelect(station) — 선택된 역명 반환
 */
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { getStationsByRegion, getStationList, findRoutesByStations } from '../../data/timetable';
import { SPACING } from '../../styles/tokens';

export default function SingleStationPicker({ onClose, onSelect, mode, fixedStation, initialValue = '' }) {
  const [query, setQuery] = useState('');

  const allStations = useMemo(() => getStationList(), []);
  const regionGroups = useMemo(() => getStationsByRegion(), []);

  const stationList = useMemo(() => {
    if (!fixedStation) return [];
    if (mode === 'from') {
      return allStations.filter((s) => s !== fixedStation && findRoutesByStations(s, fixedStation).length > 0);
    }
    return allStations.filter((s) => s !== fixedStation && findRoutesByStations(fixedStation, s).length > 0);
  }, [mode, fixedStation, allStations]);

  const searchLower = (query || '').trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    return regionGroups
      .map((g) => ({
        ...g,
        stations: g.stations.filter((s) =>
          stationList.includes(s) && (!searchLower || s.toLowerCase().includes(searchLower))
        ),
      }))
      .filter((g) => g.stations.length > 0);
  }, [regionGroups, stationList, searchLower]);

  const handlePick = (station) => {
    onSelect(station);
    onClose();
  };

  const title = mode === 'from' ? `출발지 선택 (→ ${fixedStation})` : `도착지 선택 (${fixedStation} →)`;

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

  const overlay = (
    <div style={{
      position: 'fixed',
      ...(viewportRect != null ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height } : { inset: 0 }),
      zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface-container-lowest)',
      animation: 'singleStationSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <style>{`@keyframes singleStationSlideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      <div style={{ flexShrink: 0, paddingTop: 'env(safe-area-inset-top, 0px)', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-outline-variant)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, padding: `${SPACING.ml} ${SPACING.lg} ${SPACING.ml} ${SPACING.md}` }}>
          <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
          <h3 style={{ margin: 0, flex: 1, fontSize: 'var(--typo-body-1-n---bold-size)', fontWeight: 'var(--typo-body-1-n---bold-weight)', color: 'var(--color-on-surface)' }}>
            {title}
          </h3>
        </div>
        <div style={{ padding: `${SPACING.lg} ${SPACING.xxl}` }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: SPACING.md,
            height: 'var(--height-lg, 36px)', padding: '0 var(--spacing-sp140, 14px)',
            border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--color-surface-container-lowest)',
          }}>
            <Icon name="search" size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="역명 검색"
              autoComplete="off"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', color: 'var(--color-on-surface)', fontFamily: 'inherit' }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <Icon name="close" size={14} style={{ opacity: 0.4 }} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingBottom: `calc(${SPACING.xxl} + var(--safe-area-bottom, 0px))` }}>
        {filteredGroups.length === 0 ? (
          <div style={{ padding: `60px ${SPACING.xxl}`, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 'var(--typo-body-2-size)', color: 'var(--color-on-surface-variant2)' }}>
              {searchLower ? '검색 결과가 없습니다' : `${fixedStation}으로 갈 수 있는 역이 없습니다`}
            </p>
          </div>
        ) : (
          filteredGroups.map((g) => (
            <div key={g.region}>
              <div style={{
                padding: `${SPACING.lx} ${SPACING.xxl} ${SPACING.ms}`,
                fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 700, color: 'var(--color-primary)',
                letterSpacing: '0.5px', position: 'sticky', top: 0, background: 'var(--color-surface-container-lowest)', zIndex: 1, borderBottom: '1px solid var(--color-surface-dim)',
              }}>{g.region}</div>
              {g.stations.map((s, i) => (
                <button key={s} type="button"
                  onClick={() => handlePick(s)}
                  style={{
                    width: '100%', padding: `${SPACING.lx} ${SPACING.xxl}`,
                    textAlign: 'left', border: 'none', background: 'transparent',
                    color: 'var(--color-on-surface)', fontSize: 'var(--typo-body-2-size)', fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: SPACING.md,
                    borderBottom: i < g.stations.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                  }}>
                  <span style={{ flex: 1 }}>{s}</span>
                  <Icon name="chevronRight" size={12} style={{ opacity: 0.2, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
