/**
 * 주소/장소 검색 → 가까운 역 매핑 or 역에서 직접 선택
 *
 * mode='from': 고정 도착지로 갈 수 있는 출발지
 * mode='to': 고정 출발지에서 갈 수 있는 도착지
 *
 * onSelect(station) — 선택된 역명
 */
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';
import Button from '../common/Button';
import AddressSearch from '../common/AddressSearch';
import { getStationsByRegion, findRoutesByStations } from '../../data/timetable';
import { findNearestStation } from '../../data/stationCoords';
import { SPACING } from '../../styles/tokens';

const VIEW_ADDRESS = 'address';
const VIEW_STATION = 'station';

export default function AddressToStationPicker({ onClose, onSelect, mode, fixedStation }) {
  const [view, setView] = useState(VIEW_ADDRESS);
  const [addressError, setAddressError] = useState(null);
  const [stationQuery, setStationQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const regionGroups = useMemo(() => getStationsByRegion(), []);
  const stationList = useMemo(() => {
    if (!fixedStation) return [];
    if (mode === 'from') {
      return regionGroups.flatMap((g) => g.stations).filter(
        (s) => s !== fixedStation && findRoutesByStations(s, fixedStation).length > 0
      );
    }
    return regionGroups.flatMap((g) => g.stations).filter(
      (s) => s !== fixedStation && findRoutesByStations(fixedStation, s).length > 0
    );
  }, [mode, fixedStation, regionGroups]);

  const searchLower = (stationQuery || '').trim().toLowerCase();
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

  const handleAddressSelect = (address, lat, lon) => {
    setAddressError(null);
    if (lat == null || lon == null) {
      setAddressError('위치를 확인할 수 없습니다. 역에서 직접 선택해 주세요.');
      return;
    }
    setLoading(true);
    const nearest = findNearestStation(lat, lon, 50);
    setLoading(false);
    if (nearest) {
      const hasRoute = mode === 'from'
        ? findRoutesByStations(nearest.station, fixedStation).length > 0
        : findRoutesByStations(fixedStation, nearest.station).length > 0;
      if (hasRoute) {
        onSelect(nearest.station);
        onClose();
      } else {
        setAddressError(`${nearest.station} (약 ${Math.round(nearest.km)}km) — 해당 구간 시간표가 없습니다. 역에서 직접 선택해 주세요.`);
      }
    } else {
      setAddressError('50km 이내 가까운 역이 없습니다. 역에서 직접 선택해 주세요.');
    }
  };

  const handleStationPick = (station) => {
    onSelect(station);
    onClose();
  };

  const title = mode === 'from' ? `출발지 (→ ${fixedStation})` : `도착지 (${fixedStation} →)`;

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
      animation: 'addressStationSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <style>{`@keyframes addressStationSlideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      <div style={{ flexShrink: 0, paddingTop: 'env(safe-area-inset-top, 0px)', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-outline-variant)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, padding: `${SPACING.ml} ${SPACING.lg} ${SPACING.ml} ${SPACING.md}` }}>
          <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
          <h3 style={{ margin: 0, flex: 1, fontSize: 'var(--typo-body-1-n---bold-size)', fontWeight: 'var(--typo-body-1-n---bold-weight)', color: 'var(--color-on-surface)' }}>
            {title}
          </h3>
        </div>

        {view === VIEW_ADDRESS ? (
          <div style={{ padding: `0 ${SPACING.xxl} ${SPACING.lg}` }}>
            <AddressSearch
              placeholder="주소나 장소 검색 (예: 호텔, 카페)"
              onChange={handleAddressSelect}
              inlineResults
              size="lg"
            />
            {loading && (
              <p style={{ margin: `${SPACING.md} 0 0`, fontSize: 'var(--typo-caption-2-size)', color: 'var(--color-on-surface-variant2)' }}>가까운 역 검색 중…</p>
            )}
            {addressError && (
              <p style={{ margin: `${SPACING.md} 0 0`, fontSize: 'var(--typo-caption-2-size)', color: 'var(--color-error)' }}>{addressError}</p>
            )}
            <button
              type="button"
              onClick={() => { setView(VIEW_STATION); setAddressError(null); }}
              style={{
                marginTop: SPACING.lg,
                display: 'flex', alignItems: 'center', gap: SPACING.sm,
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 'var(--typo-label-1-n---regular-size)', color: 'var(--color-primary)', fontFamily: 'inherit',
              }}
            >
              <Icon name="navigation" size={18} style={{ color: 'var(--color-primary)' }} />
              역에서 직접 선택
            </button>
          </div>
        ) : (
          <div style={{ padding: `${SPACING.lg} ${SPACING.xxl}` }}>
            <button
              type="button"
              onClick={() => setView(VIEW_ADDRESS)}
              style={{
                display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md,
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 'var(--typo-label-1-n---regular-size)', color: 'var(--color-primary)', fontFamily: 'inherit',
              }}
            >
              <Icon name="pin" size={18} />
              주소로 검색
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: SPACING.md,
              height: 'var(--height-lg, 36px)', padding: '0 var(--spacing-sp140, 14px)',
              border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--color-surface-container-lowest)',
            }}>
              <Icon name="search" size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
              <input
                type="text"
                value={stationQuery}
                onChange={(e) => setStationQuery(e.target.value)}
                placeholder="역명 검색"
                autoComplete="off"
                style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: 'var(--typo-label-1-n---regular-size)', fontFamily: 'inherit', color: 'var(--color-on-surface)' }}
              />
              {stationQuery && (
                <button type="button" onClick={() => setStationQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                  <Icon name="close" size={14} style={{ opacity: 0.4 }} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {view === VIEW_STATION && (
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: `calc(${SPACING.xxl} + var(--safe-area-bottom, 0px))` }}>
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
                  position: 'sticky', top: 0, background: 'var(--color-surface-container-lowest)', zIndex: 1, borderBottom: '1px solid var(--color-surface-dim)',
                }}>{g.region}</div>
                {g.stations.map((s, i) => (
                  <button key={s} type="button"
                    onClick={() => handleStationPick(s)}
                    style={{
                      width: '100%', padding: `${SPACING.lx} ${SPACING.xxl}`,
                      textAlign: 'left', border: 'none', background: 'transparent',
                      color: 'var(--color-on-surface)', fontSize: 'var(--typo-body-2-size)', fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: SPACING.md,
                      borderBottom: i < g.stations.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                    }}
                  >
                    <span style={{ flex: 1 }}>{s}</span>
                    <Icon name="chevronRight" size={12} style={{ opacity: 0.2, flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
