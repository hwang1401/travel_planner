import { useState } from 'react';
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
  const accentColor = dayColor || COLOR.primary;

  /* Images: stored only (no auto-fetch) */
  const images = detail.images && Array.isArray(detail.images) && detail.images.length > 0
    ? detail.images
    : detail.image ? [detail.image] : [];
  const displayImages = detail.image && images.length > 1
    ? [detail.image, ...images.filter((img) => img !== detail.image)]
    : images;

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

        {/* ── 스크롤 콘텐츠 (PWA/iOS 세부 스크롤, 하단 갭만 최소로) ── */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch", touchAction: "pan-y",
          ...((onEdit || onDelete) ? { paddingBottom: "12px" } : {}),
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

        {/* ── 하단 고정: 삭제 + 수정하기. 세이프에리어는 BottomSheet 시트가 이미 적용함 → 푸터에서는 제외(중복 시 iOS 하단 여백 두 배) ── */}
        {(onEdit || onDelete) && (
          <div style={{
            flexShrink: 0,
            padding: "16px 20px",
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
