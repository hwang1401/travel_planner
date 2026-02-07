/*
 * ── Trip Storage Layer ──
 *
 * Data model for trips (여행 일정)
 * Stored in localStorage under key "travel_trips"
 *
 * Trip schema:
 * {
 *   id:           string (UUID),
 *   name:         string ("후쿠오카 여행"),
 *   destinations: string[] (["후쿠오카", "구마모토", "유후인"]),
 *   startDate:    string ("2026-02-19"),
 *   endDate:      string ("2026-02-24"),
 *   coverColor:   string (gradient or color token),
 *   members:      Member[],
 *   createdAt:    string (ISO date),
 *   updatedAt:    string (ISO date),
 * }
 *
 * Member schema:
 * {
 *   id:    string,
 *   name:  string,
 *   role:  "owner" | "editor" | "viewer",
 * }
 */

const STORAGE_KEY = "travel_trips";

/* ── Generate UUID ── */
function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxx-xxxx-xxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

/* ── Cover color presets ── */
export const COVER_COLORS = [
  "linear-gradient(135deg, #3A7DB5, #5BAEE6)",
  "linear-gradient(135deg, #3E8E5B, #5BC47D)",
  "linear-gradient(135deg, #D97B2B, #F0A54F)",
  "linear-gradient(135deg, #7161A5, #9B8DD0)",
  "linear-gradient(135deg, #C75D78, #E88DA3)",
  "linear-gradient(135deg, #2B6CB0, #4EA1D3)",
  "linear-gradient(135deg, #B8912A, #D4B44E)",
  "linear-gradient(135deg, #5B8C6E, #7DB895)",
];

/* ── Load all trips ── */
export function loadTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const trips = JSON.parse(raw);
    return Array.isArray(trips) ? trips : [];
  } catch {
    return [];
  }
}

/* ── Save all trips ── */
export function saveTrips(trips) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

/* ── Create a new trip ── */
export function createTrip({ name, destinations = [], startDate, endDate, members = [] }) {
  const trips = loadTrips();
  const newTrip = {
    id: generateId(),
    name: name.trim(),
    destinations,
    startDate: startDate || "",
    endDate: endDate || "",
    coverColor: COVER_COLORS[trips.length % COVER_COLORS.length],
    members: [
      ...members.map((m) => ({ ...m, id: m.id || generateId() })),
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  trips.unshift(newTrip); // newest first
  saveTrips(trips);
  return newTrip;
}

/* ── Update a trip ── */
export function updateTrip(tripId, updates) {
  const trips = loadTrips();
  const idx = trips.findIndex((t) => t.id === tripId);
  if (idx === -1) return null;
  trips[idx] = { ...trips[idx], ...updates, updatedAt: new Date().toISOString() };
  saveTrips(trips);
  return trips[idx];
}

/* ── Delete a trip ── */
export function deleteTrip(tripId) {
  const trips = loadTrips();
  const filtered = trips.filter((t) => t.id !== tripId);
  saveTrips(filtered);
  // Also clean up trip-specific custom data
  localStorage.removeItem(`travel_custom_data_${tripId}`);
}

/* ── Get a single trip ── */
export function getTrip(tripId) {
  const trips = loadTrips();
  return trips.find((t) => t.id === tripId) || null;
}

/* ── Calculate trip duration in days ── */
export function getTripDuration(trip) {
  if (!trip.startDate || !trip.endDate) return 0;
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

/* ── Format date range for display ── */
export function formatDateRange(trip) {
  if (!trip.startDate) return "날짜 미정";
  const start = new Date(trip.startDate);
  const end = trip.endDate ? new Date(trip.endDate) : null;
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const fmtFull = (d) => `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  if (!end) return fmtFull(start);
  const duration = getTripDuration(trip);
  return `${fmtFull(start)} — ${fmtFull(end)} · ${duration - 1}박${duration}일`;
}
