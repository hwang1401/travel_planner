import { useState, useCallback, useRef, useEffect } from 'react';
import Icon from './Icon';
import { getPlacePredictions, getPlaceDetails } from '../../lib/googlePlaces.js';
import { SPACING } from '../../styles/tokens';

/*
 * ── Address Search Component ──
 * Google Places Autocomplete (다저스 → Dodger Stadium, 엘에이 → LA 등)
 * Requires VITE_GOOGLE_MAPS_API_KEY, Maps JavaScript API enabled
 *
 * Props:
 *   value        — current selected address string
 *   onChange      — (address: string, lat?: number, lon?: number, placeId?: string) => void
 *   placeholder   — placeholder text
 *   label         — field label
 *   required      — show required indicator
 *   size          — "lg" | "md"
 *   variant       — "outlined" | "filled"
 *   style         — custom style
 *   inlineResults — true면 필드 하단 드롭다운 대신, 하단 영역에 검색결과 인라인 표시 (모달용)
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
  inlineResults = false,
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef(null);
  const s = SIZE_MAP[size] || SIZE_MAP.lg;

  // Close dropdown on outside click (드롭다운 모드일 때만)
  useEffect(() => {
    if (inlineResults) return;
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [inlineResults]);

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
        const addr = details.formatted_address || details.name;
        if (onChange) onChange(addr, details.lat, details.lon, details.photoUrl, details.placeId, {
          rating: details.rating, reviewCount: details.reviewCount,
          hours: details.hours, priceLevel: details.priceLevel,
        });
        setQuery('');
      } else {
        if (onChange) onChange(result.name, null, null, undefined, result.placeId);
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
      {/* Label — Field와 동일한 높이로 수평 정렬 */}
      {label && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACING.sm,
          paddingBottom: 'var(--spacing-sp40, 4px)',
          minHeight: 'var(--field-label-row-height, 20px)',
        }}>
          <span style={{
            fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)',
            lineHeight: 'var(--typo-caption-2-bold-line-height)',
            color: 'var(--color-on-surface-variant)',
          }}>
            {label}
          </span>
          {required && <span style={{ color: 'var(--color-error)', fontSize: 'var(--typo-caption-2-bold-size)' }}>*</span>}
        </div>
      )}

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: SPACING.md,
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
          onFocus={() => {
            setFocused(true);
            if (results.length > 0) setShowResults(true);
            setTimeout(() => wrapperRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 350);
          }}
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
            border: 'none', background: 'none', cursor: 'pointer', padding: SPACING.xs,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="close" size={14} style={{ opacity: 0.5 }} />
          </button>
        )}
      </div>

      {/* 검색 결과: inlineResults면 모달 하단 영역에 인라인, 아니면 필드 하단 드롭다운 */}
      {showResults && results.length > 0 && (
        <div style={{
          ...(inlineResults
            ? {
                marginTop: SPACING.lg,
                maxHeight: '280px',
                overflowY: 'auto',
                borderRadius: 'var(--radius-md, 8px)',
                background: 'var(--color-surface-container-lowest)',
                border: '1px solid var(--color-outline-variant)',
              }
            : {
                position: 'absolute', left: 0, right: 0, top: '100%', marginTop: SPACING.sm,
                background: 'var(--color-surface-container-lowest)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: s.radius, boxShadow: 'var(--shadow-strong)',
                zIndex: 100, maxHeight: '220px', overflowY: 'auto',
              }),
        }}>
          {results.map((r, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onMouseDown={() => handleSelect(r)}
              onClick={() => handleSelect(r)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(r); } }}
              style={{
                display: 'flex',
                alignItems: inlineResults ? 'flex-start' : 'center',
                gap: SPACING.md,
                padding: inlineResults ? `${SPACING.lg} ${SPACING.xl}` : `${SPACING.ml} ${SPACING.lx}`,
                cursor: 'pointer',
                borderBottom: i < results.length - 1 ? '1px solid var(--color-outline-variant)' : 'none',
                transition: 'background 0.15s ease',
                minHeight: inlineResults ? 44 : undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = inlineResults ? 'var(--color-surface-container-low)' : 'var(--color-surface-container-lowest)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {inlineResults && (
                <span style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-on-surface-variant2)', opacity: 0.7 }}>
                  <Icon name="pin" size={18} />
                </span>
              )}
              <span style={{
                flex: 1, minWidth: 0,
                fontSize: inlineResults ? 'var(--typo-label-1-n---regular-size)' : 'var(--typo-label-2-medium-size)',
                fontWeight: inlineResults ? 'var(--typo-label-1-n---regular-weight)' : 'var(--typo-label-2-medium-weight)',
                color: 'var(--color-on-surface)',
                lineHeight: inlineResults ? 1.4 : undefined,
                ...(inlineResults
                  ? { whiteSpace: 'normal', wordBreak: 'break-word' }
                  : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
              }}>
                {r.name}
              </span>
              <Icon name="chevronRight" size={16} style={{ opacity: 0.35, flexShrink: 0, marginTop: inlineResults ? 2 : 0 }} />
            </div>
          ))}
        </div>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
