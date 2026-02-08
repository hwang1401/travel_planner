import { useState, useCallback, useRef, useEffect } from 'react';
import Icon from './Icon';
import { getPlacePredictions, getPlaceDetails } from '../../lib/googlePlaces.js';

/*
 * ── Address Search Component ──
 * Google Places Autocomplete (다저스 → Dodger Stadium, 엘에이 → LA 등)
 * Requires VITE_GOOGLE_MAPS_API_KEY, Maps JavaScript API enabled
 *
 * Props:
 *   value        — current selected address string
 *   onChange      — (address: string, lat?: number, lon?: number) => void
 *   placeholder   — placeholder text
 *   label         — field label
 *   required      — show required indicator
 *   size          — "lg" | "md"
 *   variant       — "outlined" | "filled"
 *   style         — custom style
 */

const SIZE_MAP = {
  lg: { height: 'var(--height-lg, 36px)', fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', px: 'var(--spacing-sp140, 14px)', radius: 'var(--radius-md, 8px)', iconSize: 18 },
  md: { height: 'var(--height-md, 32px)', fontSize: 'var(--typo-label-2-regular-size)', fontWeight: 'var(--typo-label-2-regular-weight)', px: 'var(--spacing-sp120, 12px)', radius: 'var(--radius-md, 8px)', iconSize: 16 },
};

/* Debounce helper */
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function AddressSearch({
  value = '',
  onChange,
  placeholder = '주소 또는 장소 검색',
  label,
  required = false,
  size = 'lg',
  variant = 'outlined',
  style: customStyle = {},
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef(null);
  const s = SIZE_MAP[size] || SIZE_MAP.lg;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Sync external value
  useEffect(() => {
    if (value !== query) setQuery(value);
  }, [value]);

  const searchAddress = useCallback(async (q) => {
    if (!q || String(q).trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const list = await getPlacePredictions(String(q).trim(), 6);
      const mapped = list.map((p) => ({
        placeId: p.placeId,
        name: p.description,
        displayName: p.description,
      }));
      setResults(mapped);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useDebounce(searchAddress, 400);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val);
  };

  const handleSelect = useCallback(async (result) => {
    setShowResults(false);
    if (!result?.placeId) return;
    setLoading(true);
    try {
      const details = await getPlaceDetails(result.placeId);
      if (details) {
        const label = details.name || details.formatted_address;
        if (onChange) onChange(label, details.lat, details.lon);
        setQuery('');
      } else {
        if (onChange) onChange(result.name, null, null);
        setQuery('');
      }
    } catch {
      if (onChange) onChange(result.name, null, null);
      setQuery('');
    } finally {
      setLoading(false);
    }
  }, [onChange]);


  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    if (onChange) onChange('', null, null);
  };

  const borderColor = focused
    ? 'var(--color-primary)'
    : 'var(--color-outline-variant)';

  return (
    <div ref={wrapperRef} style={{ position: 'relative', ...customStyle }}>
      {/* Label */}
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingBottom: 'var(--spacing-sp40, 4px)' }}>
          <span style={{
            fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)',
            color: 'var(--color-on-surface-variant)',
          }}>
            {label}
          </span>
          {required && <span style={{ color: 'var(--color-error)', fontSize: 'var(--typo-caption-2-bold-size)' }}>*</span>}
        </div>
      )}

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        height: s.height, padding: `0 ${s.px}`,
        border: `1px solid ${borderColor}`, borderRadius: s.radius,
        background: variant === 'filled' ? 'var(--color-surface-container-lowest)' : 'transparent',
        transition: 'border-color var(--transition-fast)',
      }}>
        <Icon name="search" size={s.iconSize} style={{ flexShrink: 0, opacity: 0.5 }} />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => { setFocused(true); if (results.length > 0) setShowResults(true); }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontSize: s.fontSize, fontWeight: s.fontWeight, fontFamily: 'inherit',
            color: 'var(--color-on-surface)', padding: 0,
          }}
        />
        {loading && (
          <div style={{
            width: '14px', height: '14px', border: '2px solid var(--color-outline-variant)',
            borderTopColor: 'var(--color-primary)', borderRadius: '50%',
            animation: 'spin 0.6s linear infinite', flexShrink: 0,
          }} />
        )}
        {query && !loading && (
          <button onClick={handleClear} style={{
            border: 'none', background: 'none', cursor: 'pointer', padding: '2px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="close" size={14} style={{ opacity: 0.5 }} />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '4px',
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-outline-variant)',
          borderRadius: s.radius, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 100, maxHeight: '220px', overflowY: 'auto',
        }}>
          {results.map((r, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(r)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: i < results.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-container-lowest)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Icon name="pin" size={14} style={{ marginTop: '2px', flexShrink: 0, opacity: 0.5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 'var(--typo-label-2-medium-size)',
                  fontWeight: 'var(--typo-label-2-medium-weight)', color: 'var(--color-on-surface)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
