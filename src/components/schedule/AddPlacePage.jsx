import { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import Button from '../common/Button';
import Field from '../common/Field';
import Icon from '../common/Icon';
import PageTransition from '../common/PageTransition';
import NumberCircle from '../common/NumberCircle';
import { TYPE_CONFIG, TYPE_LABELS, COLOR, SPACING, RADIUS } from '../../styles/tokens';

/* ── AddPlacePage ──
 * Full-page for adding a single place / schedule item.
 * Layout: search bar (top) → map (middle) → bottom panel (results or form).
 *
 * Flow:
 *   1. User types in search bar → Nominatim results appear in bottom panel
 *   2. User taps a result → map flies to it, bottom panel switches to detail form
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

/* Map fly-to helper */
function FlyTo({ coords, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, zoom || 15, { duration: 0.6 });
  }, [coords, zoom, map]);
  return null;
}

/* Fit all search results */
function FitResults({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 14 });
    } else if (positions.length === 1) {
      map.flyTo(positions[0], 15, { duration: 0.6 });
    }
  }, [positions, map]);
  return null;
}

/* ── 커스텀 시간 선택 UI ── */
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function TimePicker({ value, onChange, label }) {
  const [h, m] = (value || '').match(/^(\d{1,2}):(\d{2})$/)
    ? value.split(':').map(Number)
    : [9, 0];
  const safeH = Math.min(23, Math.max(0, h));
  const safeM = MINUTES.includes(m) ? m : MINUTES[0];

  const update = (newH, newM) => {
    const hh = String(newH ?? safeH).padStart(2, '0');
    const mm = String(newM ?? safeM).padStart(2, '0');
    onChange(`${hh}:${mm}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label style={{
          fontSize: 'var(--typo-caption-2-regular-size)',
          color: 'var(--color-on-surface-variant2)',
          fontWeight: 500,
        }}>
          {label}
        </label>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-outline-variant)',
        background: 'var(--color-surface-container-lowest)',
      }}>
        <select
          value={safeH}
          onChange={(e) => update(Number(e.target.value), safeM)}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: 'var(--typo-label-2-regular-size)',
            color: 'var(--color-on-surface)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
          }}
          aria-label="시"
        >
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, '0')}시
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--color-outline)', fontSize: '14px' }}>:</span>
        <select
          value={safeM}
          onChange={(e) => update(safeH, Number(e.target.value))}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: 'var(--typo-label-2-regular-size)',
            color: 'var(--color-on-surface)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
          }}
          aria-label="분"
        >
          {MINUTES.map((min) => (
            <option key={min} value={min}>
              {String(min).padStart(2, '0')}분
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function AddPlacePage({ open, onClose, onSave, dayIdx }) {
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
  const [types, setTypes] = useState(['spot']); // 복수 선택
  const [sub, setSub] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [tip, setTip] = useState('');

  // Map state
  const [flyTarget, setFlyTarget] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // Default center (Tokyo area — will be overridden by search results)
  const defaultCenter = [35.68, 139.76];

  // 장소 검색: 쿼리 정규화, 유관검색어(역 등) 보정, 클라이언트 랭킹
  const normalizeQuery = (q) => q.trim().replace(/\s+/g, ' ');
  /** "하카타역" → "하카타 역" 처럼 역/정거장 붙은 검색어를 API에 맞게 보정 */
  const queryForApi = (q) => {
    const t = normalizeQuery(q);
    if (!t) return t;
    // 끝에 "역"이 붙어 있으면 앞에 공백 추가 (하카타역 → 하카타 역) → 역/정거장 결과 우선
    const withSpaceBeforeYeok = t.replace(/([가-힣a-zA-Z0-9])(역)(?=\s|$|,)/g, '$1 $2');
    return withSpaceBeforeYeok || t;
  };
  /** 검색 의도: 역/정거장 찾기인지 */
  const hasStationIntent = (q) => /역\s*$|역$/.test(normalizeQuery(q).replace(/\s+/g, ''));
  /** 결과 목록을 쿼리 의도에 맞게 정렬 (유사 검색어·역 우선, 하카타타츠미 등 하락) */
  const rankSearchResults = (results, query) => {
    const q = normalizeQuery(query);
    const qNorm = q.replace(/\s+/g, '').toLowerCase();
    const baseForStation = qNorm.replace(/역\s*$/, '').replace(/역$/, ''); // "하카타"
    const wantStation = hasStationIntent(query);

    const score = (r) => {
      const name = (r.name || '').toLowerCase();
      const full = (r.fullAddress || '').toLowerCase();
      const typeCat = `${r.type || ''} ${r.category || ''}`.toLowerCase();
      const text = `${name} ${full} ${typeCat}`;
      let s = 0;
      // 역 의도일 때: 역/station 포함이면 가산
      if (wantStation && baseForStation) {
        if (/\역|station|railway|train|駅/.test(text)) s += 3;
        if (name.includes(baseForStation) && /\역|station|駅/.test(text)) s += 2;
        // "하카타역" 검색인데 이름이 "하카타타츠미"처럼 역이 없고 다른 단어면 감점
        if (name.startsWith(baseForStation) && name.length > baseForStation.length + 1 && !/역|station|駅/.test(name))
          s -= 2;
      }
      // 이름이 쿼리(또는 보정 쿼리)로 시작하면 가산
      const qApi = queryForApi(query).toLowerCase().replace(/\s+/g, ' ');
      if (name.startsWith(qApi.replace(/\s/g, '')) || name.startsWith(qApi)) s += 2;
      if (name.includes(qNorm) || name.includes(q.replace(/\s/g, ''))) s += 1;
      if (full.includes(qNorm)) s += 0.5;
      return s;
    };
    return [...results].sort((a, b) => score(b) - score(a));
  };

  const mapNominatim = (r) => ({
    name: r.display_name?.split(',').slice(0, 2).join(', ').trim() || r.name || '',
    fullAddress: r.display_name || '',
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    type: r.type || '',
    category: r.class || '',
  });
  const mapPhotonFeature = (f) => {
    const props = f.properties || {};
    const coords = f.geometry?.coordinates;
    const lat = coords?.[1] != null ? coords[1] : null;
    const lon = coords?.[0] != null ? coords[0] : null;
    const parts = [props.street, props.name, props.city, props.state, props.country].filter(Boolean);
    const fullAddress = parts.length ? parts.join(', ') : props.name || '';
    const name = props.name || fullAddress?.split(',').slice(0, 2).join(', ').trim() || '';
    return { name, fullAddress, lat, lon, type: props.osm_value || '', category: props.osm_key || '' };
  };

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setSelectedResultIdx(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = normalizeQuery(query);
    if (!q) { setSearchResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const qApi = queryForApi(q);
        const encoded = encodeURIComponent(qApi);
        let results = [];
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=10&addressdetails=1`;
        const res = await fetch(nominatimUrl);
        const data = await res.json();
        results = (data || []).map(mapNominatim).filter((r) => r.lat != null && r.lon != null);

        if (results.length === 0) {
          const photonUrl = `https://photon.komoot.io/api/?q=${encoded}&limit=10`;
          const photonRes = await fetch(photonUrl);
          const photonData = await photonRes.json();
          const features = photonData?.features || [];
          results = features.map(mapPhotonFeature).filter((r) => r.lat != null && r.lon != null);
        }
        results = rankSearchResults(results, q);
        setSearchResults(results);
        setMode('search');
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, []);

  // Select a search result → fly map to it and switch to form
  const handleSelectResult = (result, idx) => {
    setDesc(result.name);
    setAddress(result.fullAddress || result.name);
    setLat(result.lat);
    setLon(result.lon);
    setSelectedResultIdx(idx);
    setFlyTarget({ coords: [result.lat, result.lon], ts: Date.now() });
    setMode('form');
  };

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
    if (!canSave) return;
    const primaryType = types.length ? types[0] : 'spot';
    const categoryLabels = types.length ? types.map((t) => TYPE_LABELS[t] || t) : ['정보'];
    const newItem = {
      time: time.trim(),
      desc: desc.trim(),
      type: primaryType,
      ...(sub.trim() ? { sub: sub.trim() } : {}),
      _custom: true,
      detail: {
        name: desc.trim(),
        category: categoryLabels[0] || "정보",
        ...(categoryLabels.length > 1 ? { categories: categoryLabels } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(lat != null ? { lat } : {}),
        ...(lon != null ? { lon } : {}),
        ...(tip.trim() ? { tip: tip.trim() } : {}),
      },
    };
    onSave(newItem);
    onClose();
  };

  const toggleType = (value) => {
    setTypes((prev) =>
      prev.includes(value)
        ? prev.length > 1
          ? prev.filter((t) => t !== value)
          : prev
        : [...prev, value]
    );
  };

  // Reset state when page opens
  useEffect(() => {
    if (open) {
      setMode('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedResultIdx(null);
      setTime('09:00'); setDesc(''); setTypes(['spot']); setSub('');
      setAddress(''); setLat(null); setLon(null); setTip('');
      setFlyTarget(null);
      setMapReady(false);
      // Auto-focus search input
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [open]);

  const resultPositions = searchResults.map((r) => [r.lat, r.lon]);

  return (
    <PageTransition open={open} onClose={onClose}>
      {/* ── Header with search bar ── */}
      <div style={{
        flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'var(--color-surface)',
        zIndex: 5,
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 8px 8px 4px',
        }}>
          <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
          {/* Search input */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '10px',
            background: 'var(--color-surface-container-low)',
            border: '1px solid var(--color-outline-variant)',
          }}>
            <Icon name="pin" size={15} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
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
          {mode === 'form' && (
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
              추가
            </Button>
          )}
        </div>
      </div>

      {/* ── Map area ── */}
      <div style={{
        flex: mode === 'form' ? '0 0 35vh' : '1 1 auto',
        position: 'relative',
        minHeight: '180px',
        transition: 'flex 0.3s ease',
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

            {/* Search result markers */}
            {searchResults.map((r, i) => (
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
            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 5,
          }}>
            <Button variant="neutral" size="sm" onClick={handleManualEntry}
              style={{
                borderRadius: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                background: 'var(--color-surface-container-lowest)',
              }}>
              직접 입력하기
            </Button>
          </div>
        )}
      </div>

      {/* ── Bottom panel ── */}
      <div style={{
        flexShrink: 0,
        background: 'var(--color-surface-container-lowest)',
        borderTop: '1px solid var(--color-outline-variant)',
        borderRadius: '16px 16px 0 0',
        marginTop: '-12px',
        position: 'relative',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: mode === 'form' ? '55vh' : '45vh',
        transition: 'max-height 0.3s ease',
      }}>
        {/* Drag handle visual */}
        <div style={{
          padding: '8px 0 4px', display: 'flex', justifyContent: 'center', flexShrink: 0,
        }}>
          <div style={{ width: '32px', height: '4px', borderRadius: '2px', background: 'var(--color-outline-variant)' }} />
        </div>

        {/* ── Search results list ── */}
        {mode === 'search' && (
          <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {searching && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                  검색 중...
                </p>
              </div>
            )}

            {!searching && searchResults.length === 0 && searchQuery.trim() && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                  검색 결과가 없습니다
                </p>
                <Button variant="ghost-neutral" size="sm" onClick={handleManualEntry}>
                  직접 입력하기
                </Button>
              </div>
            )}

            {!searching && searchResults.length === 0 && !searchQuery.trim() && (
              <div style={{ padding: 'var(--spacing-sp240) var(--spacing-sp200)', textAlign: 'center' }}>
                <p style={{ margin: '0 0 var(--spacing-sp120)', fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
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
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 20px',
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
          <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {/* Selected place header */}
            {desc && (
              <div style={{
                padding: '8px 20px 12px',
                borderBottom: '1px solid var(--color-outline-variant)',
                display: 'flex', alignItems: 'center', gap: '10px',
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
                  <Button variant="ghost-neutral" size="xsm" onClick={handleBackToResults}>
                    변경
                  </Button>
                )}
              </div>
            )}

            {/* Form fields */}
            <div style={{ padding: 'var(--spacing-sp120) var(--spacing-sp200) var(--spacing-sp240)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sp160)' }}>
              {/* Type selector (복수 선택) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {TYPE_OPTIONS.map((opt) => {
                  const selected = types.includes(opt.value);
                  return (
                    <button key={opt.value}
                      type="button"
                      onClick={() => toggleType(opt.value)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        padding: '5px 10px', borderRadius: '100px',
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

              {/* Time + Name */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ width: '120px', flexShrink: 0 }}>
                  <TimePicker label="시간" value={time} onChange={setTime} />
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="장소명" size="lg" variant="outlined"
                    value={desc} onChange={(e) => setDesc(e.target.value)}
                    placeholder="장소 이름" />
                </div>
              </div>

              {/* Sub info */}
              <Field label="부가정보" size="lg" variant="outlined"
                value={sub} onChange={(e) => setSub(e.target.value)}
                placeholder="예: ¥1,200 · 1시간 소요" />

              {/* Tip / Memo */}
              <Field as="textarea" label="메모" size="lg" variant="outlined"
                value={tip} onChange={(e) => setTip(e.target.value)}
                placeholder="추천 메뉴, 주의사항 등" rows={2} />
            </div>

            {/* Save button inside scroll area */}
            <div style={{
              padding: '0 20px 24px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
            }}>
              <Button variant="primary" size="xlg" fullWidth onClick={handleSave} disabled={!canSave}>
                장소 추가하기
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
