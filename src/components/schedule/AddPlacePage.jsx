import { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import Button from '../common/Button';
import Icon from '../common/Icon';
import PageTransition from '../common/PageTransition';
import BottomSheet from '../common/BottomSheet';
import { useBackClose } from '../../hooks/useBackClose';
import NumberCircle from '../common/NumberCircle';
import { getPlacePredictions, getPlaceDetails } from '../../lib/googlePlaces.js';
import { SPACING, RADIUS } from '../../styles/tokens';
import PlaceInfoContent from '../place/PlaceInfoContent';

/* ── AddPlacePage ──
 * Layout: header → map (flex:1) → bottom panel (flex child, 50vh).
 *
 * Bottom panel: list (search results) / info (place details).
 * "일정 추가하기" → separate BottomSheet modal with form.
 */

/* Leaflet numbered marker icon */
function createSearchIcon(index, isSelected) {
  const bg = isSelected ? 'var(--color-primary)' : 'var(--color-error)';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${bg};color:var(--color-on-primary);font-size:12px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2.5px solid var(--color-surface);box-shadow:0 2px 6px var(--color-shadow, rgba(0,0,0,0.3));
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    ">${index + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FlyTo({ coords, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!coords) return;
    const run = () => {
      map.invalidateSize();
      map.flyTo(coords, zoom || 15, { duration: 0.6 });
    };
    const t = setTimeout(run, 50);
    return () => clearTimeout(t);
  }, [coords, zoom, map]);
  return null;
}

function FitResults({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions.length) return;
    const run = () => {
      map.invalidateSize();
      if (positions.length > 1) {
        map.fitBounds(L.latLngBounds(positions), {
          padding: [24, 24],
          paddingBottomRight: [80, 24],
          maxZoom: 14,
        });
      } else {
        map.flyTo(positions[0], 15, { duration: 0.6 });
      }
    };
    const t = setTimeout(run, 50);
    return () => clearTimeout(t);
  }, [positions, map]);
  return null;
}

export default function AddPlacePage({ open, onClose, onSave, dayIdx, tripId, allDays, selectedDayIdx }) {
  // ── Panel view: list / info only ──
  const [panelView, setPanelView] = useState('list'); // 'list' | 'info'
  const [selectedPlace, setSelectedPlace] = useState(null);
  const panelViewRef = useRef(panelView);
  panelViewRef.current = panelView;

  // ── Form bottom sheet (separate modal) ──
  const [formSheetOpen, setFormSheetOpen] = useState(false);

  const PANEL_HEIGHT = '60vh';

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedResultIdx, setSelectedResultIdx] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // ── Map state ──
  const [flyTarget, setFlyTarget] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // ── Viewport (keyboard) ──
  const [viewportRect, setViewportRect] = useState(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const isSearchFocusedRef = useRef(isSearchFocused);
  isSearchFocusedRef.current = isSearchFocused;

  // ── Back navigation ──
  const handleInfoBack = useCallback(() => {
    setPanelView('list');
    setSelectedPlace(null);
    setSelectedResultIdx(null);
  }, []);

  const handleFormClose = useCallback(() => setFormSheetOpen(false), []);

  // Level 1: page close
  useBackClose(open, onClose);
  // Level 2: info → list
  useBackClose(open && panelView === 'info', handleInfoBack);
  // Level 3: form sheet close
  useBackClose(formSheetOpen, handleFormClose);

  // ── Viewport handling ──
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const vh = vv.height;
      const ih = window.innerHeight;
      setViewportRect({
        top: vv.offsetTop,
        left: vv.offsetLeft,
        width: vv.width,
        height: vh,
      });
      if (isSearchFocusedRef.current && vh < ih - 100) {
        setKeyboardOffset(Math.max(0, ih - vh - 100));
      } else if (!isSearchFocusedRef.current) {
        setKeyboardOffset(0);
      }
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setKeyboardOffset(0);
    };
  }, []);
  useEffect(() => {
    if (!isSearchFocused) setKeyboardOffset(0);
  }, [isSearchFocused]);

  const defaultCenter = [35.68, 139.76];

  // ── Search ──
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setSelectedResultIdx(null);
    setFlyTarget(null);
    if (panelViewRef.current !== 'list') {
      setPanelView('list');
      setSelectedPlace(null);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = (query || '').trim().replace(/\s+/g, ' ');
    if (!q || q.length < 2) { setSearchResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const list = await getPlacePredictions(q, 10);
        const base = list.map((p) => ({
          placeId: p.placeId,
          name: p.description,
          fullAddress: p.description,
        }));
        setSearchResults(base);
        const toFetch = base.slice(0, 5);
        const withCoords = await Promise.all(
          toFetch.map(async (r) => {
            if (!r.placeId) return r;
            try {
              const details = await getPlaceDetails(r.placeId);
              if (details?.lat != null && details?.lon != null) {
                return {
                  ...r,
                  name: details.name || r.name,
                  fullAddress: details.formatted_address || r.fullAddress,
                  lat: details.lat,
                  lon: details.lon,
                };
              }
            } catch { /* keep base */ }
            return r;
          })
        );
        setSearchResults((prev) => {
          if (prev.length !== base.length) return prev;
          return prev.map((r, i) => (i < withCoords.length ? withCoords[i] : r));
        });
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, []);

  // ── Select search result → info ──
  const handleSelectResult = useCallback(async (result, idx) => {
    setSelectedResultIdx(idx);
    const place = {
      name: result.name,
      address: result.fullAddress,
      lat: result.lat ?? null,
      lon: result.lon ?? null,
      placeId: result.placeId,
    };
    setSelectedPlace(place);
    setPanelView('info');
    if (result.lat != null && result.lon != null) {
      setFlyTarget({ coords: [result.lat, result.lon], ts: Date.now() });
    }

    if (result.placeId) {
      try {
        const d = await getPlaceDetails(result.placeId);
        if (d) {
          setSelectedPlace((prev) => ({
            ...prev,
            name: d.name || prev.name,
            address: d.formatted_address || prev.address,
            lat: d.lat ?? prev.lat,
            lon: d.lon ?? prev.lon,
            image: d.photoUrl || prev.image,
            rating: d.rating,
            reviewCount: d.reviewCount,
            hours: d.hours,
            priceLevel: d.priceLevel,
            placeId: d.placeId || prev.placeId,
          }));
          if (d.lat != null && d.lon != null) {
            setFlyTarget({ coords: [d.lat, d.lon], ts: Date.now() });
          }
          setSearchResults((prev) => {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              photoUrl: d.photoUrl,
              lat: d.lat,
              lon: d.lon,
              name: d.name || next[idx].name,
              fullAddress: d.formatted_address || next[idx].fullAddress,
            };
            return next;
          });
        }
      } catch { /* keep existing info */ }
    }
  }, []);


  // ── "일정 추가하기" → open form sheet ──
  const handleGoToForm = () => setFormSheetOpen(true);

  // ── "직접 입력하기" → open form sheet with empty place ──
  const handleManualEntry = () => {
    setSelectedPlace({ name: '', address: '' });
    setFormSheetOpen(true);
  };

  // ── Form submitted ──
  const handlePlaceAdd = (item, selectedFormDayIdx) => {
    setFormSheetOpen(false);
    onSave(item, selectedFormDayIdx);
    onClose();
  };

  // ── Reset on page open ──
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedResultIdx(null);
      setSelectedPlace(null);
      setPanelView('list');
      setFormSheetOpen(false);
      setFlyTarget(null);
      setMapReady(false);
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [open]);

  const resultPositions = searchResults
    .filter((r) => r.lat != null && r.lon != null)
    .map((r) => [r.lat, r.lon]);

  return (
    <PageTransition open={open} onClose={onClose} viewportRect={viewportRect}>
      {/* ── Header ── */}
      <div style={{
        flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'var(--color-surface)',
        zIndex: 5,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACING.md,
          padding: `${SPACING.md} ${SPACING.md} ${SPACING.md} ${SPACING.sm}`,
        }}>
          <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: SPACING.md,
            padding: `${SPACING.md} ${SPACING.lg}`, borderRadius: RADIUS.lg,
            background: 'var(--color-surface-container-lowest)',
            border: '1px solid var(--color-outline-variant)',
          }}>
            <Icon name="pin" size={15} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              placeholder="장소명, 주소를 검색하세요"
              style={{
                flex: 1, border: 'none', background: 'none', outline: 'none',
                fontSize: 'var(--typo-label-2-regular-size)',
                color: 'var(--color-on-surface)',
                fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); setFlyTarget(null); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0', display: 'flex' }}>
                <Icon name="close" size={14} style={{ opacity: 0.5 }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <div style={{ flex: '1 1 auto', position: 'relative', minHeight: '140px' }}>
        {open && (
          <MapContainer
            center={defaultCenter}
            zoom={4}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
            whenReady={() => setMapReady(true)}
            className="map-pins-light"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapReady && resultPositions.length > 0 && !flyTarget && (
              <FitResults positions={resultPositions} />
            )}
            {flyTarget && <FlyTo coords={flyTarget.coords} zoom={16} key={flyTarget.ts} />}
            {searchResults
              .filter((r) => r.lat != null && r.lon != null)
              .map((r, i) => (
                <Marker
                  key={i}
                  position={[r.lat, r.lon]}
                  icon={createSearchIcon(i, selectedResultIdx === i)}
                  eventHandlers={{ click: () => handleSelectResult(r, i) }}
                />
              ))}
          </MapContainer>
        )}

        {panelView === 'list' && searchResults.length === 0 && !searching && (
          <div style={{
            position: 'absolute', bottom: SPACING.xl, left: '50%', transform: 'translateX(-50%)',
            zIndex: 5,
          }}>
            <Button variant="neutral" size="sm" onClick={handleManualEntry}
              style={{
                borderRadius: RADIUS.full,
                boxShadow: 'var(--shadow-normal)',
                background: 'var(--color-surface-container-lowest)',
              }}>
              직접 입력하기
            </Button>
          </div>
        )}
      </div>

      {/* ── Bottom panel (flex child) ── */}
      <div style={{
        flexShrink: 0,
        height: PANEL_HEIGHT,
        maxHeight: '90vh',
        background: 'var(--color-surface-container-lowest)',
        borderTop: '1px solid var(--color-outline-variant)',
        borderRadius: `${RADIUS.xl} ${RADIUS.xl} 0 0`,
        marginTop: `-${SPACING.lg}`,
        position: 'relative',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-normal)',
      }}>
        {/* Top spacer */}
        <div style={{ height: SPACING.lg, flexShrink: 0 }} />
        {/* Content */}
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          overflowY: 'auto', overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}>
          {panelView === 'list' ? (
            <div style={{
              flex: 1, overflowY: 'auto', overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: keyboardOffset,
            }}>
              {searching && (
                <div style={{ padding: SPACING.xxl, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                    검색 중...
                  </p>
                </div>
              )}

              {!searching && searchResults.length === 0 && searchQuery.trim() && (
                <div style={{ padding: SPACING.xxl, textAlign: 'center' }}>
                  <p style={{ margin: `0 0 ${SPACING.sm}`, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                    검색 결과가 없습니다
                  </p>
                  <Button variant="ghost-neutral" size="sm" onClick={handleManualEntry}>
                    직접 입력하기
                  </Button>
                </div>
              )}

              {!searching && searchResults.length === 0 && !searchQuery.trim() && (
                <div style={{ padding: `${SPACING.xxxl} ${SPACING.xxl}`, textAlign: 'center' }}>
                  <p style={{ margin: `0 0 ${SPACING.lg}`, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                    장소명이나 주소를 검색하세요
                  </p>
                  <Button variant="ghost-neutral" size="sm" onClick={handleManualEntry}>
                    검색 없이 직접 입력
                  </Button>
                </div>
              )}

              {searchResults.map((r, i) => (
                <div key={i}
                  onClick={() => handleSelectResult(r, i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: SPACING.lg,
                    padding: `${SPACING.lg} ${SPACING.xxl}`,
                    cursor: 'pointer',
                    borderBottom: i < searchResults.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                    background: selectedResultIdx === i ? 'var(--color-primary-container)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <NumberCircle
                    number={i + 1}
                    size={24}
                    style={{
                      background: selectedResultIdx === i ? 'var(--color-primary)' : 'var(--color-error)',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 'var(--typo-label-2-medium-size)',
                      fontWeight: 600, color: 'var(--color-on-surface)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.name}
                    </p>
                    <p style={{
                      margin: '1px 0 0', fontSize: 'var(--typo-caption-2-regular-size)',
                      color: 'var(--color-on-surface-variant2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.fullAddress}
                    </p>
                  </div>
                  <Icon name="chevronRight" size={14} style={{ opacity: 0.25, flexShrink: 0 }} />
                </div>
              ))}
            </div>
          ) : (
            /* info view */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <PlaceInfoContent
                place={selectedPlace}
                view="info"
                onGoToForm={handleGoToForm}
                onBack={handleInfoBack}
                onAdd={handlePlaceAdd}
                tripId={tripId}
                allDays={allDays}
                selectedDayIdx={selectedDayIdx}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Form BottomSheet (separate modal) ── */}
      {formSheetOpen && (
        <BottomSheet onClose={handleFormClose} maxHeight="90vh">
          <PlaceInfoContent
            place={selectedPlace}
            view="form"
            onBack={handleFormClose}
            onAdd={handlePlaceAdd}
            tripId={tripId}
            allDays={allDays}
            selectedDayIdx={selectedDayIdx}
          />
        </BottomSheet>
      )}
    </PageTransition>
  );
}
