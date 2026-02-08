import { useState, useEffect } from 'react';
import { getPlacePhotoForItem } from '../../lib/googlePlaces';
import { getRegionImageForAddress } from '../../data/regionImages';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import ImageViewer from '../common/ImageViewer';
import InfoRow from '../common/InfoRow';
import CategoryBadge from '../common/CategoryBadge';
import TimetablePreview from '../common/TimetablePreview';
import { COLOR, SPACING, RADIUS } from '../../styles/tokens';

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

export default function DetailDialog({ detail, onClose, dayColor, onEdit, onDelete }) {
  if (!detail) return null;
  const [viewImage, setViewImage] = useState(null);
  const [fetchedImageUrl, setFetchedImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const accentColor = dayColor || COLOR.primary;

  /* Lazy-fetch place photo when we have address/coords but no image (e.g. AI schedule) */
  useEffect(() => {
    const hasLocation = (detail.address && detail.address.trim()) || (detail.lat != null && detail.lon != null);
    const hasNoImage = !detail.image && (!detail.images || !detail.images.length);
    if (!hasLocation || !hasNoImage) return;
    setImageLoading(true);
    getPlacePhotoForItem({ detail })
      .then((url) => { if (url) setFetchedImageUrl(url); })
      .catch(() => {})
      .finally(() => setImageLoading(false));
  }, [detail?.address, detail?.lat, detail?.lon, detail?.image, detail?.images]);

  /* Images: stored + optionally fetched */
  const images = detail.images && Array.isArray(detail.images) && detail.images.length > 0
    ? detail.images
    : detail.image ? [detail.image] : [];
  const sortedImages = detail.image && images.length > 1
    ? [detail.image, ...images.filter((img) => img !== detail.image)]
    : images;
  const regionFallback = getRegionImageForAddress(detail?.address);
  const displayImages = sortedImages.length > 0
    ? sortedImages
    : (fetchedImageUrl ? [fetchedImageUrl] : (regionFallback ? [regionFallback] : []));

  /* URLs */
  const directionsUrl = detail.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detail.address)}`
    : null;

  const px = "var(--spacing-sp200)";

  /* Data checks — 시간표는 detail 또는 _item.detail에서 가져옴 (리스트/merge 경로와 무관하게 노출) */
  const effectiveTimetable = (detail.timetable?.trains?.length ? detail.timetable : null)
    ?? (detail._item?.detail?.timetable?.trains?.length ? detail._item.detail.timetable : null);
  const hasTimetable = !!effectiveTimetable?.trains?.length;

  const hasPrice = !!detail.price;
  const hasTip = !!detail.tip;
  const hasHighlights = detail.highlights && detail.highlights.length > 0;

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh">
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* ── 헤더: 제목 + 뱃지 + 닫기 ── */}
        <div style={{
          padding: `var(--spacing-sp120) ${px}`,
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: "var(--spacing-sp80)",
          borderBottom: "1px solid var(--color-outline-variant)",
        }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "var(--spacing-sp80)" }}>
            <h3 style={{
              margin: 0,
              fontSize: "var(--typo-body-1-n---bold-size)",
              fontWeight: "var(--typo-body-1-n---bold-weight)",
              color: "var(--color-on-surface)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              flex: 1, minWidth: 0,
            }}>
              {detail.name}
            </h3>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', flexShrink: 0 }}>
              {(detail.categories && detail.categories.length > 0
                ? detail.categories
                : detail.category ? [detail.category] : []
              ).map((cat) => (
                <CategoryBadge key={cat} category={cat} />
              ))}
            </span>
          </div>
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} style={{ flexShrink: 0 }} />
        </div>

        {/* ── 스크롤 콘텐츠 (하단 고정 버튼과 갭 확보) ── */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain",
          ...((onEdit || onDelete) ? { paddingBottom: "24px" } : {}),
        }}>

        {/* ── 이미지: 헤더 바로 아래 (저장된 이미지 + 주소/좌표로 가져온 이미지) ── */}
        {imageLoading && displayImages.length === 0 && (
          <div style={{ padding: "var(--spacing-sp200)", textAlign: "center", color: "var(--color-on-surface-variant)" }}>
            이미지 불러오는 중…
          </div>
        )}
        {displayImages.length === 1 && (
          <div onClick={() => setViewImage(displayImages[0])}
            style={{
              width: "100%",
              aspectRatio: "16/9",
              overflow: "hidden",
              cursor: "zoom-in",
              background: COLOR.surfaceLowest,
            }}>
            <img src={displayImages[0]} alt={detail.name}
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
                <img src={img} alt={`${detail.name} ${i + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
        )}

        {/* ── 주소: 라벨 + 본문 (카드·구분선 없음) ── */}
        {detail.address && (
          <SectionWrap label="주소" px={px}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sp120)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontSize: "var(--typo-body-2-n---regular-size)",
                  lineHeight: "var(--typo-body-2-n---regular-line-height)",
                  color: "var(--color-on-surface-variant)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {detail.address}
                </p>
                {detail.hours && (
                  <p style={{
                    margin: "var(--spacing-sp20) 0 0",
                    fontSize: "var(--typo-caption-1-regular-size)",
                    lineHeight: "var(--typo-caption-1-regular-line-height)",
                    color: "var(--color-on-surface-variant2)",
                  }}>
                    {detail.hours}
                  </p>
                )}
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

        {/* ── 정보 섹션: 비용, 영업시간 ── */}
        {hasPrice && (
          <SectionWrap label="정보" px={px}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sp80)" }}>
              {hasPrice && <InfoRow icon="pricetag">{detail.price}</InfoRow>}
            </div>
          </SectionWrap>
        )}

        {/* ── 메모: 라벨 + 본문 (카드 없음) ── */}
        {hasTip && (
          <SectionWrap label="메모" px={px}>
            <p style={{
              margin: 0,
              fontSize: "var(--typo-body-2-n---regular-size)",
              lineHeight: "var(--typo-body-2-n---regular-line-height)",
              color: "var(--color-on-surface-variant)",
              whiteSpace: "pre-line",
            }}>
              {detail.tip}
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
                {detail.highlights.map((h, i) => {
                  const isNote = h.startsWith("[");
                  return (
                    <div key={i} style={{ display: "flex", gap: SPACING.lg, alignItems: "flex-start" }}>
                      <div style={{
                        width: "5px", height: "5px", borderRadius: RADIUS.full,
                        background: isNote ? COLOR.onSurfaceVariant2 : accentColor,
                        flexShrink: 0, marginTop: "6px",
                      }} />
                      <span style={{
                        fontSize: "var(--typo-label-1-n---regular-size)",
                        lineHeight: "var(--typo-label-1-n---regular-line-height)",
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

        {/* ── 교통 타임테이블 (공통 컴포넌트) ── */}
        {hasTimetable && (
          <SectionWrap label={`${effectiveTimetable.station} → ${effectiveTimetable.direction}`} px={px}>
            <TimetablePreview timetable={effectiveTimetable} variant="full" accentColor={accentColor} />
          </SectionWrap>
        )}

        {(!onEdit && !onDelete) && <div style={{ height: "var(--spacing-sp120)" }} />}
        </div>

        {/* ── 하단 고정: 삭제 + 수정하기 (수정 모달과 동일 스타일) ── */}
        {(onEdit || onDelete) && (
          <div style={{
            flexShrink: 0,
            padding: "16px 20px calc(16px + env(safe-area-inset-bottom, 0px))",
            display: "flex",
            gap: "8px",
            borderTop: "1px solid var(--color-outline-variant)",
            background: "var(--color-surface)",
          }}>
            {onDelete && (
              <Button variant="ghost-danger" size="lg" iconLeft="trash" onClick={() => onDelete(detail)}>
                삭제
              </Button>
            )}
            {onEdit && (
              <Button variant="primary" size="lg" iconLeft="edit" onClick={() => onEdit(detail)} fullWidth style={{ flex: 1 }}>
                수정하기
              </Button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
