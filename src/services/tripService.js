/*
 * ── Trip Service ──
 * Handles trip CRUD via Supabase.
 * Replaces localStorage-based tripStorage.js
 */

import { supabase } from '../lib/supabase';

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

/**
 * Load all trips the current user is a member of.
 * Returns trips with their members.
 */
export async function loadTrips() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_members (
        id,
        user_id,
        role,
        joined_at,
        profiles:user_id ( id, name, email, avatar_url )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TripService] loadTrips error:', error);
    return [];
  }

  return (data || []).map(formatTrip);
}

/**
 * Get a single trip by ID.
 */
export async function getTrip(tripId) {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_members (
        id,
        user_id,
        role,
        joined_at,
        profiles:user_id ( id, name, email, avatar_url )
      )
    `)
    .eq('id', tripId)
    .single();

  if (error) {
    console.error('[TripService] getTrip error:', error);
    return null;
  }

  return formatTrip(data);
}

/**
 * Create a new trip.
 * Automatically adds the current user as owner in trip_members.
 */
export async function createTrip({ name, destinations = [], startDate, endDate, members = [], coverImage = '', scheduleData = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get trip count for cover color cycling
  const { count } = await supabase
    .from('trip_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const coverColor = COVER_COLORS[(count || 0) % COVER_COLORS.length];

  // Insert trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      name: name.trim(),
      destinations: destinations, // Pass array directly for JSONB
      start_date: startDate || null,
      end_date: endDate || startDate || null,
      cover_color: coverColor,
      cover_image: coverImage || null,
      owner_id: user.id,
    })
    .select()
    .single();

  if (tripError) {
    console.error('[TripService] createTrip error:', tripError);
    throw tripError;
  }

  // Add owner as member
  await supabase
    .from('trip_members')
    .insert({ trip_id: trip.id, user_id: user.id, role: 'owner' });

  // Create schedule (empty or with AI-generated data)
  const initialData = scheduleData || { _standalone: true };
  await supabase
    .from('trip_schedules')
    .insert({ trip_id: trip.id, data: initialData, updated_by: user.id });

  return formatTrip(trip);
}

/**
 * Update trip metadata.
 */
export async function updateTrip(tripId, updates) {
  const { data, error } = await supabase
    .from('trips')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId)
    .select()
    .single();

  if (error) {
    console.error('[TripService] updateTrip error:', error);
    return null;
  }

  return formatTrip(data);
}

/**
 * Delete a trip (only owner).
 * Cascading delete will remove trip_members and trip_schedules.
 */
export async function deleteTrip(tripId) {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);

  if (error) {
    console.error('[TripService] deleteTrip error:', error);
    throw error;
  }
}

/**
 * Get the share code for a trip.
 */
export async function getShareCode(tripId) {
  const { data, error } = await supabase
    .from('trips')
    .select('share_code')
    .eq('id', tripId)
    .single();

  if (error) return null;
  return data?.share_code;
}

/**
 * Duplicate a trip (copies metadata + schedule).
 * If scheduleData is provided (e.g. from legacy localStorage), use that.
 * Otherwise, copies the existing trip's schedule.
 */
export async function duplicateTrip({ name, destinations = [], startDate, endDate, scheduleData = null, sourceTripId = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get trip count for cover color cycling
  const { count } = await supabase
    .from('trip_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const coverColor = COVER_COLORS[(count || 0) % COVER_COLORS.length];

  // 1. Insert trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      name: name.trim(),
      destinations: destinations, // Pass array directly for JSONB
      start_date: startDate || null,
      end_date: endDate || startDate || null,
      cover_color: coverColor,
      owner_id: user.id,
    })
    .select()
    .single();

  if (tripError) {
    console.error('[TripService] duplicateTrip - trip insert error:', tripError);
    throw tripError;
  }

  // 2. Add owner as member
  const { error: memberError } = await supabase
    .from('trip_members')
    .insert({ trip_id: trip.id, user_id: user.id, role: 'owner' });

  if (memberError) {
    console.error('[TripService] duplicateTrip - member insert error:', memberError);
    // Trip was created but member failed — still throw
    throw memberError;
  }

  // 3. Get schedule data to copy
  let dataToSave = scheduleData || {};
  if (!scheduleData && sourceTripId) {
    const { data: srcSchedule, error: srcError } = await supabase
      .from('trip_schedules')
      .select('data')
      .eq('trip_id', sourceTripId)
      .single();
    if (srcError) {
      console.warn('[TripService] duplicateTrip - source schedule read error:', srcError);
    }
    if (srcSchedule) dataToSave = srcSchedule.data || {};
  }

  // Ensure dataToSave is a clean JSON-safe object
  try {
    dataToSave = JSON.parse(JSON.stringify(dataToSave));
  } catch {
    dataToSave = {};
  }

  // 4. Create schedule with copied data
  const { error: schedError } = await supabase
    .from('trip_schedules')
    .insert({ trip_id: trip.id, data: dataToSave, updated_by: user.id });

  if (schedError) {
    console.error('[TripService] duplicateTrip - schedule insert error:', schedError);
    // Trip + member created, schedule failed — don't throw, trip is still usable
    console.warn('[TripService] Trip created without schedule data');
  }

  return formatTrip(trip);
}

/* ── Helpers ── */

function formatTrip(raw) {
  if (!raw) return null;

  // Parse destinations from JSONB
  let destinations = [];
  if (typeof raw.destinations === 'string') {
    try { destinations = JSON.parse(raw.destinations); } catch { destinations = []; }
  } else if (Array.isArray(raw.destinations)) {
    destinations = raw.destinations;
  }

  // Format members from join data
  const members = (raw.trip_members || []).map((tm) => ({
    id: tm.user_id,
    name: tm.profiles?.name || tm.profiles?.email || 'Unknown',
    email: tm.profiles?.email,
    avatarUrl: tm.profiles?.avatar_url,
    role: tm.role,
    joinedAt: tm.joined_at,
  }));

  return {
    id: raw.id,
    name: raw.name,
    destinations,
    startDate: raw.start_date,
    endDate: raw.end_date,
    coverColor: raw.cover_color,
    coverImage: raw.cover_image || '',
    ownerId: raw.owner_id,
    shareCode: raw.share_code,
    members,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/**
 * Calculate trip duration in days.
 */
export function getTripDuration(trip) {
  if (!trip.startDate || !trip.endDate) return 0;
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

/**
 * Format date range for display.
 */
export function formatDateRange(trip) {
  if (!trip.startDate) return "날짜 미정";
  const start = new Date(trip.startDate);
  const end = trip.endDate ? new Date(trip.endDate) : null;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const fmtFull = (d) => `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  if (!end) return fmtFull(start);
  const duration = getTripDuration(trip);
  return `${fmtFull(start)} — ${fmtFull(end)} · ${duration - 1}박${duration}일`;
}
