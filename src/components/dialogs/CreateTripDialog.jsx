import { useState, useCallback, useMemo } from 'react';
import Button from '../common/Button';
import Field from '../common/Field';
import Icon from '../common/Icon';
import AddressSearch from '../common/AddressSearch';
import BottomSheet from '../common/BottomSheet';
import ImagePicker from '../common/ImagePicker';
import { uploadImage, generateImagePath } from '../../services/imageService';

/*
 * ── Create Trip Dialog ──
 * Full-screen style bottom sheet for creating a new trip
 */

/* ── Date Picker BottomSheet ── */
function DatePickerSheet({ label, value, onChange, onClose, minDate }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(value ? new Date(value).getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value ? new Date(value).getMonth() : today.getMonth());

  const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const handlePrev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const handleNext = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const isDisabled = (day) => {
    if (!day || !minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    return d < new Date(minDate);
  };

  const isSelected = (day) => {
    if (!day || !value) return false;
    const sel = new Date(value);
    return sel.getFullYear() === viewYear && sel.getMonth() === viewMonth && sel.getDate() === day;
  };

  const isToday = (day) => {
    if (!day) return false;
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  const handleSelect = (day) => {
    if (!day || isDisabled(day)) return;
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} maxHeight="auto" zIndex={4000}>
      <div style={{ padding: '8px 20px 20px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <h3 style={{
            margin: 0, fontSize: 'var(--typo-body-2-n---bold-size)',
            fontWeight: 'var(--typo-body-2-n---bold-weight)', color: 'var(--color-on-surface)',
          }}>
            {label}
          </h3>
        </div>

        {/* Month navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '12px',
        }}>
          <button onClick={handlePrev} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            padding: '6px', display: 'flex',
          }}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <span style={{
            fontSize: 'var(--typo-label-1-n---bold-size)',
            fontWeight: 'var(--typo-label-1-n---bold-weight)',
            color: 'var(--color-on-surface)',
          }}>
            {viewYear}년 {viewMonth + 1}월
          </span>
          <button onClick={handleNext} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            padding: '6px', display: 'flex',
          }}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        {/* Weekday header */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0',
          marginBottom: '4px',
        }}>
          {DAYS_KR.map((d) => (
            <div key={d} style={{
              textAlign: 'center', padding: '4px 0',
              fontSize: 'var(--typo-caption-3-medium-size)',
              fontWeight: 'var(--typo-caption-3-medium-weight)',
              color: d === '일' ? 'var(--color-error)' : d === '토' ? 'var(--color-primary)' : 'var(--color-on-surface-variant2)',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px',
        }}>
          {calendarDays.map((day, i) => {
            const disabled = isDisabled(day);
            const selected = isSelected(day);
            const todayMark = isToday(day);
            return (
              <div key={i}
                onClick={() => handleSelect(day)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '38px', borderRadius: 'var(--radius-md, 8px)',
                  cursor: day && !disabled ? 'pointer' : 'default',
                  background: selected ? 'var(--color-primary)' : 'transparent',
                  color: selected ? 'var(--color-on-primary)'
                    : disabled ? 'var(--color-outline-variant)'
                    : todayMark ? 'var(--color-primary)'
                    : 'var(--color-on-surface)',
                  fontSize: 'var(--typo-label-2-medium-size)',
                  fontWeight: selected || todayMark ? 'var(--typo-label-2-bold-weight)' : 'var(--typo-label-2-medium-weight)',
                  transition: 'background 0.1s',
                  position: 'relative',
                }}
              >
                {day}
                {todayMark && !selected && (
                  <div style={{
                    position: 'absolute', bottom: '4px',
                    width: '4px', height: '4px', borderRadius: '50%',
                    background: 'var(--color-primary)',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}

export default function CreateTripDialog({ onClose, onCreate, editTrip }) {
  const isEdit = !!editTrip;
  const [name, setName] = useState(editTrip?.name || '');
  const [destinations, setDestinations] = useState(
    editTrip?.destinations?.map((d) => typeof d === 'string' ? { name: d } : d) || []
  );
  const [destInput, setDestInput] = useState('');
  const [startDate, setStartDate] = useState(editTrip?.startDate || '');
  const [endDate, setEndDate] = useState(editTrip?.endDate || '');
  const [datePickerTarget, setDatePickerTarget] = useState(null); // 'start' | 'end' | null
  const [coverImage, setCoverImage] = useState(editTrip?.coverImage || '');
  const [coverUploading, setCoverUploading] = useState(false);

  /* ── Destination helpers ── */
  const addDestination = useCallback((dest, lat, lon) => {
    if (!dest || !dest.trim()) return;
    const trimmed = dest.trim();
    if (destinations.some((d) => d.name === trimmed)) return;
    setDestinations((prev) => [...prev, { name: trimmed, lat: lat || null, lon: lon || null }]);
    setDestInput('');
  }, [destinations]);

  const removeDestination = useCallback((idx) => {
    setDestinations((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  /* ── Date display helper ── */
  const formatDateDisplay = useCallback((dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
  }, []);

  /* ── Cover image upload ── */
  const handleCoverFile = useCallback(async (file) => {
    setCoverUploading(true);
    try {
      // Use editTrip id or a temp id for new trips
      const id = editTrip?.id || `tmp_${Date.now()}`;
      const path = generateImagePath(id, 'cover');
      const url = await uploadImage(file, path);
      setCoverImage(url);
    } catch (err) {
      console.error('Cover upload error:', err);
    } finally {
      setCoverUploading(false);
    }
  }, [editTrip]);

  const handleCoverRemove = useCallback(() => {
    setCoverImage('');
  }, []);

  /* ── Submit ── */
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim() && startDate && !submitting && !coverUploading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        destinations: destinations.map((d) => d.name),
        startDate,
        endDate: endDate || startDate,
        coverImage: coverImage || '',
        ...(isEdit ? { tripId: editTrip.id } : {}),
      });
    } catch (err) {
      console.error(isEdit ? 'Edit trip error:' : 'Create trip error:', err);
      setSubmitting(false);
    }
  };

  /* ── Duration calc ── */
  const duration = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1)
    : null;

  return (
    <BottomSheet onClose={onClose} maxHeight="92vh">
      {/* Header */}
      <div style={{
        padding: '6px 16px 12px 20px', flexShrink: 0,
        borderBottom: '1px solid var(--color-outline-variant)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h3 style={{ margin: 0, fontSize: 'var(--typo-body-1-n---bold-size)', fontWeight: 'var(--typo-body-1-n---bold-weight)', color: 'var(--color-on-surface)' }}>
          {isEdit ? '여행 수정' : '새 여행 만들기'}
        </h3>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Cover Image ── */}
        <section>
          <p style={{
            margin: '0 0 10px', fontSize: 'var(--typo-caption-1-bold-size)',
            fontWeight: 'var(--typo-caption-1-bold-weight)', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            커버 이미지
          </p>
          <ImagePicker
            value={coverImage}
            onChange={handleCoverFile}
            onRemove={handleCoverRemove}
            placeholder="여행 커버 이미지를 선택하세요"
            aspect="cover"
            uploading={coverUploading}
          />
        </section>

        {/* ── Section: 여행 정보 ── */}
        <section>
          <p style={{
            margin: '0 0 12px', fontSize: 'var(--typo-caption-1-bold-size)',
            fontWeight: 'var(--typo-caption-1-bold-weight)', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            여행 정보
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label="여행 이름" required size="lg" variant="outlined"
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="예: 후쿠오카 가족여행" />

            {/* Destinations */}
            <div>
              <AddressSearch
                label="여행지"
                value={destInput}
                onChange={(addr, lat, lon) => {
                  if (addr) addDestination(addr, lat, lon);
                  else setDestInput('');
                }}
                placeholder="도시 또는 장소를 검색하세요"
                size="lg"
              />
              {/* Destination chips */}
              {destinations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {destinations.map((dest, i) => (
                    <div key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 10px', borderRadius: 'var(--radius-md, 8px)',
                      background: 'var(--color-primary-container)',
                      fontSize: 'var(--typo-caption-1-bold-size)',
                      fontWeight: 'var(--typo-caption-1-bold-weight)',
                      color: 'var(--color-on-primary-container)',
                    }}>
                      <Icon name="pin" size={12} />
                      {dest.name}
                      <button onClick={() => removeDestination(i)} style={{
                        border: 'none', background: 'none', cursor: 'pointer',
                        padding: '0 0 0 2px', display: 'flex', alignItems: 'center',
                      }}>
                        <Icon name="close" size={12} style={{ opacity: 0.6 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Section: 일정 ── */}
        <section>
          <p style={{
            margin: '0 0 12px', fontSize: 'var(--typo-caption-1-bold-size)',
            fontWeight: 'var(--typo-caption-1-bold-weight)', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            일정
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Start date: tappable field */}
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                paddingBottom: 'var(--spacing-sp40, 4px)',
              }}>
                <span style={{
                  fontSize: 'var(--typo-caption-2-bold-size)',
                  fontWeight: 'var(--typo-caption-2-bold-weight)',
                  color: 'var(--color-on-surface-variant)',
                }}>출발일</span>
                <span style={{ color: 'var(--color-error)', fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)' }}>*</span>
              </div>
              <div
                onClick={() => setDatePickerTarget('start')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', height: 'var(--height-lg, 36px)',
                  padding: '0 var(--spacing-sp140, 14px)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: 'var(--radius-md, 8px)',
                  cursor: 'pointer', boxSizing: 'border-box',
                }}
              >
                <Icon name="calendar" size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
                <span style={{
                  flex: 1, fontSize: 'var(--typo-label-1-n---regular-size)',
                  color: startDate ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {startDate ? formatDateDisplay(startDate) : '날짜 선택'}
                </span>
              </div>
            </div>

            {/* End date: tappable field */}
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                paddingBottom: 'var(--spacing-sp40, 4px)',
              }}>
                <span style={{
                  fontSize: 'var(--typo-caption-2-bold-size)',
                  fontWeight: 'var(--typo-caption-2-bold-weight)',
                  color: 'var(--color-on-surface-variant)',
                }}>귀국일</span>
              </div>
              <div
                onClick={() => setDatePickerTarget('end')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', height: 'var(--height-lg, 36px)',
                  padding: '0 var(--spacing-sp140, 14px)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: 'var(--radius-md, 8px)',
                  cursor: 'pointer', boxSizing: 'border-box',
                }}
              >
                <Icon name="calendar" size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
                <span style={{
                  flex: 1, fontSize: 'var(--typo-label-1-n---regular-size)',
                  color: endDate ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {endDate ? formatDateDisplay(endDate) : '날짜 선택'}
                </span>
              </div>
            </div>
          </div>

          {duration && (
            <p style={{
              margin: '8px 0 0', fontSize: 'var(--typo-caption-2-medium-size)',
              fontWeight: 'var(--typo-caption-2-medium-weight)', color: 'var(--color-on-surface-variant)',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <Icon name="calendar" size={12} />
              {duration - 1}박 {duration}일
            </p>
          )}

          <p style={{
            margin: '6px 0 0', fontSize: 'var(--typo-caption-3-regular-size)',
            color: 'var(--color-on-surface-variant2)',
          }}>
            여행을 만든 후 초대 링크로 멤버를 추가할 수 있습니다.
          </p>
        </section>
      </div>

      {/* Submit */}
      <div style={{ padding: '0 20px 20px', flexShrink: 0 }}>
        <Button variant="primary" size="xlg" fullWidth onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? (isEdit ? '저장 중...' : '생성 중...') : (isEdit ? '저장' : '여행 만들기')}
        </Button>
      </div>

      {/* Date Picker */}
      {datePickerTarget === 'start' && (
        <DatePickerSheet
          label="출발일 선택"
          value={startDate}
          onChange={(v) => {
            setStartDate(v);
            if (endDate && v > endDate) setEndDate('');
          }}
          onClose={() => setDatePickerTarget(null)}
        />
      )}
      {datePickerTarget === 'end' && (
        <DatePickerSheet
          label="귀국일 선택"
          value={endDate || startDate}
          onChange={(v) => setEndDate(v)}
          onClose={() => setDatePickerTarget(null)}
          minDate={startDate}
        />
      )}
    </BottomSheet>
  );
}
