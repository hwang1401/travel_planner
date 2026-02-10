import { useState } from 'react';
import Field from '../common/Field';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import { SPACING } from '../../styles/tokens';

/**
 * Day 추가 다이얼로그.
 * "추가" 시 마지막 Day + 1로 자동 추가. 라벨(날짜 이름)만 입력 가능(선택).
 * 비우면 "Day N"으로 저장.
 */
export default function AddDayDialog({ onAdd, onCancel, existingDays = [] }) {
  const [label, setLabel] = useState('');

  const handleSubmit = () => {
    onAdd(label.trim());
  };

  return (
    <BottomSheet onClose={onCancel} maxHeight="auto" zIndex={3000} title="날짜 추가">
      <div style={{ padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.xxxl}` }}>
        <div style={{ marginBottom: SPACING.xxl }}>
          <Field
            label="날짜 이름 (선택)"
            size="lg"
            variant="outlined"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="비우면 Day N으로 저장돼요"
          />
        </div>

        <div style={{ display: 'flex', gap: SPACING.ml }}>
          <Button variant="neutral" size="lg" onClick={onCancel} style={{ flex: 1, borderColor: 'var(--color-outline-variant)' }}>
            취소
          </Button>
          <Button variant="primary" size="lg" onClick={handleSubmit} style={{ flex: 1 }}>
            추가
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
