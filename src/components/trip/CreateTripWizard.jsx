import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Button from '../common/Button';
import Field from '../common/Field';
import Icon from '../common/Icon';
import AddressSearch from '../common/AddressSearch';
import ImagePicker from '../common/ImagePicker';
import PageTransition from '../common/PageTransition';
import Toast from '../common/Toast';
import { uploadImage, generateImagePath } from '../../services/imageService';
import { generateFullTripSchedule, analyzeScheduleWithAI, formatBookedItemsForPrompt } from '../../services/geminiService';
import { readFileAsBase64 } from '../../utils/fileReader';
import { getTypeConfig, COLOR, SPACING, RADIUS } from '../../styles/tokens';
import BottomSheet from '../common/BottomSheet';
import PlaceInfoContent from '../place/PlaceInfoContent';
import { createPortal } from 'react-dom';

/* ── CreateTripWizard ──
 * Full-screen step-by-step wizard for creating a new trip.
 * Step 1: 어디로? (name, destinations, cover)
 * Step 2: 언제? (full calendar date picker)
 * Step 3: 일정 채우기 (paste info / AI / skip)
 */

const STYLE_CHIPS = [
  { label: '맛집 위주', template: '맛집 탐방 위주로 구성해줘. 현지인 맛집과 유명 맛집을 골고루 넣어줘' },
  { label: '관광 중심', template: '주요 관광지와 명소 위주로 구성해줘' },
  { label: '쇼핑 많이', template: '쇼핑 시간을 넉넉하게 잡아줘. 쇼핑 스팟도 추천해줘' },
  { label: '여유롭게', template: '여유로운 일정으로 구성해줘. 하루에 너무 많은 곳을 넣지 말아줘' },
  { label: '알차게', template: '알차게 구성해서 최대한 많은 곳을 효율적으로 돌 수 있게 해줘' },
];

/* ── Inline Calendar ── */
function InlineCalendar({ startDate, endDate, onSelect }) {
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

  const isToday = (day) => day && today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  const isPast = (day) => {
    if (!day) return false;
    const cell = new Date(viewYear, viewMonth, day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return cell < todayStart;
  };
  const getDayStr = (day) => day ? toStr(viewYear, viewMonth, day) : '';

  const handleDayClick = (day) => {
    if (!day || isPast(day)) return;
    const str = getDayStr(day);
    if (!selectingEnd) {
      setSelStart(str); setSelEnd(''); setSelectingEnd(true);
      onSelect(str, '');
    } else {
      if (str < selStart) {
        setSelStart(str); setSelEnd(''); onSelect(str, '');
      } else {
        setSelEnd(str); setSelectingEnd(false); onSelect(selStart, str);
      }
    }
  };

  const dur = selStart && selEnd
    ? Math.max(1, Math.ceil((new Date(selEnd) - new Date(selStart)) / (1000 * 60 * 60 * 24)) + 1)
    : null;

  const formatShort = (str) => {
    if (!str) return '';
    const d = new Date(str);
    return `${d.getMonth() + 1}.${d.getDate()} (${DAYS_KR[d.getDay()]})`;
  };

  return (
    <div>
      {/* Selection summary */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xl,
        fontSize: 'var(--typo-caption-1-medium-size)', color: 'var(--color-on-surface-variant)',
      }}>
        <span style={{
          padding: `${SPACING.ms} ${SPACING.lx}`, borderRadius: RADIUS.md,
          background: selStart ? 'var(--color-primary-container)' : 'var(--color-surface-container-lowest)',
          color: selStart ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant2)',
          fontWeight: 600,
        }}>
          {selStart ? formatShort(selStart) : '출발일'}
        </span>
        <span style={{ color: 'var(--color-on-surface-variant2)' }}>→</span>
        <span style={{
          padding: `${SPACING.ms} ${SPACING.lx}`, borderRadius: RADIUS.md,
          background: selEnd ? 'var(--color-primary-container)' : 'var(--color-surface-container-lowest)',
          color: selEnd ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant2)',
          fontWeight: 600,
        }}>
          {selEnd ? formatShort(selEnd) : '귀국일'}
        </span>
        {dur && (
          <span style={{ fontSize: 'var(--typo-caption-2-bold-size)', color: 'var(--color-primary)', fontWeight: 700 }}>
            {dur - 1}박 {dur}일
          </span>
        )}
      </div>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg }}>
        <button onClick={handlePrev} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: SPACING.ms, display: 'flex' }}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <span style={{ fontSize: 'var(--typo-label-1-n---bold-size)', fontWeight: 'var(--typo-label-1-n---bold-weight)', color: 'var(--color-on-surface)' }}>
          {viewYear}년 {viewMonth + 1}월
        </span>
        <button onClick={handleNext} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: SPACING.ms, display: 'flex' }}>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      {/* Day header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: SPACING.sm }}>
        {DAYS_KR.map((d) => (
          <div key={d} style={{
            textAlign: 'center', padding: `${SPACING.ms} 0`,
            fontSize: 'var(--typo-caption-3-bold-size)', fontWeight: 'var(--typo-caption-3-bold-weight)',
            color: 'var(--color-on-surface-variant2)',
          }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: SPACING.xs }}>
        {calendarDays.map((day, i) => {
          if (!day) return <div key={i} />;
          const str = getDayStr(day);
          const past = isPast(day);
          const isStart = str === selStart;
          const isEnd = str === selEnd;
          const inRange = selStart && selEnd && str > selStart && str < selEnd;
          const selected = isStart || isEnd;
          return (
            <div key={i}
              onClick={() => handleDayClick(day)}
              style={{
                textAlign: 'center', padding: `${SPACING.ml} 0`,
                cursor: past ? 'not-allowed' : 'pointer',
                opacity: past ? 0.4 : 1,
                borderRadius: isStart ? '8px 0 0 8px' : isEnd ? '0 8px 8px 0' : selected ? '8px' : '0',
                background: selected ? 'var(--color-primary)' : inRange ? 'var(--color-primary-container)' : 'transparent',
                color: selected ? '#fff' : isToday(day) ? 'var(--color-primary)' : 'var(--color-on-surface)',
                fontSize: 'var(--typo-label-2-medium-size)', fontWeight: selected || isToday(day) ? 700 : 400,
                position: 'relative', transition: 'background 0.1s',
              }}
            >
              {day}
              {isToday(day) && !selected && (
                <div style={{
                  width: '4px', height: '4px', borderRadius: RADIUS.full,
                  background: 'var(--color-primary)',
                  position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)',
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CreateTripWizard({ open, onClose, onCreate }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [destinations, setDestinations] = useState([]);
  const [destInput, setDestInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [toast, setToast] = useState(null);

  // Step 3 state
  const [step3Mode, setStep3Mode] = useState(null); // null | 'paste' | 'ai'
  const [pasteText, setPasteText] = useState('');
  const [pasteAttachments, setPasteAttachments] = useState([]); // [{ mimeType, data, name? }]
  const [aiPreferences, setAiPreferences] = useState('');
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [bookedText, setBookedText] = useState('');
  const [bookedAttachments, setBookedAttachments] = useState([]); // [{ mimeType, data, name? }]
  const [generating, setGenerating] = useState(false);
  const [genStatusMsg, setGenStatusMsg] = useState('');
  const [genError, setGenError] = useState('');
  const [preview, setPreview] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const abortedRef = useRef(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [editingField, setEditingField] = useState(null); // null | 'preferences' | 'booked'

  const duration = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1)
    : null;

  const addDestination = useCallback((dest, lat, lon) => {
    if (!dest?.trim()) return;
    const trimmed = dest.trim();
    if (destinations.some((d) => d.name === trimmed)) return;
    setDestinations((prev) => [...prev, { name: trimmed, lat: lat || null, lon: lon || null }]);
    setDestInput('');
  }, [destinations]);

  const removeDestination = useCallback((idx) => {
    setDestinations((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCoverFile = useCallback(async (file) => {
    setCoverUploading(true);
    try {
      const path = generateImagePath(`tmp_${Date.now()}`, 'cover');
      const url = await uploadImage(file, path);
      setCoverImage(url);
    } catch (err) { console.error('Cover upload error:', err); }
    finally { setCoverUploading(false); }
  }, []);

  // Step validation
  const canStep1 = name.trim() && destinations.length > 0;
  const canStep2 = !!startDate;

  const handleNext = () => {
    if (step === 1) {
      if (!canStep1) {
        setToast({ message: '여행 이름과 여행지를 입력해주세요', icon: 'info' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!canStep2) {
        setToast({ message: '출발일을 선택해주세요', icon: 'info' });
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step3Mode) {
      setStep3Mode(null); setPreview(null); setGenError('');
      setPasteText(''); setPasteAttachments([]);
      setBookedText(''); setBookedAttachments([]);
      return;
    }
    if (step > 1) setStep(step - 1);
    else onClose();
  };

  const canPasteGenerate = pasteText.trim() || pasteAttachments.length > 0;
  const hasBookedInput = bookedText.trim() || bookedAttachments.length > 0;

  // Step 3: Generate
  const handleGenerate = async () => {
    abortedRef.current = false; setGenerating(true); setGenError(''); setPreview(null); setGenStatusMsg('');
    try {
      if (step3Mode === 'paste') {
        if (!canPasteGenerate) { setGenError('텍스트를 붙여넣거나 이미지/PDF를 첨부해 주세요'); setGenerating(false); return; }
        const attachmentParts = pasteAttachments.map((a) => ({ mimeType: a.mimeType, data: a.data }));
        const { items, error } = await analyzeScheduleWithAI(pasteText.trim(), `여행지: ${destinations.map(d => d.name).join(', ')}`, {
          onStatus: setGenStatusMsg,
          attachments: attachmentParts.length > 0 ? attachmentParts : undefined,
        });
        if (error) { setGenError(error); setGenerating(false); return; }
        // Convert flat items to day structure
        const dayItems = { sections: [{ title: "일정", items }] };
        if (!abortedRef.current) setPreview({ days: [{ day: 1, label: "붙여넣기 일정", ...dayItems }] });
      } else if (step3Mode === 'ai') {
        let bookedItemsStr = '';
        if (hasBookedInput) {
          setGenStatusMsg('예약 정보 추출 중...');
          const attachmentParts = bookedAttachments.map((a) => ({ mimeType: a.mimeType, data: a.data }));
          const { items: extractedItems, error: extractErr } = await analyzeScheduleWithAI(bookedText.trim(), '여행 예약 정보', {
            onStatus: setGenStatusMsg,
            attachments: attachmentParts.length > 0 ? attachmentParts : undefined,
          });
          if (extractErr) { setGenError(extractErr); setGenerating(false); return; }
          bookedItemsStr = extractedItems?.length ? formatBookedItemsForPrompt(extractedItems) : bookedText.trim();
        }
        setGenStatusMsg('일정 생성 중...');
        const styleTemplates = selectedStyles.map(s => STYLE_CHIPS.find(c => c.label === s)?.template).filter(Boolean);
        const fullPreferences = [...styleTemplates, aiPreferences.trim()].filter(Boolean).join('. ');
        const { days, error } = await generateFullTripSchedule({
          destinations,
          duration: duration || 1,
          startDate,
          preferences: fullPreferences || undefined,
          bookedItems: bookedItemsStr || undefined,
          onStatus: setGenStatusMsg,
        });
        if (error) { setGenError(error); setGenerating(false); return; }
        if (days.length === 0) { setGenError('AI가 일정을 생성하지 못했습니다.'); setGenerating(false); return; }
        if (!abortedRef.current) setPreview({ days });
      }
    } catch (err) { setGenError(err.message); }
    finally { setGenerating(false); setGenStatusMsg(''); }
  };

  // Submit
  const handleSubmit = async (withSchedule = false) => {
    setSubmitting(true);
    try {
      let scheduleData = null;
      if (withSchedule && preview?.days) {
        scheduleData = { _standalone: true, _extraDays: preview.days };
      }
      await onCreate({
        name: name.trim(),
        destinations: destinations.map((d) => d.name),
        startDate,
        endDate: endDate || startDate,
        coverImage: coverImage || '',
        scheduleData,
      });
    } catch (err) {
      console.error('Create trip error:', err);
      setSubmitting(false);
    }
  };

  const [viewportRect, setViewportRect] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportRect({ top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  return (
    <PageTransition open={open} onClose={onClose} viewportRect={viewportRect}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sp80)',
        padding: 'var(--spacing-sp120) var(--spacing-sp160)',
        paddingTop: 'calc(var(--spacing-sp120) + env(safe-area-inset-top, 0px))',
        borderBottom: '1px solid var(--color-outline-variant)',
        flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={handleBack} aria-label="뒤로" />
        <span style={{ flex: 1, fontSize: 'var(--typo-body-2-n---bold-size)', fontWeight: 'var(--typo-body-2-n---bold-weight)', color: 'var(--color-on-surface)' }}>
          새 여행 만들기
        </span>
      </div>

      {/* Progress: stepper full-bleed (no side gap) */}
      <div style={{ padding: 'var(--spacing-sp160) 0 var(--spacing-sp120)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
          {/* Track line edge-to-edge */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '11px',
            height: '2px',
            borderRadius: '1px',
            background: 'var(--color-outline-variant)',
            opacity: 0.6,
          }} />
          <div style={{
            position: 'absolute',
            left: 0,
            top: '11px',
            height: '2px',
            borderRadius: '1px',
            width: step >= 3 ? '100%' : step >= 2 ? '66.666%' : step >= 1 ? '33.333%' : '0',
            background: 'var(--color-primary)',
            transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
          {[
            { step: 1, label: '어디로' },
            { step: 2, label: '언제' },
            { step: 3, label: '일정' },
          ].map(({ step: s, label }) => {
            const isDone = step > s || (step === 3 && step3Mode);
            const isCurrent = step === s || (step === 3 && step3Mode && s === 3);
            const isActive = isDone || isCurrent;
            return (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sp80)' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: RADIUS.full,
                  background: isActive ? 'var(--color-primary)' : 'var(--color-surface-container-lowest)',
                  border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  zIndex: 1,
                  transition: 'background 0.2s, border-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isDone ? (
                    <Icon name="check" size={12} style={{ filter: 'brightness(0) invert(1)' }} />
                  ) : (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isActive ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant2)',
                      lineHeight: 1,
                    }}>{s}</span>
                  )}
                </div>
                <span style={{
                  fontSize: 'var(--typo-caption-2-medium-size)',
                  fontWeight: 'var(--typo-caption-2-medium-weight)',
                  color: isCurrent ? 'var(--color-primary)' : isDone ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
                  transition: 'color 0.2s',
                  textAlign: 'center',
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}>

        {/* Step 1: 어디로? */}
        {step === 1 && (
          <div style={{ padding: `${SPACING.xxxl} ${SPACING.xxl} ${SPACING.xxxxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.xxl }}>
            <div>
              <h2 style={{ margin: `0 0 ${SPACING.sm}`, fontSize: 'var(--typo-heading-3-size, 22px)', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                어디로 여행을 떠나시나요?
              </h2>
              <p style={{ margin: 0, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                여행 이름과 목적지를 알려주세요
              </p>
            </div>

            <Field label="여행 이름" size="lg" variant="outlined"
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="예: 후쿠오카 가족여행" />

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
              {destinations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.ms, marginTop: SPACING.md }}>
                  {destinations.map((dest, i) => (
                    <div key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: SPACING.sm,
                      padding: `${SPACING.sm} ${SPACING.ml}`, borderRadius: RADIUS.md,
                      background: 'var(--color-primary-container)',
                      fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600,
                      color: 'var(--color-on-primary-container)',
                    }}>
                      <Icon name="pin" size={12} />
                      {dest.name}
                      <button onClick={() => removeDestination(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: `0 0 0 ${SPACING.xs}`, display: 'flex' }}>
                        <Icon name="close" size={12} style={{ opacity: 0.6 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ImagePicker
              value={coverImage}
              onChange={handleCoverFile}
              onRemove={() => setCoverImage('')}
              placeholder="커버 이미지 (선택)"
              aspect="cover"
              uploading={coverUploading}
            />
          </div>
        )}

        {/* Step 2: 언제? */}
        {step === 2 && (
          <div style={{ padding: `${SPACING.xxxl} ${SPACING.xxl} ${SPACING.xxxxl}` }}>
            <h2 style={{ margin: `0 0 ${SPACING.sm}`, fontSize: 'var(--typo-heading-3-size, 22px)', fontWeight: 700, color: 'var(--color-on-surface)' }}>
              언제 출발하시나요?
            </h2>
            <p style={{ margin: `0 0 ${SPACING.xxl}`, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
              출발일과 귀국일을 선택해주세요
            </p>
            <InlineCalendar
              startDate={startDate}
              endDate={endDate}
              onSelect={(s, e) => { setStartDate(s); setEndDate(e); }}
            />
          </div>
        )}

        {/* Step 3: 일정 채우기 */}
        {step === 3 && !step3Mode && (
          <div style={{ padding: `${SPACING.xxxl} ${SPACING.xxl} ${SPACING.xxxxl}` }}>
            <h2 style={{ margin: `0 0 ${SPACING.sm}`, fontSize: 'var(--typo-heading-3-size, 22px)', fontWeight: 700, color: 'var(--color-on-surface)' }}>
              어떻게 일정을 채울까요?
            </h2>
            <p style={{ margin: `0 0 ${SPACING.xxxl}`, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
              나중에 추가할 수도 있어요
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.ml }}>
              {[
                { key: 'paste', icon: 'document', title: '예약 정보 붙여넣기', desc: '확인메일, 바우처 텍스트를 복붙하면 AI가 일정으로 정리해요' },
                { key: 'ai', icon: 'flash', title: 'AI로 일정 만들기', desc: '여행 스타일을 알려주면 AI가 전체 일정을 자동 생성해요' },
              ].map((opt) => (
                <div key={opt.key}
                  onClick={() => setStep3Mode(opt.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: SPACING.lx,
                    padding: SPACING.xl, borderRadius: '12px',
                    border: '1px solid var(--color-outline-variant)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-surface-container-lowest)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: 'var(--color-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon name={opt.icon} size={20} style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 'var(--typo-label-1-n---bold-size)', fontWeight: 600, color: 'var(--color-on-surface)' }}>{opt.title}</p>
                    <p style={{ margin: `${SPACING.xs} 0 0`, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)', lineHeight: 1.4 }}>{opt.desc}</p>
                  </div>
                  <Icon name="chevronRight" size={16} style={{ opacity: 0.3, flexShrink: 0 }} />
                </div>
              ))}

              <Button variant="ghost-neutral" size="lg" fullWidth onClick={() => handleSubmit(false)} disabled={submitting}
                style={{ marginTop: SPACING.md }}>
                {submitting ? '생성 중...' : '직접 만들기 (빈 여행)'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Paste mode */}
        {step === 3 && step3Mode === 'paste' && (
          <div style={{ padding: `${SPACING.xxxl} ${SPACING.xxl} ${SPACING.xxxxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
            <button
              type="button"
              onClick={() => { setStep3Mode(null); setPreview(null); setGenError(''); setPasteText(''); setPasteAttachments([]); }}
              style={{
                alignSelf: 'flex-start',
                display: 'flex', alignItems: 'center', gap: SPACING.sm,
                padding: `${SPACING.sm} 0`, border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 'var(--typo-caption-1-medium-size)', color: 'var(--color-on-surface-variant)',
                fontFamily: 'inherit',
              }}
            >
              <Icon name="chevronLeft" size={14} />
              뒤로
            </button>
            <div>
              <h2 style={{ margin: `0 0 ${SPACING.sm}`, fontSize: 'var(--typo-heading-3-size, 22px)', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                예약 정보 붙여넣기
              </h2>
              <p style={{ margin: 0, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                확인 메일, 바우처, 일정을 복사해서 붙여넣거나 이미지/PDF를 첨부하세요
              </p>
            </div>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="여기에 예약 확인 메일이나 일정 텍스트를 붙여넣으세요..."
              rows={8}
              style={{
                width: '100%', padding: SPACING.lx, borderRadius: '12px',
                border: '1px solid var(--color-outline-variant)',
                background: 'var(--color-surface-container-lowest)',
                fontSize: 'var(--typo-label-2-regular-size)',
                color: 'var(--color-on-surface)',
                resize: 'vertical', fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <label style={{
              display: 'flex', alignItems: 'center', gap: SPACING.md,
              padding: `${SPACING.ml} ${SPACING.lx}`, borderRadius: RADIUS.md,
              border: '1px dashed var(--color-outline-variant)',
              cursor: 'pointer', color: 'var(--color-on-surface-variant)',
              fontSize: 'var(--typo-caption-1-regular-size)',
              background: 'var(--color-surface-container-lowest)',
            }}>
              <Icon name="document" size={16} style={{ opacity: 0.6 }} />
              <span>이미지/PDF 첨부 (바우처, 확인 메일 등) {pasteAttachments.length > 0 && `· ${pasteAttachments.length}개 선택됨`}</span>
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
                    setGenError(err.message || '파일을 읽을 수 없습니다');
                    return;
                  }
                }
                if (toAdd.length) setPasteAttachments((prev) => [...prev, ...toAdd]);
              }} style={{ display: 'none' }} />
            </label>
            {pasteAttachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.ms }}>
                {pasteAttachments.map((a, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: SPACING.ms,
                    padding: `${SPACING.ms} ${SPACING.ml}`, borderRadius: RADIUS.md,
                    background: 'var(--color-surface-container-high)', fontSize: 'var(--typo-caption-2-regular-size)',
                    color: 'var(--color-on-surface-variant)',
                  }}>
                    {a.name || '첨부'}
                    <button type="button" onClick={() => setPasteAttachments((prev) => prev.filter((_, idx) => idx !== i))} aria-label="제거"
                      style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.8 }}>×</button>
                  </span>
                ))}
              </div>
            )}

            <Button variant="primary" size="lg" fullWidth iconLeft="flash"
              onClick={handleGenerate} disabled={generating || !canPasteGenerate}>
              {generating ? 'AI가 분석하고 있어요...' : 'AI로 분석하기'}
            </Button>

            {genError && (
              <p style={{ margin: 0, padding: `${SPACING.ml} ${SPACING.lg}`, background: 'var(--color-error-container)', borderRadius: RADIUS.md, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-error)' }}>
                {genError}
              </p>
            )}

            {preview && <PreviewAccordion days={preview.days} expandedDay={expandedDay} setExpandedDay={setExpandedDay} onItemClick={setSelectedPlace} />}

            {preview && (
              <Button variant="primary" size="xlg" fullWidth onClick={() => handleSubmit(true)} disabled={submitting}>
                {submitting ? '생성 중...' : '이 일정으로 여행 만들기'}
              </Button>
            )}
          </div>
        )}

        {/* Step 3: AI mode */}
        {step === 3 && step3Mode === 'ai' && (
          <div style={{ padding: `${SPACING.xxxl} ${SPACING.xxl} ${SPACING.xxxxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
            <button
              type="button"
              onClick={() => { setStep3Mode(null); setPreview(null); setGenError(''); setAiPreferences(''); setSelectedStyles([]); setBookedText(''); setBookedAttachments([]); }}
              style={{
                alignSelf: 'flex-start',
                display: 'flex', alignItems: 'center', gap: SPACING.sm,
                padding: `${SPACING.sm} 0`, border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 'var(--typo-caption-1-medium-size)', color: 'var(--color-on-surface-variant)',
                fontFamily: 'inherit',
              }}
            >
              <Icon name="chevronLeft" size={14} />
              뒤로
            </button>
            <div>
              <h2 style={{ margin: `0 0 ${SPACING.sm}`, fontSize: 'var(--typo-heading-3-size, 22px)', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                AI로 일정 만들기
              </h2>
              <p style={{ margin: 0, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                {destinations.map(d => d.name).join(', ')} {duration && `${duration - 1}박 ${duration}일`} 일정을 AI가 만들어드려요
              </p>
            </div>

            {/* Tappable card: 여행 스타일 */}
            <div
              onClick={() => setEditingField('preferences')}
              style={{
                display: 'flex', alignItems: 'center', gap: SPACING.md,
                padding: `${SPACING.lx} ${SPACING.lg}`,
                borderRadius: RADIUS.lg,
                border: '1px solid var(--color-outline-variant)',
                cursor: 'pointer',
                background: 'var(--color-surface-container-lowest)',
              }}
            >
              <Icon name="edit" size={18} style={{ color: 'var(--color-on-surface-variant)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                  여행 스타일 / 요청사항
                </p>
                <p style={{
                  margin: `${SPACING.xs} 0 0`, fontSize: 'var(--typo-label-2-regular-size)',
                  color: (selectedStyles.length > 0 || aiPreferences) ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {[selectedStyles.join(', '), aiPreferences.trim()].filter(Boolean).join(' · ') || '탭하여 여행 스타일을 선택하세요'}
                </p>
              </div>
              <Icon name="chevronRight" size={16} style={{ opacity: 0.3, flexShrink: 0 }} />
            </div>

            {/* Tappable card: 예약 정보 */}
            <div
              onClick={() => setEditingField('booked')}
              style={{
                display: 'flex', alignItems: 'center', gap: SPACING.md,
                padding: `${SPACING.lx} ${SPACING.lg}`,
                borderRadius: RADIUS.lg,
                border: '1px solid var(--color-outline-variant)',
                cursor: 'pointer',
                background: 'var(--color-surface-container-lowest)',
              }}
            >
              <Icon name="bookmark" size={18} style={{ color: 'var(--color-on-surface-variant)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                  예약 정보 (선택)
                </p>
                <p style={{
                  margin: `${SPACING.xs} 0 0`, fontSize: 'var(--typo-label-2-regular-size)',
                  color: hasBookedInput ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant2)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {bookedText.trim()
                    ? bookedText
                    : bookedAttachments.length > 0
                      ? `${bookedAttachments.length}건 첨부됨`
                      : '예약 확인 메일·바우처 텍스트 붙여넣기'}
                </p>
              </div>
              <Icon name="chevronRight" size={16} style={{ opacity: 0.3, flexShrink: 0 }} />
            </div>

            <Button variant="primary" size="lg" fullWidth iconLeft="flash"
              onClick={handleGenerate} disabled={generating}>
              {generating ? 'AI가 일정을 만들고 있어요...' : preview ? 'AI 일정 재생성' : 'AI 일정 생성하기'}
            </Button>

            {generating && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm, padding: SPACING.lg, background: 'var(--color-primary-container)', borderRadius: RADIUS.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[0, 1, 2].map((d) => (
                      <div key={d} style={{ width: '5px', height: '5px', borderRadius: RADIUS.full, background: 'var(--color-primary)', animation: `bounce 1.2s infinite ${d * 0.2}s` }} />
                    ))}
                  </div>
                  <span style={{ flex: 1, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-primary-container)' }}>
                    {genStatusMsg || '일정을 생성하고 있습니다...'}
                  </span>
                  <Button variant="ghost-danger" size="xsm" onClick={() => { abortedRef.current = true; setGenerating(false); setGenStatusMsg(''); }}>
                    취소
                  </Button>
                </div>
                <span style={{ fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-primary-container)', opacity: 0.9 }}>
                  1~2분 정도 걸려요. 화면을 켜둔 채로 기다려 주세요!
                </span>
              </div>
            )}

            {genError && (
              <p style={{ margin: 0, padding: `${SPACING.ml} ${SPACING.lg}`, background: 'var(--color-error-container)', borderRadius: RADIUS.md, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-error)' }}>
                {genError}
              </p>
            )}

            {preview && <PreviewAccordion days={preview.days} expandedDay={expandedDay} setExpandedDay={setExpandedDay} onItemClick={setSelectedPlace} />}

            {preview && (
              <Button variant="primary" size="xlg" fullWidth onClick={() => handleSubmit(true)} disabled={submitting}>
                {submitting ? '생성 중...' : `AI 일정으로 여행 만들기 (${preview.days.length}일)`}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar (Step 1 & 2 only) */}
      {step < 3 && (
        <div style={{
          padding: `${SPACING.lx} ${SPACING.xxl} var(--safe-area-bottom, 0px)`,
          borderTop: '1px solid var(--color-outline-variant)',
          flexShrink: 0,
        }}>
          <Button variant="primary" size="xlg" fullWidth onClick={handleNext}
            disabled={step === 1 ? !canStep1 : !canStep2}>
            다음
          </Button>
        </div>
      )}

      {toast && <Toast message={toast.message} icon={toast.icon} onDone={() => setToast(null)} />}

      {selectedPlace && createPortal(
        <BottomSheet maxHeight="70vh" zIndex={9600} onClose={() => setSelectedPlace(null)}>
          <PlaceInfoContent
            view="info"
            place={{
              name: selectedPlace.desc,
              address: selectedPlace.detail?.address,
              lat: selectedPlace.detail?.lat,
              lon: selectedPlace.detail?.lon,
              image: selectedPlace.detail?.image,
              rating: selectedPlace.detail?.rating,
              reviewCount: selectedPlace.detail?.reviewCount,
              hours: selectedPlace.detail?.hours,
              placeId: selectedPlace.detail?.placeId,
              tip: selectedPlace.sub,
              type: selectedPlace.type,
              businessStatus: selectedPlace.detail?.businessStatus,
            }}
          />
        </BottomSheet>,
        document.body
      )}

      {editingField === 'preferences' && createPortal(
        <BottomSheet title="여행 스타일 / 요청사항" zIndex={9500} onClose={() => setEditingField(null)}>
          <div style={{ padding: `${SPACING.lg} ${SPACING.xxl} ${SPACING.xxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.ms }}>
              {STYLE_CHIPS.map(({ label }) => {
                const active = selectedStyles.includes(label);
                return (
                  <button key={label}
                    onClick={() => setSelectedStyles(prev => active ? prev.filter(s => s !== label) : [...prev, label])}
                    style={{
                      padding: `6px ${SPACING.lg}`, borderRadius: '100px',
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                      background: active ? 'var(--color-primary-container)' : 'var(--color-surface-container-lowest)',
                      fontSize: 'var(--typo-caption-2-regular-size)',
                      fontWeight: active ? 600 : 400,
                      color: active ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >{label}</button>
                );
              })}
            </div>
            <Field as="textarea" size="lg" variant="outlined"
              value={aiPreferences} onChange={(e) => setAiPreferences(e.target.value)}
              placeholder="추가 요청사항이 있으면 자유롭게 적어주세요"
              rows={5}
            />
          </div>
        </BottomSheet>,
        document.body
      )}

      {editingField === 'booked' && createPortal(
        <BottomSheet title="예약 정보" zIndex={9500} onClose={() => setEditingField(null)}>
          <div style={{ padding: `${SPACING.lg} ${SPACING.xxl} ${SPACING.xxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
            <Field as="textarea" size="lg" variant="outlined"
              value={bookedText} onChange={(e) => setBookedText(e.target.value)}
              placeholder="예약 확인 메일·바우처 텍스트 붙여넣기"
              rows={6}
            />
            <label style={{
              display: 'flex', alignItems: 'center', gap: SPACING.md,
              padding: `${SPACING.ml} ${SPACING.lx}`, borderRadius: RADIUS.md,
              border: '1px dashed var(--color-outline-variant)',
              cursor: 'pointer', color: 'var(--color-on-surface-variant)',
              fontSize: 'var(--typo-caption-1-regular-size)',
              background: 'var(--color-surface-container-lowest)',
            }}>
              <Icon name="document" size={16} style={{ opacity: 0.6 }} />
              <span>이미지/PDF 첨부 {bookedAttachments.length > 0 && `· ${bookedAttachments.length}개 선택됨`}</span>
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
                    setGenError(err.message || '파일을 읽을 수 없습니다');
                    return;
                  }
                }
                if (toAdd.length) setBookedAttachments((prev) => [...prev, ...toAdd]);
              }} style={{ display: 'none' }} />
            </label>
            {bookedAttachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.ms }}>
                {bookedAttachments.map((a, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: SPACING.ms,
                    padding: `${SPACING.ms} ${SPACING.ml}`, borderRadius: RADIUS.md,
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
          </div>
        </BottomSheet>,
        document.body
      )}

      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>
    </PageTransition>
  );
}

/* ── Preview Accordion ── */
function PreviewAccordion({ days, expandedDay, setExpandedDay, onItemClick }) {
  return (
    <div style={{
      border: '1px solid var(--color-outline-variant)', borderRadius: '12px', overflow: 'hidden',
    }}>
      <div style={{ padding: `${SPACING.ml} ${SPACING.lx}`, background: 'var(--color-primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-primary-container)' }}>
          AI 추천 일정 ({days.length}일)
        </span>
      </div>
      <div style={{
        maxHeight: '360px',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        transform: 'translateZ(0)',
      }}>
        {days.map((day, di) => {
          const allItems = day.sections?.flatMap((s) => s.items || []) || [];
          const isOpen = expandedDay === di;
          return (
            <div key={di} style={{ borderBottom: di < days.length - 1 ? '1px solid var(--color-outline-variant)' : 'none' }}>
              <div onClick={() => setExpandedDay(isOpen ? null : di)}
                style={{ padding: `${SPACING.ml} ${SPACING.lx}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isOpen ? 'var(--color-surface-container-lowest)' : 'transparent' }}>
                <span style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                  Day {day.day} — {day.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.ms }}>
                  <span style={{ fontSize: 'var(--typo-caption-3-regular-size)', color: 'var(--color-on-surface-variant2)' }}>{allItems.length}개</span>
                  <Icon name="chevronRight" size={12} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', opacity: 0.4 }} />
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: `0 ${SPACING.lx} ${SPACING.ml}` }}>
                  {allItems.map((it, j) => (
                    <div key={j}
                      onClick={() => it.detail && onItemClick?.(it)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: SPACING.md,
                        padding: `${SPACING.ml} 0`,
                        borderBottom: j < allItems.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                        cursor: it.detail && onItemClick ? 'pointer' : 'default',
                      }}>
                      <span style={{ width: '36px', flexShrink: 0, textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-on-surface-variant2)', fontVariantNumeric: 'tabular-nums', lineHeight: '18px' }}>
                        {it.time || ''}
                      </span>
                      <div style={{ width: '3px', flexShrink: 0, borderRadius: RADIUS.xs, background: getTypeConfig(it.type).text, alignSelf: 'stretch', minHeight: '16px' }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 'var(--typo-label-2-medium-size)', fontWeight: 500, color: 'var(--color-on-surface)', lineHeight: '18px' }}>{it.desc}</p>
                        {it.sub && <p style={{ margin: '1px 0 0', fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)' }}>{it.sub}</p>}
                      </div>
                      {it.detail && onItemClick && (
                        <Icon name="chevronRight" size={14} style={{ opacity: 0.3, flexShrink: 0, marginTop: '2px' }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
