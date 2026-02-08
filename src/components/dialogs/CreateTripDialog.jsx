import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Button from '../common/Button';
import Field from '../common/Field';
import Icon from '../common/Icon';
import AddressSearch from '../common/AddressSearch';
import BottomSheet from '../common/BottomSheet';
import ImagePicker from '../common/ImagePicker';
import Toast from '../common/Toast';
import { uploadImage, generateImagePath } from '../../services/imageService';
import { generateFullTripSchedule, analyzeScheduleWithAI, formatBookedItemsForPrompt } from '../../services/geminiService';
import { readFileAsBase64 } from '../../utils/fileReader';
import { getTypeConfig, RADIUS } from '../../styles/tokens';

/*
 * ── Create Trip Dialog ──
 * Full-screen style bottom sheet for creating a new trip
 */

/* ── Date Range Picker BottomSheet ── */
function DateRangePickerSheet({ startDate, endDate, onConfirm, onClose }) {
  const today = new Date();
  const initDate = startDate ? new Date(startDate) : today;
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [selStart, setSelStart] = useState(startDate || '');
  const [selEnd, setSelEnd] = useState(endDate || '');
  const [selectingEnd, setSelectingEnd] = useState(!!startDate && !endDate);

  const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

  const toStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

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

  const isToday = (day) => {
    if (!day) return false;
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };
  const isPast = (day) => {
    if (!day) return false;
    const cell = new Date(viewYear, viewMonth, day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return cell < todayStart;
  };

  const getDayStr = (day) => day ? toStr(viewYear, viewMonth, day) : '';

  const handleSelect = (day) => {
    if (!day || isPast(day)) return;
    const str = getDayStr(day);
    if (!selectingEnd) {
      // Selecting start date
      setSelStart(str);
      setSelEnd('');
      setSelectingEnd(true);
    } else {
      // Selecting end date
      if (str < selStart) {
        // Clicked before start — reset start
        setSelStart(str);
        setSelEnd('');
      } else {
        setSelEnd(str);
        setSelectingEnd(false);
      }
    }
  };

  const handleConfirm = () => {
    if (selStart) {
      onConfirm(selStart, selEnd || selStart);
      onClose();
    }
  };

  // Duration display
  const dur = selStart && selEnd
    ? Math.max(1, Math.ceil((new Date(selEnd) - new Date(selStart)) / (1000 * 60 * 60 * 24)) + 1)
    : null;

  const formatShort = (str) => {
    if (!str) return '';
    const d = new Date(str);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}.${d.getDate()} (${days[d.getDay()]})`;
  };

  return (
    <BottomSheet onClose={onClose} maxHeight="auto" zIndex="var(--z-toast)">
      <div style={{ padding: '8px 20px 20px' }}>
        {/* Header */}
        <div style={{ marginBottom: '14px' }}>
          <h3 style={{
            margin: '0 0 8px', fontSize: 'var(--typo-body-2-n---bold-size)',
            fontWeight: 'var(--typo-body-2-n---bold-weight)', color: 'var(--color-on-surface)',
          }}>
            여행 기간 선택
          </h3>
          {/* Selection summary */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: 'var(--typo-caption-1-medium-size)',
            color: 'var(--color-on-surface-variant)',
          }}>
            <span style={{
              padding: '4px 10px', borderRadius: '6px',
              background: selStart ? 'var(--color-primary-container)' : 'var(--color-surface-container-lowest)',
              color: selStart ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant2)',
              fontWeight: 'var(--typo-caption-1-bold-weight)',
            }}>
              {selStart ? formatShort(selStart) : '출발일'}
            </span>
            <span style={{ color: 'var(--color-on-surface-variant2)' }}>→</span>
            <span style={{
              padding: '4px 10px', borderRadius: '6px',
              background: selEnd ? 'var(--color-primary-container)' : 'var(--color-surface-container-lowest)',
              color: selEnd ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant2)',
              fontWeight: 'var(--typo-caption-1-bold-weight)',
            }}>
              {selEnd ? formatShort(selEnd) : '귀국일'}
            </span>
            {dur && (
              <span style={{
                fontSize: 'var(--typo-caption-2-medium-size)',
                color: 'var(--color-primary)',
                fontWeight: 'var(--typo-caption-2-bold-weight)',
              }}>
                {dur - 1}박 {dur}일
              </span>
            )}
          </div>
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
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0',
        }}>
          {calendarDays.map((day, i) => {
            const str = getDayStr(day);
            const past = day && isPast(day);
            const isStart = str && str === selStart;
            const isEnd = str && str === selEnd;
            const isInRange = str && selStart && selEnd && str > selStart && str < selEnd;
            const todayMark = isToday(day);
            const isSelected = isStart || isEnd;

            return (
              <div key={i}
                onClick={() => handleSelect(day)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '38px',
                  cursor: day ? (past ? 'not-allowed' : 'pointer') : 'default',
                  opacity: past ? 0.4 : 1,
                  position: 'relative',
                  // Range background
                  background: isInRange ? 'var(--color-primary-container)'
                    : (isStart && selEnd) ? 'linear-gradient(to right, transparent 50%, var(--color-primary-container) 50%)'
                    : (isEnd && selStart) ? 'linear-gradient(to left, transparent 50%, var(--color-primary-container) 50%)'
                    : 'transparent',
                }}
              >
                <div style={{
                  width: '34px', height: '34px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                  color: isSelected ? 'var(--color-on-primary)'
                    : isInRange ? 'var(--color-on-primary-container)'
                    : todayMark ? 'var(--color-primary)'
                    : day ? 'var(--color-on-surface)' : 'transparent',
                  fontSize: 'var(--typo-label-2-medium-size)',
                  fontWeight: isSelected || todayMark ? 'var(--typo-label-2-bold-weight)' : 'var(--typo-label-2-medium-weight)',
                  transition: 'background 0.1s',
                  position: 'relative',
                }}>
                  {day}
                  {todayMark && !isSelected && (
                    <div style={{
                      position: 'absolute', bottom: '2px',
                      width: '4px', height: '4px', borderRadius: '50%',
                      background: 'var(--color-primary)',
                    }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Guide text */}
        <p style={{
          margin: '10px 0 0', textAlign: 'center',
          fontSize: 'var(--typo-caption-3-regular-size)',
          color: 'var(--color-on-surface-variant2)',
        }}>
          {!selStart ? '출발일을 선택하세요' : selectingEnd ? '귀국일을 선택하세요' : ''}
        </p>

        {/* Confirm button */}
        <Button
          variant="primary" size="lg" fullWidth
          onClick={handleConfirm}
          disabled={!selStart}
          style={{ marginTop: '14px' }}
        >
          {selStart && selEnd ? '확인' : selStart ? '당일치기로 선택' : '날짜를 선택하세요'}
        </Button>
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
  const [showDatePicker, setShowDatePicker] = useState(false);
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
  const canSubmit = name.trim() && destinations.length > 0 && startDate && !submitting && !coverUploading;

  /* ── AI schedule generation ── */
  const [aiPreferences, setAiPreferences] = useState('');
  const [bookedText, setBookedText] = useState('');
  const [bookedAttachments, setBookedAttachments] = useState([]); // [{ mimeType, data, name? }]
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState(''); // 청크 진행 시 "1~7일차 일정 생성 중..."
  const [aiPreview, setAiPreview] = useState(null); // { days: [...] }
  const [aiError, setAiError] = useState('');
  const [expandedDay, setExpandedDay] = useState(null); // accordion: which day is expanded
  const [toast, setToast] = useState(null);
  const previewScrollRef = useRef(null);

  /* ── Duration calc ── */
  const duration = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1)
    : null;

  const hasBookedInput = bookedText.trim() || bookedAttachments.length > 0;

  const handleGenerateAi = useCallback(async () => {
    // Validation
    if (!name.trim()) { setToast({ message: '여행 이름을 입력해주세요', icon: 'info' }); return; }
    if (destinations.length === 0) { setToast({ message: '여행지를 추가해주세요', icon: 'info' }); return; }
    if (!startDate) { setToast({ message: '출발일을 선택해주세요', icon: 'info' }); return; }
    if (aiGenerating || submitting) return;
    setAiGenerating(true);
    setAiError('');
    setAiPreview(null);
    setAiStatusMsg('');

    let bookedItemsStr = '';
    if (hasBookedInput) {
      setAiStatusMsg('예약 정보 추출 중...');
      const attachmentParts = bookedAttachments.map((a) => ({ mimeType: a.mimeType, data: a.data }));
      const { items: extractedItems, error: extractErr } = await analyzeScheduleWithAI(bookedText.trim(), '여행 예약 정보', {
        onStatus: setAiStatusMsg,
        attachments: attachmentParts.length > 0 ? attachmentParts : undefined,
      });
      if (extractErr) {
        setAiGenerating(false);
        setAiStatusMsg('');
        setAiError(extractErr);
        return;
      }
      bookedItemsStr = extractedItems?.length ? formatBookedItemsForPrompt(extractedItems) : bookedText.trim();
    }

    setAiStatusMsg('일정 생성 중...');
    const dur = duration || 1;
    const { days, error } = await generateFullTripSchedule({
      destinations: destinations.map((d) => d.name),
      duration: dur,
      startDate,
      preferences: aiPreferences,
      bookedItems: bookedItemsStr || undefined,
      onStatus: setAiStatusMsg,
    });

    setAiGenerating(false);
    setAiStatusMsg('');
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
  }, [destinations, startDate, duration, aiPreferences, bookedText, bookedAttachments, name, aiGenerating, submitting]);

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
    <BottomSheet onClose={onClose} maxHeight="92vh" title={isEdit ? '여행 수정' : '새 여행 만들기'}>

      {/* Form */}
      <div ref={previewScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Cover Image ── */}
        <ImagePicker
          value={coverImage}
          onChange={handleCoverFile}
          onRemove={handleCoverRemove}
          placeholder="여행 커버 이미지를 선택하세요"
          aspect="cover"
          uploading={coverUploading}
        />

        {/* ── Section: 여행 정보 ── */}
        <section>
          <p style={{
            margin: '0 0 12px', fontSize: 'var(--typo-caption-2-bold-size)',
            fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant2)',
            letterSpacing: '0.5px',
          }}>
            여행 정보
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label="여행 이름" size="lg" variant="outlined"
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="예: 후쿠오카 가족여행" />

            {/* Destinations */}
            <div>
              <AddressSearch
                label="여행지"
                value={destInput}
                onChange={(addr, lat, lon) => {
                  if (addr) {
                    addDestination(addr, lat, lon);
                    setDestInput('');
                  } else setDestInput('');
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
            margin: '0 0 12px', fontSize: 'var(--typo-caption-2-bold-size)',
            fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant2)',
            letterSpacing: '0.5px',
          }}>
            일정
          </p>

          {/* Date range tappable field */}
          <div
            onClick={() => setShowDatePicker(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', minHeight: 'var(--height-lg, 36px)',
              padding: '8px var(--spacing-sp140, 14px)',
              border: '1px solid var(--color-outline-variant)',
              borderRadius: 'var(--radius-md, 8px)',
              cursor: 'pointer', boxSizing: 'border-box',
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: 'var(--typo-label-1-n---regular-size)',
                color: startDate ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
              }}>
                {startDate ? formatDateDisplay(startDate) : '출발일'}
              </span>
              <span style={{ color: 'var(--color-on-surface-variant2)', fontSize: 'var(--typo-caption-2-regular-size)' }}>→</span>
              <span style={{
                fontSize: 'var(--typo-label-1-n---regular-size)',
                color: endDate ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
              }}>
                {endDate ? formatDateDisplay(endDate) : '귀국일'}
              </span>
            </div>
            {duration && (
              <span style={{
                fontSize: 'var(--typo-caption-2-bold-size)',
                fontWeight: 'var(--typo-caption-2-bold-weight)',
                color: 'var(--color-primary)',
                flexShrink: 0,
              }}>
                {duration - 1}박 {duration}일
              </span>
            )}
          </div>
        </section>

        {/* ── Section: AI 일정 자동 생성 (only for new trips) ── */}
        {!isEdit && (
          <section>
            <p style={{
              margin: '0 0 12px', fontSize: 'var(--typo-caption-2-bold-size)',
              fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant2)',
              letterSpacing: '0.5px',
            }}>
              AI 일정 자동 생성
            </p>

            <Field as="textarea" label="여행 스타일 / 요청사항" size="lg" variant="outlined"
              value={aiPreferences}
              onChange={(e) => setAiPreferences(e.target.value)}
              placeholder="예: 맛집 위주로, 쇼핑도 좀, 너무 빡빡하지 않게"
              rows={2}
            />
            <Field as="textarea" label="예약 정보 (선택)" size="lg" variant="outlined"
              value={bookedText}
              onChange={(e) => setBookedText(e.target.value)}
              placeholder="예약 확인 메일·바우처 텍스트 붙여넣기 또는 아래에서 이미지/PDF 첨부"
              rows={2}
            />
            <label style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', borderRadius: '8px',
              border: '1px dashed var(--color-outline-variant)',
              cursor: 'pointer', color: 'var(--color-on-surface-variant)',
              fontSize: 'var(--typo-caption-1-regular-size)',
              background: 'var(--color-surface-container-lowest)',
            }}>
              <Icon name="document" size={16} style={{ opacity: 0.6 }} />
              <span>이미지/PDF 첨부 (바우처, 확인 메일 등) {bookedAttachments.length > 0 && `· ${bookedAttachments.length}개 선택됨`}</span>
              <input type="file" accept="image/*,application/pdf" multiple onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                e.target.value = '';
                const toAdd = [];
                for (const file of files) {
                  try {
                    const { mimeType, data } = await readFileAsBase64(file);
                    toAdd.push({ mimeType, data, name: file.name });
                  } catch (err) {
                    setAiError(err.message || '파일을 읽을 수 없습니다');
                    return;
                  }
                }
                if (toAdd.length) setBookedAttachments((prev) => [...prev, ...toAdd]);
              }} style={{ display: 'none' }} />
            </label>
            {bookedAttachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {bookedAttachments.map((a, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 10px', borderRadius: '8px',
                    background: 'var(--color-surface-container-high)', fontSize: 'var(--typo-caption-2-regular-size)',
                    color: 'var(--color-on-surface-variant)',
                  }}>
                    {a.name || '첨부'}
                    <button type="button" onClick={() => setBookedAttachments((prev) => prev.filter((_, idx) => idx !== i))} aria-label="제거"
                      style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.8 }}>×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick preference chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {['맛집 위주', '관광 중심', '쇼핑 많이', '여유롭게', '알차게'].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setAiPreferences((prev) => prev ? `${prev}, ${chip}` : chip)}
                  style={{
                    padding: '5px 12px', borderRadius: '100px',
                    border: '1px solid var(--color-outline-variant)',
                    background: 'var(--color-surface-container-lowest)',
                    fontSize: 'var(--typo-caption-2-regular-size)',
                    color: 'var(--color-on-surface-variant)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-primary-container)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface-container-lowest)';
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
                disabled={aiGenerating || submitting}
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
                disabled={aiGenerating || submitting}
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
                  {aiStatusMsg || `${destinations.map((d) => d.name).join(', ')} ${duration || 1}일 일정을 생성하고 있습니다...`}
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
                            background: isOpen ? 'var(--color-surface-container-lowest)' : 'transparent',
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
                                  width: '3px', flexShrink: 0, borderRadius: RADIUS.xs,
                                  background: getTypeConfig(it.type).text,
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
        {!isEdit && (
          <p style={{
            margin: '2px 0 0', textAlign: 'center',
            fontSize: 'var(--typo-caption-3-regular-size)',
            color: 'var(--color-on-surface-variant2)',
          }}>
            여행을 만든 후 초대 링크로 멤버를 추가할 수 있습니다.
          </p>
        )}
      </div>

      {/* Date Range Picker */}
      {showDatePicker && (
        <DateRangePickerSheet
          startDate={startDate}
          endDate={endDate}
          onConfirm={(s, e) => { setStartDate(s); setEndDate(e); }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          icon={toast.icon}
          onDone={() => setToast(null)}
        />
      )}
    </BottomSheet>
  );
}
