/* ── Today / Now Detection Utilities ── */

/**
 * Parse a day's date string (e.g. "2/19 (목)") into a Date object for the current/relevant year.
 * Handles the format used in BASE_DAYS and trip schedules.
 * @param {string} dateStr - e.g. "2/19 (목)"
 * @param {number} [hintYear] - optional year hint
 * @returns {Date|null}
 */
function parseDayDate(dateStr, hintYear) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = hintYear || new Date().getFullYear();
  return new Date(year, month - 1, day);
}

/**
 * Find the day index that matches today's date.
 * Falls back to 0 if no match (not during the trip).
 * @param {Array} days - merged days array, each with .date string
 * @returns {number} 0-indexed day that matches today, or 0
 */
export function getTodayDayIndex(days) {
  if (!days || days.length === 0) return 0;

  const now = new Date();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();

  // Try to detect year from the first day's date
  // For now just use current year, could be extended with trip metadata
  for (let i = 0; i < days.length; i++) {
    const d = parseDayDate(days[i].date);
    if (d && d.getMonth() + 1 === todayMonth && d.getDate() === todayDay) {
      return i;
    }
  }

  return 0; // Not during travel — default to Day 1
}

/**
 * Given a flat list of items with time fields, find the index of the
 * current or next upcoming item based on current time.
 * @param {Array} items - items with .time (HH:MM format)
 * @returns {{ index: number, status: "current" | "next" | "none" }}
 */
export function getCurrentItemIndex(items) {
  if (!items || items.length === 0) return { index: -1, status: "none" };

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let lastPastIndex = -1;

  for (let i = 0; i < items.length; i++) {
    const t = items[i].time;
    if (!t) continue;
    const [h, m] = t.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) continue;
    const itemMinutes = h * 60 + m;

    if (itemMinutes <= nowMinutes) {
      lastPastIndex = i;
    } else {
      // This is the first future item
      if (lastPastIndex >= 0) {
        // Check if we're within the "current" window (before next item)
        return { index: lastPastIndex, status: "current" };
      }
      return { index: i, status: "next" };
    }
  }

  // All items are in the past
  if (lastPastIndex >= 0) {
    return { index: lastPastIndex, status: "current" };
  }
  return { index: -1, status: "none" };
}

/**
 * Check if today falls within the trip's date range.
 * @param {Array} days - merged days array
 * @returns {boolean}
 */
export function isTodayInTrip(days) {
  if (!days || days.length === 0) return false;
  const now = new Date();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();

  for (const day of days) {
    const d = parseDayDate(day.date);
    if (d && d.getMonth() + 1 === todayMonth && d.getDate() === todayDay) {
      return true;
    }
  }
  return false;
}
