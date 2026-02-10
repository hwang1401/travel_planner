import Icon from '../common/Icon';
import Button from '../common/Button';
import { SPACING, RADIUS } from '../../styles/tokens';

/**
 * 주변 추천 가로 스크롤용 카드. 이미지/이름/거리/별점/일정추가.
 * RAG place 객체 (name_ko, image_url, type, _distKm, rating, ...) 사용.
 */
function formatDistance(distKm) {
  if (distKm == null || Number.isNaN(distKm)) return '';
  const m = Math.round(distKm * 1000);
  if (m < 1000) return `${m}m`;
  return `${(distKm).toFixed(1)}km`;
}

function formatWalkMinutes(distKm) {
  if (distKm == null || Number.isNaN(distKm)) return '';
  const minutes = Math.round((distKm * 1000) / 80);
  if (minutes <= 0) return '';
  return `도보 ${minutes}분`;
}

export default function NearbyPlaceCard({ place, onSelect, onAddToSchedule }) {
  if (!place) return null;
  const { name_ko, image_url, type, _distKm, rating, address } = place;

  const distanceText = _distKm != null ? (formatWalkMinutes(_distKm) || formatDistance(_distKm)) : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(place)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(place); } }}
      style={{
        flexShrink: 0,
        width: '140px',
        cursor: onSelect ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        scrollSnapAlign: 'start',
      }}
    >
      {/* Image / 플레이스홀더 (이미지 없을 때 통일된 placeholder) */}
      <div style={{
        width: '100%',
        aspectRatio: '4/3',
        background: image_url ? undefined : 'var(--color-surface-container-lowest)',
        display: image_url ? 'block' : 'flex',
        flexDirection: image_url ? undefined : 'column',
        alignItems: image_url ? undefined : 'center',
        justifyContent: image_url ? undefined : 'center',
        gap: image_url ? undefined : SPACING.xs,
        overflow: 'hidden',
        borderRadius: RADIUS.sm,
        border: image_url ? undefined : '1px dashed var(--color-outline-variant)',
      }}>
        {image_url ? (
          <img
            src={image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <>
            <Icon name="pin" size={24} style={{ opacity: 0.35, color: 'var(--color-on-surface-variant2)' }} />
            <span style={{
              fontSize: 'var(--typo-caption-2-regular-size)',
              color: 'var(--color-on-surface-variant2)',
              opacity: 0.8,
            }}>
              이미지 없음
            </span>
          </>
        )}
      </div>

      {/* 텍스트 + 일정추가: 이미지 아래 좌측 정렬 수직 나열 */}
      <div style={{
        width: '100%',
        paddingTop: SPACING.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xs,
        alignItems: 'flex-start',
        textAlign: 'left',
      }}>
        <p style={{
          margin: 0,
          fontSize: 'var(--typo-caption-1-bold-size)',
          fontWeight: 'var(--typo-caption-1-bold-weight)',
          color: 'var(--color-on-surface)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}>
          {name_ko || '장소'}
        </p>
        {distanceText && (
          <p style={{
            margin: 0,
            fontSize: 'var(--typo-caption-2-regular-size)',
            color: 'var(--color-on-surface-variant2)',
          }}>
            {distanceText}
          </p>
        )}
        {rating != null && !Number.isNaN(Number(rating)) && (
          <p style={{
            margin: 0,
            fontSize: 'var(--typo-caption-2-regular-size)',
            color: 'var(--color-on-surface-variant2)',
          }}>
            ★ {Number(rating).toFixed(1)}
          </p>
        )}
        {onAddToSchedule && (
          <Button
            variant="ghost-primary"
            size="xsm"
            iconLeft="plus"
            onClick={(e) => { e.stopPropagation(); onAddToSchedule(place); }}
            style={{ marginTop: SPACING.xs, paddingLeft: 0, paddingRight: 0 }}
          >
            일정추가
          </Button>
        )}
      </div>
    </div>
  );
}
