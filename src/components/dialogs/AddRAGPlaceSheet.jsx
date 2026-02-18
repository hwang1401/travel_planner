import { useState, useMemo, useEffect } from 'react';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import Field from '../common/Field';
import Icon from '../common/Icon';
import Skeleton from '../common/Skeleton';
import Tab from '../common/Tab';
import ChipSelector from '../common/ChipSelector';
import TimePickerDialog from '../common/TimePickerDialog';
import { TYPE_LABELS, SPACING, RADIUS } from '../../styles/tokens';
import { buildPlaceDetail } from '../../utils/itemBuilder';

/**
 * RAG 장소를 일정에 추가할 때 쓰는 바텀시트.
 * 일정명, 유형, 시간, 이미지를 편집 가능하게 프리필.
 */

const TYPE_OPTIONS = Object.entries(TYPE_LABELS)
  .filter(([k]) => k !== 'move' && k !== 'flight')
  .map(([value, label]) => ({ label, value }));

export default function AddRAGPlaceSheet({ place, onConfirm, onClose, allDays, selectedDayIdx }) {
  const [name, setName] = useState(place?.name_ko || '');
  const [type, setType] = useState(place?.type || 'spot');
  const [time, setTime] = useState('12:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [formDayIdx, setFormDayIdx] = useState(selectedDayIdx ?? 0);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => { setImageLoaded(false); }, [place?.image_url]);

  const hasDayTabs = Array.isArray(allDays) && allDays.length > 1;
  const dayTabItems = useMemo(() => {
    if (!hasDayTabs) return [];
    return allDays.map((d, i) => ({ label: `D${d.day ?? i + 1}`, value: i }));
  }, [allDays, hasDayTabs]);

  if (!place) return null;

  const handleSave = () => {
    const t = (time || '').trim() || '12:00';
    const detail = buildPlaceDetail(place);
    if (imageRemoved) detail.image = null;
    const item = {
      desc: name.trim() || place.name_ko || '',
      type: type || 'spot',
      time: /^\d{1,2}:\d{2}$/.test(t) ? t : '12:00',
      _custom: true,
      ...(place.description?.trim() ? { sub: place.description.trim() } : {}),
      detail,
    };
    onConfirm(item, formDayIdx);
    onClose();
  };

  const showImage = !imageRemoved && place.image_url;

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh" zIndex="var(--z-confirm)" title="일정에 추가">
      <div style={{ padding: SPACING.xxxl, display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
        {/* Day 선택 */}
        {hasDayTabs && (
          <div>
            <div style={{
              paddingBottom: 'var(--spacing-sp40, 4px)',
              minHeight: 'var(--field-label-row-height, 20px)',
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                fontSize: 'var(--typo-caption-2-bold-size)',
                fontWeight: 'var(--typo-caption-2-bold-weight)',
                color: 'var(--color-on-surface-variant)',
              }}>추가할 Day</span>
            </div>
            <Tab items={dayTabItems} value={formDayIdx} onChange={setFormDayIdx} variant="pill" size="sm" />
          </div>
        )}

        {/* 일정명 */}
        <Field
          label="일정명"
          size="lg"
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ background: 'var(--color-surface-container-lowest)' }}
        />

        {/* 유형 */}
        <div>
          <div style={{
            paddingBottom: 'var(--spacing-sp40, 4px)',
            minHeight: 'var(--field-label-row-height, 20px)',
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{
              fontSize: 'var(--typo-caption-2-bold-size)',
              fontWeight: 'var(--typo-caption-2-bold-weight)',
              color: 'var(--color-on-surface-variant)',
            }}>유형</span>
          </div>
          <ChipSelector
            items={TYPE_OPTIONS}
            value={type}
            onChange={setType}
            variant="pill"
            size="ms"
            style={{ gap: SPACING.md, flexWrap: 'wrap' }}
          />
        </div>

        {/* 시간 — iOS 스타일 휠 다이얼로그 */}
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

        {/* 주소 (읽기 전용) */}
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

        {/* 이미지 */}
        {showImage && (
          <div>
            <div style={{
              paddingBottom: 'var(--spacing-sp40, 4px)',
              minHeight: 'var(--field-label-row-height, 20px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: 'var(--typo-caption-2-bold-size)',
                fontWeight: 'var(--typo-caption-2-bold-weight)',
                color: 'var(--color-on-surface-variant)',
              }}>
                이미지
              </span>
              <Button variant="ghost-neutral" size="xs" iconOnly="close" onClick={() => setImageRemoved(true)} title="이미지 제거" />
            </div>
            <div style={{ position: 'relative', width: '100%', maxHeight: 160, borderRadius: RADIUS.md, overflow: 'hidden', border: '1px solid var(--color-outline-variant)' }}>
              {!imageLoaded && <Skeleton style={{ position: 'absolute', inset: 0, borderRadius: RADIUS.md }} />}
              <img
                src={place.image_url}
                alt=""
                onLoad={() => setImageLoaded(true)}
                style={{
                  width: '100%',
                  maxHeight: '160px',
                  objectFit: 'cover',
                  display: 'block',
                  opacity: imageLoaded ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        <Button variant="primary" size="lg" fullWidth onClick={handleSave}>
          저장
        </Button>
      </div>
    </BottomSheet>
  );
}
