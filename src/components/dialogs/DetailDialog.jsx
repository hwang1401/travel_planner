import { useState } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import ImageViewer from '../common/ImageViewer';
import InfoRow from '../common/InfoRow';
import CategoryBadge from '../common/CategoryBadge';
import { COLOR, SPACING, RADIUS } from '../../styles/tokens';

/**
 * ── DetailDialog ──
 * "바로 꺼내기" — 여행 중 일정 정보를 즉시 확인.
 *
 * 구조:
 *   헤더 (고정) → 주소+길찾기 (퀵 액세스) → 이미지 → 정보 → 메모 → 포인트 → 교통 → 맵 → 수정
 *
 * 원칙:
 *   - 있는 것만 렌더, 빈 섹션은 그리지 않음
 *   - 섹션 구분: 소형 라벨 + 여백 (구분선은 주소 블록에만)
 *   - 메모: 카드형 (rounded + 배경)
 *   - 미니맵: 정적 이미지, 로드 실패 시 텍스트 링크로 대체
 *   - 높이: 콘텐츠에 맞춰 자동
 */

/* ── 내부 헬퍼 ── */

const SectionLabel = ({ children }) => (
  <p style={{
    margin: "0 0 var(--spacing-sp80)",
    fontSize: "var(--typo-caption-2-bold-size)",
    fontWeight: "var(--typo-caption-2-bold-weight)",
    color: "var(--color-on-surface-variant2)",
    letterSpacing: "0.3px",
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

export default function DetailDialog({ detail, onClose, dayColor, onEdit }) {
  if (!detail) return null;
  const [viewImage, setViewImage] = useState(null);
  const [mapError, setMapError] = useState(false);
  const accentColor = dayColor || COLOR.primary;

  /* Images */
  const images = detail.images && Array.isArray(detail.images) && detail.images.length > 0
    ? detail.images
    : detail.image ? [detail.image] : [];
  const sortedImages = detail.image && images.length > 1
    ? [detail.image, ...images.filter((img) => img !== detail.image)]
    : images;

  /* URLs */
  const directionsUrl = detail.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detail.address)}`
    : null;
  const mapUrl = (detail.lat && detail.lon)
    ? directionsUrl || `https://www.google.com/maps?q=${detail.lat},${detail.lon}`
    : null;

  const px = "var(--spacing-sp200)";

  /* Data checks */
  const hasPrice = !!detail.price;
  const hasTip = !!detail.tip;
  const hasHighlights = detail.highlights && detail.highlights.length > 0;
  const hasTimetable = !!detail.timetable;
  const hasCoords = !!(detail.lat && detail.lon);

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh">
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
          <CategoryBadge category={detail.category} style={{ flexShrink: 0 }} />
        </div>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} style={{ flexShrink: 0 }} />
      </div>

      {/* ── 스크롤 콘텐츠 ── */}
      <div style={{ overflowY: "auto", overscrollBehavior: "contain" }}>

        {/* ── 퀵 액세스: 주소 + 길찾기 (유일하게 borderBottom 유지) ── */}
        {detail.address && (
          <div style={{
            padding: `var(--spacing-sp120) ${px}`,
            display: "flex", alignItems: "center", gap: "var(--spacing-sp80)",
            borderBottom: "1px solid var(--color-outline-variant)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0,
                fontSize: "var(--typo-caption-1-regular-size)",
                lineHeight: "var(--typo-caption-1-regular-line-height)",
                color: "var(--color-on-surface-variant)",
              }}>
                {detail.address}
              </p>
              {detail.hours && (
                <p style={{
                  margin: "var(--spacing-sp20) 0 0",
                  fontSize: "var(--typo-caption-2-regular-size)",
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
        )}

        {/* ── 이미지: 히어로 또는 캐러셀 ── */}
        {sortedImages.length === 1 && (
          <div onClick={() => setViewImage(sortedImages[0])}
            style={{ overflow: "hidden", cursor: "zoom-in", background: COLOR.surfaceLow }}>
            <img src={sortedImages[0]} alt={detail.name}
              style={{ width: "100%", display: "block", maxHeight: "240px", objectFit: "contain" }} />
          </div>
        )}
        {sortedImages.length > 1 && (
          <div style={{
            overflowX: "auto", overflowY: "hidden",
            display: "flex", gap: "var(--spacing-sp60)", padding: `var(--spacing-sp120) ${px}`,
            scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
          }}>
            {sortedImages.map((img, i) => (
              <div key={i} onClick={() => setViewImage(img)} style={{
                flexShrink: 0, width: "75%", scrollSnapAlign: "start",
                borderRadius: RADIUS.md, overflow: "hidden",
                cursor: "zoom-in", background: COLOR.surfaceLow,
              }}>
                <img src={img} alt={`${detail.name} ${i + 1}`}
                  style={{ width: "100%", height: "180px", objectFit: "contain", display: "block" }} />
              </div>
            ))}
          </div>
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

        {/* ── 메모 섹션: 카드형 ── */}
        {hasTip && (
          <SectionWrap label="메모" px={px}>
            <div style={{
              padding: "var(--spacing-sp120) var(--spacing-sp160)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface-container-low)",
            }}>
              <p style={{
                margin: 0,
                fontSize: "var(--typo-caption-1-regular-size)",
                lineHeight: 1.6,
                color: "var(--color-on-surface-variant)",
                whiteSpace: "pre-line",
              }}>
                {detail.tip}
              </p>
            </div>
          </SectionWrap>
        )}

        {/* ── 포인트/하이라이트 ── */}
        {hasHighlights && (
          <SectionWrap label="포인트" px={px}>
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
                      fontSize: "var(--typo-caption-1-regular-size)",
                      lineHeight: 1.6,
                      color: isNote ? COLOR.onSurfaceVariant : COLOR.onSurface,
                    }}>
                      {h}
                    </span>
                  </div>
                );
              })}
            </div>
          </SectionWrap>
        )}

        {/* ── 교통 타임테이블 ── */}
        {hasTimetable && (
          <SectionWrap label={`${detail.timetable.station} → ${detail.timetable.direction}`} px={px}>
            <div style={{
              borderRadius: RADIUS.md, overflow: "hidden",
              border: `1px solid ${COLOR.outlineVariant}`,
            }}>
              <div style={{
                display: "flex", padding: `${SPACING.md} ${SPACING.lg}`,
                background: COLOR.surfaceLow,
                borderBottom: `1px solid ${COLOR.outlineVariant}`,
                fontSize: "var(--typo-caption-3-bold-size)",
                fontWeight: "var(--typo-caption-3-bold-weight)",
                color: COLOR.onSurfaceVariant,
              }}>
                <span style={{ width: "52px", flexShrink: 0 }}>시각</span>
                <span style={{ flex: 1 }}>열차명</span>
                <span style={{ flex: 1, textAlign: "right" }}>행선 / 소요</span>
              </div>
              {detail.timetable.trains.map((t, i) => (
                <div key={i} style={{
                  display: "flex", flexDirection: "column",
                  padding: `${SPACING.md} ${SPACING.lg}`,
                  background: t.picked ? COLOR.surfaceLow : COLOR.surfaceLowest,
                  borderBottom: i < detail.timetable.trains.length - 1 ? `1px solid ${COLOR.outlineVariant}` : "none",
                  borderLeft: t.picked ? `3px solid ${accentColor}` : "3px solid transparent",
                }}>
                  {t.picked && (
                    <span style={{
                      alignSelf: "flex-start",
                      fontSize: "var(--typo-caption-3-bold-size)",
                      fontWeight: "var(--typo-caption-3-bold-weight)",
                      color: accentColor, letterSpacing: "0.3px", marginBottom: SPACING.sm,
                    }}>
                      탑승 예정
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{
                      width: "52px", flexShrink: 0, fontVariantNumeric: "tabular-nums",
                      fontSize: t.picked ? "var(--typo-label-1-n---bold-size)" : "var(--typo-caption-1-medium-size)",
                      fontWeight: t.picked ? "var(--typo-label-1-n---bold-weight)" : "var(--typo-caption-1-medium-weight)",
                      color: t.picked ? accentColor : COLOR.onSurfaceVariant,
                    }}>
                      {t.time}
                    </span>
                    <span style={{
                      flex: 1,
                      fontSize: t.picked ? "var(--typo-label-2-bold-size)" : "var(--typo-caption-2-medium-size)",
                      fontWeight: t.picked ? "var(--typo-label-2-bold-weight)" : "var(--typo-caption-2-medium-weight)",
                      color: COLOR.onSurface,
                    }}>
                      {t.name}
                    </span>
                    <span style={{
                      flex: 1, textAlign: "right",
                      fontSize: "var(--typo-caption-3-regular-size)",
                      fontWeight: t.picked ? "var(--typo-caption-3-bold-weight)" : "var(--typo-caption-3-regular-weight)",
                      color: COLOR.onSurfaceVariant2, lineHeight: 1.4,
                    }}>
                      <span style={{ display: "block" }}>{t.dest}</span>
                      <span style={{ fontSize: "var(--typo-caption-3-regular-size)", opacity: 0.8 }}>{t.note}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SectionWrap>
        )}

        {/* ── 미니맵: 정적 이미지, 실패 시 텍스트 링크 ── */}
        {hasCoords && mapUrl && (
          <SectionWrap px={px}>
            {mapError ? (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: "var(--spacing-sp60)",
                  padding: "var(--spacing-sp120) var(--spacing-sp160)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-surface-container-low)",
                  color: "var(--color-primary)",
                  fontSize: "var(--typo-caption-1-medium-size)",
                  fontWeight: "var(--typo-caption-1-medium-weight)",
                  textDecoration: "none",
                }}>
                <Icon name="pin" size={14} />
                지도에서 보기
              </a>
            ) : (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", borderRadius: RADIUS.md, overflow: "hidden", border: `1px solid ${COLOR.outlineVariant}` }}>
                <img
                  src={`https://staticmap.openstreetmap.de/staticmap.php?center=${detail.lat},${detail.lon}&zoom=15&size=400x120&markers=${detail.lat},${detail.lon},red-pushpin`}
                  alt="지도" loading="lazy"
                  onError={() => setMapError(true)}
                  style={{ width: "100%", height: "100px", objectFit: "cover", display: "block" }}
                />
              </a>
            )}
          </SectionWrap>
        )}

        {/* ── 수정하기 (맨 아래) ── */}
        {onEdit && (
          <div style={{ padding: `var(--spacing-sp200) ${px} var(--spacing-sp160)` }}>
            <Button variant="neutral" size="md" fullWidth
              onClick={() => { onEdit(detail); onClose(); }}
              iconLeft="edit">
              수정하기
            </Button>
          </div>
        )}

        {!onEdit && <div style={{ height: "var(--spacing-sp120)" }} />}
      </div>
    </BottomSheet>
  );
}
