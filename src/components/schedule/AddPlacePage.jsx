import { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import Button from '../common/Button';
import Field from '../common/Field';
import Icon from '../common/Icon';
import BottomSheet from '../common/BottomSheet';
import PageTransition from '../common/PageTransition';
import Toast from '../common/Toast';
import NumberCircle from '../common/NumberCircle';
import { getPlacePredictions, getPlaceDetails } from '../../lib/googlePlaces.js';
import { uploadImage, generateImagePath } from '../../services/imageService';
import { TYPE_CONFIG, TYPE_LABELS, COLOR, SPACING, RADIUS } from '../../styles/tokens';
import { TIMETABLE_DB, findBestTrain, findRoutesByStations } from '../../data/timetable';
import TimetablePreview from '../common/TimetablePreview';
import { FromToStationField } from '../common/FromToStationField';
import AddressToStationPicker from '../dialogs/AddressToStationPicker';
import TimePickerDialog from '../common/TimePickerDialog';

/* ── AddPlacePage ──
 * Full-page for adding a single place / schedule item.
 * Layout: search bar (top) → map (middle) → bottom panel (results or form).
 *
 * Flow:
 *   1. User types in search bar → Google Places predictions appear in bottom panel
 *   2. User taps a result → Place Details fetched, map flies to it, bottom panel switches to detail form
 *   3. User fills in time/type/memo → taps "추가하기"
 *   4. Or: user can skip search and fill form directly
 */

const TYPE_OPTIONS = Object.entries(TYPE_CONFIG).map(([key, cfg]) => ({
  value: key, label: TYPE_LABELS[key], icon: cfg.icon,
}));

/* Leaflet numbered marker icon */
function createSearchIcon(index, isSelected) {
  const bg = isSelected ? 'var(--color-primary)' : '#D94F3B';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${bg};color:#fff;font-size:12px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    ">${index + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/* Selected place marker */
function createSelectedIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:var(--color-primary);color:#fff;font-size:14px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    ">📍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/* Map fly-to helper — invalidateSize 후 포커싱 */
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

/* Fit all search results — invalidateSize 후 포커싱해 상단 맵에 마커가 보이도록 */
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

/* ── 시간 선택 UI: iOS 스타일 휠 다이얼로그 ── */
const FIELD_LG_HEIGHT = 'var(--height-lg, 36px)';
const FIELD_LG_PX = 'var(--spacing-sp140, 14px)';
const FIELD_RADIUS = 'var(--radius-md, 8px)';

function TimePicker({ value, onChange, label, error }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const displayText = value && value.match(/^\d{1,2}:\d{2}$/) ? value : '';
  const borderColor = error
    ? 'var(--color-error)'
    : 'var(--color-outline-variant)';

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sp40, 4px)',
    paddingBottom: 'var(--spacing-sp40, 4px)',
  };
  const labelTextStyle = {
    fontSize: 'var(--typo-caption-2-bold-size)',
    fontWeight: 'var(--typo-caption-2-bold-weight)',
    lineHeight: 'var(--typo-caption-2-bold-line-height)',
    color: 'var(--color-on-surface-variant)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: '60px' }}>
      {label && (
        <div style={labelStyle}>
          <span style={labelTextStyle}>{label}</span>
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDialogOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDialogOpen(true); } }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          height: FIELD_LG_HEIGHT,
          padding: `0 ${FIELD_LG_PX}`,
          border: `1px solid ${borderColor}`,
          borderRadius: FIELD_RADIUS,
          background: 'var(--color-surface-container-lowest)',
          transition: 'border-color var(--transition-fast)',
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
        aria-label="시간 선택"
      >
        <span style={{
          flex: 1,
          fontSize: 'var(--typo-label-1-n---regular-size)',
          color: displayText ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {displayText || '시간 선택'}
        </span>
        <Icon name="chevronDown" size={18} style={{ flexShrink: 0, opacity: 0.6 }} />
      </div>

      {error && (
        <div style={{ paddingTop: SPACING.sm }}>
          <span style={{
            fontSize: 'var(--typo-caption-1-regular-size)',
            fontWeight: 'var(--typo-caption-1-regular-weight)',
            color: 'var(--color-error)',
          }}>
            {error}
          </span>
        </div>
      )}

      <TimePickerDialog
        open={dialogOpen}
        value={value || '12:00'}
        minuteStep={5}
        onConfirm={(v) => { onChange(v); setDialogOpen(false); }}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

export default function AddPlacePage({ open, onClose, onSave, dayIdx, tripId }) {
  // View mode: 'search' (showing results) | 'form' (detail entry)
  const [mode, setMode] = useState('search');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedResultIdx, setSelectedResultIdx] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Form state (filled when result is selected, or manually)
  const [time, setTime] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('spot'); // 단일 선택
  const [sub, setSub] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [tip, setTip] = useState('');
  const [highlights, setHighlights] = useState('');

  // Timetable state (move type)
  const [loadedTimetable, setLoadedTimetable] = useState(null);
  const [moveFrom, setMoveFrom] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [singleStationPicker, setSingleStationPicker] = useState(null);

  // Validation: field errors and toast
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  // Place image & placeId (uploaded to Storage)
  const [storageImageUrl, setStorageImageUrl] = useState(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);

  // Map state
  const [flyTarget, setFlyTarget] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // 모바일 키보드: visualViewport 전체(offset 포함) — 페이지·패널이 키보드에 가리지 않게
  const [viewportRect, setViewportRect] = useState(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const isSearchFocusedRef = useRef(isSearchFocused);
  isSearchFocusedRef.current = isSearchFocused;
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

  // Default center (Tokyo area — will be overridden by search results)
  const defaultCenter = [35.68, 139.76];

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setSelectedResultIdx(null);
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
        setMode('search');
        // 좌표가 있어야 마커·포커싱 가능 — 상위 5건만 Place Details로 채움
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

  // Select a prediction → 즉시 폼 전환 + 백그라운드에서 Place Details 보강
  const handleSelectResult = useCallback(async (result, idx) => {
    // 먼저 가진 정보로 즉시 폼 열기 (두 번 누를 필요 없음)
    setDesc(result.name || '');
    setAddress(result.fullAddress || result.name || '');
    setLat(result.lat ?? null);
    setLon(result.lon ?? null);
    setSelectedResultIdx(idx);
    if (result.lat != null && result.lon != null) {
      setFlyTarget({ coords: [result.lat, result.lon], ts: Date.now() });
    }
    setMode('form');

    // placeId가 있으면 백그라운드에서 상세 정보 보강
    if (result.placeId) {
      try {
        const details = await getPlaceDetails(result.placeId);
        if (details) {
          if (details.name) setDesc(details.name);
          if (details.formatted_address) setAddress(details.formatted_address);
          if (details.lat != null) { setLat(details.lat); setLon(details.lon); setFlyTarget({ coords: [details.lat, details.lon], ts: Date.now() }); }
          // Store placeId for later use (navigation URLs)
          if (details.placeId) setSelectedPlaceId(details.placeId);
          if (details.photoUrl) {
            setSearchResults((prev) => {
              const next = [...prev];
              next[idx] = { ...next[idx], photoUrl: details.photoUrl, lat: details.lat, lon: details.lon, name: details.name, fullAddress: details.formatted_address };
              return next;
            });
            // Background: copy Google photo to Supabase Storage (so URL doesn't expire)
            (async () => {
              try {
                const res = await fetch(details.photoUrl);
                if (!res.ok) return;
                const blob = await res.blob();
                const file = new File([blob], 'place.jpg', { type: 'image/jpeg' });
                const path = tripId
                  ? generateImagePath(tripId, 'items')
                  : `places/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
                const publicUrl = await uploadImage(file, path);
                setStorageImageUrl(publicUrl);
              } catch (e) {
                console.warn('[AddPlacePage] Photo storage upload failed:', e);
                // Fall through — place saves without permanent image
              }
            })();
          }
        }
      } catch { /* 실패해도 기존 정보로 폼 유지 */ }
    }
  }, [tripId]);

  // Go back to search results from form
  const handleBackToResults = () => {
    setMode('search');
    setSelectedResultIdx(null);
  };

  // Skip search, fill manually
  const handleManualEntry = () => {
    setMode('form');
    setSearchResults([]);
    setSelectedResultIdx(null);
  };

  const canSave = time.trim() && desc.trim();

  const handleSave = () => {
    const hasTime = !!time.trim();
    const hasDesc = !!desc.trim();
    if (!hasTime || !hasDesc) {
      const nextErrors = {};
      if (!hasTime) nextErrors.time = '시간을 선택해주세요';
      if (!hasDesc) nextErrors.desc = '일정명을 입력해주세요';
      setErrors(nextErrors);
      const msg = !hasTime && !hasDesc
        ? '시간과 일정명을 입력해주세요'
        : !hasTime
          ? '시간을 선택해주세요'
          : '일정명을 입력해주세요';
      setToast({ message: msg, icon: 'info' });
      return;
    }
    setErrors({});
    const categoryLabel = TYPE_LABELS[type] || '정보';
    // Parse highlights (newline-separated)
    const parsedHighlights = highlights.trim()
      ? highlights.split('\n').map((l) => l.trim()).filter(Boolean)
      : null;
    // Timetable for move type
    const timetable = (type === 'move' && loadedTimetable?.trains?.length) ? loadedTimetable : null;
    // Route highlights override manual ones
    let finalHighlights = parsedHighlights;
    if (timetable?._routeId) {
      const route = TIMETABLE_DB.find((r) => r.id === timetable._routeId);
      if (route?.highlights) finalHighlights = route.highlights;
    }
    const newItem = {
      time: time.trim(),
      desc: desc.trim(),
      type,
      ...(sub.trim() ? { sub: sub.trim() } : {}),
      ...(type === 'move' && moveFrom ? { moveFrom } : {}),
      ...(type === 'move' && moveTo ? { moveTo } : {}),
      _custom: true,
      detail: {
        name: desc.trim(),
        category: categoryLabel,
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(lat != null ? { lat } : {}),
        ...(lon != null ? { lon } : {}),
        ...(tip.trim() ? { tip: tip.trim() } : {}),
        // Prefer Storage URL over expiring Google photo URL
        ...(storageImageUrl
          ? { image: storageImageUrl }
          : searchResults[selectedResultIdx ?? 0]?.photoUrl
            ? { image: searchResults[selectedResultIdx ?? 0].photoUrl }
            : {}),
        ...(selectedPlaceId ? { placeId: selectedPlaceId } : {}),
        ...(timetable ? { timetable } : {}),
        ...(finalHighlights ? { highlights: finalHighlights } : {}),
      },
    };
    onSave(newItem);
    onClose();
  };

  const handleSingleStationSelect = (station) => {
    const from = singleStationPicker.mode === 'from' ? station : moveFrom;
    const to = singleStationPicker.mode === 'to' ? station : moveTo;
    setSingleStationPicker(null);
    setMoveFrom(from);
    setMoveTo(to);
    if (!desc.trim()) setDesc(`${from} → ${to}`);
    const routes = findRoutesByStations(from, to);
    const route = routes[0] || null;
    if (route) {
      const bestIdx = findBestTrain(route.trains, time);
      setLoadedTimetable({
        _routeId: route.id,
        station: route.station,
        direction: route.direction,
        trains: route.trains.map((t, i) => ({ ...t, picked: i === bestIdx })),
      });
    } else {
      setLoadedTimetable(null);
    }
  };

  // Reset state when page opens
  useEffect(() => {
    if (open) {
      setMode('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedResultIdx(null);
      setTime('09:00'); setDesc(''); setType('spot'); setSub('');
      setAddress(''); setLat(null); setLon(null); setTip('');
      setHighlights(''); setLoadedTimetable(null); setMoveFrom(''); setMoveTo(''); setSingleStationPicker(null);
      setStorageImageUrl(null); setSelectedPlaceId(null);
      setErrors({});
      setToast(null);
      setFlyTarget(null);
      setMapReady(false);
      // Auto-focus search input
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [open]);

  const resultPositions = searchResults
    .filter((r) => r.lat != null && r.lon != null)
    .map((r) => [r.lat, r.lon]);

  return (
    <PageTransition open={open} onClose={onClose} viewportRect={viewportRect}>
      {/* ── Header with search bar ── */}
      <div style={{
        flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'var(--color-surface)',
        zIndex: 5,
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACING.md,
          padding: `${SPACING.md} ${SPACING.md} ${SPACING.md} ${SPACING.sm}`,
        }}>
          <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
          {/* Search input */}
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
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); setMode('search'); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0', display: 'flex' }}>
                <Icon name="close" size={14} style={{ opacity: 0.5 }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Map area ── (검색 포커스+결과 있을 때는 줄여서 하단 결과가 키보드 위로) */}
      <div style={{
        flex: mode === 'form' ? '0 0 35vh' : (isSearchFocused && searchResults.length > 0 ? '0 0 22vh' : '1 1 auto'),
        position: 'relative',
        minHeight: '140px',
        transition: 'flex 0.25s ease',
      }}>
        {open && (
          <MapContainer
            center={defaultCenter}
            zoom={4}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
            whenReady={() => setMapReady(true)}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Fit to search results */}
            {mapReady && resultPositions.length > 0 && !flyTarget && (
              <FitResults positions={resultPositions} />
            )}

            {/* Fly to selected */}
            {flyTarget && <FlyTo coords={flyTarget.coords} zoom={16} key={flyTarget.ts} />}

            {/* Search result markers (only when we have coordinates, e.g. after Place Details) */}
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

            {/* Selected place marker (if in form mode with coords but no search results visible) */}
            {mode === 'form' && lat && lon && searchResults.length === 0 && (
              <Marker position={[lat, lon]} icon={createSelectedIcon()} />
            )}
          </MapContainer>
        )}

        {/* "직접 입력" floating button on map (when no results and search mode) */}
        {mode === 'search' && searchResults.length === 0 && !searching && (
          <div style={{
            position: 'absolute', bottom: SPACING.xl, left: '50%', transform: 'translateX(-50%)',
            zIndex: 5,
          }}>
            <Button variant="neutral" size="sm" onClick={handleManualEntry}
              style={{
                borderRadius: RADIUS.full,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                background: 'var(--color-surface-container-lowest)',
              }}>
              직접 입력하기
            </Button>
          </div>
        )}
      </div>

      {/* ── Bottom panel. 키보드 노출 시 패널 높이를 visualViewport에 맞춰 버튼이 가리지 않게 ── */}
      <div style={{
        flexShrink: 0,
        background: 'var(--color-surface-container-lowest)',
        borderTop: '1px solid var(--color-outline-variant)',
        borderRadius: `${RADIUS.xl} ${RADIUS.xl} 0 0`,
        marginTop: `-${SPACING.lg}`,
        position: 'relative',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: (() => {
          const base = mode === 'form' ? '55vh' : '45vh';
          if (mode === 'form' && viewportRect != null && viewportRect.height < window.innerHeight - 80) {
            return `${Math.max(200, viewportRect.height - 180)}px`;
          }
          return base;
        })(),
        transition: 'max-height 0.25s ease',
      }}>
        {/* Drag handle visual */}
        <div style={{
          padding: `${SPACING.md} 0 ${SPACING.sm}`, display: 'flex', justifyContent: 'center', flexShrink: 0,
        }}>
          <div style={{ width: '32px', height: '4px', borderRadius: RADIUS.xs, background: 'var(--color-outline-variant)' }} />
        </div>

        {/* ── Search results list ── (키보드 높이만큼 하단 패딩으로 스크롤 시 결과가 가려지지 않게) */}
        {mode === 'search' && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
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
                {/* Number badge — uses NumberCircle but with map-marker red when not selected */}
                <NumberCircle
                  number={i + 1}
                  size={24}
                  style={{
                    background: selectedResultIdx === i ? 'var(--color-primary)' : '#D94F3B',
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
        )}

        {/* ── Detail form (after selecting a place) ── */}
        {mode === 'form' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* 스크롤 영역: 헤더 + 폼 (PWA/iOS 세부 스크롤) */}
            <div style={{
              flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch', touchAction: 'pan-y',
            }}>
              {/* Selected place header */}
              {desc && (
                <div style={{
                  padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.lg}`,
                  borderBottom: '1px solid var(--color-outline-variant)',
                  display: 'flex', alignItems: 'center', gap: SPACING.lg,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 'var(--typo-label-1-n---bold-size)',
                      fontWeight: 600, color: 'var(--color-on-surface)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {desc}
                    </p>
                    {address && (
                      <p style={{
                        margin: '1px 0 0', fontSize: 'var(--typo-caption-2-regular-size)',
                        color: 'var(--color-on-surface-variant2)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {address}
                      </p>
                    )}
                  </div>
                  {searchResults.length > 0 && (
                    <Button variant="ghost-neutral" size="sm" onClick={handleBackToResults}>
                      변경
                    </Button>
                  )}
                </div>
              )}

              {/* Form fields */}
              <div style={{ padding: `${SPACING.lg} ${SPACING.xxl} ${SPACING.xxxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
                {/* Section: 카테고리 */}
                <div>
                  <p style={{
                    margin: `0 0 ${SPACING.sm}`,
                    fontSize: 'var(--typo-caption-2-bold-size)',
                    fontWeight: 'var(--typo-caption-2-bold-weight)',
                    color: 'var(--color-on-surface-variant)',
                  }}>
                    카테고리
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm }}>
                    {TYPE_OPTIONS.map((opt) => {
                      const selected = type === opt.value;
                      return (
                        <button key={opt.value}
                          type="button"
                          onClick={() => setType(opt.value)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: SPACING.xs,
                            padding: `${SPACING.sm} ${SPACING.lg}`, borderRadius: RADIUS.full,
                            border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                            background: selected ? 'var(--color-primary-container)' : 'transparent',
                            color: selected ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                            fontSize: '12px', fontWeight: selected ? 600 : 400,
                            cursor: 'pointer', transition: 'all 0.15s',
                            fontFamily: 'inherit',
                          }}
                        >
                          <Icon name={opt.icon} size={11} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 시간 · 장소명 (한 줄). flex-start로 맞춰야 헬퍼 나와도 '시간'이 아래로 밀리지 않음 */}
                <div style={{ display: 'flex', gap: SPACING.md, alignItems: 'flex-start' }}>
                  <div style={{ width: '120px', flexShrink: 0 }}>
                    <TimePicker label="시간" value={time} onChange={setTime} error={errors.time} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Field label="일정명" size="lg" variant="outlined"
                      value={desc} onChange={(e) => setDesc(e.target.value)}
                      placeholder="예: 캐널시티 라멘스타디움" error={errors.desc} />
                  </div>
                </div>

                <Field label="부가정보" size="lg" variant="outlined"
                  value={sub} onChange={(e) => setSub(e.target.value)}
                  placeholder="예: ¥1,200 · 1시간 소요" />

                <Field as="textarea" label="메모" size="lg" variant="outlined"
                  value={tip} onChange={(e) => setTip(e.target.value)}
                  placeholder="추천 메뉴, 주의사항 등" rows={2} />

                {/* 포인트 (하이라이트) */}
                <Field as="textarea" label="포인트 (줄바꿈으로 구분)" size="lg" variant="outlined"
                  value={highlights} onChange={(e) => setHighlights(e.target.value)}
                  placeholder={"추천 메뉴, 꿀팁 등 핵심 포인트\n예: 후쿠오카 돈코츠 라멘 추천\n예: 면세 카운터 있음 (여권 필수)"} rows={3} />

                {/* 시간표: 교통(move) 전용 — Field와 동일한 단일 필드 스타일 */}
                {type === 'move' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ paddingBottom: 'var(--spacing-sp40, 4px)', minHeight: 'var(--field-label-row-height, 20px)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)' }}>
                        시간표
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
                      <FromToStationField
                        label="출발지"
                        value={moveFrom}
                        placeholder="출발지 선택"
                        onClick={() => setSingleStationPicker({ mode: 'from' })}
                      />
                      <FromToStationField
                        label="도착지"
                        value={moveTo}
                        placeholder="도착지 선택"
                        onClick={() => setSingleStationPicker({ mode: 'to' })}
                      />
                    </div>

                    {/* 시간표 미리보기 */}
                    {moveFrom && moveTo && !loadedTimetable?.trains?.length && (
                      <p style={{ margin: `${SPACING.md} 0 0`, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)', textAlign: 'center' }}>
                        해당 구간의 시간표가 없습니다
                      </p>
                    )}
                    {loadedTimetable?.trains?.length > 0 && (
                      <div style={{ marginTop: SPACING.md }}>
                        <TimetablePreview timetable={loadedTimetable} variant="compact" />
                      </div>
                    )}

                    {singleStationPicker && (
                      <AddressToStationPicker
                        mode={singleStationPicker.mode}
                        fixedStation={singleStationPicker.mode === 'from' ? (moveTo || '') : (moveFrom || '')}
                        onClose={() => setSingleStationPicker(null)}
                        onSelect={handleSingleStationSelect}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 장소 추가하기 — 스크롤 밖, 패널 하단 고정. 버튼 아래 여백만 padding + safe-area */}
            <div style={{
              flexShrink: 0,
              padding: `${SPACING.lg} ${SPACING.xxl} var(--safe-area-bottom, 0px)`,
              background: 'var(--color-surface-container-lowest)',
              borderTop: '1px solid var(--color-outline-variant)',
            }}>
              <Button variant="primary" size="xlg" fullWidth onClick={handleSave}>
                일정 추가하기
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Toast (validation feedback) */}
      {toast && (
        <Toast
          message={toast.message}
          icon={toast.icon}
          onDone={() => setToast(null)}
        />
      )}
    </PageTransition>
  );
}
