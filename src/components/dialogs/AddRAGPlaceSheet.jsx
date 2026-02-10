import { useState } from 'react';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import Field from '../common/Field';
import { TYPE_LABELS } from '../../styles/tokens';
import { SPACING, RADIUS } from '../../styles/tokens';

/**
 * RAG 장소를 일정에 추가할 때 쓰는 바텀시트.
 * 기존 일정 추가 폼(EditItemDialog/AddPlacePage)과 동일한 필드(일정명, 유형, 시간, 주소, 이미지)를
 * RAG 데이터로 프리필하고, 사용자는 시간만 선택해 저장하면 됨.
 *
 * 매핑: desc ← name_ko, type ← type, detail.image ← image_url,
 *       detail.placeId ← google_place_id, detail.address ← address, detail.lat/lon ← lat/lon
 */
const timeOptions = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    timeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

export default function AddRAGPlaceSheet({ place, onConfirm, onClose }) {
  const [time, setTime] = useState('12:00');

  if (!place) return null;

  const handleSave = () => {
    const t = (time || '').trim() || '12:00';
    const item = {
      desc: place.name_ko || '',
      type: place.type || 'spot',
      time: /^\d{1,2}:\d{2}$/.test(t) ? t : '12:00',
      _custom: true,
      ...(place.description?.trim() ? { sub: place.description.trim() } : {}),
      detail: {
        name: place.name_ko,
        address: place.address,
        lat: place.lat,
        lon: place.lon,
        image: place.image_url,
        placeId: place.google_place_id,
      },
    };
    onConfirm(item);
    onClose();
  };

  const typeLabel = TYPE_LABELS[place.type] || '정보';

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh" zIndex="var(--z-confirm)" title="일정에 추가">
      <div style={{ padding: `0 ${SPACING.xxl} ${SPACING.xxxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
        {/* 일정명 (프리필, 읽기 전용) */}
        <Field
          label="일정명"
          size="lg"
          variant="outlined"
          value={place.name_ko || ''}
          disabled
          style={{ background: 'var(--color-surface-container-lowest)' }}
        />

        {/* 유형 (프리필, 읽기 전용) */}
        <Field
          label="유형"
          size="lg"
          variant="outlined"
          value={typeLabel}
          disabled
          style={{ background: 'var(--color-surface-container-lowest)' }}
        />

        {/* 시간 (편집 가능) */}
        <Field
          as="select"
          label="시간"
          required
          size="lg"
          variant="outlined"
          value={time}
          onChange={(e) => setTime(e.target.value || '12:00')}
        >
          {timeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Field>

        {/* 주소 (프리필, 읽기 전용) */}
        {place.address && (
          <Field
            label="주소"
            size="lg"
            variant="outlined"
            value={place.address}
            disabled
            style={{ background: 'var(--color-surface-container-lowest)' }}
          />
        )}

        {/* 이미지 (프리필, 확인용) */}
        {place.image_url && (
          <div>
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
                이미지
              </span>
            </div>
            <img
              src={place.image_url}
              alt=""
              style={{
                width: '100%',
                maxHeight: '160px',
                objectFit: 'cover',
                borderRadius: RADIUS.md,
                border: '1px solid var(--color-outline-variant)',
              }}
            />
          </div>
        )}

        <Button variant="primary" size="lg" fullWidth onClick={handleSave}>
          저장
        </Button>
      </div>
    </BottomSheet>
  );
}
