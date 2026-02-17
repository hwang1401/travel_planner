/**
 * 영업시간 파싱/변환 유틸리티
 *
 * PlaceInfoContent, DetailDialog, googlePlaces에서 사용하던
 * 중복 로직을 통합한 단일 소스.
 */

/* ── 상수 ── */
export const DAY_ORDER = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
export const EN_DAY = { Monday: '월요일', Tuesday: '화요일', Wednesday: '수요일', Thursday: '목요일', Friday: '금요일', Saturday: '토요일', Sunday: '일요일' };
export const JA_DAY = { '月曜日': '월요일', '火曜日': '화요일', '水曜日': '수요일', '木曜日': '목요일', '金曜日': '금요일', '土曜日': '토요일', '日曜日': '일요일' };
/** getDay() 0=일, 1=월, ... 6=토 → 한국어 요일 */
export const TODAY_BY_GETDAY = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/* ── 영어/일본어 시간 텍스트 → 한국어 정규화 ── */
export function normalizeTimeText(t) {
  if (!t) return t;
  const trimmed = t.trim();
  if (/^Closed$/i.test(trimmed) || trimmed === '定休日') return '휴무';
  if (/^Open 24 hours$/i.test(trimmed) || trimmed === '24時間営業') return '24시간 영업';
  if (/^Open$/i.test(trimmed)) return null; // 단독 "Open"은 유효한 영업시간 아님
  if (/^Temporarily closed$/i.test(trimmed)) return '임시 휴업';
  if (/^Permanently closed$/i.test(trimmed)) return '폐업';
  let s = t.replace(/\bClosed\b/gi, '휴무').replace(/\bOpen 24 hours\b/gi, '24시간 영업');
  // 일본어 시간 형식 "11時00分〜23時00分" → "11:00 – 23:00"
  s = s.replace(/(\d{1,2})時(\d{2})分/g, (_, h, m) => `${String(h).padStart(2, '0')}:${m}`);
  s = s.replace(/〜/g, ' – ');
  // AM/PM → 24시간 변환
  s = s.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi, (_, h, m, ap) => {
    let hour = parseInt(h, 10);
    if (ap.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ap.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${m}`;
  });
  return s;
}

/* ── 영업시간 문자열에 상태 텍스트만 있으면 null, 아니면 한국어로 치환 ── */
export function sanitizeHoursForDisplay(hours) {
  if (!hours || typeof hours !== 'string') return hours;
  const t = hours.trim();
  if (!t) return null;
  // 단독 상태 텍스트 (영어/한국어/일본어)
  if (/^(Closed|Open|Open now|Temporarily closed|Permanently closed|영업\s*중|폐업|임시\s*휴업|営業中|閉店)$/i.test(t)) return null;
  if (/^Open\s*[⋅·•]\s*/i.test(t)) return null;
  // 남은 영어 키워드 치환
  return hours.replace(/\bClosed\b/gi, '휴무').replace(/\bOpen 24 hours\b/gi, '24시간 영업');
}

/* ── 영업시간 문자열을 요일별 배열로 파싱 ── */
export function parseHoursToDays(hours) {
  if (!hours || typeof hours !== 'string') return null;
  const raw = hours.split(/\s*[;；]\s*/).map((s) => s.trim()).filter(Boolean);
  const parsed = [];
  for (const segment of raw) {
    const match = segment.match(/^(월요일|화요일|수요일|목요일|금요일|토요일|일요일|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|日曜日)\s*[:：]\s*(.+)$/i);
    if (!match) continue;
    let day = match[1];
    if (EN_DAY[day]) day = EN_DAY[day];
    if (JA_DAY[day]) day = JA_DAY[day];
    parsed.push({ day, time: normalizeTimeText(match[2].trim()) });
  }
  if (parsed.length === 0) return null;
  parsed.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
  return parsed;
}

/* ── 조회일(우선 요일) 기준으로 재정렬 ── */
export function reorderHoursByPriority(parsed, priorityDay) {
  if (!parsed?.length || !priorityDay) return parsed;
  const pi = DAY_ORDER.indexOf(priorityDay);
  if (pi === -1) return parsed;
  return [...parsed].sort((a, b) => {
    const ai = DAY_ORDER.indexOf(a.day);
    const bi = DAY_ORDER.indexOf(b.day);
    return ((ai - pi + 7) % 7) - ((bi - pi + 7) % 7);
  });
}

/* ── 숙소 체크인/체크아웃 문자열 파싱 ── */
export function parseStayHours(hoursString) {
  if (!hoursString || typeof hoursString !== 'string') return { checkIn: '15:00', checkOut: '11:00' };
  const parts = hoursString.split(/\s*[\/~]\s*/).map((s) => s.trim()).filter(Boolean);
  const m = (p) => /^\d{1,2}:\d{2}$/.test(p) ? p : null;
  return {
    checkIn: parts[0] ? m(parts[0]) || '15:00' : '15:00',
    checkOut: parts[1] ? m(parts[1]) || '11:00' : '11:00',
  };
}

/* ── 한 요일의 시간 문자열 파싱 → { closed, open, close } (DetailDialog 편집용) ── */
export function parseTimeSegment(timeStr) {
  const t = (timeStr || '').trim();
  if (!t || /휴무|closed/i.test(t)) return { closed: true };
  const parts = t.split(/\s*[~\-–—]\s*/).map((s) => s.trim()).filter(Boolean);
  const to24 = (part) => {
    const m = part.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2];
    if (m[3]) {
      if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${min}`;
  };
  const open = parts[0] ? to24(parts[0]) : null;
  const close = parts[1] ? to24(parts[1]) : null;
  if (open && close) return { open, close, closed: false };
  if (open) return { open, close: '23:59', closed: false };
  return { closed: true };
}

/* ── 요일별 편집 초기값: parseHoursToDays 결과 + parseTimeSegment (DetailDialog용) ── */
export function initHoursEditState(hoursString) {
  const parsed = parseHoursToDays(hoursString || '');
  const byDay = {};
  if (parsed) for (const { day, time } of parsed) byDay[day] = parseTimeSegment(time);
  return DAY_ORDER.map((day) => ({
    day,
    ...(byDay[day] || { closed: true }),
    ...(byDay[day]?.closed !== false ? {} : { open: byDay[day].open || '09:00', close: byDay[day].close || '18:00' }),
  })).map((row) => ({
    day: row.day,
    closed: row.closed !== false,
    open: row.open || '09:00',
    close: row.close || '18:00',
  }));
}

/* ── Google Places periods → "요일: HH:MM – HH:MM" 문자열 변환 ── */
const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function formatPeriodsToHours(periods) {
  if (!periods?.length) return null;
  const byDay = {};
  for (const p of periods) {
    const openDay = p.open?.day;
    if (openDay == null) continue;
    if (!p.close || (p.close.day === openDay && p.close.hour === 0 && p.close.minute === 0 && p.open.hour === 0 && p.open.minute === 0)) {
      byDay[openDay] = '24시간 영업';
      continue;
    }
    const pad = (n) => String(n).padStart(2, '0');
    const openHour = p.open?.hour ?? 0;
    const openMin = p.open?.minute ?? 0;
    const closeHour = p.close?.hour ?? 0;
    const closeMin = p.close?.minute ?? 0;
    const timeStr = `${pad(openHour)}:${pad(openMin)} – ${pad(closeHour)}:${pad(closeMin)}`;
    byDay[openDay] = timeStr;
  }
  const parts = [];
  for (let d = 0; d < 7; d++) {
    if (byDay[d]) parts.push(`${DAY_NAMES[d]}: ${byDay[d]}`);
    else parts.push(`${DAY_NAMES[d]}: 휴무`);
  }
  return parts.join('; ');
}

/* ── 영어 weekdayDescriptions → 한국어 변환 (safety net) ── */
export function localizeHoursText(text) {
  if (!text || typeof text !== 'string') return text;
  let s = text;
  for (const [en, ko] of Object.entries(EN_DAY)) {
    s = s.replace(new RegExp(en, 'gi'), ko);
  }
  s = s.replace(/\bClosed\b/gi, '휴무');
  s = s.replace(/\bTemporarily\s+휴무\b/gi, '임시 휴업');
  s = s.replace(/\bPermanently\s+휴무\b/gi, '폐업');
  s = s.replace(/\bOpen 24 hours\b/gi, '24시간 영업');
  s = s.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi, (_, h, m, ap) => {
    let hour = parseInt(h, 10);
    if (ap.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ap.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${m}`;
  });
  return s;
}
