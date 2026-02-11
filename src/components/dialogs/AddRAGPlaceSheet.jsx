import { useState } from 'react';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import Field from '../common/Field';
import Icon from '../common/Icon';
import TimePickerDialog from '../common/TimePickerDialog';
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
export default function AddRAGPlaceSheet({ place, onConfirm, onClose }) {
  const [time, setTime] = useState('12:00');
  const [showTimePicker, setShowTimePicker] = useState(false);

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
      <div style={{ padding: SPACING.xxxl, display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
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

        {/* 시간 (편집 가능) — iOS 스타일 휠 다이얼로그 */}
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
          minuteStep={5}
          onConfirm={(v) => setTime(v)}
          onClose={() => setShowTimePicker(false)}
        />

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
