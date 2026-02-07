import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Button from '../common/Button';
import Field from '../common/Field';
import Icon from '../common/Icon';
import AddressSearch from '../common/AddressSearch';
import BottomSheet from '../common/BottomSheet';
import ImagePicker from '../common/ImagePicker';
import { uploadImage, generateImagePath } from '../../services/imageService';
import { generateFullTripSchedule } from '../../services/geminiService';

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

  /* ── AI schedule generation ── */
  const [aiPreferences, setAiPreferences] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState(null); // { days: [...] }
  const [aiError, setAiError] = useState('');
  const [expandedDay, setExpandedDay] = useState(null); // accordion: which day is expanded
  const previewScrollRef = useRef(null);

  /* ── Duration calc ── */
  const duration = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1)
    : null;

  const canGenerateAi = destinations.length > 0 && startDate && !aiGenerating && !submitting;

  const handleGenerateAi = useCallback(async () => {
    if (!canGenerateAi) return;
    setAiGenerating(true);
    setAiError('');
    setAiPreview(null);

    const dur = duration || 1;
    const { days, error } = await generateFullTripSchedule({
      destinations: destinations.map((d) => d.name),
      duration: dur,
      startDate,
      preferences: aiPreferences,
    });

    setAiGenerating(false);
    if (error) {
      setAiError(error);
      return;
    }
    if (days.length === 0) {
      setAiError('AI가 일정을 생성하지 못했습니다. 다시 시도해주세요.');
      return;
    }
    setAiPreview({ days });

    setTimeout(() => {
      previewScrollRef.current?.scrollTo({ top: previewScrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 200);
  }, [canGenerateAi, destinations, startDate, duration, aiPreferences]);

  const handleSubmit = async (withAi = false) => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Build schedule data from AI preview if requested
      let scheduleData = null;
      if (withAi && aiPreview?.days) {
        scheduleData = {
          _standalone: true,
          _extraDays: aiPreview.days,
        };
      }

      await onCreate({
        name: name.trim(),
        destinations: destinations.map((d) => d.name),
        startDate,
        endDate: endDate || startDate,
        coverImage: coverImage || '',
        scheduleData,
        ...(isEdit ? { tripId: editTrip.id } : {}),
      });
    } catch (err) {
      console.error(isEdit ? 'Edit trip error:' : 'Create trip error:', err);
      setSubmitting(false);
    }
  };

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
      <div ref={previewScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

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

        {/* ── Section: AI 일정 자동 생성 (only for new trips) ── */}
        {!isEdit && (
          <section>
            <p style={{
              margin: '0 0 12px', fontSize: 'var(--typo-caption-1-bold-size)',
              fontWeight: 'var(--typo-caption-1-bold-weight)', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Icon name="flash" size={14} />
              AI 일정 자동 생성
            </p>

            <Field as="textarea" label="여행 스타일 / 요청사항" size="lg" variant="outlined"
              value={aiPreferences}
              onChange={(e) => setAiPreferences(e.target.value)}
              placeholder="예: 맛집 위주로, 쇼핑도 좀, 너무 빡빡하지 않게"
              rows={2}
            />

            {/* Quick preference chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {['맛집 위주', '관광 중심', '쇼핑 많이', '여유롭게', '알차게'].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setAiPreferences((prev) => prev ? `${prev}, ${chip}` : chip)}
                  style={{
                    padding: '5px 12px', borderRadius: '100px',
                    border: '1px solid var(--color-outline-variant)',
                    background: 'var(--color-surface-container-low)',
                    fontSize: 'var(--typo-caption-2-regular-size)',
                    color: 'var(--color-on-surface-variant)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-primary-container)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface-container-low)';
                    e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Generate / Regenerate button */}
            {!aiPreview && (
              <Button
                variant="neutral" size="lg" fullWidth
                iconLeft="flash"
                onClick={handleGenerateAi}
                disabled={!canGenerateAi}
                style={{ marginTop: '12px' }}
              >
                {aiGenerating ? 'AI가 일정을 만들고 있어요...' : 'AI 일정 미리보기'}
              </Button>
            )}
            {aiPreview && !aiGenerating && (
              <Button
                variant="neutral" size="sm"
                iconLeft="flash"
                onClick={() => { setAiPreview(null); setExpandedDay(null); handleGenerateAi(); }}
                disabled={!canGenerateAi}
                style={{ marginTop: '12px', alignSelf: 'flex-start' }}
              >
                다시 생성하기
              </Button>
            )}

            {/* AI Loading */}
            {aiGenerating && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px', marginTop: '10px',
                background: 'var(--color-primary-container)',
                borderRadius: 'var(--radius-md, 8px)',
              }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[0, 1, 2].map((d) => (
                    <div key={d} style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: 'var(--color-primary)',
                      animation: `bounce 1.2s infinite ${d * 0.2}s`,
                    }} />
                  ))}
                </div>
                <span style={{
                  fontSize: 'var(--typo-caption-2-regular-size)',
                  color: 'var(--color-on-primary-container)',
                }}>
                  {destinations.map((d) => d.name).join(', ')} {duration || 1}일 일정을 생성하고 있습니다...
                </span>
              </div>
            )}

            {/* AI Error */}
            {aiError && (
              <p style={{
                margin: '10px 0 0', padding: '10px 12px',
                background: 'var(--color-error-container, #FEE2E2)',
                borderRadius: 'var(--radius-md, 8px)',
                fontSize: 'var(--typo-caption-2-regular-size)',
                color: 'var(--color-error)',
              }}>
                {aiError}
              </p>
            )}

            {/* AI Preview */}
            {aiPreview && aiPreview.days.length > 0 && (
              <div style={{
                marginTop: '12px',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-md, 8px)',
                overflow: 'hidden',
              }}>
                {/* Preview header */}
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--color-primary-container)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: 'var(--typo-caption-1-bold-size)',
                    fontWeight: 'var(--typo-caption-1-bold-weight)',
                    color: 'var(--color-on-primary-container)',
                  }}>
                    AI 추천 일정 ({aiPreview.days.length}일)
                  </span>
                  <button
                    onClick={() => setAiPreview(null)}
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      padding: '2px', display: 'flex',
                    }}
                  >
                    <Icon name="close" size={14} style={{ opacity: 0.6 }} />
                  </button>
                </div>

                {/* Day accordion list */}
                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {aiPreview.days.map((day, di) => {
                    const allItems = day.sections?.flatMap((s) => s.items || []) || [];
                    const totalItems = allItems.length;
                    const isOpen = expandedDay === di;
                    const TYPE_ICONS = { food: "fire", spot: "pin", shop: "shopping", move: "navigation", stay: "home", info: "flash" };
                    const TYPE_COLORS = { food: "#C75D20", spot: "#2B6CB0", shop: "#6B46C1", move: "#6B6B67", stay: "#2A7D4F", info: "#8A7E22" };
                    return (
                      <div key={di} style={{
                        borderBottom: di < aiPreview.days.length - 1 ? '1px solid var(--color-outline-variant)' : 'none',
                      }}>
                        {/* Day header — clickable accordion toggle */}
                        <div
                          onClick={() => setExpandedDay(isOpen ? null : di)}
                          style={{
                            padding: '10px 14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer', userSelect: 'none',
                            background: isOpen ? 'var(--color-surface-container-low)' : 'transparent',
                            transition: 'background 0.15s',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{
                              fontSize: 'var(--typo-caption-1-bold-size)',
                              fontWeight: 'var(--typo-caption-1-bold-weight)',
                              color: 'var(--color-on-surface)',
                            }}>
                              Day {day.day} — {day.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{
                              fontSize: 'var(--typo-caption-3-regular-size)',
                              color: 'var(--color-on-surface-variant2)',
                            }}>
                              {totalItems}개
                            </span>
                            <Icon
                              name="chevronRight"
                              size={12}
                              style={{
                                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s',
                                opacity: 0.4,
                              }}
                            />
                          </div>
                        </div>

                        {/* Expanded item list */}
                        {isOpen && (
                          <div style={{ padding: '0 14px 10px' }}>
                            {allItems.map((it, j) => (
                              <div key={j} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '8px',
                                padding: '6px 0',
                                borderBottom: j < allItems.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                              }}>
                                <span style={{
                                  width: '36px', flexShrink: 0, textAlign: 'right',
                                  fontSize: 'var(--typo-caption-3-bold-size)',
                                  fontWeight: 'var(--typo-caption-3-bold-weight)',
                                  color: 'var(--color-on-surface-variant2)',
                                  fontVariantNumeric: 'tabular-nums',
                                  lineHeight: '18px',
                                }}>
                                  {it.time || ''}
                                </span>
                                <div style={{
                                  width: '3px', flexShrink: 0, borderRadius: '2px',
                                  background: TYPE_COLORS[it.type] || '#999',
                                  alignSelf: 'stretch', minHeight: '16px',
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{
                                    margin: 0,
                                    fontSize: 'var(--typo-caption-2-medium-size)',
                                    fontWeight: 'var(--typo-caption-2-medium-weight)',
                                    color: 'var(--color-on-surface)',
                                    lineHeight: '18px',
                                  }}>
                                    {it.desc}
                                  </p>
                                  {it.sub && (
                                    <p style={{
                                      margin: '1px 0 0',
                                      fontSize: 'var(--typo-caption-3-regular-size)',
                                      color: 'var(--color-on-surface-variant2)',
                                      lineHeight: '14px',
                                    }}>
                                      {it.sub}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>
          </section>
        )}
      </div>

      {/* Submit */}
      <div style={{
        padding: '14px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: '8px',
        borderTop: '1px solid var(--color-outline-variant)',
        background: 'var(--color-surface-container-lowest)',
      }}>
        {/* AI trip create button (only when preview is ready) */}
        {!isEdit && aiPreview?.days?.length > 0 && (
          <Button variant="primary" size="xlg" fullWidth iconLeft="flash"
            onClick={() => handleSubmit(true)} disabled={!canSubmit}>
            {submitting ? 'AI 일정으로 생성 중...' : `AI 일정으로 여행 만들기 (${aiPreview.days.length}일)`}
          </Button>
        )}
        <Button
          variant={aiPreview?.days?.length > 0 ? 'neutral' : 'primary'}
          size="xlg" fullWidth
          onClick={() => handleSubmit(false)} disabled={!canSubmit}
        >
          {submitting
            ? (isEdit ? '저장 중...' : '생성 중...')
            : (isEdit ? '저장' : (aiPreview?.days?.length > 0 ? '빈 여행으로 만들기' : '여행 만들기'))}
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
