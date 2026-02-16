import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Field from '../common/Field';
import ImageViewer from '../common/ImageViewer';
import Toast from '../common/Toast';
import TimePickerDialog from '../common/TimePickerDialog';
import TimetablePreview from '../common/TimetablePreview';
import { FromToStationField } from '../common/FromToStationField';
import AddressToStationPicker from '../dialogs/AddressToStationPicker';
import { getPlacePhotos, getPlaceDetails } from '../../lib/googlePlaces.js';
import { uploadImage, generateImagePath } from '../../services/imageService';
import { getPlaceByNameOrAddress, cachePhotoToRAG } from '../../services/ragService';
import { COLOR, SPACING, RADIUS, TYPE_CONFIG, TYPE_LABELS } from '../../styles/tokens';
import { findRoutesByStations, findBestTrain } from '../../data/timetable';

/* ══════════════════════════════════════
   Helpers (ported from DetailDialog)
   ══════════════════════════════════════ */

const SectionLabel = ({ children }) => (
  <p style={{
    margin: `0 0 ${SPACING.md}`,
    fontSize: 'var(--typo-caption-1-bold-size)',
    fontWeight: 'var(--typo-caption-1-bold-weight)',
    lineHeight: 'var(--typo-caption-1-bold-line-height)',
    color: 'var(--color-on-surface-variant2)',
    letterSpacing: 'var(--typo-caption-1-bold-letter-spacing)',
  }}>
    {children}
  </p>
);

/* ── Hours parsing ── */
const DAY_ORDER = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
const EN_DAY = { Monday: '월요일', Tuesday: '화요일', Wednesday: '수요일', Thursday: '목요일', Friday: '금요일', Saturday: '토요일', Sunday: '일요일' };
const JA_DAY = { '月曜日': '월요일', '火曜日': '화요일', '水曜日': '수요일', '木曜日': '목요일', '金曜日': '금요일', '土曜日': '토요일', '日曜日': '일요일' };
const TODAY_BY_GETDAY = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/** 영어/일본어 시간 텍스트 → 한국어 정규화 */
function normalizeTimeText(t) {
  if (!t) return t;
  const trimmed = t.trim();
  if (/^Closed$/i.test(trimmed) || trimmed === '定休日') return '휴무';
  if (/^Open 24 hours$/i.test(trimmed) || trimmed === '24時間営業') return '24시간 영업';
  if (/^Open$/i.test(trimmed)) return null; // 단독 "Open"은 유효한 영업시간 아님
  if (/^Temporarily closed$/i.test(trimmed)) return '임시 휴업';
  if (/^Permanently closed$/i.test(trimmed)) return '폐업';
  // "Closed" / "Open" 키워드 한국어 변환
  let s = t.replace(/\bClosed\b/gi, '휴무').replace(/\bOpen 24 hours\b/gi, '24시간 영업');
  // 일본어 시간 형식 "11時00分〜23時00分" → "11:00 – 23:00"
  s = s.replace(/(\d{1,2})時(\d{2})分/g, (_, h, m) => `${String(h).padStart(2, '0')}:${m}`);
  s = s.replace(/〜/g, ' – ');
  // AM/PM → 24시간 변환
  s = s.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi, (_, h, m, ap) => {
    let hour = parseInt(h, 10);
    if (ap.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ap.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${m}`;
  });
  return s;
}

/** 영업시간 문자열에 상태 텍스트만 있으면 null, 아니면 한국어로 치환 */
function sanitizeHoursForDisplay(hours) {
  if (!hours || typeof hours !== 'string') return hours;
  const t = hours.trim();
  if (!t) return null;
  // 단독 상태 텍스트 (영어/한국어/일본어)
  if (/^(Closed|Open|Open now|Temporarily closed|Permanently closed|영업\s*중|폐업|임시\s*휴업|営業中|閉店)$/i.test(t)) return null;
  if (/^Open\s*[⋅·•]\s*/i.test(t)) return null;
  // 남은 영어 키워드 치환
  return hours.replace(/\bClosed\b/gi, '휴무').replace(/\bOpen 24 hours\b/gi, '24시간 영업');
}

function parseHoursToDays(hours) {
  if (!hours || typeof hours !== 'string') return null;
  const raw = hours.split(/\s*[;；]\s*/).map((s) => s.trim()).filter(Boolean);
  const parsed = [];
  for (const segment of raw) {
    const match = segment.match(/^(월요일|화요일|수요일|목요일|금요일|토요일|일요일|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|日曜日)\s*[:：]\s*(.+)$/i);
    if (!match) continue;
    let day = match[1];
    if (EN_DAY[day]) day = EN_DAY[day];
    if (JA_DAY[day]) day = JA_DAY[day];
    parsed.push({ day, time: normalizeTimeText(match[2].trim()) });
  }
  if (parsed.length === 0) return null;
  parsed.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
  return parsed;
}

function reorderHoursByPriority(parsed, priorityDay) {
  if (!parsed?.length || !priorityDay) return parsed;
  const pi = DAY_ORDER.indexOf(priorityDay);
  if (pi === -1) return parsed;
  return [...parsed].sort((a, b) => {
    const ai = DAY_ORDER.indexOf(a.day);
    const bi = DAY_ORDER.indexOf(b.day);
    return ((ai - pi + 7) % 7) - ((bi - pi + 7) % 7);
  });
}

function parseStayHours(hoursString) {
  if (!hoursString || typeof hoursString !== 'string') return { checkIn: '15:00', checkOut: '11:00' };
  const parts = hoursString.split(/\s*[\/~]\s*/).map((s) => s.trim()).filter(Boolean);
  const match = (p) => /^\d{1,2}:\d{2}$/.test(p) ? p : null;
  return {
    checkIn: parts[0] ? match(parts[0]) || '15:00' : '15:00',
    checkOut: parts[1] ? match(parts[1]) || '11:00' : '11:00',
  };
}

function formatPriceLevel(pl) {
  if (pl == null) return null;
  if (typeof pl === 'number') {
    if (pl === 0) return '무료';
    return '₩'.repeat(Math.min(4, pl));
  }
  const map = {
    'PRICE_LEVEL_FREE': '무료',
    'PRICE_LEVEL_INEXPENSIVE': '₩',
    'PRICE_LEVEL_MODERATE': '₩₩',
    'PRICE_LEVEL_EXPENSIVE': '₩₩₩',
    'PRICE_LEVEL_VERY_EXPENSIVE': '₩₩₩₩',
  };
  return map[pl] || null;
}

/* Leaflet pin icon for address minimap */
function createAddressPinIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:var(--color-primary);
      border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/* ── Form helpers ── */
const TYPE_OPTIONS = Object.entries(TYPE_CONFIG).map(([key, cfg]) => ({
  value: key, label: TYPE_LABELS[key], icon: cfg.icon,
}));

function TimePicker({ value, onChange, label, error }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const displayText = value && value.match(/^\d{1,2}:\d{2}$/) ? value : '';
  const borderColor = error ? 'var(--color-error)' : 'var(--color-outline-variant)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: '60px' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, paddingBottom: SPACING.sm }}>
          <span style={{ fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)', lineHeight: 'var(--typo-caption-2-bold-line-height)', color: 'var(--color-on-surface-variant)' }}>{label}</span>
        </div>
      )}
      <div role="button" tabIndex={0}
        onClick={() => setDialogOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDialogOpen(true); } }}
        style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, height: 'var(--height-lg, 36px)', padding: '0 var(--spacing-sp140, 14px)', border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-md, 8px)', background: 'var(--color-surface-container-lowest)', cursor: 'pointer', boxSizing: 'border-box' }}
      >
        <span style={{ flex: 1, fontSize: 'var(--typo-label-1-n---regular-size)', color: displayText ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayText || '시간 선택'}
        </span>
        <Icon name="chevronDown" size={18} style={{ flexShrink: 0, opacity: 0.6 }} />
      </div>
      {error && <div style={{ paddingTop: SPACING.sm }}><span style={{ fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-error)' }}>{error}</span></div>}
      <TimePickerDialog open={dialogOpen} value={value || '12:00'} minuteStep={5} onConfirm={(v) => { onChange(v); setDialogOpen(false); }} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

/* ══════════════════════════════════════
   PlaceInfoContent — controlled component
   ══════════════════════════════════════ */
export default function PlaceInfoContent({
  place,         // { name, address, lat, lon, placeId, image, rating, reviewCount, hours, priceLevel, price, tip, type }
  view,          // 'info' | 'form' (controlled by parent)
  onGoToForm,    // () => void — "일정 추가하기" tapped
  onBack,        // () => void — back from current view
  onAdd,         // (item) => void — form submitted
  tripId,
  initialTime,
  onAddToSchedule,
}) {
  const px = SPACING.xxl;
  const contentScrollRef = useRef(null);
  const carouselRef = useRef(null);

  /* ── Image state ── */
  const [viewImage, setViewImage] = useState(null);
  const [ragImage, setRagImage] = useState(null);
  const [placePhotos, setPlacePhotos] = useState([]);
  const [storageImageUrl, setStorageImageUrl] = useState(null);

  /* ── RAG enriched data (fills in missing place info) ── */
  const [ragEnriched, setRagEnriched] = useState(null);

  /* ── Info state ── */
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [copyToast, setCopyToast] = useState(null);

  /* ── Form state ── */
  const [time, setTime] = useState(initialTime || '09:00');
  const [formName, setFormName] = useState(place?.name || '');
  const [formType, setFormType] = useState(place?.type || 'spot');
  const [memo, setMemo] = useState(place?.tip || '');
  const [moveFrom, setMoveFrom] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [loadedTimetable, setLoadedTimetable] = useState(null);
  const [singleStationPicker, setSingleStationPicker] = useState(null);
  const [errors, setErrors] = useState({});
  const [formToast, setFormToast] = useState(null);

  /* ── Derived ── */
  const hasCoords = place?.lat != null && place?.lon != null;
  const isStay = place?.type === 'stay';

  /* ── Reset when place changes ── */
  const placeKey = `${place?.placeId || ''}|${place?.name || ''}|${place?.lat || ''}|${place?.lon || ''}`;
  useEffect(() => {
    setHoursExpanded(false);
    setRagImage(null);
    setRagEnriched(null);
    setPlacePhotos([]);
    setStorageImageUrl(null);
    // Reset form
    setFormName(place?.name || '');
    setFormType(place?.type || 'spot');
    setMemo(place?.tip || '');
    setMoveFrom('');
    setMoveTo('');
    setLoadedTimetable(null);
    setSingleStationPicker(null);
    setErrors({});
    contentScrollRef.current?.scrollTo?.({ top: 0 });
  }, [placeKey]);

  // Also reset time from initialTime when it changes
  useEffect(() => {
    if (initialTime) setTime(initialTime);
  }, [initialTime]);


  /* ── Image computation (same as DetailDialog) ── */
  const mainImage = place?.image;
  const displayImages = useMemo(() => {
    const imgs = [];
    if (mainImage) imgs.push(mainImage);
    if (ragImage && !imgs.includes(ragImage)) imgs.push(ragImage);
    if (imgs.length === 0) {
      for (const url of placePhotos) {
        if (imgs.length >= 3) break;
        if (url && !imgs.includes(url)) imgs.push(url);
      }
    }
    return imgs.slice(0, 3);
  }, [mainImage, ragImage, placePhotos]);

  /* ── RAG data auto-load ── */
  useEffect(() => {
    const name = place?.name || '';
    const address = place?.address || '';
    if (!name.trim() && !address.trim()) { setRagImage(null); setRagEnriched(null); return; }
    let cancelled = false;

    getPlaceByNameOrAddress({ name, address }).then((p) => {
      if (cancelled) return;
      if (!p) {
        setRagImage(null);
        // Don't reset ragEnriched — Google Places effect may have already set data
        return;
      }
      if (!mainImage && p.image_url) setRagImage(p.image_url);
      const enriched = {};
      if (!place?.address && p.address) enriched.address = p.address;
      if (place?.rating == null && p.rating != null) enriched.rating = p.rating;
      if (place?.reviewCount == null && p.review_count != null) enriched.reviewCount = p.review_count;
      if (p.opening_hours && !place?.hours) enriched.hours = p.opening_hours;
      if (!place?.placeId && p.google_place_id) enriched.placeId = p.google_place_id;
      if (place?.lat == null && p.lat != null) enriched.lat = p.lat;
      if (place?.lon == null && p.lon != null) enriched.lon = p.lon;
      if (!cancelled) setRagEnriched((prev) => {
        const merged = { ...(prev || {}), ...enriched };
        return Object.keys(merged).length > 0 ? merged : null;
      });
    }).catch(() => { if (!cancelled) { setRagImage(null); setRagEnriched((prev) => prev); } });
    return () => { cancelled = true; };
  }, [place?.name, place?.address, mainImage]);

  /* ── Google Places: placeId가 있으면 항상 상세 정보(영업시간 등) 가져오기 ── */
  const effectivePlaceId = place?.placeId || ragEnriched?.placeId;

  useEffect(() => {
    if (!effectivePlaceId) return;
    let cancelled = false;
    getPlaceDetails(effectivePlaceId).then((gd) => {
      if (cancelled || !gd) return;
      setRagEnriched((prev) => {
        const next = { ...(prev || {}) };
        if (gd.hours && !place?.hours && !prev?.hours) next.hours = gd.hours;
        if (!place?.address && !prev?.address && gd.formatted_address) next.address = gd.formatted_address;
        if (place?.rating == null && !prev?.rating && gd.rating != null) next.rating = gd.rating;
        if (place?.reviewCount == null && !prev?.reviewCount && gd.reviewCount != null) next.reviewCount = gd.reviewCount;
        if (place?.lat == null && !prev?.lat && gd.lat != null) next.lat = gd.lat;
        if (place?.lon == null && !prev?.lon && gd.lon != null) next.lon = gd.lon;
        if (!mainImage && !ragImage && gd.photoUrl) setRagImage(gd.photoUrl);
        return Object.keys(next).length > 0 ? next : null;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [effectivePlaceId]);

  /* ── placePhotos fetch ── */
  useEffect(() => {
    const pid = place?.placeId || ragEnriched?.placeId;
    if (!pid) { setPlacePhotos([]); return; }
    if (mainImage) return;
    if (ragImage) return;
    let cancelled = false;
    getPlacePhotos(pid, 3).then(async (urls) => {
      if (cancelled || !urls.length) return;
      if (!cancelled) setPlacePhotos(urls);
      try { await cachePhotoToRAG(pid); } catch {}
    }).catch(() => { if (!cancelled) setPlacePhotos([]); });
    return () => { cancelled = true; };
  }, [place?.placeId, ragEnriched?.placeId, mainImage, ragImage]);

  /* ── Background: upload Google photo to Storage ── */
  useEffect(() => {
    if (!place?.image) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(place.image);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const file = new File([blob], 'place.jpg', { type: 'image/jpeg' });
        const path = tripId ? generateImagePath(tripId, 'items') : `places/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const publicUrl = await uploadImage(file, path);
        if (!cancelled) setStorageImageUrl(publicUrl);
      } catch (e) { console.warn('[PlaceInfoContent] Photo storage upload failed:', e); }
    })();
    return () => { cancelled = true; };
  }, [place?.image, tripId]);


  /* ── Form handlers ── */
  const handleSingleStationSelect = (value) => {
    const isAddress = value && typeof value === 'object' && value.type === 'address';
    const displayName = isAddress ? value.address : value;
    const from = singleStationPicker.mode === 'from' ? displayName : moveFrom;
    const to = singleStationPicker.mode === 'to' ? displayName : moveTo;
    setSingleStationPicker(null);
    setMoveFrom(from);
    setMoveTo(to);
    if (!formName.trim()) setFormName(`${from} → ${to}`);
    if (isAddress) { setLoadedTimetable(null); return; }
    const routes = findRoutesByStations(from, to);
    const route = routes[0] || null;
    if (route) {
      const bestIdx = findBestTrain(route.trains, time);
      setLoadedTimetable({ _routeId: route.id, station: route.station, direction: route.direction, trains: route.trains.map((t, i) => ({ ...t, picked: i === bestIdx })) });
    } else { setLoadedTimetable(null); }
  };

  const handleSave = () => {
    const hasTime = !!time.trim();
    const hasName = !!formName.trim();
    if (!hasTime || !hasName) {
      const nextErrors = {};
      if (!hasTime) nextErrors.time = '시간을 선택해주세요';
      if (!hasName) nextErrors.desc = '일정명을 입력해주세요';
      setErrors(nextErrors);
      setFormToast({ message: !hasTime && !hasName ? '시간과 일정명을 입력해주세요' : !hasTime ? '시간을 선택해주세요' : '일정명을 입력해주세요', icon: 'info' });
      return;
    }
    setErrors({});
    const categoryLabel = TYPE_LABELS[formType] || '정보';
    const timetable = (formType === 'move' && loadedTimetable?.trains?.length) ? loadedTimetable : null;
    const imageUrl = storageImageUrl || place?.image || null;
    const newItem = {
      time: time.trim(), desc: formName.trim(), type: formType,
      ...(formType === 'move' && moveFrom ? { moveFrom } : {}),
      ...(formType === 'move' && moveTo ? { moveTo } : {}),
      _custom: true,
      detail: {
        name: formName.trim(), category: categoryLabel,
        ...(place?.address?.trim() ? { address: place.address.trim() } : {}),
        ...(place?.lat != null ? { lat: place.lat } : {}),
        ...(place?.lon != null ? { lon: place.lon } : {}),
        ...(memo.trim() ? { tip: memo.trim() } : {}),
        ...(imageUrl ? { image: imageUrl } : {}),
        ...(place?.placeId ? { placeId: place.placeId } : {}),
        ...(place?.rating != null ? { rating: place.rating } : {}),
        ...(place?.reviewCount != null ? { reviewCount: place.reviewCount } : {}),
        ...(place?.hours ? { hours: place.hours } : {}),
        ...(place?.priceLevel != null ? { priceLevel: place.priceLevel } : {}),
        ...(timetable ? { timetable } : {}),
      },
    };
    onAdd(newItem);
  };

  const handleCopyAddress = useCallback(() => {
    if (!place?.address) return;
    navigator.clipboard.writeText(place.address).then(() => {
      setCopyToast({ message: '주소가 복사되었습니다' });
    }).catch(() => {});
  }, [place?.address]);

  /* ══════════════════════════
     INFO VIEW
     ══════════════════════════ */
  if (view === 'info') {
    // Merge place data with RAG-enriched data for display
    // ragEnriched의 undefined/null 값이 place의 기존 값을 덮어쓰지 않도록 필터링
    const safeEnriched = ragEnriched
      ? Object.fromEntries(Object.entries(ragEnriched).filter(([k, v]) =>
          v != null && !(k === 'hours' && typeof v === 'string' && !v.trim())))
      : null;
    const merged = safeEnriched ? { ...place, ...safeEnriched } : { ...place };
    // place.hours(챗봇/엣지함수 제공)는 최우선 — enriched 데이터로 덮어쓰이지 않도록 보호
    if (place?.hours) merged.hours = place.hours;
    const ep = merged;
    const displayRating = ep?.rating != null ? ep.rating : null;
    const displayReviewCount = ep?.reviewCount != null ? ep.reviewCount : null;
    const hoursParsed = ep?.hours && !isStay ? parseHoursToDays(ep.hours) : null;
    const todayKorean = TODAY_BY_GETDAY[new Date().getDay()];
    const hoursParsedOrdered = hoursParsed ? reorderHoursByPriority(hoursParsed, todayKorean) : null;
    const showHoursGoogleStyle = !isStay && hoursParsedOrdered && hoursParsedOrdered.length > 0;
    const stayParsed = isStay && ep?.hours ? parseStayHours(ep.hours) : null;
    const priceLevelText = formatPriceLevel(ep?.priceLevel);
    const priceText = ep?.price || priceLevelText;

    const infoRows = [
      ep?.tip ? { field: 'tip', icon: 'info', label: '소개' } : null,
      ep?.hours ? { field: 'hours', icon: 'clock', label: isStay ? '체크인·체크아웃' : '영업시간' } : null,
      ep?.address ? { field: 'address', icon: 'pin', label: '주소' } : null,
      priceText ? { field: 'price', icon: 'pricetag', label: '가격' } : null,
    ].filter(Boolean);

    const renderInfoRow = (row, isLast) => {
      const rowStyle = {
        display: 'flex', alignItems: 'flex-start', gap: SPACING.lg,
        padding: `${SPACING.lg} 0`,
        borderBottom: !isLast ? '1px solid var(--color-outline-variant)' : 'none',
        background: 'transparent',
      };

      /* ── Hours: expandable Google style ── */
      if (row.field === 'hours' && isStay) {
        return (
          <div key={row.field} style={rowStyle}>
            <Icon name="clock" size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0, marginTop: SPACING.xs }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant2)', marginBottom: SPACING.xs }}>체크인·체크아웃</div>
              <div style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface)' }}>
                {stayParsed ? `체크인 ${stayParsed.checkIn} · 체크아웃 ${stayParsed.checkOut}` : ep.hours}
              </div>
            </div>
          </div>
        );
      }
      if (row.field === 'hours' && showHoursGoogleStyle) {
        return (
          <div key={row.field} style={{ padding: `${SPACING.lg} 0`, borderBottom: !isLast ? '1px solid var(--color-outline-variant)' : 'none' }}>
            <div role="button" tabIndex={0}
              onClick={() => setHoursExpanded((e) => !e)}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setHoursExpanded((e) => !e); } }}
              style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg, cursor: 'pointer', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', padding: 0, font: 'inherit', color: 'inherit' }}
            >
              <Icon name="clock" size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant2)', marginBottom: SPACING.xs }}>영업시간</div>
                <div style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface)' }}>
                  {hoursParsedOrdered[0].day} {hoursParsedOrdered[0].time}
                  {hoursParsedOrdered[0].day === todayKorean && (
                    <span style={{ marginLeft: SPACING.sm, fontSize: 'var(--typo-caption-1-bold-size)', color: 'var(--color-primary)' }}>· 오늘</span>
                  )}
                </div>
              </div>
              <Icon name={hoursExpanded ? 'chevronUp' : 'chevronDown'} size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0 }} />
            </div>
            {hoursExpanded && (
              <div style={{ marginTop: SPACING.md, marginLeft: SPACING.xxxxl, display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
                {hoursParsedOrdered.map(({ day, time: t }) => (
                  <div key={day} style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.lg }}>
                    <span style={{ color: 'var(--color-on-surface-variant2)' }}>
                      {day}
                      {day === todayKorean && <span style={{ marginLeft: SPACING.sm, fontSize: 'var(--typo-caption-1-bold-size)', color: 'var(--color-primary)' }}>· 오늘</span>}
                    </span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      if (row.field === 'hours') {
        // Simple hours display (not parseable to days)
        const sanitizedHours = sanitizeHoursForDisplay(ep.hours);
        if (!sanitizedHours) return null; // 상태 텍스트만 있으면 표시 안 함
        return (
          <div key={row.field} style={rowStyle}>
            <Icon name="clock" size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0, marginTop: SPACING.xs }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant2)', marginBottom: SPACING.xs }}>영업시간</div>
              <div style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface)' }}>{sanitizedHours}</div>
            </div>
          </div>
        );
      }

      /* ── Address: minimap 80x80 + tap to copy ── */
      if (row.field === 'address') {
        const epHasCoords = ep?.lat != null && ep?.lon != null;
        const copyAddr = () => {
          if (!ep?.address) return;
          navigator.clipboard.writeText(ep.address).then(() => {
            setCopyToast({ message: '주소가 복사되었습니다' });
          }).catch(() => {});
        };
        return (
          <div key={row.field} role="button" tabIndex={0} onClick={copyAddr}
            style={{ ...rowStyle, cursor: 'pointer' }}
          >
            <Icon name="pin" size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0, marginTop: SPACING.xs }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant2)', marginBottom: SPACING.xs }}>주소</div>
              <div style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface)', wordBreak: 'break-word' }}>{ep.address}</div>
            </div>
            {epHasCoords && (
              <div key={`minimap-${ep.lat}-${ep.lon}`} style={{ width: 80, height: 80, borderRadius: RADIUS.md, overflow: 'hidden', flexShrink: 0 }}>
                <MapContainer center={[ep.lat, ep.lon]} zoom={15} style={{ height: '100%', width: '100%' }}
                  zoomControl={false} attributionControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[ep.lat, ep.lon]} icon={createAddressPinIcon()} />
                </MapContainer>
              </div>
            )}
          </div>
        );
      }

      /* ── Tip / Description ── */
      if (row.field === 'tip') {
        return (
          <div key={row.field} style={rowStyle}>
            <Icon name="info" size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0, marginTop: SPACING.xs }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant2)', marginBottom: SPACING.xs }}>소개</div>
              <div style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ep.tip}</div>
            </div>
          </div>
        );
      }

      /* ── Price ── */
      if (row.field === 'price') {
        return (
          <div key={row.field} style={rowStyle}>
            <Icon name="pricetag" size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0, marginTop: SPACING.xs }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant2)', marginBottom: SPACING.xs }}>가격</div>
              <div style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface)' }}>{priceText}</div>
            </div>
          </div>
        );
      }
      return null;
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* ── Fixed header: name + rating ── */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ padding: `${SPACING.lg} ${px} ${SPACING.md}` }}>
            {/* Name row (with back button) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                {onBack && <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onBack} style={{ flexShrink: 0 }} />}
                <h3 style={{
                  margin: 0, flex: '0 1 auto', minWidth: 0,
                  fontSize: 'var(--typo-heading-3-bold-size)', fontWeight: 'var(--typo-heading-3-bold-weight)',
                  color: 'var(--color-on-surface)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {place?.name || ''}
                </h3>
              </div>
            </div>

            {/* Rating */}
            {displayRating != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0, fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', lineHeight: 1, color: 'var(--color-on-surface-variant)' }}>
                  {[1, 2, 3, 4, 5].map((i) => {
                    const filled = i <= Math.min(5, Math.round(Number(displayRating)));
                    return <Icon key={i} name={filled ? 'star' : 'starOutlined'} size={14} />;
                  })}
                  <span style={{ marginLeft: SPACING.xs }}>{Number(displayRating).toFixed(1)}</span>
                </span>
                {displayReviewCount != null && (
                  <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', lineHeight: 1, color: 'var(--color-on-surface-variant2)' }}>
                    ({displayReviewCount})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Image carousel ── */}
          {displayImages.length > 0 && (
            <div style={{ flexShrink: 0, position: 'relative', padding: `${SPACING.sm} ${px} 0` }}>
              {displayImages.length === 1 ? (
                <div onClick={() => setViewImage(displayImages[0])}
                  style={{ width: '100%', height: '180px', borderRadius: RADIUS.md, overflow: 'hidden', cursor: 'zoom-in', background: COLOR.surfaceLowest }}>
                  <img src={displayImages[0]} alt={place?.name} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
                </div>
              ) : (
                <div ref={carouselRef} style={{
                  width: '100%', minWidth: 0, overflowX: 'auto', overflowY: 'hidden',
                  display: 'flex', gap: SPACING.md, scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overscrollBehavior: 'contain', paddingBottom: SPACING.sm,
                }}>
                  {displayImages.map((img, i) => (
                    <div key={i} onClick={() => setViewImage(img)} style={{
                      flexShrink: 0, width: '90%', height: '180px', scrollSnapAlign: 'start',
                      borderRadius: RADIUS.md, overflow: 'hidden', cursor: 'zoom-in', background: COLOR.surfaceLowest,
                    }}>
                      <img src={img} alt={`${place?.name} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Scrollable content ── */}
        <div ref={contentScrollRef} style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch', touchAction: 'pan-y',
          padding: `${SPACING.sm} ${px} ${SPACING.xl}`,
        }}>
          {infoRows.map((row, i) => renderInfoRow(row, i === infoRows.length - 1))}
          {infoRows.length === 0 && (
            <p style={{ padding: `${SPACING.xxxl} 0`, textAlign: 'center', color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-body-2-size)' }}>정보 없음</p>
          )}
        </div>

        {/* ── "일정 추가하기" button ── */}
        <div style={{ flexShrink: 0, padding: `${SPACING.md} ${px}`, borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)' }}>
          <Button variant="primary" size="xlg" fullWidth onClick={onGoToForm}>일정 추가하기</Button>
        </div>

        {/* Toasts & overlays */}
        {copyToast && <Toast message={copyToast.message} onDone={() => setCopyToast(null)} />}
        <ImageViewer src={viewImage} alt={place?.name} onClose={() => setViewImage(null)} />
      </div>
    );
  }

  /* ══════════════════════════
     FORM VIEW
     ══════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ── Form header ── */}
      <div style={{
        flexShrink: 0,
        padding: `${SPACING.md} ${px} ${SPACING.lg}`,
        borderBottom: '1px solid var(--color-outline-variant)',
        display: 'flex', alignItems: 'center', gap: SPACING.md,
      }}>
        {onBack && <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onBack} style={{ flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {place?.name && (
            <p style={{ margin: 0, fontSize: 'var(--typo-label-1-n---bold-size)', fontWeight: 600, color: 'var(--color-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {place.name}
            </p>
          )}
          {place?.address && (
            <p style={{ margin: '1px 0 0', fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {place.address}
            </p>
          )}
        </div>
      </div>

      {/* ── Scrollable form ── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch', touchAction: 'pan-y',
      }}>
        <div style={{ padding: `${SPACING.lg} ${px} ${SPACING.xxxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
          {/* Category chips */}
          <div>
            <p style={{ margin: `0 0 ${SPACING.sm}`, fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)' }}>카테고리</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm }}>
              {TYPE_OPTIONS.map((opt) => {
                const selected = formType === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => setFormType(opt.value)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: SPACING.xs,
                      padding: `${SPACING.sm} ${SPACING.lg}`, borderRadius: RADIUS.full,
                      border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                      background: selected ? 'var(--color-primary-container)' : 'transparent',
                      color: selected ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                      fontSize: '12px', fontWeight: selected ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}>
                    <Icon name={opt.icon} size={11} />{opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time + Name */}
          <div style={{ display: 'flex', gap: SPACING.md, alignItems: 'flex-start' }}>
            <div style={{ width: '120px', flexShrink: 0 }}>
              <TimePicker label="시간" value={time} onChange={setTime} error={errors.time} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Field label="일정명" size="lg" variant="outlined" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="예: 캐널시티 라멘스타디움" error={errors.desc} />
            </div>
          </div>

          {/* Memo */}
          <Field as="textarea" label="메모" size="lg" variant="outlined" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="추천 메뉴, 주의사항, 꿀팁 등" rows={3} />

          {/* Timetable (move type) */}
          {formType === 'move' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ paddingBottom: SPACING.sm, minHeight: 'var(--field-label-row-height, 20px)', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)' }}>시간표</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
                <FromToStationField label="출발지" value={moveFrom} placeholder="출발지 선택" onClick={() => setSingleStationPicker({ mode: 'from' })} />
                <FromToStationField label="도착지" value={moveTo} placeholder="도착지 선택" onClick={() => setSingleStationPicker({ mode: 'to' })} />
              </div>
              {moveFrom && moveTo && !loadedTimetable?.trains?.length && (
                <p style={{ margin: `${SPACING.md} 0 0`, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)', textAlign: 'center' }}>해당 구간의 시간표가 없습니다</p>
              )}
              {loadedTimetable?.trains?.length > 0 && (
                <div style={{ marginTop: SPACING.md }}><TimetablePreview timetable={loadedTimetable} variant="compact" /></div>
              )}
              {singleStationPicker && (
                <AddressToStationPicker mode={singleStationPicker.mode} fixedStation={singleStationPicker.mode === 'from' ? (moveTo || '') : (moveFrom || '')} onClose={() => setSingleStationPicker(null)} onSelect={handleSingleStationSelect} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Save button ── */}
      <div style={{ flexShrink: 0, padding: `${SPACING.md} ${px}`, borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)' }}>
        <Button variant="primary" size="xlg" fullWidth onClick={handleSave}>추가</Button>
      </div>

      {formToast && <Toast message={formToast.message} icon={formToast.icon} onDone={() => setFormToast(null)} />}
    </div>
  );
}
