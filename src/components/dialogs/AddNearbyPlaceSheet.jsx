import { useState, useEffect } from 'react';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import Icon from '../common/Icon';
import Skeleton from '../common/Skeleton';
import TimePickerDialog from '../common/TimePickerDialog';
import { SPACING, RADIUS } from '../../styles/tokens';

/**
 * 가벼운 바텀시트: 주변 추천 "일정추가" 시 시간만 선택.
 * 상단에 장소 정보(이름, 이미지, 주소) 확인용 표시.
 * onConfirm(place, time) → 저장 시 sectionIdx -1(extraItems)로 부모가 추가.
 */
export default function AddNearbyPlaceSheet({ place, onConfirm, onClose }) {
  const [time, setTime] = useState('12:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => { setImageLoaded(false); }, [place?.image_url]);

  if (!place) return null;

  const handleSave = () => {
    const t = (time || '').trim() || '12:00';
    if (!/^\d{1,2}:\d{2}$/.test(t)) {
      onConfirm(place, '12:00');
    } else {
      onConfirm(place, t);
    }
    onClose();
  };

  const name = place.name_ko || '장소';
  const address = place.short_address || place.address || '';

  return (
    <BottomSheet onClose={onClose} maxHeight="70vh" zIndex="var(--z-confirm)" title="일정에 추가">
      <div style={{ padding: `0 ${SPACING.xxl} ${SPACING.xxxl}` }}>
        {/* 장소 정보 (확인용) */}
        <div style={{
          marginBottom: SPACING.xxl,
          padding: SPACING.lg,
          borderRadius: RADIUS.md,
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-outline-variant)',
        }}>
          {place.image_url && (
            <div style={{ position: 'relative', width: '100%', height: 120, borderRadius: RADIUS.sm, overflow: 'hidden', marginBottom: SPACING.md }}>
              {!imageLoaded && <Skeleton style={{ position: 'absolute', inset: 0, borderRadius: RADIUS.sm }} />}
              <img
                src={place.image_url}
                alt=""
                onLoad={() => setImageLoaded(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  opacity: imageLoaded ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                }}
              />
            </div>
          )}
          <p style={{
            margin: 0,
            fontSize: 'var(--typo-label-1-n---bold-size)',
            fontWeight: 'var(--typo-label-1-n---bold-weight)',
            color: 'var(--color-on-surface)',
            marginBottom: SPACING.xs,
          }}>
            {name}
          </p>
          {address && (
            <p style={{
              margin: 0,
              fontSize: 'var(--typo-caption-2-regular-size)',
              color: 'var(--color-on-surface-variant2)',
              lineHeight: 1.4,
            }}>
              {address}
            </p>
          )}
        </div>

        {/* 시간 — iOS 스타일 휠 다이얼로그 */}
        <div style={{ marginBottom: SPACING.xxl }}>
          <div style={{
            paddingBottom: 'var(--spacing-sp40, 4px)',
            minHeight: 'var(--field-label-row-height, 20px)',
            display: 'flex',
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: 'var(--typo-caption-2-bold-size)',
              fontWeight: 'var(--typo-caption-2-bold-weight)',
              color: 'var(--color-on-surface-variant)',
            }}>
              시간
            </span>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowTimePicker(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTimePicker(true); } }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.md,
              minHeight: 'var(--height-lg, 48px)',
              padding: `0 ${SPACING.lx}`,
              border: '1px solid var(--color-outline-variant)',
              borderRadius: RADIUS.md,
              background: 'var(--color-surface-container-lowest)',
              cursor: 'pointer',
            }}
            aria-label="시간 선택"
          >
            <span style={{
              flex: 1,
              fontSize: 'var(--typo-label-1-n---regular-size)',
              color: 'var(--color-on-surface)',
            }}>
              {/^\d{1,2}:\d{2}$/.test(time) ? time : '12:00'}
            </span>
            <Icon name="chevronDown" size={18} style={{ opacity: 0.6 }} />
          </div>
        </div>
        <TimePickerDialog
          open={showTimePicker}
          value={time}
          onConfirm={(v) => setTime(v)}
          onClose={() => setShowTimePicker(false)}
        />

        <Button variant="primary" size="lg" fullWidth onClick={handleSave}>
          저장
        </Button>
      </div>
    </BottomSheet>
  );
}
