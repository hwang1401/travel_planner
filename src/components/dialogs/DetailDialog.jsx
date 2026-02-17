import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useBackClose } from '../../hooks/useBackClose';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import ConfirmDialog from '../common/ConfirmDialog';
import ImageViewer from '../common/ImageViewer';
import TimetablePreview from '../common/TimetablePreview';
import NearbyPlaceCard from './NearbyPlaceCard';
import PlaceInfoContent from '../place/PlaceInfoContent';
import Skeleton from '../common/Skeleton';
import CenterPopup from '../common/CenterPopup';
import TimePickerDialog from '../common/TimePickerDialog';
import ChipSelector from '../common/ChipSelector';
import Toast from '../common/Toast';
import { uploadImage, generateImagePath } from '../../services/imageService';
import AddressSearch from '../common/AddressSearch';
import AddressToStationPicker from './AddressToStationPicker';
import { FromToStationField } from '../common/FromToStationField';
import { getNearbyPlaces, getPlaceByNameOrAddress, cachePhotoToRAG } from '../../services/ragService';
import { getPlacePhotos } from '../../lib/googlePlaces';
import { COLOR, SPACING, RADIUS, TYPE_CONFIG, TYPE_LABELS, getCategoryColor } from '../../styles/tokens';
import { TIMETABLE_DB, findBestTrain, matchByFromTo, findRoutesByStations } from '../../data/timetable';
import {
  DAY_ORDER, TODAY_BY_GETDAY,
  parseHoursToDays, reorderHoursByPriority,
  parseStayHours, sanitizeHoursForDisplay,
  initHoursEditState,
} from '../../utils/hoursParser';
import { buildPlaceDetail } from '../../utils/itemBuilder';

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

/* RAG place → detail shape. 대표 한 줄은 포인트(highlights[0])로 상단 노출, 부가정보(sub)는 별도. */
function ragPlaceToDetail(place) {
  if (!place) return null;
  const pd = buildPlaceDetail(place);
  const cat = TYPE_LABELS[place.type];
  const tags = place.tags;
  const oneLine = (Array.isArray(tags) && tags.length > 0 && tags[0])
    ? String(tags[0]).slice(0, 80)
    : (typeof place.description === 'string' && place.description.trim())
      ? place.description.trim().split(/\n/)[0].slice(0, 80).trim()
      : '';
  return {
    name: pd.name, address: pd.address, lat: pd.lat, lon: pd.lon,
    image: pd.image, placeId: pd.placeId,
    rating: pd.rating ?? place.rating ?? null,
    reviewCount: pd.reviewCount ?? place.review_count ?? null,
    hours: pd.hours ?? place.opening_hours ?? null,
    categories: cat ? [cat] : [], tip: null,
    highlights: oneLine ? [oneLine] : null,
    _item: { desc: pd.name, sub: place.description || '' },
  };
}


/* 장소 검색 모달용: 선택한 위치에 핀 아이콘 */
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
  useBackClose(!!detail, onClose);
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
  const [nearbyPages, setNearbyPages] = useState({ food: 0, spot: 0, shop: 0 });
  const carouselScrollRef = useRef(null);
  const contentScrollRef = useRef(null);
  const effectiveDetail = detail;
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
  const [copyToast, setCopyToast] = useState(null);
  const [showImageManageDialog, setShowImageManageDialog] = useState(false);
  const [imageToReplace, setImageToReplace] = useState(null); // url when replacing one image
  const [hoursExpanded, setHoursExpanded] = useState(false); // 영업시간 구글 스타일 접기/펼치기
  const [hoursEditRows, setHoursEditRows] = useState([]); // 영업시간 편집 시 요일별 { day, open, close, closed }
  const [hoursTimePicker, setHoursTimePicker] = useState(null); // { day, field: 'open'|'close' } | null
  const [stayCheckIn, setStayCheckIn] = useState('15:00');
  const [stayCheckOut, setStayCheckOut] = useState('11:00');
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
  const isStay = itemType === 'stay';
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
    if (imgs.length === 0 && !effectiveDetail._imageRemovedByUser) {
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
  }, [effectiveDetail?.name, effectiveDetail?.address, effectiveDetail?._imageRemovedByUser, item?.desc, mainImage, imagesArray]);

  // placeId가 있으면 Google Places에서 최대 3장 사진 fetch (가드 조건으로 불필요한 API 호출 방지)
  useEffect(() => {
    const pid = effectiveDetail?.placeId;
    if (!pid) { setPlacePhotos([]); return; }
    if (effectiveDetail._imageRemovedByUser) return;
    const hasImage = mainImage || (imagesArray && imagesArray.length > 0);
    if (hasImage) return;
    if (ragImage) return;

    let cancelled = false;
    setPhotosLoading(true);
    getPlacePhotos(pid, 3).then(async (urls) => {
      if (cancelled || !urls.length) return;
      if (!cancelled) setPlacePhotos(urls);
      try {
        await cachePhotoToRAG(pid);
      } catch (e) {
        console.warn('[DetailDialog] cachePhotoToRAG failed:', e);
      }
    }).catch(() => {
      if (!cancelled) setPlacePhotos([]);
    }).finally(() => {
      if (!cancelled) setPhotosLoading(false);
    });
    return () => { cancelled = true; };
  }, [effectiveDetail?.placeId, effectiveDetail?._imageRemovedByUser, mainImage, imagesArray, ragImage]);

  useEffect(() => {
    if (!showNearby) return;
    const lat = Number(effectiveDetail.lat);
    const lon = Number(effectiveDetail.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    const key = `${lat},${lon}`;
    if (nearbyCacheRef.current[key]) { setNearbyByType(nearbyCacheRef.current[key]); setNearbyPages({ food: 0, spot: 0, shop: 0 }); return; }
    setNearbyLoading(true);
    getNearbyPlaces({ lat, lon, excludeName: effectiveDetail.name }).then((byType) => {
      nearbyCacheRef.current[key] = byType;
      setNearbyByType(byType);
      setNearbyPages({ food: 0, spot: 0, shop: 0 });
      setNearbyLoading(false);
    }).catch(() => setNearbyLoading(false));
  }, [showNearby, effectiveDetail.lat, effectiveDetail.lon, effectiveDetail.name]);

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
  }, [onNavigateToIndex, curIdx, total]);

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
  const canEditInline = !!onSaveField && isCustom;
  /** onSaveField가 있으면 시간만 수정 가능 (커스텀 여부 무관) */
  const canEditTime = !!onSaveField;

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
    if (!updated.detail) updated.detail = { name: updated.desc, category: TYPE_LABELS[updated.type] || '관광' };
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
    if (field === 'hours') {
      if (isStay) {
        const { checkIn, checkOut } = parseStayHours(currentValue || '');
        setStayCheckIn(checkIn);
        setStayCheckOut(checkOut);
      } else {
        setHoursEditRows(initHoursEditState(currentValue || ''));
      }
    }
    setEditField({ field, label, value: currentValue || '', multiline });
  };
  const handleTextSave = () => {
    if (!editField) return;
    const { field, value } = editField;
    if (field === 'highlights') {
      const arr = value.split('\n').map(l => l.trim()).filter(Boolean);
      saveField({ highlights: arr.length > 0 ? arr : [] });
    } else if (field === 'hours') {
      if (isStay) {
        saveField({ hours: `${stayCheckIn} / ${stayCheckOut}` });
      } else {
        const parts = hoursEditRows.map((r) =>
          r.closed ? `${r.day}: 휴무` : `${r.day}: ${r.open}~${r.close}`
        );
        saveField({ hours: parts.join('; ') });
      }
      setEditField(null);
      return;
    } else {
      saveField({ [field]: value });
    }
    setEditField(null);
  };
  const applyHoursToAllDays = () => {
    const first = hoursEditRows[0];
    if (!first) return;
    setHoursEditRows(DAY_ORDER.map((day) => ({ ...first, day })));
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

  const handleSingleStationSelect = (value) => {
    const isAddress = value && typeof value === 'object' && value.type === 'address';
    const displayName = isAddress ? value.address : value;
    const from = singleStationPicker.mode === 'from' ? displayName : (item?.moveFrom || '');
    const to = singleStationPicker.mode === 'to' ? displayName : (item?.moveTo || '');
    setSingleStationPicker(null);
    const updates = { moveFrom: from, moveTo: to, desc: `${from} → ${to}` };
    if (isAddress) {
      updates.timetable = null;
      saveField(updates);
      return;
    }
    const routes = findRoutesByStations(from, to);
    const route = routes[0] || null;
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
  const infoRows = [
    { field: 'hours', icon: 'clock', label: isStay ? '체크인·체크아웃' : '영업시간', value: isStay ? effectiveDetail.hours : sanitizeHoursForDisplay(effectiveDetail.hours), placeholder: isStay ? '체크인·체크아웃 입력' : '영업시간 입력', onClick: () => openTextEdit('hours', isStay ? '체크인·체크아웃' : '영업시간', effectiveDetail.hours) },
    { icon: 'pin', label: '주소', value: effectiveDetail.address, placeholder: '장소 검색', onClick: () => setShowAddressSearchDialog(true), miniMap: true, copyable: true },
    { icon: 'pricetag', label: '가격', value: effectiveDetail.price, placeholder: '가격 입력', onClick: () => openTextEdit('price', '가격', effectiveDetail.price) },
    { icon: 'bulb', label: '메모', value: effectiveDetail.tip, placeholder: '메모를 입력하세요', onClick: () => openTextEdit('tip', '메모', effectiveDetail.tip, true), multiline: true },
  ];

  const renderInfoTab = () => {
    const visibleRows = canEditInline ? infoRows : infoRows.filter(r => !!r.value);
    const hoursRow = visibleRows.find((r) => r.field === 'hours');
    const hoursParsed = hoursRow?.value && !isStay ? parseHoursToDays(hoursRow.value) : null;
    const todayKorean = TODAY_BY_GETDAY[new Date().getDay()];
    const hoursParsedOrdered = hoursParsed ? reorderHoursByPriority(hoursParsed, todayKorean) : null;
    const showHoursGoogleStyle = !isStay && hoursParsedOrdered && hoursParsedOrdered.length > 0;

    const renderRow = (row, i, isLast) => {
      if (row.field === 'hours' && isStay) {
        const parsed = hoursRow?.value ? parseStayHours(hoursRow.value) : null;
        return (
          <div
            key={row.label}
            role={canEditInline ? 'button' : undefined}
            tabIndex={canEditInline ? 0 : undefined}
            onClick={canEditInline ? row.onClick : undefined}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: SPACING.lg,
              padding: `${SPACING.lg} 0`,
              borderBottom: !isLast ? '1px solid var(--color-outline-variant)' : 'none',
              cursor: canEditInline ? 'pointer' : 'default',
              background: 'transparent',
            }}
          >
            <Icon name="clock" size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0, marginTop: SPACING.xs }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant2)', marginBottom: SPACING.xs }}>체크인·체크아웃</div>
              <div style={{ fontSize: 'var(--typo-label-1-n---regular-size)', lineHeight: 'var(--typo-label-1-n---regular-line-height)', color: parsed ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)' }}>
                {parsed ? `체크인 ${parsed.checkIn} · 체크아웃 ${parsed.checkOut}` : (canEditInline ? row.placeholder : '')}
              </div>
            </div>
          </div>
        );
      }
      if (row.field === 'hours' && showHoursGoogleStyle) {
        return (
          <div
            key={row.label}
            style={{
              padding: `${SPACING.lg} 0`,
              borderBottom: !isLast ? '1px solid var(--color-outline-variant)' : 'none',
            }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => setHoursExpanded((e) => !e)}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setHoursExpanded((e) => !e); } }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.lg,
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                padding: 0,
                font: 'inherit',
                color: 'inherit',
              }}
            >
              <Icon name="clock" size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--typo-caption-1-bold-size)',
                  fontWeight: 600,
                  color: 'var(--color-on-surface-variant2)',
                  marginBottom: SPACING.xs,
                }}>영업시간</div>
                <div style={{
                  fontSize: 'var(--typo-label-1-n---regular-size)',
                  lineHeight: 'var(--typo-label-1-n---regular-line-height)',
                  color: 'var(--color-on-surface)',
                }}>
                  {hoursParsedOrdered[0].day} {hoursParsedOrdered[0].time}
                  {hoursParsedOrdered[0].day === todayKorean && (
                    <span style={{ marginLeft: SPACING.sm, fontSize: 'var(--typo-caption-1-bold-size)', color: 'var(--color-primary)' }}>· 오늘</span>
                  )}
                </div>
              </div>
              <Icon
                name={hoursExpanded ? 'chevronUp' : 'chevronDown'}
                size={20}
                style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0 }}
              />
            </div>
            {hoursExpanded && (
              <div style={{ marginTop: SPACING.md, marginLeft: SPACING.xxxxl, display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
                {hoursParsedOrdered.map(({ day, time }) => (
                  <div
                    key={day}
                    style={{
                      fontSize: 'var(--typo-label-1-n---regular-size)',
                      lineHeight: 'var(--typo-label-1-n---regular-line-height)',
                      color: 'var(--color-on-surface)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: SPACING.lg,
                    }}
                  >
                    <span style={{ color: 'var(--color-on-surface-variant2)' }}>
                      {day}
                      {day === todayKorean && (
                        <span style={{ marginLeft: SPACING.sm, fontSize: 'var(--typo-caption-1-bold-size)', color: 'var(--color-primary)' }}>· 오늘</span>
                      )}
                    </span>
                    <span>{time}</span>
                  </div>
                ))}
                {canEditInline && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); hoursRow.onClick(); }}
                    style={{
                      marginTop: SPACING.sm,
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      fontSize: 'var(--typo-caption-1-bold-size)',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    새로운 영업시간 제안
                  </button>
                )}
              </div>
            )}
          </div>
        );
      }
      const rowClickable = canEditInline || (row.copyable && row.value);
      const handleRowClick = canEditInline
        ? row.onClick
        : (row.copyable && row.value)
          ? () => {
              navigator.clipboard.writeText(row.value).then(() => {
                setCopyToast({ message: '주소가 복사되었습니다' });
              }).catch(() => {});
            }
          : undefined;
      return (
        <div
          key={row.label}
          role={rowClickable ? 'button' : undefined}
          tabIndex={rowClickable ? 0 : undefined}
          onClick={handleRowClick}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: SPACING.lg,
            padding: `${SPACING.lg} 0`,
            borderBottom: !isLast ? '1px solid var(--color-outline-variant)' : 'none',
            cursor: rowClickable ? 'pointer' : 'default',
            background: 'transparent',
          }}
        >
          <Icon name={row.icon} size={20} style={{ color: 'var(--color-on-surface-variant2)', flexShrink: 0, marginTop: SPACING.xs }} />
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
                className="map-pins-light"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[effectiveDetail.lat, effectiveDetail.lon]} icon={createAddressPinIcon()} />
              </MapContainer>
            </div>
          )}
        </div>
      );
    };

    return (
      <>
        {visibleRows.map((row, i) => renderRow(row, i, i === visibleRows.length - 1))}
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
      {!nearbyLoading && (() => {
        const CARDS_PER_PAGE = 3;
        const renderPagedSection = (label, places, typeKey) => {
          if (!places?.length) return null;
          const page = nearbyPages[typeKey] || 0;
          const totalPages = Math.ceil(places.length / CARDS_PER_PAGE);
          const start = page * CARDS_PER_PAGE;
          const visible = places.slice(start, start + CARDS_PER_PAGE);
          return (
            <div style={{ padding: `${SPACING.xxl} 0 0` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
                <SectionLabel>{label}</SectionLabel>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                    <button type="button" onClick={() => setNearbyPages((prev) => ({ ...prev, [typeKey]: Math.max(0, page - 1) }))}
                      disabled={page === 0}
                      style={{ border: 'none', background: 'none', cursor: page === 0 ? 'default' : 'pointer', padding: SPACING.xs, display: 'flex', opacity: page === 0 ? 0.25 : 0.7, fontFamily: 'inherit' }}>
                      <Icon name="chevronLeft" size={16} />
                    </button>
                    <span style={{ fontSize: 'var(--typo-caption-2-medium-size)', fontWeight: 500, color: 'var(--color-on-surface-variant2)', minWidth: '28px', textAlign: 'center' }}>
                      {page + 1}/{totalPages}
                    </span>
                    <button type="button" onClick={() => setNearbyPages((prev) => ({ ...prev, [typeKey]: Math.min(totalPages - 1, page + 1) }))}
                      disabled={page >= totalPages - 1}
                      style={{ border: 'none', background: 'none', cursor: page >= totalPages - 1 ? 'default' : 'pointer', padding: SPACING.xs, display: 'flex', opacity: page >= totalPages - 1 ? 0.25 : 0.7, fontFamily: 'inherit' }}>
                      <Icon name="chevronRight" size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: SPACING.lg, paddingBottom: SPACING.sm }}>
                {visible.map((p) => (
                  <NearbyPlaceCard key={p.id || p.name_ko} place={p} onSelect={(pl) => { setOverlayDetail(ragPlaceToDetail(pl)); setOverlayPlace(pl); }} onAddToSchedule={onAddToSchedule} />
                ))}
              </div>
            </div>
          );
        };
        return (
          <>
            {renderPagedSection('주변 맛집', nearbyByType.food, 'food')}
            {renderPagedSection('주변 볼거리', nearbyByType.spot, 'spot')}
            {renderPagedSection('주변 쇼핑', nearbyByType.shop, 'shop')}
            {!nearbyByType.food?.length && !nearbyByType.spot?.length && !nearbyByType.shop?.length && (
              <p style={{ padding: `${SPACING.xxxl} 0`, textAlign: 'center', color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-body-2-size)' }}>주변 추천 없음</p>
            )}
          </>
        );
      })()}
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
  /** placeId가 없으면(주소만 넣은 장소) 저장된 평점은 이전 장소 것일 수 있으므로 표시하지 않음 */
  const displayRating = effectiveDetail.placeId != null ? effectiveDetail.rating : null;
  const displayReviewCount = effectiveDetail.placeId != null ? effectiveDetail.reviewCount : null;

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
      paddingBottom: 0,
      boxSizing: 'border-box',
    }}>
      {/* ══ 고정 헤더 ══ */}
      <div style={{ flexShrink: 0 }}>
        {/* 기본 헤더: 이름 + 평점 + 카테고리 + 팁 */}
          <div style={{ padding: `${SPACING.lg} ${px} ${SPACING.md}` }}>
            {/* 라인 1: 장소명 + 시간뱃지 + 더보기 + 닫기 */}
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
                      padding: `${SPACING.sm} ${SPACING.ml}`,
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
              {((onMoveToDay && moveDayOptions.length > 1) || (canEditInline && tripId)) && (
                <Button variant="ghost-neutral" size="sm" iconOnly="moreHorizontal" onClick={() => setShowMoreSheet(true)} title="더보기" style={{ flexShrink: 0 }} />
              )}
              <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} style={{ flexShrink: 0 }} />
            </div>

            {/* 라인 2: 평점 + 카테고리 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: effectiveDetail.tip ? SPACING.sm : 0, flexWrap: 'wrap' }}>
              {displayRating != null ? (
                <>
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
                  {(i > 0 || displayRating == null) && (
                    <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', color: 'var(--color-on-surface-variant2)', marginRight: SPACING.sm }}>·</span>
                  )}
                  <span style={{ fontSize: 'var(--typo-label-1-n---regular-size)', fontWeight: 'var(--typo-label-1-n---regular-weight)', lineHeight: 1, color: 'var(--color-on-surface-variant)' }}>{cat}</span>
                </span>
              ))}
            </div>

            {/* 라인 3: 메모(tip) 첫 줄 */}
            {effectiveDetail.tip && (
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
                {effectiveDetail.tip.split('\n')[0]}
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
                    width: SPACING.xxxxl, height: SPACING.xxxxl,
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
        {chipItems.length > 1 && (
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
          padding: `${SPACING.sm} ${px} ${SPACING.xl}`,
        }}
      >
        {renderActiveContent()}
      </div>

      {/* ══ 하단 dot 인디케이터 (탭 시 해당 항목으로 이동) ══ */}
      {allDetailPayloads && allDetailPayloads.length > 1 && (
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
                width: SPACING.xxxl,
                height: SPACING.xxxl,
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
                  width: SPACING.ms,
                  height: SPACING.ms,
                  borderRadius: '50%',
                  background: i === curIdx ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                  opacity: i === curIdx ? 1 : 0.6,
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* ══ 하단 고정 액션: 삭제 + 길찾기(primary) ══ */}
      {(directionsUrl || (isCustom && onDelete)) && (
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

      {/* ══ 헤더 더보기 메뉴 → Day 이동 (구분선 있는 버전으로 통일) ══ */}
      {showMoreSheet && (() => {
        const moreRows = [];
        if (onMoveToDay && moveDayOptions.length > 1) {
          moreRows.push({ key: 'move', icon: 'pin', label: '다른 Day로 이동', onClick: () => { setShowMoreSheet(false); setShowMoveSheet(true); } });
        }
        if (canEditInline && tripId && displayImages.length > 0) {
          moreRows.push({ key: 'image-edit', icon: 'file', label: '이미지 수정', onClick: () => { setShowMoreSheet(false); setShowImageManageDialog(true); } });
        }
        if (canEditInline && tripId && displayImages.length === 0) {
          moreRows.push({ key: 'image-add', icon: 'file', label: '이미지 추가', onClick: () => { setShowMoreSheet(false); imageFileRef.current?.click(); } });
        }
        const btnStyle = (idx) => ({
          display: 'flex', alignItems: 'center', gap: SPACING.md,
          width: '100%', padding: `${SPACING.lg} ${SPACING.xl}`,
          border: 'none', borderTop: idx > 0 ? '1px solid var(--color-outline-variant)' : 'none',
          borderRadius: 0, background: 'transparent',
          color: 'var(--color-on-surface)', fontSize: 'var(--typo-label-2-medium-size)',
          fontWeight: 'var(--typo-label-2-medium-weight)', cursor: 'pointer', textAlign: 'left',
        });
        return (
          <BottomSheet onClose={() => setShowMoreSheet(false)} maxHeight="auto" zIndex={3100} title="">
            <div style={{ padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.xxxl}`, display: 'flex', flexDirection: 'column' }}>
              {moreRows.map((row, idx) => (
                <button key={row.key} type="button" onClick={row.onClick} style={btnStyle(idx)}>
                  <Icon name={row.icon} size={20} style={{ opacity: 0.7, flexShrink: 0 }} />
                  {row.label}
                </button>
              ))}
            </div>
          </BottomSheet>
        );
      })()}

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
                          width: SPACING.xxxl,
                          height: SPACING.xxxl,
                          borderRadius: '50%',
                          border: '2px solid var(--color-surface)',
                          background: isSelected ? 'var(--color-primary)' : 'color-mix(in srgb, var(--color-scrim) 30%, transparent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 'var(--shadow-normal)',
                        }}>
                          {isSelected && <span style={{ color: 'var(--color-on-primary)', fontSize: 14, lineHeight: 1 }}>✓</span>}
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

      {/* 영업시간/체크인·체크아웃 편집 시 타임 피커 — CenterPopup(9999) 위에 표시 */}
      {hoursTimePicker && editField?.field === 'hours' && (
        <TimePickerDialog
          open
          zIndex={10000}
          value={
            hoursTimePicker.type === 'checkIn'
              ? stayCheckIn
              : hoursTimePicker.type === 'checkOut'
                ? stayCheckOut
                : (hoursEditRows.find((r) => r.day === hoursTimePicker.day)?.[hoursTimePicker.field] ?? '09:00')
          }
          onConfirm={(value) => {
            if (hoursTimePicker.type === 'checkIn') {
              setStayCheckIn(value);
            } else if (hoursTimePicker.type === 'checkOut') {
              setStayCheckOut(value);
            } else {
              setHoursEditRows((prev) =>
                prev.map((r) => (r.day === hoursTimePicker.day ? { ...r, [hoursTimePicker.field]: value } : r))
              );
            }
            setHoursTimePicker(null);
          }}
          onClose={() => setHoursTimePicker(null)}
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
                placeId: addressSearchPending.placeId ?? null,
                rating: addressSearchPending.rating ?? null,
                reviewCount: addressSearchPending.reviewCount ?? null,
                hours: addressSearchPending.hours ?? null,
                priceLevel: addressSearchPending.priceLevel ?? null,
              };
              if (addressSearchPending.photoUrl) {
                fields.image = addressSearchPending.photoUrl;
              } else {
                fields.image = null;
                fields._imageRemovedByUser = false;
              }
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
                className="map-pins-light"
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
                placeId: addressSearchPending.placeId ?? null,
                rating: addressSearchPending.rating ?? null,
                reviewCount: addressSearchPending.reviewCount ?? null,
                hours: addressSearchPending.hours ?? null,
                priceLevel: addressSearchPending.priceLevel ?? null,
              };
              if (addressSearchPending.photoUrl) {
                fields.image = addressSearchPending.photoUrl;
              } else {
                fields.image = null;
                fields._imageRemovedByUser = false;
              }
              saveField(fields);
              setShowAddressSearchDialog(false);
            }}>확인</Button>
          </div>
        </CenterPopup>
      )}

      {/* 텍스트 필드 수정 CenterPopup */}
      {editField && (
        <CenterPopup title={editField.label} onClose={() => setEditField(null)} maxWidth={360}>
          {editField.field === 'hours' ? (
            isStay ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
                  <span style={{ width: 80, flexShrink: 0, fontSize: 'var(--typo-label-2-regular-size)', color: 'var(--color-on-surface-variant2)' }}>체크인</span>
                  <button
                    type="button"
                    onClick={() => setHoursTimePicker({ type: 'checkIn' })}
                    style={{
                      flex: 1,
                      padding: `${SPACING.sm} ${SPACING.lg}`,
                      border: '1px solid var(--color-outline-variant)',
                      borderRadius: RADIUS.sm,
                      fontSize: 'var(--typo-label-2-regular-size)',
                      color: 'var(--color-on-surface)',
                      background: 'var(--color-surface-container-lowest)',
                      cursor: 'pointer',
                    }}
                  >
                    {stayCheckIn}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
                  <span style={{ width: 80, flexShrink: 0, fontSize: 'var(--typo-label-2-regular-size)', color: 'var(--color-on-surface-variant2)' }}>체크아웃</span>
                  <button
                    type="button"
                    onClick={() => setHoursTimePicker({ type: 'checkOut' })}
                    style={{
                      flex: 1,
                      padding: `${SPACING.sm} ${SPACING.lg}`,
                      border: '1px solid var(--color-outline-variant)',
                      borderRadius: RADIUS.sm,
                      fontSize: 'var(--typo-label-2-regular-size)',
                      color: 'var(--color-on-surface)',
                      background: 'var(--color-surface-container-lowest)',
                      cursor: 'pointer',
                    }}
                  >
                    {stayCheckOut}
                  </button>
                </div>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
              <button
                type="button"
                onClick={applyHoursToAllDays}
                style={{
                  alignSelf: 'flex-start',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  fontSize: 'var(--typo-caption-1-bold-size)',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  marginBottom: SPACING.xs,
                }}
              >
                매일 동일하게 적용
              </button>
              {hoursEditRows.map((row) => (
                <div
                  key={row.day}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACING.md,
                    flexWrap: 'nowrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flex: 1, minWidth: 0 }}>
                    <span style={{ width: SPACING.xxxxl, flexShrink: 0, fontSize: 'var(--typo-label-2-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                      {row.day.replace('요일', '')}
                    </span>
                    <button
                      type="button"
                      disabled={row.closed}
                      onClick={() => { if (!row.closed) setHoursTimePicker({ day: row.day, field: 'open' }); }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: `${SPACING.xs} ${SPACING.sm}`,
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: RADIUS.sm,
                        fontSize: 'var(--typo-label-2-regular-size)',
                        color: row.closed ? 'var(--color-on-surface-variant2)' : 'var(--color-on-surface)',
                        background: row.closed ? 'var(--color-surface-container-low)' : 'var(--color-surface-container-lowest)',
                        cursor: row.closed ? 'not-allowed' : 'pointer',
                        opacity: row.closed ? 0.7 : 1,
                      }}
                    >
                      {row.open}
                    </button>
                    <span style={{ flexShrink: 0, fontSize: 'var(--typo-label-2-regular-size)', color: 'var(--color-on-surface-variant2)' }}>~</span>
                    <button
                      type="button"
                      disabled={row.closed}
                      onClick={() => { if (!row.closed) setHoursTimePicker({ day: row.day, field: 'close' }); }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: `${SPACING.xs} ${SPACING.sm}`,
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: RADIUS.sm,
                        fontSize: 'var(--typo-label-2-regular-size)',
                        color: row.closed ? 'var(--color-on-surface-variant2)' : 'var(--color-on-surface)',
                        background: row.closed ? 'var(--color-surface-container-low)' : 'var(--color-surface-container-lowest)',
                        cursor: row.closed ? 'not-allowed' : 'pointer',
                        opacity: row.closed ? 0.7 : 1,
                      }}
                    >
                      {row.close}
                    </button>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: SPACING.xs, flexShrink: 0, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(e) => {
                        const closed = e.target.checked;
                        setHoursEditRows((prev) => prev.map((r) => r.day === row.day ? { ...r, closed } : r));
                      }}
                      style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>휴무</span>
                  </label>
                </div>
              ))}
            </div>
            )
          ) : editField.multiline ? (
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

      {/* 주소 복사 토스트 */}
      {copyToast && (
        <Toast message={copyToast.message} onDone={() => setCopyToast(null)} />
      )}

      {/* 주변 장소 상세 모달 */}
      {overlayDetail && (
        <BottomSheet maxHeight="60vh" zIndex={2500} onClose={() => { setOverlayDetail(null); setOverlayPlace(null); }}>
          <PlaceInfoContent
            view="info"
            place={{
              name: overlayDetail.name,
              address: overlayDetail.address,
              lat: overlayDetail.lat,
              lon: overlayDetail.lon,
              image: overlayDetail.image,
              rating: overlayDetail.rating,
              reviewCount: overlayDetail.reviewCount,
              hours: overlayDetail.hours,
              placeId: overlayDetail.placeId,
              type: overlayPlace?.type,
              businessStatus: overlayDetail.businessStatus,
            }}
          />
          {onAddToSchedule && overlayPlace && (
            <div style={{ padding: `${SPACING.md} ${SPACING.xxl}`, borderTop: '1px solid var(--color-outline-variant)' }}>
              <Button variant="primary" size="lg" iconLeft="plus" fullWidth onClick={() => { onAddToSchedule(overlayPlace); setOverlayDetail(null); setOverlayPlace(null); }}>일정추가</Button>
            </div>
          )}
        </BottomSheet>
      )}
    </>,
    document.body
  );
}
