import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Field from '../common/Field';
import Tab from '../common/Tab';
import ImageViewer from '../common/ImageViewer';
import Skeleton from '../common/Skeleton';
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
import {
  TODAY_BY_GETDAY, parseHoursToDays, reorderHoursByPriority,
  parseStayHours, sanitizeHoursForDisplay,
} from '../../utils/hoursParser';
import { buildPlaceDetail } from '../../utils/itemBuilder';

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
      border:3px solid var(--color-surface);box-shadow:0 2px 8px var(--color-shadow, rgba(0,0,0,0.25));
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
  onAdd,         // (item, dayIdx?) => void — form submitted
  tripId,
  initialTime,
  onAddToSchedule,
  allDays,       // Day 배열 (Day 선택 Tab 표시용)
  selectedDayIdx, // 현재 선택된 Day 인덱스 (초기값)
}) {
  const px = SPACING.xxl;
  const contentScrollRef = useRef(null);
  const carouselRef = useRef(null);

  /* ── Image state ── */
  const [viewImage, setViewImage] = useState(null);
  const [ragImages, setRagImages] = useState([]);
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
  const [formDayIdx, setFormDayIdx] = useState(selectedDayIdx ?? 0);

  /* ── Day Tab ── */
  const hasDayTabs = Array.isArray(allDays) && allDays.length > 1;
  const dayTabItems = useMemo(() => {
    if (!hasDayTabs) return [];
    return allDays.map((d, i) => ({ label: `D${d.day ?? i + 1}`, value: i }));
  }, [allDays, hasDayTabs]);

  // Sync formDayIdx when selectedDayIdx prop changes
  useEffect(() => {
    if (selectedDayIdx != null) setFormDayIdx(selectedDayIdx);
  }, [selectedDayIdx]);

  /* ── Derived ── */
  const hasCoords = place?.lat != null && place?.lon != null;
  const isStay = place?.type === 'stay';

  /* ── Reset when place changes ── */
  const placeKey = `${place?.placeId || ''}|${place?.name || ''}|${place?.lat || ''}|${place?.lon || ''}`;
  useEffect(() => {
    setHoursExpanded(false);
    setRagImages([]);
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


  /* ── Image computation ── */
  const mainImage = place?.image;
  const displayImages = useMemo(() => {
    const imgs = [];
    // 1순위: place.image (edge function 대표 이미지)
    if (mainImage) imgs.push(mainImage);
    // 2순위: RAG에서 가져온 image_urls
    // mainImage가 있으면 ragImages[0] 스킵 (같은 대표 사진의 URL이 다를 수 있어 시각적 중복 방지)
    const ragStart = (mainImage && ragImages.length > 0) ? 1 : 0;
    for (let i = ragStart; i < ragImages.length; i++) {
      if (imgs.length >= 3) break;
      const url = ragImages[i];
      if (url && !imgs.includes(url)) imgs.push(url);
    }
    // 3순위: fallback — RAG에도 없으면 Google에서 직접 (거의 발생 안 함)
    if (imgs.length === 0) {
      for (const url of placePhotos) {
        if (imgs.length >= 3) break;
        if (url && !imgs.includes(url)) imgs.push(url);
      }
    }
    return imgs.slice(0, 3);
  }, [mainImage, ragImages, placePhotos]);

  const [loadedImageIndices, setLoadedImageIndices] = useState(() => new Set());
  useEffect(() => {
    setLoadedImageIndices(new Set());
  }, [placeKey, displayImages.length, displayImages[0]]);

  /* ── RAG data auto-load ── */
  useEffect(() => {
    const name = place?.name || '';
    const address = place?.address || '';
    if (!name.trim() && !address.trim()) { setRagImages([]); setRagEnriched(null); return; }
    let cancelled = false;

    getPlaceByNameOrAddress({ name, address, placeId: place?.placeId }).then((p) => {
      if (cancelled) return;
      if (!p) {
        setRagImages([]);
        // Don't reset ragEnriched — Google Places effect may have already set data
        return;
      }
      // image_urls 배열 우선, 없으면 image_url 단일값 사용
      const imgs = p.image_urls?.length ? p.image_urls : (p.image_url ? [p.image_url] : []);
      if (imgs.length > 0) setRagImages(imgs);
      const enriched = {};
      if (!place?.address && p.address) enriched.address = p.address;
      if (!place?.shortAddress && p.short_address) enriched.shortAddress = p.short_address;
      if (place?.rating == null && p.rating != null) enriched.rating = p.rating;
      if (place?.reviewCount == null && p.review_count != null) enriched.reviewCount = p.review_count;
      if (p.opening_hours && !place?.hours) enriched.hours = p.opening_hours;
      if (p.business_status && !place?.businessStatus) enriched.businessStatus = p.business_status;
      if (!place?.placeId && p.google_place_id) enriched.placeId = p.google_place_id;
      if (place?.lat == null && p.lat != null) enriched.lat = p.lat;
      if (place?.lon == null && p.lon != null) enriched.lon = p.lon;
      if (!cancelled) setRagEnriched((prev) => {
        const merged = { ...(prev || {}), ...enriched };
        return Object.keys(merged).length > 0 ? merged : null;
      });
    }).catch(() => { if (!cancelled) { setRagImages([]); setRagEnriched((prev) => prev); } });
    return () => { cancelled = true; };
  }, [place?.name, place?.address, mainImage]);

  /* ── Google Places: placeId가 있으면 항상 상세 정보(영업시간 등) 가져오기 ── */
  const effectivePlaceId = place?.placeId || ragEnriched?.placeId;

  useEffect(() => {
    if (!effectivePlaceId) return;
    // 이미 핵심 데이터(hours, address, rating)가 있으면 Google API 호출 스킵 (비용 절감)
    const hasHours = !!(place?.hours || ragEnriched?.hours);
    const hasAddress = !!(place?.address || ragEnriched?.address);
    const hasRating = place?.rating != null || ragEnriched?.rating != null;
    const hasImage = !!(mainImage || ragImages.length > 0);
    if (hasHours && hasAddress && hasRating && hasImage) return;
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
        if (!mainImage && ragImages.length === 0 && gd.photoUrl) setRagImages([gd.photoUrl]);
        return Object.keys(next).length > 0 ? next : null;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [effectivePlaceId, place?.hours, place?.address, place?.rating, ragEnriched?.hours, ragEnriched?.address, ragEnriched?.rating, mainImage, ragImages]);

  /* ── placePhotos fetch (fallback: RAG에도 이미지 없을 때만) ── */
  useEffect(() => {
    const pid = place?.placeId || ragEnriched?.placeId;
    if (!pid) { setPlacePhotos([]); return; }
    if (mainImage) return;
    if (ragImages.length > 0) return;
    let cancelled = false;
    getPlacePhotos(pid, 3).then(async (urls) => {
      if (cancelled || !urls.length) return;
      if (!cancelled) setPlacePhotos(urls);
      try { await cachePhotoToRAG(pid); } catch {}
    }).catch(() => { if (!cancelled) setPlacePhotos([]); });
    return () => { cancelled = true; };
  }, [place?.placeId, ragEnriched?.placeId, mainImage, ragImages]);

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
    const timetable = (formType === 'move' && loadedTimetable?.trains?.length) ? loadedTimetable : null;
    const imageUrl = storageImageUrl || place?.image || null;
    // place prop + ragEnriched 병합 (place 우선)
    const ep = ragEnriched ? { ...ragEnriched, ...place } : { ...place };
    const detail = buildPlaceDetail(
      { ...ep, name: formName.trim(), image: imageUrl, type: formType },
      { tip: memo.trim() || null, timetable },
    );
    const newItem = {
      time: time.trim(), desc: formName.trim(), type: formType,
      ...(formType === 'move' && moveFrom ? { moveFrom } : {}),
      ...(formType === 'move' && moveTo ? { moveTo } : {}),
      _custom: true,
      detail,
    };
    onAdd(newItem, formDayIdx);
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

      /* ── Address: minimap 80x80 + tap to copy (full address) ── */
      if (row.field === 'address') {
        const epHasCoords = ep?.lat != null && ep?.lon != null;
        const displayAddr = ep?.shortAddress || ep?.address;
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
              <div style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface)', wordBreak: 'break-word' }}>{displayAddr}</div>
            </div>
            {epHasCoords && (
              <div key={`minimap-${ep.lat}-${ep.lon}`} style={{ width: 80, height: 80, borderRadius: RADIUS.md, overflow: 'hidden', flexShrink: 0 }}>
                <MapContainer center={[ep.lat, ep.lon]} zoom={15} style={{ height: '100%', width: '100%' }}
                  zoomControl={false} attributionControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} className="map-pins-light">
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
                {ep?.businessStatus === 'CLOSED_TEMPORARILY' && (
                  <span style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center',
                    padding: `${SPACING.xs} ${SPACING.md}`, borderRadius: RADIUS.full,
                    border: '1px solid var(--color-error-container)', background: 'var(--color-error-container)', color: 'var(--color-on-error-container)',
                    fontSize: 'var(--typo-caption-2-regular-size)', fontWeight: 600, whiteSpace: 'nowrap',
                  }}>임시 휴업</span>
                )}
                {ep?.businessStatus === 'CLOSED_PERMANENTLY' && (
                  <span style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center',
                    padding: `${SPACING.xs} ${SPACING.md}`, borderRadius: RADIUS.full,
                    border: '1px solid var(--color-error-container)', background: 'var(--color-error-container)', color: 'var(--color-on-error-container)',
                    fontSize: 'var(--typo-caption-2-regular-size)', fontWeight: 600, whiteSpace: 'nowrap',
                  }}>폐업</span>
                )}
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

          {/* ── Image carousel (모든 이미지 로드 시까지 스켈레톤) ── */}
          {displayImages.length > 0 && (() => {
            const allLoaded = loadedImageIndices.size === displayImages.length;
            return (
            <div style={{ flexShrink: 0, position: 'relative', padding: `${SPACING.sm} ${px} 0` }}>
              {displayImages.length === 1 ? (
                <div onClick={() => setViewImage(displayImages[0])}
                  style={{ width: '100%', height: '180px', borderRadius: RADIUS.md, overflow: 'hidden', cursor: 'zoom-in', background: COLOR.surfaceLowest, position: 'relative' }}>
                  {!allLoaded && <Skeleton style={{ position: 'absolute', inset: 0, borderRadius: RADIUS.md }} />}
                  <img
                    src={displayImages[0]}
                    alt={place?.name}
                    onLoad={() => setLoadedImageIndices((prev) => new Set(prev).add(0))}
                    style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', opacity: allLoaded ? 1 : 0, transition: 'opacity 0.2s ease' }}
                  />
                </div>
              ) : (
                <div ref={carouselRef} style={{
                  width: '100%', minWidth: 0, overflowX: 'auto', overflowY: 'hidden',
                  display: 'flex', gap: SPACING.md, scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overscrollBehavior: 'contain', paddingBottom: SPACING.sm,
                }}>
                  {displayImages.map((img, i) => {
                    const loaded = loadedImageIndices.has(i);
                    return (
                    <div key={`${img}-${i}`} onClick={() => setViewImage(img)} style={{
                      flexShrink: 0, width: '90%', height: '180px', scrollSnapAlign: 'start',
                      borderRadius: RADIUS.md, overflow: 'hidden', cursor: 'zoom-in', background: COLOR.surfaceLowest, position: 'relative',
                    }}>
                      {!loaded && <Skeleton style={{ position: 'absolute', inset: 0, borderRadius: RADIUS.md }} />}
                      <img
                        src={img}
                        alt={`${place?.name} ${i + 1}`}
                        onLoad={() => setLoadedImageIndices((prev) => new Set(prev).add(i))}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s ease' }}
                      />
                    </div>
                  );})}
                </div>
              )}
            </div>
            );
          })()}

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
        {onGoToForm && (
          <div style={{ flexShrink: 0, padding: `${SPACING.md} ${px}`, borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)' }}>
            <Button variant="primary" size="xlg" fullWidth onClick={onGoToForm}>일정 추가하기</Button>
          </div>
        )}

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
          {(place?.shortAddress || place?.address) && (
            <p style={{ margin: '1px 0 0', fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {place.shortAddress || place.address}
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
          {/* Day selector */}
          {hasDayTabs && (
            <div>
              <p style={{ margin: `0 0 ${SPACING.sm}`, fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)' }}>추가할 Day</p>
              <Tab items={dayTabItems} value={formDayIdx} onChange={setFormDayIdx} variant="pill" size="sm" />
            </div>
          )}

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
