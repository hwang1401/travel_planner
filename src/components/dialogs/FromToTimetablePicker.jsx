/**
 * 출발지 → 도착지 → 노선 통합 선택 모달
 * 
 * Step 1: 출발지 선택
 * Step 2: 도착지 선택 (출발지에서 갈 수 있는 역만)
 * Step 3: 해당 구간 노선이 여러 개면 노선 선택 (1개면 자동 선택)
 * 
 * onSelect({ from, to, routeId, route }) — route는 TIMETABLE_DB 항목
 * 노선 없으면 routeId/route 없이 호출
 */
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';
import Button from '../common/Button';
import AddressSearch from '../common/AddressSearch';
import { getStationsByRegion, getStationList, findRoutesByStations } from '../../data/timetable';
import { findNearestStation } from '../../data/stationCoords';
import { SPACING } from '../../styles/tokens';

const VIEW_ADDRESS = 'address';
const VIEW_STATION = 'station';

const STEP_FROM = 1;
const STEP_TO = 2;
const STEP_ROUTE = 3;

export default function FromToTimetablePicker({ onClose, onSelect, initialFrom = '', initialTo = '', initialRouteId = '' }) {
  const [step, setStep] = useState(initialFrom && initialTo ? STEP_ROUTE : initialFrom ? STEP_TO : STEP_FROM);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [query, setQuery] = useState('');
  const [view, setView] = useState(VIEW_ADDRESS);
  const [addressError, setAddressError] = useState(null);
  const [loading, setLoading] = useState(false);

  const regionGroups = useMemo(() => getStationsByRegion(), []);
  const allStations = useMemo(() => getStationList(), []);

  const availableDests = useMemo(() => {
    if (!from) return [];
    return allStations.filter((s) => s !== from && findRoutesByStations(from, s).length > 0);
  }, [from, allStations]);

  const routes = useMemo(() => {
    if (!from || !to) return [];
    return findRoutesByStations(from, to);
  }, [from, to]);

  const q = (query || '').trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    const src = step === STEP_FROM
      ? regionGroups
      : regionGroups.map((g) => {
          const destSet = new Set(availableDests);
          return { ...g, stations: g.stations.filter((s) => destSet.has(s)) };
        });
    return src
      .map((g) => ({ ...g, stations: g.stations.filter((s) => !q || s.toLowerCase().includes(q)) }))
      .filter((g) => g.stations.length > 0);
  }, [step, regionGroups, availableDests, q]);

  const handlePickFrom = (station) => {
    setFrom(station);
    setQuery('');
    setView(VIEW_ADDRESS);
    setAddressError(null);
    setStep(STEP_TO);
  };

  const handleAddressSelect = (address, lat, lon) => {
    setAddressError(null);
    if (lat == null || lon == null) {
      setAddressError('위치를 확인할 수 없습니다. 역에서 직접 선택해 주세요.');
      return;
    }
    setLoading(true);
    const nearest = findNearestStation(lat, lon, 50);
    setLoading(false);
    if (!nearest) {
      setAddressError('50km 이내 가까운 역이 없습니다. 역에서 직접 선택해 주세요.');
      return;
    }
    if (step === STEP_FROM) {
      if (!allStations.includes(nearest.station)) {
        setAddressError(`${nearest.station} (약 ${Math.round(nearest.km)}km) — 등록된 역이 아닙니다. 역에서 직접 선택해 주세요.`);
        return;
      }
      handlePickFrom(nearest.station);
    } else {
      const dests = new Set(availableDests);
      if (!dests.has(nearest.station)) {
        setAddressError(`${nearest.station} (약 ${Math.round(nearest.km)}km) — 해당 구간 시간표가 없습니다. 역에서 직접 선택해 주세요.`);
        return;
      }
      handlePickTo(nearest.station);
    }
  };

  const handlePickTo = (station) => {
    setTo(station);
    setQuery('');
    setView(VIEW_ADDRESS);
    setAddressError(null);
    const r = findRoutesByStations(from, station);
    if (r.length === 0) {
      setStep(STEP_ROUTE);
    } else if (r.length === 1) {
      onSelect({ from, to: station, routeId: r[0].id, route: r[0] });
      onClose();
    } else {
      setStep(STEP_ROUTE);
    }
  };

  const handlePickRoute = (route) => {
    onSelect({ from, to, routeId: route.id, route });
    onClose();
  };

  const handleBack = () => {
    if (step === STEP_TO) {
      setStep(STEP_FROM);
      setTo('');
      setQuery('');
      setView(VIEW_ADDRESS);
      setAddressError(null);
    } else if (step === STEP_ROUTE) {
      setStep(STEP_TO);
      setQuery('');
      setView(VIEW_ADDRESS);
      setAddressError(null);
    }
  };

  const titles = {
    [STEP_FROM]: '출발지 선택',
    [STEP_TO]: '도착지 선택',
    [STEP_ROUTE]: '노선 선택',
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

  const overlay = (
    <div style={{
      position: 'fixed',
      ...(viewportRect != null ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height } : { inset: 0 }),
      zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface-container-lowest)',
      animation: 'fromToPickerSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <style>{`
        @keyframes fromToPickerSlideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {/* 헤더 */}
      <div style={{ flexShrink: 0, paddingTop: 'env(safe-area-inset-top, 0px)', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-outline-variant)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, padding: `${SPACING.ml} ${SPACING.lg} ${SPACING.ml} ${SPACING.md}` }}>
          <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={step > STEP_FROM ? handleBack : onClose} />
          <h3 style={{ margin: 0, flex: 1, fontSize: 'var(--typo-body-1-n---bold-size)', fontWeight: 'var(--typo-body-1-n---bold-weight)', color: 'var(--color-on-surface)' }}>
            {titles[step]}
          </h3>
        </div>

        {/* 출발지·도착지 표시 */}
        {(step === STEP_TO || step === STEP_ROUTE) && (
          <div style={{
            padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.ml}`,
            display: 'flex', alignItems: 'center', gap: SPACING.ml,
            background: 'var(--color-primary-container)',
            borderBottom: '1px solid var(--color-outline-variant)',
          }}>
            <Icon name="navigation" size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 'var(--typo-label-2-bold-size)', fontWeight: 700, color: 'var(--color-on-primary-container)' }}>
              {from} → {to || '도착지 선택'}
            </span>
            {step === STEP_ROUTE && (
              <button type="button" onClick={() => { setStep(STEP_TO); setQuery(''); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-primary)', fontFamily: 'inherit', fontWeight: 600, padding: `${SPACING.sm} ${SPACING.md}` }}>
                변경
              </button>
            )}
          </div>
        )}

        {/* 검색 (step 1, 2만) — 주소 검색 + 역 선택 통합 */}
        {step !== STEP_ROUTE && (
          <div style={{ padding: `0 ${SPACING.xxl} ${SPACING.lg}` }}>
            {view === VIEW_ADDRESS ? (
              <>
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
              </>
            ) : (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: SPACING.md,
                  height: 'var(--height-lg, 36px)', padding: '0 var(--spacing-sp140, 14px)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'var(--color-surface-container-lowest)',
                }}>
                  <Icon name="search" size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={step === STEP_FROM ? '역명 검색 (예: 하카타)' : '도착지 검색'}
                    autoComplete="off"
                    style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', color: 'var(--color-on-surface)', fontFamily: 'inherit' }}
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                      <Icon name="close" size={14} style={{ opacity: 0.4 }} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setView(VIEW_ADDRESS)}
                  style={{
                    marginTop: SPACING.lg,
                    display: 'flex', alignItems: 'center', gap: SPACING.sm,
                    border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 'var(--typo-label-1-n---regular-size)', color: 'var(--color-primary)', fontFamily: 'inherit',
                  }}
                >
                  <Icon name="pin" size={18} style={{ color: 'var(--color-primary)' }} />
                  주소로 검색
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 콘텐츠 — 노선 선택 시 또는 역 직접 선택 시에만 */}
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingBottom: `calc(${SPACING.xxl} + var(--safe-area-bottom, 0px))` }}>
        {step === STEP_ROUTE ? (
          routes.length === 0 ? (
            <div style={{ padding: `60px ${SPACING.xxl}`, textAlign: 'center' }}>
              <Icon name="car" size={36} style={{ color: 'var(--color-on-surface-variant2)', opacity: 0.2, marginBottom: SPACING.xl }} />
              <p style={{ margin: 0, fontSize: 'var(--typo-body-2-size)', color: 'var(--color-on-surface-variant2)' }}>
                {from} → {to} 구간의 노선이 없습니다
              </p>
              <p style={{ margin: `${SPACING.md} 0 0`, fontSize: 'var(--typo-caption-2-size)', color: 'var(--color-on-surface-variant2)' }}>
                출발지·도착지를 변경해보세요
              </p>
            </div>
          ) : (
            <ul style={{ margin: 0, padding: `${SPACING.md} 0`, listStyle: 'none' }}>
              {routes.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => handlePickRoute(r)}
                    style={{
                      width: '100%', padding: `${SPACING.lx} ${SPACING.xxl}`,
                      textAlign: 'left', border: 'none', background: 'transparent',
                      color: 'var(--color-on-surface)', fontSize: 'var(--typo-body-2-size)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      borderBottom: '1px solid var(--color-surface-dim)',
                      display: 'flex', alignItems: 'center', gap: SPACING.md,
                    }}
                  >
                    <span style={{ flex: 1, fontWeight: 500 }}>{r.label}</span>
                    {(r.station || r.direction) && (
                      <span style={{ fontSize: 'var(--typo-caption-2-size)', color: 'var(--color-on-surface-variant2)' }}>
                        {r.station}{r.station && r.direction ? ' · ' : ''}{r.direction}
                      </span>
                    )}
                    <Icon name="chevronRight" size={12} style={{ opacity: 0.2, flexShrink: 0 }} />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : view === VIEW_STATION ? (
          filteredGroups.length === 0 ? (
            <div style={{ padding: `60px ${SPACING.xxl}`, textAlign: 'center' }}>
              <Icon name="navigation" size={36} style={{ color: 'var(--color-on-surface-variant2)', opacity: 0.2, marginBottom: SPACING.xl }} />
              <p style={{ margin: 0, fontSize: 'var(--typo-body-2-size)', color: 'var(--color-on-surface-variant2)' }}>
                {q ? '검색 결과가 없습니다' : (step === STEP_TO ? `${from}에서 출발하는 노선이 없습니다` : '등록된 역이 없습니다')}
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
                    onClick={() => (step === STEP_TO ? handlePickTo(s) : handlePickFrom(s))}
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
          )
        ) : null}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
