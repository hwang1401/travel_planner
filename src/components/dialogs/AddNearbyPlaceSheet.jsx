import { useState } from 'react';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import Field from '../common/Field';
import { SPACING, RADIUS } from '../../styles/tokens';

/**
 * 가벼운 바텀시트: 주변 추천 "일정추가" 시 시간만 선택.
 * 상단에 장소 정보(이름, 이미지, 주소) 확인용 표시.
 * onConfirm(place, time) → 저장 시 sectionIdx -1(extraItems)로 부모가 추가.
 */
export default function AddNearbyPlaceSheet({ place, onConfirm, onClose }) {
  const [time, setTime] = useState('12:00');

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
  const address = place.address || '';

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
            <img
              src={place.image_url}
              alt=""
              style={{
                width: '100%',
                height: '120px',
                objectFit: 'cover',
                borderRadius: RADIUS.sm,
                marginBottom: SPACING.md,
                display: 'block',
              }}
            />
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

        {/* 시간 */}
        <div style={{ marginBottom: SPACING.xxl }}>
          <Field
            as="input"
            label="시간"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value || '12:00')}
            size="lg"
          />
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={handleSave}>
          저장
        </Button>
      </div>
    </BottomSheet>
  );
}
