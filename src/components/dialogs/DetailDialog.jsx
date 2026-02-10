import { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import ImageViewer from '../common/ImageViewer';
import CategoryBadge from '../common/CategoryBadge';
import TimetablePreview from '../common/TimetablePreview';
import NearbyPlaceCard from './NearbyPlaceCard';
import { getNearbyPlaces } from '../../services/ragService';
import { COLOR, SPACING, RADIUS } from '../../styles/tokens';
import { TYPE_LABELS } from '../../styles/tokens';

/**
 * ── DetailDialog ──
 * "바로 꺼내기" — 여행 중 일정 정보를 즉시 확인.
 *
 * 구조:
 *   헤더 (고정) → 이미지 → 주소+길찾기 → 정보 → 메모 → 포인트(카드) → 교통 → 맵 → 수정
 *
 * 원칙:
 *   - 있는 것만 렌더, 빈 섹션은 그리지 않음
 *   - 섹션 구분: 소형 라벨 + 여백 (구분선 없음, 라벨+본문 흐름)
 *   - 주소·메모: 라벨 + 본문 (카드 없음)
 *   - 포인트: 카드형 (rounded + 배경 + border)으로 강조
 *   - 미니맵: 정적 이미지, 로드 실패 시 텍스트 링크로 대체
 *   - 높이: 콘텐츠에 맞춰 자동
 *
 * 다이얼로그 아웃라인 규칙: 시트 배경과 같은 블록·버튼은 구분을 위해 아웃라인 필수.
 * 아웃라인은 기본으로 variant 사용 (연한 톤, --color-outline-variant).
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

/* ── 컴포넌트 ── */

/** RAG place → detail shape for overlay view (일정 상세와 동일한 UI: 부가정보, 메모, 주소, 정보, 포인트) */
function ragPlaceToDetail(place) {
  if (!place) return null;
  const cat = TYPE_LABELS[place.type];
  const tags = place.tags;
  const highlights = Array.isArray(tags) && tags.length > 0
    ? tags
    : typeof tags === "string" && tags.trim() ? [tags.trim()] : [];
  return {
    name: place.name_ko,
    address: place.address,
    lat: place.lat,
    lon: place.lon,
    image: place.image_url,
    placeId: place.google_place_id,
    categories: cat ? [cat] : [],
    tip: null,
    highlights: highlights.length > 0 ? highlights : null,
    _item: {
      desc: place.name_ko,
      sub: place.description || "",
    },
  };
}

export default function DetailDialog({ detail, onClose, dayColor, onEdit, onDelete, onMoveToDay, moveDayOptions = [], currentDayDisplayIdx, allDetailPayloads, currentDetailIndex, onNavigateToIndex, onAddToSchedule }) {
  if (!detail) return null;
  const [viewImage, setViewImage] = useState(null);
  const [overlayDetail, setOverlayDetail] = useState(null);
  const [overlayPlace, setOverlayPlace] = useState(null);
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
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

  /* Images: stored only (no auto-fetch) */
  const images = effectiveDetail.images && Array.isArray(effectiveDetail.images) && effectiveDetail.images.length > 0
    ? effectiveDetail.images
    : effectiveDetail.image ? [effectiveDetail.image] : [];
  const displayImages = effectiveDetail.image && images.length > 1
    ? [effectiveDetail.image, ...images.filter((img) => img !== effectiveDetail.image)]
    : images;

  /* URLs */
  const directionsUrl = effectiveDetail.placeId
    ? `https://www.google.com/maps/dir/?api=1&destination=place_id:${effectiveDetail.placeId}&destination_place_id=${effectiveDetail.placeId}`
    : effectiveDetail.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(effectiveDetail.address)}`
      : null;

  const px = "var(--spacing-sp200)";

  /* Data checks — 시간표는 detail 또는 _item.detail에서 가져옴 (리스트/merge 경로와 무관하게 노출) */
  const effectiveTimetable = (effectiveDetail.timetable?.trains?.length ? effectiveDetail.timetable : null)
    ?? (effectiveDetail._item?.detail?.timetable?.trains?.length ? effectiveDetail._item.detail.timetable : null);
  const hasTimetable = !!effectiveTimetable?.trains?.length;

  const hasTip = !!effectiveDetail.tip;
  const hasHighlights = effectiveDetail.highlights && effectiveDetail.highlights.length > 0;

  const itemDesc = effectiveDetail._item?.desc;
  const itemSub = effectiveDetail._item?.sub;
  const hasExtraText = !!(itemDesc || itemSub);

  /* 주변 추천: effectiveDetail에 lat/lon 있으면 조회 (캐시 by coords) */
  const hasCoords = effectiveDetail.lat != null && effectiveDetail.lon != null;
  const showNearby = hasCoords;
  useEffect(() => {
    setOverlayDetail(null);
    setOverlayPlace(null);
  }, [detail]);

  useEffect(() => {
    if (!showNearby) return;
    const lat = Number(effectiveDetail.lat);
    const lon = Number(effectiveDetail.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    const key = `${lat},${lon}`;
    if (nearbyCacheRef.current[key]) {
      setNearbyByType(nearbyCacheRef.current[key]);
      return;
    }
    setNearbyLoading(true);
    getNearbyPlaces({ lat, lon, excludeName: effectiveDetail.name }).then((byType) => {
      nearbyCacheRef.current[key] = byType;
      setNearbyByType(byType);
      setNearbyLoading(false);
    }).catch(() => setNearbyLoading(false));
  }, [showNearby, effectiveDetail.lat, effectiveDetail.lon, effectiveDetail.name]);

  /* 주변 장소 overlay 열릴 때 스크롤 맨 위로 초기화 */
  useEffect(() => {
    if (overlayDetail && contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [overlayDetail]);

  /* 스와이프: 왼쪽(끝<시작) → 다음 인덱스, 오른쪽(끝>시작) → 이전 인덱스. 이동할 인덱스만 부모에 전달 */
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
  const onPointerCancel = useCallback(() => {
    swipeStart.current.pointerId = null;
  }, []);

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh">
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* ── 헤더: 제목 + 뱃지(제목 옆) + 닫기(우측) ── */}
        <div style={{
          padding: `var(--spacing-sp120) ${px}`,
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: "var(--spacing-sp80)",
          borderBottom: "1px solid var(--color-outline-variant)",
        }}>
          {overlayDetail && (
            <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={() => setOverlayDetail(null)} style={{ flexShrink: 0 }} title="이전" />
          )}
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: SPACING.md, overflow: "hidden" }}>
            <h3 style={{
              margin: 0,
              minWidth: 0, flexShrink: 1,
              fontSize: "var(--typo-body-1-n---bold-size)",
              fontWeight: "var(--typo-body-1-n---bold-weight)",
              color: "var(--color-on-surface)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {effectiveDetail.name}
            </h3>
            <span style={{ display: "inline-flex", alignItems: "center", gap: SPACING.sm, flexWrap: "nowrap", flexShrink: 0 }}>
              {(effectiveDetail.categories && effectiveDetail.categories.length > 0
                ? effectiveDetail.categories
                : effectiveDetail.category ? [effectiveDetail.category] : []
              ).map((cat) => (
                <CategoryBadge key={cat} category={cat} />
              ))}
            </span>
          </div>
          {!overlayDetail && onMoveToDay && moveDayOptions.length > 1 && (
            <Button variant="ghost-neutral" size="sm" iconOnly="moreHorizontal" onClick={() => setShowMoreSheet(true)} style={{ flexShrink: 0 }} title="더보기" />
          )}
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} style={{ flexShrink: 0 }} />
        </div>

        {/* ── 스크롤 콘텐츠 (스와이프로 이전/다음) ── */}
        <div
          ref={contentScrollRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{
          flex: 1, minHeight: "min(40vh, 280px)", overflowY: "auto", overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch", touchAction: "pan-y",
          ...((onEdit || onDelete) ? { paddingBottom: SPACING.lg } : {}),
        }}>

        {/* ── 이미지: 헤더 바로 아래 (저장된 이미지만) ── */}
        {displayImages.length === 1 && (
          <div onClick={() => setViewImage(displayImages[0])}
            style={{
              width: "100%",
              aspectRatio: "16/9",
              overflow: "hidden",
              cursor: "zoom-in",
              background: COLOR.surfaceLowest,
            }}>
            <img src={displayImages[0]} alt={effectiveDetail.name}
              style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
          </div>
        )}
        {displayImages.length > 1 && (
          <div style={{
            overflowX: "auto", overflowY: "hidden",
            display: "flex", gap: "var(--spacing-sp60)", padding: `var(--spacing-sp120) ${px}`,
            scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
          }}>
            {displayImages.map((img, i) => (
              <div key={i} onClick={() => setViewImage(img)} style={{
                flexShrink: 0, width: "75%", aspectRatio: "16/9",
                scrollSnapAlign: "start",
                borderRadius: RADIUS.md, overflow: "hidden",
                cursor: "zoom-in", background: COLOR.surfaceLowest,
              }}>
                <img src={img} alt={`${effectiveDetail.name} ${i + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
        )}

        {/* ── 부가정보: 이미지/헤더 아래 텍스트 (빈 모달에서도 스와이프 영역 확보 + 내용 노출) ── */}
        {hasExtraText && (
          <SectionWrap label="부가정보" px={px}>
            <p style={{
              margin: 0,
              fontSize: "var(--typo-label-1-n---regular-size)",
              lineHeight: "var(--typo-label-1-n---regular-line-height)",
              color: "var(--color-on-surface-variant)",
              whiteSpace: "pre-line",
              wordBreak: "break-word",
            }}>
              {[itemDesc, itemSub].filter(Boolean).join("\n")}
            </p>
          </SectionWrap>
        )}

        {/* ── 주소: 라벨 + 본문 (카드·구분선 없음) ── */}
        {effectiveDetail.address && (
          <SectionWrap label="주소" px={px}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sp120)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontSize: "var(--typo-label-1-n---regular-size)",
                  lineHeight: "var(--typo-label-1-n---regular-line-height)",
                  color: "var(--color-on-surface-variant)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {effectiveDetail.address}
                </p>
              </div>
              {directionsUrl && (
                <Button variant="primary" size="sm" iconLeft="navigation"
                  onClick={() => window.open(directionsUrl, "_blank")}
                  style={{ flexShrink: 0 }}>
                  길찾기
                </Button>
              )}
            </div>
          </SectionWrap>
        )}

        <ImageViewer src={viewImage} alt={detail.name} onClose={() => setViewImage(null)} />

        {/* ── 메모: 라벨 + 본문 (카드 없음) ── */}
        {hasTip && (
          <SectionWrap label="메모" px={px}>
            <p style={{
              margin: 0,
              fontSize: "var(--typo-label-1-n---regular-size)",
              lineHeight: "var(--typo-label-1-n---regular-line-height)",
              color: "var(--color-on-surface-variant)",
              whiteSpace: "pre-line",
            }}>
              {effectiveDetail.tip}
            </p>
          </SectionWrap>
        )}

        {/* ── 포인트: 카드로 감싼 불릿 리스트 ── */}
        {hasHighlights && (
          <SectionWrap label="포인트" px={px}>
            <div style={{
              padding: "var(--spacing-sp120) var(--spacing-sp160)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface-container-lowest)",
              border: "1px solid var(--color-outline-variant)",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: SPACING.md }}>
                {effectiveDetail.highlights.map((h, i) => {
                  const isNote = h.startsWith("[");
                  return (
                    <div key={i} style={{ display: "flex", gap: SPACING.lg, alignItems: "flex-start" }}>
                      <div style={{
                        width: "5px", height: "5px", borderRadius: RADIUS.full,
                        background: isNote ? COLOR.onSurfaceVariant2 : accentColor,
                        flexShrink: 0, marginTop: SPACING.ms,
                      }} />
                      <span style={{
                        fontSize: "var(--typo-caption-1-regular-size)",
                        lineHeight: "var(--typo-caption-1-regular-line-height)",
                        color: isNote ? COLOR.onSurfaceVariant : COLOR.onSurface,
                      }}>
                        {h}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </SectionWrap>
        )}

        {/* ── 주변 추천 (가로 스크롤 카드). 이 영역 내 좌우 스와이프는 상세 이동이 아닌 스크롤만. ── */}
        {showNearby && (
          <div ref={nearbyScrollRef}>
            {nearbyLoading && (
              <SectionWrap label="주변 추천" px={px}>
                <p style={{ margin: 0, fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)" }}>불러오는 중...</p>
              </SectionWrap>
            )}
            {!nearbyLoading && (nearbyByType.food?.length > 0 || nearbyByType.spot?.length > 0 || nearbyByType.shop?.length > 0) && (
              <>
                {nearbyByType.food?.length > 0 && (
                  <SectionWrap label="주변 맛집" px={px}>
                    <div style={{
                      display: "flex", gap: SPACING.lg, overflowX: "auto", overflowY: "hidden",
                      scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
                      paddingBottom: SPACING.sm,
                    }}>
                      {nearbyByType.food.map((p) => (
                        <NearbyPlaceCard
                          key={p.id || p.name_ko}
                          place={p}
                          onSelect={(pl) => { setOverlayDetail(ragPlaceToDetail(pl)); setOverlayPlace(pl); }}
                          onAddToSchedule={onAddToSchedule}
                        />
                      ))}
                    </div>
                  </SectionWrap>
                )}
                {nearbyByType.spot?.length > 0 && (
                  <SectionWrap label="주변 볼거리" px={px}>
                    <div style={{
                      display: "flex", gap: SPACING.lg, overflowX: "auto", overflowY: "hidden",
                      scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
                      paddingBottom: SPACING.sm,
                    }}>
                      {nearbyByType.spot.map((p) => (
                        <NearbyPlaceCard
                          key={p.id || p.name_ko}
                          place={p}
                          onSelect={(pl) => { setOverlayDetail(ragPlaceToDetail(pl)); setOverlayPlace(pl); }}
                          onAddToSchedule={onAddToSchedule}
                        />
                      ))}
                    </div>
                  </SectionWrap>
                )}
                {nearbyByType.shop?.length > 0 && (
                  <SectionWrap label="주변 쇼핑" px={px}>
                    <div style={{
                      display: "flex", gap: SPACING.lg, overflowX: "auto", overflowY: "hidden",
                      scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
                      paddingBottom: SPACING.sm,
                    }}>
                      {nearbyByType.shop.map((p) => (
                        <NearbyPlaceCard
                          key={p.id || p.name_ko}
                          place={p}
                          onSelect={(pl) => { setOverlayDetail(ragPlaceToDetail(pl)); setOverlayPlace(pl); }}
                          onAddToSchedule={onAddToSchedule}
                        />
                      ))}
                    </div>
                  </SectionWrap>
                )}
              </>
            )}
          </div>
        )}

        {/* ── 교통 타임테이블 (공통 컴포넌트) ── */}
        {hasTimetable && (
          <SectionWrap label={`${effectiveTimetable.station} → ${effectiveTimetable.direction}`} px={px}>
            <TimetablePreview timetable={effectiveTimetable} variant="full" accentColor={accentColor} />
          </SectionWrap>
        )}

        {(!onEdit && !onDelete) && <div style={{ height: "var(--spacing-sp120)" }} />}
        </div>

        {/* ── 컨텐츠 하단: 일정 개수만큼 dot, 현재만 강조 (주변 장소 overlay 중에는 숨김) ── */}
        {!overlayDetail && allDetailPayloads && allDetailPayloads.length > 1 && (
          <div style={{
            flexShrink: 0,
            padding: "var(--spacing-sp80) var(--spacing-sp200)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: SPACING.ms,
            background: "var(--color-surface-container-lowest)",
          }}>
            {allDetailPayloads.map((_, i) => {
              const active = i === curIdx;
              return (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: active ? "var(--color-primary)" : "var(--color-outline-variant)",
                    opacity: active ? 1 : 0.6,
                  }}
                  aria-hidden
                />
              );
            })}
          </div>
        )}

        {/* ── 하단 고정: 주변 장소 상세(overlay)일 때 일정추가 ── */}
        {overlayDetail && onAddToSchedule && overlayPlace && (
          <div style={{
            flexShrink: 0,
            padding: `${SPACING.xl} ${SPACING.xxl}`,
            borderTop: "1px solid var(--color-outline-variant)",
            background: "var(--color-surface)",
          }}>
            <Button variant="primary" size="lg" iconLeft="plus" fullWidth onClick={() => onAddToSchedule(overlayPlace)}>
              일정추가
            </Button>
          </div>
        )}

        {/* ── 하단 고정: 삭제 + 수정하기 (일정 아이템 상세일 때만) ── */}
        {!overlayDetail && (onEdit || onDelete) && (
          <div style={{
            flexShrink: 0,
            padding: `${SPACING.xl} ${SPACING.xxl}`,
            display: "flex",
            gap: SPACING.md,
            borderTop: "1px solid var(--color-outline-variant)",
            background: "var(--color-surface)",
          }}>
            {onDelete && (
              <Button variant="ghost-danger" size="lg" iconLeft="trash" onClick={() => onDelete(effectiveDetail)}>
                삭제
              </Button>
            )}
            {onEdit && (
              <Button variant="primary" size="lg" iconLeft="edit" onClick={() => onEdit(effectiveDetail)} fullWidth style={{ flex: 1 }}>
                수정하기
              </Button>
            )}
          </div>
        )}

        {/* 헤더 더보기 액션 시트: 다른 Day로 이동 */}
        {showMoreSheet && (
          <BottomSheet onClose={() => setShowMoreSheet(false)} maxHeight="auto" zIndex={3100} title="">
            <div style={{ padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.xxxl}` }}>
              <button
                type="button"
                onClick={() => {
                  setShowMoreSheet(false);
                  setShowMoveSheet(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACING.md,
                  width: "100%",
                  padding: `${SPACING.lg} ${SPACING.xl}`,
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  background: "transparent",
                  color: "var(--color-on-surface)",
                  fontSize: "var(--typo-label-2-medium-size)",
                  fontWeight: "var(--typo-label-2-medium-weight)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon name="pin" size={20} style={{ opacity: 0.7 }} />
                다른 Day로 이동
              </button>
            </div>
          </BottomSheet>
        )}

        {/* Day 선택 시트 (다른 Day로 이동) */}
        {showMoveSheet && (
          <BottomSheet onClose={() => setShowMoveSheet(false)} maxHeight="70vh" zIndex={3100} title="어느 날로 옮길까요?">
            <div style={{ padding: SPACING.xxxl, display: "flex", flexDirection: "column", gap: SPACING.sm }}>
              {moveDayOptions
                .filter((opt) => opt.displayIdx !== currentDayDisplayIdx)
                .map((opt) => (
                  <Button
                    key={opt.displayIdx}
                    variant="ghost-neutral"
                    size="lg"
                    fullWidth
                    onClick={() => {
                      onMoveToDay(effectiveDetail, opt.displayIdx);
                      setShowMoveSheet(false);
                    }}
                    style={{ justifyContent: "flex-start" }}
                  >
                    {opt.label}
                  </Button>
                ))}
            </div>
          </BottomSheet>
        )}
      </div>
    </BottomSheet>
  );
}
