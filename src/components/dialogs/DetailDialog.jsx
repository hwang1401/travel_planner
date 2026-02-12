import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import ConfirmDialog from '../common/ConfirmDialog';
import ImageViewer from '../common/ImageViewer';
import CategoryBadge from '../common/CategoryBadge';
import TimetablePreview from '../common/TimetablePreview';
import NearbyPlaceCard from './NearbyPlaceCard';
import Skeleton from '../common/Skeleton';
import CenterPopup from '../common/CenterPopup';
import TimePickerDialog from '../common/TimePickerDialog';
import ChipSelector from '../common/ChipSelector';
import ImagePicker from '../common/ImagePicker';
import AddressSearch from '../common/AddressSearch';
import StationPickerModal from './StationPickerModal';
import TimetableSearchDialog from './TimetableSearchDialog';
import { getNearbyPlaces } from '../../services/ragService';
import { COLOR, SPACING, RADIUS, TYPE_CONFIG, TYPE_LABELS } from '../../styles/tokens';
import { TIMETABLE_DB, findBestTrain, matchByFromTo, findRoutesByStations } from '../../data/timetable';

/**
 * ── DetailDialog (풀스크린) ──
 * 여행 일정 아이템 상세 — 풀스크린 모달.
 *
 * 구조:
 *   고정 헤더 → 칩 네비게이션 → 콘텐츠 (인라인 수정 가능) → 하단 고정 액션
 *   스와이프로 이전/다음 아이템 이동 유지.
 */

/* ── 내부 헬퍼 ── */
const SectionLabel = ({ children }) => (
  <p style={{
    margin: "0 0 var(--spacing-sp80)",
    fontSize: "var(--typo-caption-1-bold-size)",
    fontWeight: "var(--typo-caption-1-bold-weight)",
    lineHeight: "var(--typo-caption-1-bold-line-height)",
    color: "var(--color-on-surface-variant2)",
    letterSpacing: "var(--typo-caption-1-bold-letter-spacing)",
  }}>
    {children}
  </p>
);

const SectionWrap = ({ label, children, px }) => (
  <div style={{ padding: `var(--spacing-sp200) ${px} 0` }}>
    {label && <SectionLabel>{label}</SectionLabel>}
    {children}
  </div>
);

/** 탭 가능 필드 행 */
const TappableRow = ({ label, value, placeholder, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: `${SPACING.lg} 0`,
      border: 'none', background: 'transparent', cursor: 'pointer',
      textAlign: 'left', fontFamily: 'inherit',
    }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant2)', marginBottom: SPACING.xs }}>{label}</div>
      <div style={{
        fontSize: 'var(--typo-label-1-n---regular-size)',
        color: value ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
        whiteSpace: 'pre-line', wordBreak: 'break-word',
      }}>
        {value || placeholder || '탭하여 입력'}
      </div>
    </div>
    <Icon name="chevronRight" size={14} style={{ opacity: 0.3, flexShrink: 0, marginLeft: SPACING.md }} />
  </button>
);

/* RAG place → detail shape */
function ragPlaceToDetail(place) {
  if (!place) return null;
  const cat = TYPE_LABELS[place.type];
  const tags = place.tags;
  const highlights = Array.isArray(tags) && tags.length > 0 ? tags
    : typeof tags === "string" && tags.trim() ? [tags.trim()] : [];
  return {
    name: place.name_ko, address: place.address, lat: place.lat, lon: place.lon,
    image: place.image_url, placeId: place.google_place_id,
    categories: cat ? [cat] : [], tip: null,
    highlights: highlights.length > 0 ? highlights : null,
    _item: { desc: place.name_ko, sub: place.description || "" },
  };
}

const catMap = { food: "식사", spot: "관광", shop: "쇼핑", move: "교통", flight: "항공", stay: "숙소", info: "정보" };

/* 장소 검색 모달용: 선택한 위치에 핀 아이콘 */
function createAddressPinIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:var(--color-primary);color:#fff;font-size:14px;
      display:flex;align-items:center;justify-content:center;
      border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);
    ">📍</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function AddressMapFlyTo({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lon == null) return;
    map.invalidateSize?.();
    map.flyTo([lat, lon], 15, { duration: 0.5 });
  }, [lat, lon, map]);
  return null;
}

export default function DetailDialog({
  detail, onClose, dayColor,
  onEdit, onDelete, onMoveToDay, onSaveField,
  moveDayOptions = [], currentDayDisplayIdx,
  allDetailPayloads, currentDetailIndex,
  onNavigateToIndex, onAddToSchedule,
}) {
  if (!detail) return null;

  const [viewImage, setViewImage] = useState(null);
  const [overlayDetail, setOverlayDetail] = useState(null);
  const [overlayPlace, setOverlayPlace] = useState(null);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [showDirectionsConfirm, setShowDirectionsConfirm] = useState(false);
  const [nearbyByType, setNearbyByType] = useState({ food: [], spot: [], shop: [] });
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const nearbyCacheRef = useRef({});
  const nearbyScrollRef = useRef(null);
  const contentScrollRef = useRef(null);
  const effectiveDetail = overlayDetail || detail;
  const accentColor = dayColor || COLOR.primary;
  const swipeStart = useRef({ x: 0, y: 0, pointerId: null, fromNearbyScroll: false });
  const curIdx = typeof currentDetailIndex === "number" ? currentDetailIndex : 0;
  const total = allDetailPayloads?.length ?? 0;

  // ── 인라인 수정 state ──
  const [editField, setEditField] = useState(null); // { field, value }
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerInitialTime, setTimePickerInitialTime] = useState(null); // 시간표 행 탭 시 해당 시각으로 초기값
  const [timePickerPickedIndex, setTimePickerPickedIndex] = useState(null); // 시간표 행 탭 시 저장 시 해당 행을 picked로
  const [showStationPicker, setShowStationPicker] = useState(false);
  const [showTimetableSearch, setShowTimetableSearch] = useState(false);
  const [showAddressSearchDialog, setShowAddressSearchDialog] = useState(false);
  const [addressSearchPending, setAddressSearchPending] = useState({ address: '', lat: undefined, lon: undefined });

  // visualViewport
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

  // 다이얼로그 노출 시 배경 스크롤·터치 차단
  useEffect(() => {
    if (!detail) return;
    const scrollY = window.scrollY ?? window.pageYOffset;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevLeft = document.body.style.left;
    const prevRight = document.body.style.right;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.top = `-${scrollY}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.left = prevLeft;
      document.body.style.right = prevRight;
      window.scrollTo(0, scrollY);
    };
  }, [detail]);

  /* ── 데이터 추출 ── */
  const item = effectiveDetail._item;
  const itemType = item?.type;
  const isMove = itemType === 'move';
  const isCustom = !!item?._custom;

  const mainImage = effectiveDetail.image ?? item?.detail?.image;
  const imagesArray = effectiveDetail.images ?? item?.detail?.images;
  const images = imagesArray && Array.isArray(imagesArray) && imagesArray.length > 0
    ? imagesArray : mainImage ? [mainImage] : [];
  const displayImages = mainImage && images.length > 1
    ? [mainImage, ...images.filter((img) => img !== mainImage)] : images;

  const directionsUrl = effectiveDetail.placeId
    ? `https://www.google.com/maps/dir/?api=1&destination=place_id:${effectiveDetail.placeId}&destination_place_id=${effectiveDetail.placeId}`
    : effectiveDetail.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(effectiveDetail.address)}`
      : null;

  const effectiveTimetable = (effectiveDetail.timetable?.trains?.length ? effectiveDetail.timetable : null)
    ?? (item?.detail?.timetable?.trains?.length ? item.detail.timetable : null);
  const hasTimetable = !!effectiveTimetable?.trains?.length;
  const hasTip = !!effectiveDetail.tip;
  const hasHighlights = effectiveDetail.highlights && effectiveDetail.highlights.length > 0;
  const hasExtraText = !!(item?.desc || item?.sub);
  const hasPrice = !!effectiveDetail.price;
  const hasHours = !!effectiveDetail.hours;
  const hasCoords = effectiveDetail.lat != null && effectiveDetail.lon != null;
  const showNearby = hasCoords && itemType !== "flight" && !isMove;

  /* ── 칩 네비게이션 ── */
  const chipItems = useMemo(() => {
    const chips = [];
    // 정보 (부가정보, 주소, 가격, 영업시간, 메모 통합)
    chips.push({ value: 'info', label: '정보' });
    // 포인트
    if (hasHighlights || isCustom) chips.push({ value: 'points', label: '포인트' });
    // 시간표 (교통만)
    if (isMove || hasTimetable) chips.push({ value: 'timetable', label: '시간표' });
    // 주변
    if (showNearby) chips.push({ value: 'nearby', label: '주변' });
    return chips;
  }, [hasHighlights, isMove, hasTimetable, showNearby, isCustom]);

  const [activeChip, setActiveChip] = useState(() => {
    if (isMove && (hasTimetable || true)) return 'timetable';
    return 'info';
  });

  // chip이 없으면 기본값으로 돌림
  useEffect(() => {
    if (chipItems.length > 0 && !chipItems.find(c => c.value === activeChip)) {
      setActiveChip(chipItems[0].value);
    }
  }, [chipItems, activeChip]);

  /* ── 주변 추천 로딩 ── */
  useEffect(() => { setOverlayDetail(null); setOverlayPlace(null); }, [detail]);

  useEffect(() => {
    if (!showNearby) return;
    const lat = Number(effectiveDetail.lat);
    const lon = Number(effectiveDetail.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    const excludeId = overlayPlace?.id ?? null;
    const key = `${lat},${lon},${excludeId ?? ''}`;
    if (nearbyCacheRef.current[key]) { setNearbyByType(nearbyCacheRef.current[key]); return; }
    setNearbyLoading(true);
    getNearbyPlaces({ lat, lon, excludeName: effectiveDetail.name, excludeId }).then((byType) => {
      nearbyCacheRef.current[key] = byType;
      setNearbyByType(byType);
      setNearbyLoading(false);
    }).catch(() => setNearbyLoading(false));
  }, [showNearby, effectiveDetail.lat, effectiveDetail.lon, effectiveDetail.name, overlayPlace?.id]);

  useEffect(() => {
    if (overlayDetail && contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
  }, [overlayDetail]);

  // 장소 검색 다이얼로그 열릴 때 현재 주소로 pending 초기화
  useEffect(() => {
    if (showAddressSearchDialog) {
      setAddressSearchPending({
        address: effectiveDetail.address || '',
        lat: effectiveDetail.lat,
        lon: effectiveDetail.lon,
      });
    }
  }, [showAddressSearchDialog]);

  /* ── 스와이프 ── */
  const MIN_SWIPE_PX = 60;
  const handleSwipeEnd = useCallback((endX, endY) => {
    if (overlayDetail) return;
    if (swipeStart.current.fromNearbyScroll) return;
    const { x: startX, y: startY } = swipeStart.current;
    const dx = endX - startX;
    const dy = endY - startY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < MIN_SWIPE_PX || adx <= ady || typeof onNavigateToIndex !== "function") return;
    if (dx < 0 && curIdx < total - 1) onNavigateToIndex(curIdx + 1);
    else if (dx > 0 && curIdx > 0) onNavigateToIndex(curIdx - 1);
  }, [overlayDetail, onNavigateToIndex, curIdx, total]);

  const handleStart = useCallback((clientX, clientY, pointerId) => {
    swipeStart.current = { x: clientX, y: clientY, pointerId };
  }, []);
  const handleEnd = useCallback((clientX, clientY, pointerId) => {
    if (swipeStart.current.pointerId !== pointerId) return;
    swipeStart.current.pointerId = null;
    handleSwipeEnd(clientX, clientY);
  }, [handleSwipeEnd]);

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    handleStart(t.clientX, t.clientY, null);
    swipeStart.current.fromNearbyScroll = nearbyScrollRef.current?.contains(e.target) ?? false;
  }, [handleStart]);
  const onTouchEnd = useCallback((e) => {
    if (!e.changedTouches?.[0]) return;
    const t = e.changedTouches[0];
    handleEnd(t.clientX, t.clientY, null);
  }, [handleEnd]);
  const onPointerDown = useCallback((e) => {
    if (e.pointerType !== "mouse") return;
    handleStart(e.clientX, e.clientY, e.pointerId);
    swipeStart.current.fromNearbyScroll = nearbyScrollRef.current?.contains(e.target) ?? false;
  }, [handleStart]);
  const onPointerUp = useCallback((e) => {
    if (e.pointerType !== "mouse") return;
    handleEnd(e.clientX, e.clientY, e.pointerId);
  }, [handleEnd]);
  const onPointerCancel = useCallback(() => { swipeStart.current.pointerId = null; }, []);

  /* ── 필드 저장 헬퍼 ── */
  const canEditInline = !!onSaveField && isCustom && !overlayDetail;
  /** onSaveField가 있으면 시간만 수정 가능 (커스텀 여부 무관) */
  const canEditTime = !!onSaveField && !overlayDetail;

  const saveField = useCallback((fieldUpdates) => {
    if (!onSaveField || !item) return;
    const displayIdx = effectiveDetail._di ?? detail._di;
    const si = effectiveDetail._si ?? detail._si;
    const ii = effectiveDetail._ii ?? detail._ii;
    // Build updated item
    const updated = { ...item };
    if (fieldUpdates.time !== undefined) updated.time = fieldUpdates.time;
    if (fieldUpdates.desc !== undefined) updated.desc = fieldUpdates.desc;
    if (fieldUpdates.sub !== undefined) updated.sub = fieldUpdates.sub;
    if (fieldUpdates.type !== undefined) updated.type = fieldUpdates.type;
    if (fieldUpdates.moveFrom !== undefined) updated.moveFrom = fieldUpdates.moveFrom;
    if (fieldUpdates.moveTo !== undefined) updated.moveTo = fieldUpdates.moveTo;
    if (!updated.detail) updated.detail = { name: updated.desc, category: catMap[updated.type] || '관광' };
    if (fieldUpdates.address !== undefined) updated.detail = { ...updated.detail, address: fieldUpdates.address };
    if (fieldUpdates.lat !== undefined) updated.detail = { ...updated.detail, lat: fieldUpdates.lat };
    if (fieldUpdates.lon !== undefined) updated.detail = { ...updated.detail, lon: fieldUpdates.lon };
    if (fieldUpdates.tip !== undefined) updated.detail = { ...updated.detail, tip: fieldUpdates.tip };
    if (fieldUpdates.price !== undefined) updated.detail = { ...updated.detail, price: fieldUpdates.price };
    if (fieldUpdates.hours !== undefined) updated.detail = { ...updated.detail, hours: fieldUpdates.hours };
    if (fieldUpdates.highlights !== undefined) updated.detail = { ...updated.detail, highlights: fieldUpdates.highlights };
    if (fieldUpdates.image !== undefined) updated.detail = { ...updated.detail, image: fieldUpdates.image };
    if (fieldUpdates.images !== undefined) updated.detail = { ...updated.detail, images: fieldUpdates.images };
    if (fieldUpdates.timetable !== undefined) updated.detail = { ...updated.detail, timetable: fieldUpdates.timetable };
    updated.detail.name = updated.desc;
    onSaveField(displayIdx, si, ii, updated);
  }, [onSaveField, item, effectiveDetail, detail]);

  /* ── 인라인 수정 핸들러 ── */
  const openTextEdit = (field, label, currentValue, multiline = false) => {
    setEditField({ field, label, value: currentValue || '', multiline });
  };
  const handleTextSave = () => {
    if (!editField) return;
    const { field, value } = editField;
    if (field === 'highlights') {
      // 줄바꿈으로 분리
      const arr = value.split('\n').map(l => l.trim()).filter(Boolean);
      saveField({ highlights: arr.length > 0 ? arr : [] });
    } else {
      saveField({ [field]: value });
    }
    setEditField(null);
  };

  const handleTimeSave = (timeVal) => {
    const prevTime = (item?.time || '').trim();
    const nextTime = (timeVal || '').trim();
    if (prevTime !== nextTime) saveField({ time: timeVal });
    setShowTimePicker(false);
    setTimePickerInitialTime(null);
    setTimePickerPickedIndex(null);
  };

  const handleStationSelect = (from, to) => {
    const updates = { moveFrom: from, moveTo: to, desc: `${from} → ${to}` };
    // 자동 재매칭
    const routes = findRoutesByStations(from, to);
    if (routes.length > 0) {
      const route = routes[0];
      const bestIdx = findBestTrain(route.trains, item?.time || '');
      updates.timetable = {
        _routeId: route.id, station: route.station, direction: route.direction,
        trains: route.trains.map((t, i) => ({ ...t, picked: i === bestIdx })),
      };
    }
    saveField(updates);
    setShowStationPicker(false);
  };

  const handleTimetableSelect = (routeId) => {
    const route = TIMETABLE_DB.find(r => r.id === routeId);
    if (!route) return;
    const bestIdx = findBestTrain(route.trains, item?.time || '');
    saveField({
      timetable: {
        _routeId: routeId, station: route.station, direction: route.direction,
        trains: route.trains.map((t, i) => ({ ...t, picked: i === bestIdx })),
      },
    });
    setShowTimetableSearch(false);
  };

  const px = "var(--spacing-sp200)";

  /* ── 콘텐츠 렌더 (칩별) ── */
  const renderInfoTab = () => (
    <>
      {/* 시간 (부가정보 위) */}
      {(canEditTime || item?.time) && (
        canEditTime ? (
          <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
            <TappableRow label="시간" value={item?.time} placeholder="시간 선택" onClick={() => setShowTimePicker(true)} />
          </div>
        ) : (
          <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${SPACING.lg} 0` }}>
              <div style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant2)', marginBottom: SPACING.xs }}>시간</div>
              <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', color: 'var(--color-on-surface)', fontVariantNumeric: 'tabular-nums' }}>{item?.time}</span>
            </div>
          </div>
        )
      )}

      {/* 부가정보 */}
      {canEditInline ? (
        <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
          <TappableRow label="부가정보" value={item?.sub} placeholder="부가정보 입력" onClick={() => openTextEdit('sub', '부가정보', item?.sub)} />
        </div>
      ) : hasExtraText && (
        <SectionWrap label="부가정보" px="0">
          <p style={{ margin: 0, fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface-variant)', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
            {[item?.desc, item?.sub].filter(Boolean).join('\n')}
          </p>
        </SectionWrap>
      )}

      {/* 주소 — 수정 시 장소 검색 센터 다이얼로그 */}
      {canEditInline ? (
        <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
          <TappableRow label="주소" value={effectiveDetail.address} placeholder="장소 검색" onClick={() => setShowAddressSearchDialog(true)} />
        </div>
      ) : effectiveDetail.address && (
        <SectionWrap label="주소" px="0">
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg, flexWrap: 'wrap' }}>
            <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface-variant)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {effectiveDetail.address}
            </p>
            {directionsUrl && (
              <Button variant="primary" size="sm" iconLeft="navigation" onClick={() => setShowDirectionsConfirm(true)} style={{ flexShrink: 0 }}>길찾기</Button>
            )}
          </div>
        </SectionWrap>
      )}

      {/* 가격 */}
      {(canEditInline || hasPrice) && (
        canEditInline ? (
          <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
            <TappableRow label="가격" value={effectiveDetail.price} placeholder="가격 입력" onClick={() => openTextEdit('price', '가격', effectiveDetail.price)} />
          </div>
        ) : (
          <SectionWrap label="가격" px="0">
            <p style={{ margin: 0, fontSize: 'var(--typo-label-1-n---regular-size)', color: 'var(--color-on-surface-variant)' }}>{effectiveDetail.price}</p>
          </SectionWrap>
        )
      )}

      {/* 영업시간 */}
      {(canEditInline || hasHours) && (
        canEditInline ? (
          <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
            <TappableRow label="영업시간" value={effectiveDetail.hours} placeholder="영업시간 입력" onClick={() => openTextEdit('hours', '영업시간', effectiveDetail.hours)} />
          </div>
        ) : (
          <SectionWrap label="영업시간" px="0">
            <p style={{ margin: 0, fontSize: 'var(--typo-label-1-n---regular-size)', color: 'var(--color-on-surface-variant)' }}>{effectiveDetail.hours}</p>
          </SectionWrap>
        )
      )}

      {/* 길찾기 (주소가 있는 경우 뷰 모드에서 아래에도 표시) */}
      {!canEditInline && !effectiveDetail.address && directionsUrl && (
        <div style={{ paddingTop: SPACING.xl }}>
          <Button variant="primary" size="sm" iconLeft="navigation" onClick={() => setShowDirectionsConfirm(true)}>길찾기</Button>
        </div>
      )}

      {/* ── 메모 (정보 탭에 통합) ── */}
      {canEditInline ? (
        <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
          <TappableRow label="메모" value={effectiveDetail.tip} placeholder="메모를 입력하세요" onClick={() => openTextEdit('tip', '메모', effectiveDetail.tip, true)} />
        </div>
      ) : hasTip && (
        <SectionWrap label="메모" px="0">
          <p style={{ margin: 0, fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface-variant)', whiteSpace: 'pre-line' }}>
            {effectiveDetail.tip}
          </p>
        </SectionWrap>
      )}
    </>
  );

  const renderPointsTab = () => (
    <>
      {canEditInline ? (
        <TappableRow
          label="포인트"
          value={hasHighlights ? effectiveDetail.highlights.join('\n') : ''}
          placeholder="포인트를 입력하세요 (줄바꿈으로 구분)"
          onClick={() => openTextEdit('highlights', '포인트', hasHighlights ? effectiveDetail.highlights.join('\n') : '', true)}
        />
      ) : hasHighlights ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {effectiveDetail.highlights.map((h, i) => {
            const isNote = h.startsWith("[");
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: SPACING.lg,
                  padding: `${SPACING.lg} ${SPACING.xl}`,
                  borderRadius: RADIUS.lg,
                  background: isNote ? 'var(--color-surface-container-lowest)' : 'var(--color-primary-container)',
                  border: `1px solid ${isNote ? 'var(--color-outline-variant)' : 'var(--color-primary)'}`,
                  borderLeftWidth: 4,
                  borderLeftColor: isNote ? 'var(--color-outline-variant)' : accentColor,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: RADIUS.full,
                    background: isNote ? 'var(--color-outline-variant)' : accentColor,
                    color: isNote ? 'var(--color-on-surface-variant2)' : 'var(--color-on-primary)',
                    fontSize: 'var(--typo-caption-2-bold-size)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 'var(--typo-label-2-regular-size)',
                    lineHeight: 1.45,
                    color: isNote ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)',
                    wordBreak: 'break-word',
                  }}
                >
                  {h}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ padding: `${SPACING.xxxl} 0`, textAlign: 'center', color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-body-2-size)' }}>포인트 없음</p>
      )}
    </>
  );

  const renderTimetableTab = () => (
    <>
      {/* 출발지/도착지 (교통) */}
      {isMove && canEditInline && (
        <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
          <TappableRow
            label="출발지 → 도착지"
            value={item?.moveFrom && item?.moveTo ? `${item.moveFrom} → ${item.moveTo}` : ''}
            placeholder="출발지/도착지 선택"
            onClick={() => setShowStationPicker(true)}
          />
        </div>
      )}

      {/* 노선 선택 */}
      {isMove && canEditInline && (
        <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
          <TappableRow
            label="시간표 노선"
            value={effectiveTimetable?._routeId ? TIMETABLE_DB.find(r => r.id === effectiveTimetable._routeId)?.label : ''}
            placeholder="노선 검색"
            onClick={() => setShowTimetableSearch(true)}
          />
        </div>
      )}

      {hasTimetable ? (
        <div style={{ paddingTop: SPACING.xl }}>
          <SectionLabel>{effectiveTimetable.station} → {effectiveTimetable.direction}</SectionLabel>
          <TimetablePreview timetable={effectiveTimetable} variant="full" accentColor={accentColor} />
        </div>
      ) : (
        <p style={{ padding: `${SPACING.xxxl} 0`, textAlign: 'center', color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-body-2-size)' }}>시간표 없음</p>
      )}
    </>
  );

  const renderNearbyTab = () => (
    <div ref={nearbyScrollRef}>
      {nearbyLoading && (
        <div style={{ display: 'flex', gap: SPACING.lg, overflowX: 'hidden', paddingBottom: SPACING.sm, paddingTop: SPACING.lg }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ flexShrink: 0, width: 140 }}>
              <Skeleton style={{ width: '100%', aspectRatio: '4/3', borderRadius: RADIUS.sm, marginBottom: SPACING.sm }} />
              <Skeleton style={{ width: '80%', height: 14, borderRadius: RADIUS.xs, marginBottom: SPACING.xs }} />
              <Skeleton style={{ width: '50%', height: 12, borderRadius: RADIUS.xs }} />
            </div>
          ))}
        </div>
      )}
      {!nearbyLoading && (
        <>
          {nearbyByType.food?.length > 0 && (
            <SectionWrap label="주변 맛집" px="0">
              <div style={{ display: 'flex', gap: SPACING.lg, overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', paddingBottom: SPACING.sm }}>
                {nearbyByType.food.map((p) => (
                  <NearbyPlaceCard key={p.id || p.name_ko} place={p} onSelect={(pl) => { setOverlayDetail(ragPlaceToDetail(pl)); setOverlayPlace(pl); }} onAddToSchedule={onAddToSchedule} />
                ))}
              </div>
            </SectionWrap>
          )}
          {nearbyByType.spot?.length > 0 && (
            <SectionWrap label="주변 볼거리" px="0">
              <div style={{ display: 'flex', gap: SPACING.lg, overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', paddingBottom: SPACING.sm }}>
                {nearbyByType.spot.map((p) => (
                  <NearbyPlaceCard key={p.id || p.name_ko} place={p} onSelect={(pl) => { setOverlayDetail(ragPlaceToDetail(pl)); setOverlayPlace(pl); }} onAddToSchedule={onAddToSchedule} />
                ))}
              </div>
            </SectionWrap>
          )}
          {nearbyByType.shop?.length > 0 && (
            <SectionWrap label="주변 쇼핑" px="0">
              <div style={{ display: 'flex', gap: SPACING.lg, overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', paddingBottom: SPACING.sm }}>
                {nearbyByType.shop.map((p) => (
                  <NearbyPlaceCard key={p.id || p.name_ko} place={p} onSelect={(pl) => { setOverlayDetail(ragPlaceToDetail(pl)); setOverlayPlace(pl); }} onAddToSchedule={onAddToSchedule} />
                ))}
              </div>
            </SectionWrap>
          )}
          {!nearbyByType.food?.length && !nearbyByType.spot?.length && !nearbyByType.shop?.length && (
            <p style={{ padding: `${SPACING.xxxl} 0`, textAlign: 'center', color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-body-2-size)' }}>주변 추천 없음</p>
          )}
        </>
      )}
    </div>
  );

  const renderActiveContent = () => {
    switch (activeChip) {
      case 'info': return renderInfoTab();
      case 'points': return renderPointsTab();
      case 'timetable': return renderTimetableTab();
      case 'nearby': return renderNearbyTab();
      default: return renderInfoTab();
    }
  };

  const typeConfig = TYPE_CONFIG[itemType] || TYPE_CONFIG.info;

  const fullscreenModal = (
    <div style={{
      position: 'fixed',
      ...(viewportRect != null
        ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height }
        : { inset: 0 }),
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-surface)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      boxSizing: 'border-box',
    }}>
      {/* ══ 고정 헤더 ══ */}
      <div style={{ flexShrink: 0 }}>
        {/* 상단 바: 이름 + 유형·시간 뱃지 + 닫기 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACING.md,
          padding: `${SPACING.md} ${px}`,
          borderBottom: '1px solid var(--color-outline-variant)',
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: SPACING.md, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, minWidth: 0, flexShrink: 1, fontSize: 'var(--typo-body-1-n---bold-size)', fontWeight: 'var(--typo-body-1-n---bold-weight)', color: 'var(--color-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {canEditInline ? (
                <span onClick={() => openTextEdit('desc', '이름', item?.desc)} style={{ cursor: 'pointer' }}>
                  {effectiveDetail.name || '이름 입력'}
                </span>
              ) : effectiveDetail.name}
            </h3>
            <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0, gap: SPACING.sm }}>
              {(effectiveDetail.categories && effectiveDetail.categories.length > 0
                ? effectiveDetail.categories
                : effectiveDetail.category ? [effectiveDetail.category] : []
              ).map((cat) => (<CategoryBadge key={cat} category={cat} />))}
              {item?.time && (
                <button
                  type="button"
                  onClick={canEditTime ? () => setShowTimePicker(true) : undefined}
                  style={{
                    padding: '2px 8px',
                    border: `1px solid ${typeConfig.border}`,
                    background: typeConfig.bg,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--typo-caption-3-bold-size)',
                    fontWeight: 'var(--typo-caption-3-bold-weight)',
                    lineHeight: 'var(--typo-caption-3-bold-line-height)',
                    color: typeConfig.text,
                    cursor: canEditTime ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.time}
                </button>
              )}
            </span>
          </div>
          {!overlayDetail && onMoveToDay && moveDayOptions.length > 1 && (
            <Button variant="ghost-neutral" size="sm" iconOnly="moreHorizontal" onClick={() => setShowMoreSheet(true)} style={{ flexShrink: 0 }} title="더보기" />
          )}
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} style={{ flexShrink: 0 }} />
        </div>

        {/* 교통이면: 출발지 → 도착지 */}
        {isMove && (item?.moveFrom || item?.moveTo || item?.desc) && (
          <div
            onClick={canEditInline ? () => setShowStationPicker(true) : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: SPACING.md,
              padding: `${SPACING.md} ${px}`,
              background: 'var(--color-surface-container-lowest)',
              borderBottom: '1px solid var(--color-outline-variant)',
              cursor: canEditInline ? 'pointer' : 'default',
            }}
          >
            <Icon name="navigation" size={14} style={{ color: typeConfig.text, flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--typo-label-2-medium-size)', color: 'var(--color-on-surface)' }}>
              {item?.moveFrom && item?.moveTo ? `${item.moveFrom} → ${item.moveTo}` : item?.desc}
            </span>
            {canEditInline && <Icon name="chevronRight" size={12} style={{ opacity: 0.3, marginLeft: 'auto' }} />}
          </div>
        )}

        {/* 이미지 — 웹에서 전체화면 차지 방지: maxHeight + flexShrink:0 */}
        {displayImages.length === 1 && (
          <div
            onClick={() => setViewImage(displayImages[0])}
            style={{
              flexShrink: 0,
              width: '100%',
              maxHeight: '40vh',
              aspectRatio: '16/7',
              overflow: 'hidden',
              cursor: 'zoom-in',
              background: COLOR.surfaceLowest,
            }}
          >
            <img src={displayImages[0]} alt={effectiveDetail.name} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
          </div>
        )}
        {displayImages.length > 1 && (
          <div style={{ flexShrink: 0, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: SPACING.ms, padding: `${SPACING.lg} ${px}`, scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
            {displayImages.map((img, i) => (
              <div key={i} onClick={() => setViewImage(img)} style={{ flexShrink: 0, width: '75%', maxHeight: '40vh', aspectRatio: '16/9', scrollSnapAlign: 'start', borderRadius: RADIUS.md, overflow: 'hidden', cursor: 'zoom-in', background: COLOR.surfaceLowest }}>
                <img src={img} alt={`${effectiveDetail.name} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ))}
          </div>
        )}

        {/* 칩 네비게이션 — 2개 이상일 때만 */}
        {!overlayDetail && chipItems.length > 1 && (
          <div style={{ padding: `${SPACING.md} ${px}`, borderBottom: '1px solid var(--color-outline-variant)', overflowX: 'auto' }}>
            <ChipSelector
              items={chipItems}
              value={activeChip}
              onChange={setActiveChip}
              variant="pill"
              size="sm"
              style={{ gap: SPACING.md, flexWrap: 'nowrap' }}
            />
          </div>
        )}
      </div>

      {/* ══ 스크롤 콘텐츠 ══ */}
      <div
        ref={contentScrollRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch', touchAction: 'pan-y',
          padding: `0 ${px} ${SPACING.xl}`,
        }}
      >
        {overlayDetail ? (
          <>
            {/* overlay view of nearby place — 기존 스타일 유지 */}
            {hasExtraText && (
              <SectionWrap label="부가정보" px="0">
                <p style={{ margin: 0, fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: 'var(--color-on-surface-variant)', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                  {[effectiveDetail._item?.desc, effectiveDetail._item?.sub].filter(Boolean).join('\n')}
                </p>
              </SectionWrap>
            )}
            {effectiveDetail.address && (
              <SectionWrap label="주소" px="0">
                <p style={{ margin: 0, fontSize: 'var(--typo-label-1-n---regular-size)', color: 'var(--color-on-surface-variant)' }}>{effectiveDetail.address}</p>
              </SectionWrap>
            )}
            {effectiveDetail.highlights?.length > 0 && (
              <SectionWrap label="포인트" px="0">
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
                  {effectiveDetail.highlights.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: SPACING.lg,
                        padding: `${SPACING.lg} ${SPACING.xl}`,
                        borderRadius: RADIUS.lg,
                        background: 'var(--color-primary-container)',
                        border: '1px solid var(--color-primary)',
                        borderLeftWidth: 4,
                        borderLeftColor: accentColor,
                      }}
                    >
                      <span style={{
                        width: 24, height: 24, borderRadius: RADIUS.full, background: accentColor,
                        color: 'var(--color-on-primary)', fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--typo-label-2-regular-size)', lineHeight: 1.45, color: 'var(--color-on-surface)', wordBreak: 'break-word' }}>{h}</span>
                    </div>
                  ))}
                </div>
              </SectionWrap>
            )}
          </>
        ) : renderActiveContent()}
      </div>

      {/* ══ 하단 dot 인디케이터 (탭 시 해당 항목으로 이동) ══ */}
      {!overlayDetail && allDetailPayloads && allDetailPayloads.length > 1 && (
        <div style={{
          flexShrink: 0,
          padding: `${SPACING.md} ${px} calc(${SPACING.md} + env(safe-area-inset-bottom, 0px)) ${px}`,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: SPACING.xs,
          background: 'var(--color-surface)',
        }}>
          {allDetailPayloads.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={typeof onNavigateToIndex === 'function' ? () => onNavigateToIndex(i) : undefined}
              aria-label={`${i + 1}번째 항목으로 이동`}
              aria-current={i === curIdx ? 'true' : undefined}
              style={{
                width: 24,
                height: 24,
                padding: 0,
                margin: 0,
                border: 'none',
                borderRadius: '50%',
                background: 'transparent',
                cursor: typeof onNavigateToIndex === 'function' ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: i === curIdx ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                  opacity: i === curIdx ? 1 : 0.6,
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* ══ 하단 고정 액션: overlay일 때 일정추가 ══ */}
      {overlayDetail && onAddToSchedule && overlayPlace && (
        <div style={{ flexShrink: 0, padding: `${SPACING.xl} ${px} calc(${SPACING.xl} + env(safe-area-inset-bottom, 0px)) ${px}`, borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)' }}>
          <Button variant="primary" size="lg" iconLeft="plus" fullWidth onClick={() => onAddToSchedule(overlayPlace)}>일정추가</Button>
        </div>
      )}

      {/* ══ 하단 고정 액션: 삭제 + 길찾기(primary) ══ */}
      {!overlayDetail && (directionsUrl || (isCustom && onDelete)) && (
        <div style={{
          flexShrink: 0,
          padding: `${SPACING.lg} ${px} calc(${SPACING.lg} + env(safe-area-inset-bottom, 0px)) ${px}`,
          display: 'flex', gap: SPACING.md,
          borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)',
        }}>
          {isCustom && onDelete && (
            <Button variant="ghost-danger" size="lg" iconLeft="trash" onClick={() => { onDelete(effectiveDetail); }}>삭제</Button>
          )}
          {directionsUrl && (
            <Button variant="primary" size="lg" iconLeft="navigation" onClick={() => setShowDirectionsConfirm(true)} style={{ flex: 1 }}>길찾기</Button>
          )}
        </div>
      )}

      {/* ══ 헤더 더보기 메뉴 → Day 이동 ══ */}
      {showMoreSheet && (
        <BottomSheet onClose={() => setShowMoreSheet(false)} maxHeight="auto" zIndex={3100} title="">
          <div style={{ padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.xxxl}` }}>
            <button
              type="button"
              onClick={() => { setShowMoreSheet(false); setShowMoveSheet(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: SPACING.md,
                width: '100%', padding: `${SPACING.lg} ${SPACING.xl}`,
                border: 'none', borderRadius: 'var(--radius-md)', background: 'transparent',
                color: 'var(--color-on-surface)', fontSize: 'var(--typo-label-2-medium-size)',
                fontWeight: 'var(--typo-label-2-medium-weight)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <Icon name="pin" size={20} style={{ opacity: 0.7 }} />
              다른 Day로 이동
            </button>
          </div>
        </BottomSheet>
      )}

      {/* ══ Day 이동 시트 ══ */}
      {showMoveSheet && (
        <BottomSheet onClose={() => setShowMoveSheet(false)} maxHeight="70vh" zIndex={3100} title="어느 날로 옮길까요?">
          <div style={{ padding: `${SPACING.lg} ${SPACING.xxl} ${SPACING.xxxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
            {moveDayOptions
              .filter((opt) => opt.displayIdx !== currentDayDisplayIdx)
              .map((opt) => {
                const dayNum = opt.displayIdx + 1;
                return (
                  <button
                    key={opt.displayIdx}
                    type="button"
                    onClick={() => { onMoveToDay(effectiveDetail, opt.displayIdx); setShowMoveSheet(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: SPACING.lg,
                      width: '100%', padding: `${SPACING.lg} ${SPACING.xl}`,
                      border: '1px solid var(--color-outline-variant)',
                      borderRadius: RADIUS.lg, background: 'var(--color-surface-container-lowest)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-container)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-container-lowest)'; e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: RADIUS.md,
                      background: 'var(--color-primary-container)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 'var(--typo-label-2-bold-size)', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {dayNum}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: 'var(--typo-label-2-medium-size)', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                        Day {dayNum}
                      </div>
                      {opt.label && opt.label !== `Day ${dayNum}` && (
                        <div style={{ fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)', marginTop: '1px' }}>
                          {opt.label}
                        </div>
                      )}
                    </div>
                    <Icon name="chevronRight" size={14} style={{ opacity: 0.3, flexShrink: 0 }} />
                  </button>
                );
              })}
          </div>
        </BottomSheet>
      )}
    </div>
  );

  return createPortal(
    <>
      {/* 배경 터치·스크롤 차단용 백드롭 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1999,
          background: 'transparent',
          pointerEvents: 'auto',
          touchAction: 'none',
        }}
        aria-hidden
      />
      {fullscreenModal}

      {/* 이미지 뷰어 */}
      <ImageViewer src={viewImage} alt={detail.name} onClose={() => setViewImage(null)} />

      {/* 구글맵 이동 확인 */}
      {showDirectionsConfirm && directionsUrl && (
        <ConfirmDialog
          title="구글맵으로 이동"
          message="구글맵으로 이동합니다"
          confirmLabel="확인"
          onConfirm={() => { window.open(directionsUrl, '_blank'); setShowDirectionsConfirm(false); }}
          onCancel={() => setShowDirectionsConfirm(false)}
        />
      )}

      {/* 시간 수정 — 다이얼로그 형식 (open 필수) */}
      {showTimePicker && (
        <TimePickerDialog
          open
          value={timePickerInitialTime ?? item?.time ?? ''}
          onConfirm={handleTimeSave}
          onClose={() => { setShowTimePicker(false); setTimePickerInitialTime(null); setTimePickerPickedIndex(null); }}
          minuteStep={5}
        />
      )}

      {/* 주소 수정 — 장소 검색: 간단 맵 + 선택 시 핀, 검색결과 인라인, 확인 버튼으로 저장 */}
      {showAddressSearchDialog && (
        <CenterPopup title="장소 검색" onClose={() => setShowAddressSearchDialog(false)} maxWidth={400}>
          {/* 선택한 주소에 좌표가 있으면 간단 맵 + 핀 노출 */}
          {addressSearchPending.lat != null && addressSearchPending.lon != null && (
            <div style={{
              width: '100%',
              height: 160,
              borderRadius: RADIUS.md,
              overflow: 'hidden',
              border: '1px solid var(--color-outline-variant)',
              marginBottom: SPACING.lg,
            }}>
              <MapContainer
                center={[addressSearchPending.lat, addressSearchPending.lon]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <AddressMapFlyTo lat={addressSearchPending.lat} lon={addressSearchPending.lon} />
                <Marker
                  position={[addressSearchPending.lat, addressSearchPending.lon]}
                  icon={createAddressPinIcon()}
                />
              </MapContainer>
            </div>
          )}
          <AddressSearch
            value={addressSearchPending.address}
            onChange={(address, lat, lon) => {
              setAddressSearchPending({ address: address || '', lat: lat ?? undefined, lon: lon ?? undefined });
            }}
            placeholder="장소명, 주소를 검색하세요"
            size="lg"
            variant="outlined"
            style={{ width: '100%' }}
            inlineResults
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.lg }}>
            <Button variant="ghost-neutral" size="sm" onClick={() => setShowAddressSearchDialog(false)}>취소</Button>
            <Button variant="primary" size="sm" onClick={() => {
              saveField({ address: addressSearchPending.address || '', lat: addressSearchPending.lat, lon: addressSearchPending.lon });
              setShowAddressSearchDialog(false);
            }}>확인</Button>
          </div>
        </CenterPopup>
      )}

      {/* 텍스트 필드 수정 CenterPopup */}
      {editField && (
        <CenterPopup title={editField.label} onClose={() => setEditField(null)} maxWidth={360}>
          {editField.multiline ? (
            <textarea
              autoFocus
              value={editField.value}
              onChange={(e) => setEditField(prev => ({ ...prev, value: e.target.value }))}
              rows={5}
              style={{
                width: '100%', border: '1px solid var(--color-outline-variant)', borderRadius: RADIUS.md,
                padding: SPACING.lg, fontSize: 'var(--typo-label-1-n---regular-size)', fontFamily: 'inherit',
                color: 'var(--color-on-surface)', background: 'var(--color-surface-container-lowest)',
                resize: 'vertical', outline: 'none',
              }}
            />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: SPACING.sm,
              border: '1px solid var(--color-outline-variant)', borderRadius: RADIUS.md,
              background: 'var(--color-surface-container-lowest)',
            }}>
              <input
                autoFocus
                type="text"
                value={editField.value}
                onChange={(e) => setEditField(prev => ({ ...prev, value: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTextSave(); }}
                style={{
                  flex: 1, minWidth: 0, border: 'none', outline: 'none',
                  padding: `${SPACING.md} ${SPACING.lg}`,
                  fontSize: 'var(--typo-label-1-n---regular-size)', fontFamily: 'inherit',
                  color: 'var(--color-on-surface)', background: 'transparent',
                }}
              />
              {editField.value ? (
                <button
                  type="button"
                  onClick={() => setEditField(prev => ({ ...prev, value: '' }))}
                  style={{
                    flexShrink: 0, padding: SPACING.xs, border: 'none', background: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  aria-label="입력 지우기"
                >
                  <Icon name="close" size={16} style={{ opacity: 0.5 }} />
                </button>
              ) : null}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.lg }}>
            <Button variant="ghost-neutral" size="sm" onClick={() => setEditField(null)}>취소</Button>
            <Button variant="primary" size="sm" onClick={handleTextSave}>저장</Button>
          </div>
        </CenterPopup>
      )}

      {/* 출발지/도착지 선택 */}
      {showStationPicker && (
        <StationPickerModal
          onClose={() => setShowStationPicker(false)}
          onSelect={(from, to) => handleStationSelect(from, to)}
          initialFrom={item?.moveFrom || ''}
          initialTo={item?.moveTo || ''}
        />
      )}

      {/* 시간표 검색 */}
      {showTimetableSearch && (
        <TimetableSearchDialog
          onClose={() => setShowTimetableSearch(false)}
          onSelect={handleTimetableSelect}
        />
      )}
    </>,
    document.body
  );
}
