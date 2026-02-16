import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBackClose } from '../../hooks/useBackClose';
import { SPACING, RADIUS } from '../../styles/tokens';

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const PADDING_Y = (WHEEL_HEIGHT - ROW_HEIGHT) / 2;
const SNAP_DELAY_MS = 120;

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_5 = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const MINUTES_15 = [0, 15, 30, 45];
const MINUTES_30 = [0, 30];

function getMinuteOptions(step) {
  if (step === 5) return MINUTES_5;
  if (step === 30) return MINUTES_30;
  return MINUTES_15;
}

function parseValue(value) {
  if (!value || typeof value !== 'string') return { hour: 12, minute: 0 };
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hour: 12, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { hour, minute };
}

function formatValue(hour, minute, minuteOptions) {
  const m = minuteOptions.includes(minute) ? minute : minuteOptions[0];
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function snapScrollTop(el, maxIndex) {
  if (!el) return;
  const idx = Math.round(el.scrollTop / ROW_HEIGHT);
  const clamped = Math.min(maxIndex, Math.max(0, idx));
  el.scrollTop = clamped * ROW_HEIGHT;
  return clamped;
}

/**
 * 휠 타임 피커 다이얼로그. 화면 중앙 팝업. 웹(마우스 휠) + 모바일(터치) 모두 지원.
 * value "HH:mm", onConfirm(value), onClose. minuteStep 5 | 15 | 30.
 */
export default function TimePickerDialog({ open, value, onConfirm, onClose, minuteStep = 5, zIndex = 10000 }) {
  useBackClose(open, onClose);
  const [hourIndex, setHourIndex] = useState(12);
  const [minuteIndex, setMinuteIndex] = useState(0);
  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const hourSnapRef = useRef(null);
  const minuteSnapRef = useRef(null);

  const minuteOptions = getMinuteOptions(minuteStep);
  const minuteLabels = minuteOptions.map((m) => String(m).padStart(2, '0'));

  const syncFromValue = useCallback(() => {
    const { hour, minute } = parseValue(value);
    setHourIndex(hour);
    const next = minuteOptions.find((m) => m >= minute);
    const chosen = next ?? minuteOptions[minuteOptions.length - 1];
    setMinuteIndex(minuteOptions.indexOf(chosen));
  }, [value, minuteStep]);

  useEffect(() => {
    if (!open) return;
    const { hour, minute } = parseValue(value);
    const chosenMinute = minuteOptions.find((m) => m >= minute) ?? minuteOptions[minuteOptions.length - 1];
    const minuteIdx = minuteOptions.indexOf(chosenMinute);
    setHourIndex(hour);
    setMinuteIndex(minuteIdx);
    requestAnimationFrame(() => {
      if (hourRef.current) hourRef.current.scrollTop = hour * ROW_HEIGHT;
      if (minuteRef.current) minuteRef.current.scrollTop = minuteIdx * ROW_HEIGHT;
    });
  }, [open, value, minuteOptions]);

  const scheduleSnapHour = useCallback(() => {
    if (hourSnapRef.current) clearTimeout(hourSnapRef.current);
    hourSnapRef.current = setTimeout(() => {
      const el = hourRef.current;
      if (!el) return;
      const idx = snapScrollTop(el, 23);
      if (idx !== undefined) setHourIndex(idx);
      hourSnapRef.current = null;
    }, SNAP_DELAY_MS);
  }, []);

  const scheduleSnapMinute = useCallback(() => {
    if (minuteSnapRef.current) clearTimeout(minuteSnapRef.current);
    minuteSnapRef.current = setTimeout(() => {
      const el = minuteRef.current;
      if (!el) return;
      const idx = snapScrollTop(el, minuteOptions.length - 1);
      if (idx !== undefined) setMinuteIndex(idx);
      minuteSnapRef.current = null;
    }, SNAP_DELAY_MS);
  }, [minuteOptions.length]);

  const handleScrollHour = useCallback(() => {
    const el = hourRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ROW_HEIGHT);
    setHourIndex(Math.min(23, Math.max(0, idx)));
    scheduleSnapHour();
  }, [scheduleSnapHour]);

  const handleScrollMinute = useCallback(() => {
    const el = minuteRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ROW_HEIGHT);
    setMinuteIndex(Math.min(minuteOptions.length - 1, Math.max(0, idx)));
    scheduleSnapMinute();
  }, [minuteOptions.length, scheduleSnapMinute]);

  /* 웹: 마우스 휠로 시/분 컬럼 스크롤 (passive: false로 preventDefault 동작) */
  const wheelsRef = useRef(null);
  const handleWheel = useCallback((e) => {
    if (!hourRef.current || !minuteRef.current) return;
    const hr = hourRef.current.getBoundingClientRect();
    const mr = minuteRef.current.getBoundingClientRect();
    const x = e.clientX;
    const target = x < (hr.left + hr.width + mr.left) / 2 ? hourRef.current : minuteRef.current;
    const maxScroll = target.scrollHeight - target.clientHeight;
    if (maxScroll <= 0) return;
    target.scrollTop += e.deltaY;
    target.scrollTop = Math.max(0, Math.min(maxScroll, target.scrollTop));
    e.preventDefault();
    e.stopPropagation();
    if (target === hourRef.current) {
      setHourIndex(Math.round(target.scrollTop / ROW_HEIGHT));
      scheduleSnapHour();
    } else {
      setMinuteIndex(Math.round(target.scrollTop / ROW_HEIGHT));
      scheduleSnapMinute();
    }
  }, [scheduleSnapHour, scheduleSnapMinute]);

  useEffect(() => {
    const el = wheelsRef.current;
    if (!el || !open) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [open, handleWheel]);

  useEffect(() => {
    return () => {
      if (hourSnapRef.current) clearTimeout(hourSnapRef.current);
      if (minuteSnapRef.current) clearTimeout(minuteSnapRef.current);
    };
  }, []);

  const handleConfirm = useCallback(() => {
    const h = hourIndex;
    const m = minuteOptions[minuteIndex];
    onConfirm(formatValue(h, m, minuteOptions));
    onClose();
  }, [hourIndex, minuteIndex, minuteOptions, onConfirm, onClose]);

  if (!open) return null;

  const wheelStyle = {
    flex: 1,
    minWidth: 0,
    height: WHEEL_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const scrollStyle = {
    width: '100%',
    height: WHEEL_HEIGHT,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    paddingTop: PADDING_Y,
    paddingBottom: PADDING_Y,
  };

  const itemStyle = {
    height: ROW_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--typo-title-3-n---regular-size)',
    fontWeight: 'var(--typo-title-3-n---regular-weight)',
    color: 'var(--color-on-surface)',
  };

  const maskTop = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: PADDING_Y,
    background: 'linear-gradient(to bottom, var(--color-surface-container-lowest) 0%, transparent 100%)',
    pointerEvents: 'none',
    zIndex: 1,
  };

  const maskBottom = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PADDING_Y,
    background: 'linear-gradient(to top, var(--color-surface-container-lowest) 0%, transparent 100%)',
    pointerEvents: 'none',
    zIndex: 1,
  };

  /* 선택 행 위·아래 얇은 구분선만 (입력 필드처럼 보이지 않게) */
  const highlightLineTop = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    marginTop: -ROW_HEIGHT / 2 - 1,
    height: 1,
    background: 'var(--color-outline-variant)',
    pointerEvents: 'none',
    zIndex: 1,
  };
  const highlightLineBottom = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    marginTop: ROW_HEIGHT / 2,
    height: 1,
    background: 'var(--color-outline-variant)',
    pointerEvents: 'none',
    zIndex: 1,
  };

  if (!open) return null;

  const dialog = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        background: 'rgba(0,0,0,0.4)',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="시간 선택"
        style={{
          width: '100%',
          maxWidth: 320,
          background: 'var(--color-surface-container-lowest)',
          borderRadius: RADIUS.xl,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS 스타일 헤더: 취소 | 시간 | 확인 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACING.md} ${SPACING.xl}`,
            borderBottom: '1px solid var(--color-outline-variant)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: SPACING.sm,
              fontSize: 'var(--typo-body-2-n---regular-size)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <span
            style={{
              fontSize: 'var(--typo-body-2-n---bold-size)',
              fontWeight: 'var(--typo-body-2-n---bold-weight)',
              color: 'var(--color-on-surface)',
            }}
          >
            시간
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              background: 'none',
              border: 'none',
              padding: SPACING.sm,
              fontSize: 'var(--typo-body-2-n---bold-size)',
              fontWeight: 'var(--typo-body-2-n---bold-weight)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
            }}
          >
            확인
          </button>
        </div>

        {/* 휠 2열: 시 / 분 (웹: 휠 리스너는 useEffect에서 passive: false로 등록) */}
        <div
          ref={wheelsRef}
          style={{
            display: 'flex',
            flexDirection: 'row',
            padding: `${SPACING.lg} 0`,
            position: 'relative',
          }}
        >
          {/* 시 */}
          <div style={wheelStyle}>
            <div style={highlightLineTop} />
            <div style={highlightLineBottom} />
            <div style={maskTop} />
            <div style={maskBottom} />
            <div
              ref={hourRef}
              style={scrollStyle}
              onScroll={handleScrollHour}
            >
              {HOURS.map((h) => (
                <div key={h} style={itemStyle}>
                  {h}
                </div>
              ))}
            </div>
          </div>
          <span
            style={{
              alignSelf: 'center',
              fontSize: 'var(--typo-title-3-n---regular-size)',
              color: 'var(--color-on-surface-variant2)',
              margin: `0 ${SPACING.xs}`,
            }}
          >
            :
          </span>
          {/* 분 */}
          <div style={wheelStyle}>
            <div style={highlightLineTop} />
            <div style={highlightLineBottom} />
            <div style={maskTop} />
            <div style={maskBottom} />
            <div
              ref={minuteRef}
              style={scrollStyle}
              onScroll={handleScrollMinute}
            >
              {minuteLabels.map((m) => (
                <div key={m} style={itemStyle}>
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
