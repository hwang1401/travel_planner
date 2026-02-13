import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../../hooks/useScrollLock';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import ConfirmDialog from '../common/ConfirmDialog';
import ImageViewer from '../common/ImageViewer';
import TimetablePreview from '../common/TimetablePreview';
import NearbyPlaceCard from './NearbyPlaceCard';
import Skeleton from '../common/Skeleton';
import CenterPopup from '../common/CenterPopup';
import TimePickerDialog from '../common/TimePickerDialog';
import ChipSelector from '../common/ChipSelector';
import { uploadImage, generateImagePath } from '../../services/imageService';
import AddressSearch from '../common/AddressSearch';
import AddressToStationPicker from './AddressToStationPicker';
import { FromToStationField } from '../common/FromToStationField';
import { getNearbyPlaces, getPlaceByNameOrAddress } from '../../services/ragService';
import { getPlacePhotos } from '../../lib/googlePlaces';
import { COLOR, SPACING, RADIUS, TYPE_CONFIG, TYPE_LABELS, getCategoryColor } from '../../styles/tokens';
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
    margin: `0 0 ${SPACING.md}`,
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
  <div style={{ padding: `${SPACING.xxl} ${px} 0` }}>
    {label && <SectionLabel>{label}</SectionLabel>}
    {children}
  </div>
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
  tripId,
}) {
  useScrollLock(!!detail);
  if (!detail) return null;

  const [viewImage, setViewImage] = useState(null);
  const [ragImage, setRagImage] = useState(null);
  const [placePhotos, setPlacePhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [overlayDetail, setOverlayDetail] = useState(null);
  const [overlayPlace, setOverlayPlace] = useState(null);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [showDirectionsConfirm, setShowDirectionsConfirm] = useState(false);
  const [nearbyByType, setNearbyByType] = useState({ food: [], spot: [], shop: [] });
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const nearbyCacheRef = useRef({});
  const nearbyScrollRef = useRef(null);
  const carouselScrollRef = useRef(null);
  const contentScrollRef = useRef(null);
  const effectiveDetail = overlayDetail || detail;
  const accentColor = dayColor || COLOR.primary;
  const swipeStart = useRef({ x: 0, y: 0, pointerId: null, fromNearbyScroll: false, fromCarousel: false });
  const curIdx = typeof currentDetailIndex === "number" ? currentDetailIndex : 0;
  const total = allDetailPayloads?.length ?? 0;

  // ── 인라인 수정 state ──
  const [editField, setEditField] = useState(null); // { field, value }
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerInitialTime, setTimePickerInitialTime] = useState(null); // 시간표 행 탭 시 해당 시각으로 초기값
  const [timePickerPickedIndex, setTimePickerPickedIndex] = useState(null); // 시간표 행 탭 시 저장 시 해당 행을 picked로
  const [singleStationPicker, setSingleStationPicker] = useState(null); // { mode: 'from'|'to' }
  const [showAddressSearchDialog, setShowAddressSearchDialog] = useState(false);
  const [showImageManageDialog, setShowImageManageDialog] = useState(false);
  const [imageToReplace, setImageToReplace] = useState(null); // url when replacing one image
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(() => new Set());
  const [addressSearchPending, setAddressSearchPending] = useState({ address: '', lat: undefined, lon: undefined, placeId: undefined, photoUrl: undefined, rating: undefined, reviewCount: undefined, hours: undefined, priceLevel: undefined });

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

  // 배경 스크롤 차단: useScrollLock이 overflow + touchmove 처리 (iOS overscroll 방지)
  useEffect(() => {
    if (!detail) return;
    const scrollY = window.scrollY ?? window.pageYOffset;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevLeft = document.body.style.left;
    const prevRight = document.body.style.right;
    document.body.style.position = 'fixed';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.top = `-${scrollY}px`;
    return () => {
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
  const displayImages = useMemo(() => {
    const imgs = [];
    if (mainImage) imgs.push(mainImage);
    if (imagesArray?.length) {
      for (const img of imagesArray) {
        if (img && !imgs.includes(img)) imgs.push(img);
      }
    }
    if (ragImage && !imgs.includes(ragImage)) imgs.push(ragImage);
    // placePhotos는 사용자/RAG 이미지가 하나도 없을 때만 보충
    if (imgs.length === 0) {
      for (const url of placePhotos) {
        if (imgs.length >= 3) break;
        if (url && !imgs.includes(url)) imgs.push(url);
      }
    }
    return imgs.slice(0, 3);
  }, [mainImage, imagesArray, ragImage, placePhotos]);

  const directionsUrl = effectiveDetail.placeId
    ? `https://www.google.com/maps/dir/?api=1&destination=place_id:${effectiveDetail.placeId}&destination_place_id=${effectiveDetail.placeId}`
    : effectiveDetail.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(effectiveDetail.address)}`
      : null;

  const effectiveTimetable = (effectiveDetail.timetable?.trains?.length ? effectiveDetail.timetable : null)
    ?? (item?.detail?.timetable?.trains?.length ? item.detail.timetable : null);
  const hasTimetable = !!effectiveTimetable?.trains?.length;
  const hasHighlights = effectiveDetail.highlights && effectiveDetail.highlights.length > 0;
  const hasExtraText = !!(item?.desc || item?.sub);
  const hasCoords = effectiveDetail.lat != null && effectiveDetail.lon != null;
  const showNearby = hasCoords && itemType !== "flight" && !isMove;

  /* ── 칩 네비게이션 ── */
  const chipItems = useMemo(() => {
    const chips = [];
    // 정보 (영업시간·주소·가격·부가정보·메모·포인트 통합)
    chips.push({ value: 'info', label: '정보' });
    // 시간표 (교통만)
    if (isMove || hasTimetable) chips.push({ value: 'timetable', label: '시간표' });
    // 주변
    if (showNearby) chips.push({ value: 'nearby', label: '주변' });
    return chips;
  }, [isMove, hasTimetable, showNearby]);

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

  /* ── RAG 이미지 자동 로드 (표시 전용, 저장하지 않음) ── */
  /* 사용자가 의도적으로 이미지 삭제한 경우(_imageRemovedByUser) RAG로 덮어쓰지 않음 */
  useEffect(() => {
    if (overlayDetail) { setRagImage(null); return; }
    if (effectiveDetail._imageRemovedByUser) { setRagImage(null); return; }
    const hasImage = mainImage || (imagesArray && imagesArray.length > 0);
    if (hasImage) { setRagImage(null); return; }
    const name = effectiveDetail.name || item?.desc || '';
    const address = effectiveDetail.address || '';
    if (!name.trim() && !address.trim()) { setRagImage(null); return; }
    let cancelled = false;
    getPlaceByNameOrAddress({ name, address }).then((place) => {
      if (cancelled || !place?.image_url) {
        if (!cancelled) setRagImage(null);
        return;
      }
      setRagImage(place.image_url);
    }).catch(() => { if (!cancelled) setRagImage(null); });
    return () => { cancelled = true; };
  }, [effectiveDetail?.name, effectiveDetail?.address, effectiveDetail?._imageRemovedByUser, item?.desc, mainImage, imagesArray, overlayDetail]);

  // placeId가 있으면 Google Places에서 최대 3장 사진 fetch
  useEffect(() => {
    const pid = effectiveDetail?.placeId;
    if (!pid) { setPlacePhotos([]); return; }
    let cancelled = false;
    setPhotosLoading(true);
    getPlacePhotos(pid, 3).then((urls) => {
      if (!cancelled) setPlacePhotos(urls);
    }).catch(() => {
      if (!cancelled) setPlacePhotos([]);
    }).finally(() => {
      if (!cancelled) setPhotosLoading(false);
    });
    return () => { cancelled = true; };
  }, [effectiveDetail?.placeId]);

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
        placeId: effectiveDetail.placeId,
        photoUrl: undefined,
        rating: effectiveDetail.rating,
        reviewCount: effectiveDetail.reviewCount,
        hours: effectiveDetail.hours,
        priceLevel: effectiveDetail.priceLevel,
      });
    }
  }, [showAddressSearchDialog, effectiveDetail.address, effectiveDetail.lat, effectiveDetail.lon, effectiveDetail.placeId]);

  /* ── 스와이프 ── */
  const MIN_SWIPE_PX = 60;
  const handleSwipeEnd = useCallback((endX, endY) => {
    if (overlayDetail) return;
    if (swipeStart.current.fromNearbyScroll) return;
    if (swipeStart.current.fromCarousel) return;
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
    swipeStart.current.fromCarousel = carouselScrollRef.current?.contains(e.target) ?? false;
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
    swipeStart.current.fromCarousel = carouselScrollRef.current?.contains(e.target) ?? false;
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
    if (fieldUpdates.placeId !== undefined) updated.detail = { ...updated.detail, placeId: fieldUpdates.placeId };
    if (fieldUpdates.tip !== undefined) updated.detail = { ...updated.detail, tip: fieldUpdates.tip };
    if (fieldUpdates.price !== undefined) updated.detail = { ...updated.detail, price: fieldUpdates.price };
    if (fieldUpdates.hours !== undefined) updated.detail = { ...updated.detail, hours: fieldUpdates.hours };
    if (fieldUpdates.highlights !== undefined) updated.detail = { ...updated.detail, highlights: fieldUpdates.highlights };
    if (fieldUpdates.image !== undefined) {
      updated.detail = { ...updated.detail, image: fieldUpdates.image };
      if (fieldUpdates.image) updated.detail._imageRemovedByUser = false; // 새 이미지 추가 시 플래그 해제
    }
    if (fieldUpdates.images !== undefined) updated.detail = { ...updated.detail, images: fieldUpdates.images };
    if (fieldUpdates.image === '' || (fieldUpdates.images && fieldUpdates.images.length === 0)) {
      updated.detail = { ...updated.detail, _imageRemovedByUser: true };
    }
    if (fieldUpdates._imageRemovedByUser !== undefined) {
      updated.detail = { ...updated.detail, _imageRemovedByUser: fieldUpdates._imageRemovedByUser };
    }
    if (fieldUpdates.timetable !== undefined) updated.detail = { ...updated.detail, timetable: fieldUpdates.timetable };
    if (fieldUpdates.rating !== undefined) updated.detail = { ...updated.detail, rating: fieldUpdates.rating };
    if (fieldUpdates.reviewCount !== undefined) updated.detail = { ...updated.detail, reviewCount: fieldUpdates.reviewCount };
    if (fieldUpdates.priceLevel !== undefined) updated.detail = { ...updated.detail, priceLevel: fieldUpdates.priceLevel };
    updated.detail.name = updated.desc;

    const editKind = fieldUpdates.address !== undefined || fieldUpdates.lat !== undefined || fieldUpdates.placeId !== undefined
      ? 'address'
      : fieldUpdates.time !== undefined
        ? 'time'
        : fieldUpdates.desc !== undefined
          ? 'desc'
          : fieldUpdates.tip !== undefined
            ? 'tip'
            : fieldUpdates.price !== undefined
              ? 'price'
              : fieldUpdates.hours !== undefined
                ? 'hours'
                : fieldUpdates.highlights !== undefined
                  ? 'highlights'
                  : fieldUpdates.image !== undefined || fieldUpdates.images !== undefined
                    ? 'image'
                    : fieldUpdates.timetable !== undefined
                      ? 'timetable'
                      : fieldUpdates.sub !== undefined
                        ? 'sub'
                        : fieldUpdates.type !== undefined
                          ? 'type'
                          : (fieldUpdates.moveFrom !== undefined || fieldUpdates.moveTo !== undefined)
                            ? 'move'
                            : null;
    onSaveField(displayIdx, si, ii, updated, editKind);
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

  const imageFileRef = useRef(null);

  const handleAddImage = useCallback(async (file) => {
    if (!tripId || !onSaveField) return;
    setImageUploading(true);
    try {
      const path = generateImagePath(tripId, 'items');
      const url = await uploadImage(file, path);
      saveField({ image: url });
      setRagImage(null);
    } catch (err) {
      console.error('[DetailDialog] Image upload error:', err);
    } finally {
      setImageUploading(false);
    }
  }, [tripId, onSaveField, saveField]);

  const handleReplaceImageWithFile = useCallback(async (file, oldUrl) => {
    if (!tripId || !onSaveField || !oldUrl) return;
    setImageUploading(true);
    try {
      const path = generateImagePath(tripId, 'items');
      const newUrl = await uploadImage(file, path);
      // displayImages 전체에서 교체한 결과를 image+images에 저장 (Google Photos URL도 영속화)
      const updated = displayImages.map((u) => (u === oldUrl ? newUrl : u));
      if (oldUrl === ragImage) setRagImage(null);
      saveField({
        image: updated[0] || '',
        images: updated.length > 1 ? updated.slice(1) : [],
      });
    } catch (err) {
      console.error('[DetailDialog] Replace image error:', err);
    } finally {
      setImageUploading(false);
      setImageToReplace(null);
    }
  }, [tripId, onSaveField, saveField, displayImages, ragImage]);

  const handleSingleStationSelect = (station) => {
    const from = singleStationPicker.mode === 'from' ? station : (item?.moveFrom || '');
    const to = singleStationPicker.mode === 'to' ? station : (item?.moveTo || '');
    setSingleStationPicker(null);
    const routes = findRoutesByStations(from, to);
    const route = routes[0] || null;
    const updates = { moveFrom: from, moveTo: to, desc: `${from} → ${to}` };
    if (route) {
      const bestIdx = findBestTrain(route.trains, item?.time || '');
      updates.timetable = {
        _routeId: route.id, station: route.station, direction: route.direction,
        trains: route.trains.map((t, i) => ({ ...t, picked: i === bestIdx })),
      };
    } else {
      updates.timetable = null;
    }
    saveField(updates);
  };

  const px = SPACING.xxl; // 20px 가로 패딩

  /* ── 콘텐츠 렌더 (칩별) ── */
  const showPoints = hasHighlights || (canEditInline && isCustom);
  const infoRows = [
    { icon: 'clock', label: '영업시간', value: effectiveDetail.hours, placeholder: '영업시간 입력', onClick: () => openTextEdit('hours', '영업시간', effectiveDetail.hours) },
    { icon: 'pin', label: '주소', value: effectiveDetail.address, placeholder: '장소 검색', onClick: () => setShowAddressSearchDialog(true), miniMap: true },
    { icon: 'pricetag', label: '가격', value: effectiveDetail.price, placeholder: '가격 입력', onClick: () => openTextEdit('price', '가격', effectiveDetail.price) },
    { icon: 'info', label: '부가정보', value: item?.sub, placeholder: '부가정보 입력', onClick: () => openTextEdit('sub', '부가정보', item?.sub) },
    { icon: 'bulb', label: '메모', value: effectiveDetail.tip, placeholder: '메모를 입력하세요', onClick: () => openTextEdit('tip', '메모', effectiveDetail.tip, true), multiline: true },
    ...(showPoints ? [{
      icon: 'flag',
      label: '포인트',
      value: hasHighlights ? effectiveDetail.highlights.join('\n') : '',
      placeholder: '포인트를 입력하세요 (줄바꿈으로 구분)',
      onClick: () => openTextEdit('highlights', '포인트', hasHighlights ? effectiveDetail.highlights.join('\n') : '', true),
      multiline: true,
    }] : []),
  ];

  const renderInfoTab = () => {
    const visibleRows = canEditInline ? infoRows : infoRows.filter(r => !!r.value);

    return (
      <>
        {visibleRows.map((row, i) => (
          <div
            key={row.label}
            role={canEditInline ? 'button' : undefined}
            tabIndex={canEditInline ? 0 : undefined}
            onClick={canEditInline ? row.onClick : undefined}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: SPACING.lg,
              padding: `${SPACING.lg} 0`,
              borderBottom: i < visibleRows.length - 1 ? '1px solid var(--color-outline-variant)' : 'none',
              cursor: canEditInline ? 'pointer' : 'default',
              background: 'transparent',
            }}
          >
            <Icon name={row.icon} size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--typo-caption-1-bold-size)',
                fontWeight: 600,
                color: 'var(--color-on-surface-variant2)',
                marginBottom: SPACING.xs,
              }}>{row.label}</div>
              <div style={{
                fontSize: 'var(--typo-label-1-n---regular-size)',
                lineHeight: 'var(--typo-label-1-n---regular-line-height)',
                color: row.value ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
                whiteSpace: row.multiline ? 'pre-line' : 'normal',
                wordBreak: 'break-word',
              }}>
                {row.value || (canEditInline ? row.placeholder : '')}
              </div>
            </div>
            {row.miniMap && hasCoords && (
              <div
                key={`minimap-${effectiveDetail.lat}-${effectiveDetail.lon}`}
                style={{ width: 80, height: 80, borderRadius: RADIUS.md, overflow: 'hidden', flexShrink: 0 }}
              >
                <MapContainer
                  center={[effectiveDetail.lat, effectiveDetail.lon]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  attributionControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[effectiveDetail.lat, effectiveDetail.lon]} icon={createAddressPinIcon()} />
                </MapContainer>
              </div>
            )}
          </div>
        ))}
        {visibleRows.length === 0 && (
          <p style={{ padding: `${SPACING.xxxl} 0`, textAlign: 'center', color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-body-2-size)' }}>정보 없음</p>
        )}
      </>
    );
  };

  const renderTimetableTab = () => (
    <>
      {/* 출발지 · 도착지 (각각 탭해서 변경) */}
      {isMove && canEditTime && (
        <div style={{ padding: `${SPACING.lg} 0`, borderBottom: '1px solid var(--color-outline-variant)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
            <FromToStationField
              label="출발지"
              value={item?.moveFrom || ''}
              placeholder="출발지 선택"
              onClick={() => setSingleStationPicker({ mode: 'from' })}
            />
            <FromToStationField
              label="도착지"
              value={item?.moveTo || ''}
              placeholder="도착지 선택"
              onClick={() => setSingleStationPicker({ mode: 'to' })}
            />
          </div>
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
        {/* 상단 헤더: 이름 + 평점 + 카테고리 + 팁 */}
        <div style={{
          padding: `${SPACING.lg} ${px} ${SPACING.md}`,
        }}>
          {/* 라인 1: 장소명(좌측) + 시간뱃지 + 더보기 + 닫기 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
              <h3 style={{
                margin: 0, flex: '0 1 auto', minWidth: 0,
                fontSize: 'var(--typo-heading-3-bold-size)',
                fontWeight: 'var(--typo-heading-3-bold-weight)',
                color: 'var(--color-on-surface)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {canEditInline ? (
                  <span onClick={() => openTextEdit('desc', '이름', item?.desc)} style={{ cursor: 'pointer' }}>
                    {effectiveDetail.name || '이름 입력'}
                  </span>
                ) : effectiveDetail.name}
              </h3>
              {item?.time && (
              <button
                type="button"
                onClick={canEditTime ? () => setShowTimePicker(true) : undefined}
                style={(() => {
                  const c = getCategoryColor('정보');
                  return {
                    padding: '4px 10px',
                    border: `1px solid ${c.border}`,
                    background: c.bg,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--typo-caption-2-bold-size)',
                    fontWeight: 'var(--typo-caption-2-bold-weight)',
                    lineHeight: 1,
                    color: c.color,
                    cursor: canEditTime ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  };
                })()}
              >
                {item.time}
              </button>
              )}
            </div>
            {!overlayDetail && ((onMoveToDay && moveDayOptions.length > 1) || (canEditInline && tripId)) && (
              <Button variant="ghost-neutral" size="sm" iconOnly="moreHorizontal" onClick={() => setShowMoreSheet(true)} title="더보기" style={{ flexShrink: 0 }} />
            )}
            <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} style={{ flexShrink: 0 }} />
          </div>

          {/* 라인 2: 평점 + 카테고리 (단순 텍스트) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: item?.sub ? SPACING.sm : 0, flexWrap: 'wrap' }}>
            {effectiveDetail.rating != null ? (
              <>
                <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', lineHeight: 1, color: 'var(--color-on-surface-variant)' }}>
                  {'⭐'} {Number(effectiveDetail.rating).toFixed(1)}
                </span>
                {effectiveDetail.reviewCount != null && (
                  <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', lineHeight: 1, color: 'var(--color-on-surface-variant2)' }}>
                    ({effectiveDetail.reviewCount})
                  </span>
                )}
                <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 1, color: 'var(--color-on-surface-variant2)' }}>·</span>
              </>
            ) : (
              <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', lineHeight: 1, color: 'var(--color-on-surface-variant)' }}>
                평점 없음
              </span>
            )}
            {(effectiveDetail.categories?.length > 0
              ? effectiveDetail.categories
              : effectiveDetail.category ? [effectiveDetail.category] : []
            ).map((cat, i) => (
              <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
                {(i > 0 || effectiveDetail.rating == null) && (
                  <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', color: 'var(--color-on-surface-variant2)', marginRight: SPACING.sm }}>·</span>
                )}
                <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', lineHeight: 1, color: 'var(--color-on-surface-variant)' }}>{cat}</span>
              </span>
            ))}
          </div>

          {/* 라인 3: 부가정보 (있을 때만) */}
          {item?.sub && (
            <p style={{
              margin: 0,
              fontSize: 'var(--typo-label-1-n---regular-size)',
              fontWeight: 'var(--typo-label-1-n---regular-weight)',
              lineHeight: 1,
              color: 'var(--color-on-surface-variant)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.sub}
            </p>
          )}
        </div>

        {/* 교통이면: 출발지 → 도착지 (예상 소요시간 표시) */}
        {isMove && (item?.moveFrom || item?.moveTo || item?.desc) && (() => {
          const routeLabel = item?.moveFrom && item?.moveTo ? `${item.moveFrom} → ${item.moveTo}` : item?.desc;
          const mins = (effectiveTimetable?.trains || [])
            .map((t) => t.note?.match(/(\d+)\s*분/))
            .filter(Boolean)
            .map((m) => parseInt(m[1], 10));
          const durationMin = mins.length ? Math.min(...mins) : null;
          return (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: SPACING.md,
                padding: `${SPACING.md} ${px}`,
                background: 'var(--color-surface-container-lowest)',
              }}
            >
              <Icon name="navigation" size={14} style={{ color: typeConfig.text, flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--typo-label-2-medium-size)', color: 'var(--color-on-surface)' }}>
                {routeLabel}
                {durationMin != null && (
                  <span style={{ marginLeft: SPACING.sm, fontSize: 'var(--typo-caption-2-size)', color: 'var(--color-on-surface-variant2)' }}>
                    약 {durationMin}분
                  </span>
                )}
              </span>
            </div>
          );
        })()}

        {/* 이미지 업로드용 hidden input (항상 마운트) */}
        <input
          ref={imageFileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (imageToReplace) {
                handleReplaceImageWithFile(file, imageToReplace);
              } else {
                handleAddImage(file);
              }
            }
            e.target.value = '';
          }}
        />

        {/* 이미지 캐러셀 — 있을 때만 표시, 없으면 영역 자체 제거 */}
        {displayImages.length > 0 && (
          <div style={{ flexShrink: 0, position: 'relative', padding: `${SPACING.sm} ${px} 0` }}>
            {/* 1장이면 풀 와이드, 2장 이상이면 캐러셀 */}
            {displayImages.length === 1 ? (
              <div
                onClick={(e) => { if (!imageUploading && !e.target.closest('button')) setViewImage(displayImages[0]); }}
                style={{
                  width: '100%', maxHeight: '40vh', aspectRatio: '16/9',
                  borderRadius: RADIUS.md,
                  overflow: 'hidden', cursor: imageUploading ? 'default' : 'zoom-in',
                  background: COLOR.surfaceLowest,
                }}
              >
                <img src={displayImages[0]} alt={effectiveDetail.name}
                  style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
              </div>
            ) : (
              <div
                ref={carouselScrollRef}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  minWidth: 0,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  display: 'flex',
                  gap: SPACING.md,
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-x',
                  overscrollBehavior: 'contain',
                  paddingBottom: SPACING.sm,
                }}
              >
                {displayImages.map((img, i) => (
                  <div key={i} onClick={() => setViewImage(img)} style={{
                    flexShrink: 0, width: '90%', maxHeight: '40vh', aspectRatio: '16/9',
                    scrollSnapAlign: 'start', borderRadius: RADIUS.md,
                    overflow: 'hidden', cursor: 'zoom-in', background: COLOR.surfaceLowest,
                  }}>
                    <img src={img} alt={`${effectiveDetail.name} ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ))}
              </div>
            )}
            {imageUploading && (
              <>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 28, height: 28,
                    border: '3px solid rgba(255,255,255,0.4)',
                    borderTopColor: 'white', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              </>
            )}
          </div>
        )}

        {/* 칩 네비게이션 — 2개 이상일 때만 */}
        {!overlayDetail && chipItems.length > 1 && (
          <div style={{ padding: `${SPACING.lg} ${px} ${SPACING.sm}`, overflowX: 'auto' }}>
            <ChipSelector
              items={chipItems}
              value={activeChip}
              onChange={setActiveChip}
              variant="pill"
              size="ms"
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
          padding: `${overlayDetail ? 0 : SPACING.sm} ${px} ${SPACING.xl}`,
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
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
          padding: `${SPACING.md} ${px} 0 ${px}`,
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
        <div style={{ flexShrink: 0, padding: `${SPACING.md} ${px} 0 ${px}`, borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)' }}>
          <Button variant="primary" size="lg" iconLeft="plus" fullWidth onClick={() => onAddToSchedule(overlayPlace)}>일정추가</Button>
        </div>
      )}

      {/* ══ 하단 고정 액션: 삭제 + 길찾기(primary) ══ */}
      {!overlayDetail && (directionsUrl || (isCustom && onDelete)) && (
        <div style={{
          flexShrink: 0,
          padding: `${SPACING.md} ${px} 0 ${px}`,
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
            {onMoveToDay && moveDayOptions.length > 1 && (
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
            )}
            {canEditInline && tripId && !overlayDetail && displayImages.length > 0 && (
              <button
                type="button"
                onClick={() => { setShowMoreSheet(false); setShowImageManageDialog(true); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: SPACING.md,
                  width: '100%', padding: `${SPACING.lg} ${SPACING.xl}`,
                  border: 'none', borderRadius: 'var(--radius-md)', background: 'transparent',
                  color: 'var(--color-on-surface)', fontSize: 'var(--typo-label-2-medium-size)',
                  fontWeight: 'var(--typo-label-2-medium-weight)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <Icon name="file" size={20} style={{ opacity: 0.7 }} />
                이미지 수정
              </button>
            )}
            {canEditInline && tripId && !overlayDetail && displayImages.length === 0 && (
              <button
                type="button"
                onClick={() => { setShowMoreSheet(false); imageFileRef.current?.click(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: SPACING.md,
                  width: '100%', padding: `${SPACING.lg} ${SPACING.xl}`,
                  border: 'none', borderRadius: 'var(--radius-md)', background: 'transparent',
                  color: 'var(--color-on-surface)', fontSize: 'var(--typo-label-2-medium-size)',
                  fontWeight: 'var(--typo-label-2-medium-weight)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <Icon name="file" size={20} style={{ opacity: 0.7 }} />
                이미지 추가
              </button>
            )}
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

      {/* ══ 이미지 관리 다이얼로그 ══ */}
      {showImageManageDialog && (
        <BottomSheet
          onClose={() => {
            setShowImageManageDialog(false);
            setDeleteMode(false);
            setSelectedForDelete(new Set());
          }}
          maxHeight="70vh"
          zIndex={3100}
          title="이미지 관리"
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* 썸네일 그리드 — 스크롤 영역 */}
            <div
              style={{
                maxHeight: '45vh',
                overflow: 'auto',
                padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.xl}`,
              }}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: SPACING.md,
              }}>
              {displayImages.map((img, i) => {
                const isSelected = selectedForDelete.has(img);
                return (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      aspectRatio: '1/1',
                      borderRadius: RADIUS.md,
                      overflow: 'hidden',
                      background: COLOR.surfaceLowest,
                      outline: deleteMode && isSelected ? '3px solid var(--color-primary)' : 'none',
                      outlineOffset: 2,
                    }}
                  >
                    {deleteMode ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedForDelete((prev) => {
                            const next = new Set(prev);
                            if (next.has(img)) next.delete(img);
                            else next.add(img);
                            return next;
                          });
                        }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'flex-end',
                          padding: SPACING.sm,
                          zIndex: 1,
                        }}
                      >
                        <span style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: '2px solid #fff',
                          background: isSelected ? 'var(--color-primary)' : 'rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        }}>
                          {isSelected && <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>✓</span>}
                        </span>
                      </button>
                    ) : null}
                    <img
                      src={img}
                      alt={`${effectiveDetail.name} ${i + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        cursor: deleteMode ? 'default' : 'pointer',
                        pointerEvents: deleteMode ? 'none' : 'auto',
                      }}
                      onClick={(e) => {
                        if (deleteMode) return;
                        e.stopPropagation();
                        setImageToReplace(img);
                        imageFileRef.current?.click();
                      }}
                    />
                  </div>
                );
              })}
              </div>
            </div>
            {/* 하단: 이미지 삭제 / 이미지 추가 */}
            <div style={{
              flexShrink: 0,
              display: 'flex',
              gap: SPACING.md,
              padding: SPACING.md,
              borderTop: '1px solid var(--color-outline-variant)',
              background: 'var(--color-surface)',
            }}>
              {deleteMode ? (
                <>
                  <Button
                    variant="ghost-neutral"
                    size="md"
                    onClick={() => {
                      setDeleteMode(false);
                      setSelectedForDelete(new Set());
                    }}
                    style={{ flex: 1 }}
                  >
                    취소
                  </Button>
                  <Button
                    variant="ghost-danger"
                    size="md"
                    iconLeft="trash"
                    disabled={selectedForDelete.size === 0 || imageUploading}
                    onClick={() => {
                      const remaining = displayImages.filter((u) => !selectedForDelete.has(u));
                      if (selectedForDelete.has(ragImage)) setRagImage(null);
                      saveField({
                        image: remaining[0] || '',
                        images: remaining.length > 1 ? remaining.slice(1) : [],
                        _imageRemovedByUser: remaining.length === 0,
                      });
                      setSelectedForDelete(new Set());
                      setDeleteMode(false);
                      if (remaining.length === 0) setShowImageManageDialog(false);
                    }}
                    style={{ flex: 1 }}
                  >
                    삭제 ({selectedForDelete.size}개)
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost-danger"
                    size="md"
                    iconLeft="trash"
                    onClick={() => setDeleteMode(true)}
                    style={{ flex: 1 }}
                  >
                    이미지 삭제
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    iconLeft="plus"
                    disabled={imageUploading}
                    onClick={() => {
                      setImageToReplace(null);
                      imageFileRef.current?.click();
                    }}
                    style={{ flex: 1 }}
                  >
                    이미지 추가
                  </Button>
                </>
              )}
            </div>
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
        <CenterPopup
          title="장소 검색"
          onClose={() => {
            const changed =
              (addressSearchPending.address || '') !== (effectiveDetail.address || '') ||
              addressSearchPending.lat !== effectiveDetail.lat ||
              addressSearchPending.lon !== effectiveDetail.lon;
            if (changed && addressSearchPending.address) {
              const fields = {
                address: addressSearchPending.address || '',
                lat: addressSearchPending.lat,
                lon: addressSearchPending.lon,
                placeId: addressSearchPending.placeId,
              };
              if (addressSearchPending.photoUrl) {
                fields.image = addressSearchPending.photoUrl;
              } else {
                fields.image = null;
                fields._imageRemovedByUser = false;
              }
              if (addressSearchPending.rating != null) fields.rating = addressSearchPending.rating;
              if (addressSearchPending.reviewCount != null) fields.reviewCount = addressSearchPending.reviewCount;
              if (addressSearchPending.hours) fields.hours = addressSearchPending.hours;
              if (addressSearchPending.priceLevel != null) fields.priceLevel = addressSearchPending.priceLevel;
              saveField(fields);
            }
            setShowAddressSearchDialog(false);
          }}
          maxWidth={400}
        >
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
            onChange={(address, lat, lon, photoUrl, placeId, extras) => {
              setAddressSearchPending({
                address: address || '', lat: lat ?? undefined, lon: lon ?? undefined,
                placeId: placeId ?? undefined, photoUrl: photoUrl ?? undefined,
                rating: extras?.rating ?? undefined, reviewCount: extras?.reviewCount ?? undefined,
                hours: extras?.hours ?? undefined, priceLevel: extras?.priceLevel ?? undefined,
              });
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
              const fields = {
                address: addressSearchPending.address || '',
                lat: addressSearchPending.lat,
                lon: addressSearchPending.lon,
                placeId: addressSearchPending.placeId,
              };
              if (addressSearchPending.photoUrl) {
                fields.image = addressSearchPending.photoUrl;
              } else {
                fields.image = null;
                fields._imageRemovedByUser = false;
              }
              if (addressSearchPending.rating != null) fields.rating = addressSearchPending.rating;
              if (addressSearchPending.reviewCount != null) fields.reviewCount = addressSearchPending.reviewCount;
              if (addressSearchPending.hours) fields.hours = addressSearchPending.hours;
              if (addressSearchPending.priceLevel != null) fields.priceLevel = addressSearchPending.priceLevel;
              saveField(fields);
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

      {singleStationPicker && (
        <AddressToStationPicker
          mode={singleStationPicker.mode}
          fixedStation={singleStationPicker.mode === 'from' ? (item?.moveTo || '') : (item?.moveFrom || '')}
          onClose={() => setSingleStationPicker(null)}
          onSelect={handleSingleStationSelect}
        />
      )}
    </>,
    document.body
  );
}
