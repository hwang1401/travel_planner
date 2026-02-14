/*
 * ── Schedule Service ──
 * Handles trip schedule (itinerary) data via Supabase.
 * Includes realtime subscription for collaborative editing.
 */

import { supabase } from '../lib/supabase';

/**
 * Load schedule data for a trip.
 * Returns the JSONB `data` field (same structure as old customData).
 */
export async function loadSchedule(tripId) {
  const { data, error } = await supabase
    .from('trip_schedules')
    .select('*')
    .eq('trip_id', tripId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No schedule exists yet → return empty
      return { data: {}, version: 0 };
    }
    console.error('[ScheduleService] loadSchedule error:', error);
    return { data: {}, version: 0 };
  }

  return {
    data: data.data || {},
    version: data.version || 1,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  };
}

/**
 * Save schedule data for a trip.
 * Uses upsert with version increment.
 * Returns the new version number.
 */
export async function saveSchedule(tripId, scheduleData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trip_schedules')
    .upsert({
      trip_id: tripId,
      data: scheduleData,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      // Increment version via raw SQL or let DB handle it
    }, {
      onConflict: 'trip_id',
    })
    .select('version')
    .single();

  if (error) {
    console.error('[ScheduleService] saveSchedule error:', error);
    throw error;
  }

  return data?.version || 1;
}

/**
 * Subscribe to realtime schedule changes for a trip.
 * Calls `onUpdate(payload)` whenever another user modifies the schedule.
 *
 * Returns unsubscribe function.
 */
export function subscribeToSchedule(tripId, onUpdate) {
  const channel = supabase
    .channel(`trip-schedule:${tripId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trip_schedules',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload) => {
        onUpdate({
          data: payload.new?.data || {},
          version: payload.new?.version || 1,
          updatedAt: payload.new?.updated_at,
          updatedBy: payload.new?.updated_by,
          eventType: payload.eventType,
        });
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Create a debounced save function.
 * Useful for auto-saving as user edits.
 *
 * @param {string} tripId
 * @param {number} delayMs - debounce delay (default 800ms)
 * @returns {{ save: (data) => void, flush: () => Promise, cancel: () => void }}
 */
export function createDebouncedSave(tripId, delayMs = 800, onVersionUpdate) {
  let timeoutId = null;
  let pendingData = null;
  let savePromise = null;

  const flush = async () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (pendingData !== null) {
      const dataToSave = pendingData;
      pendingData = null;
      savePromise = saveSchedule(tripId, dataToSave);
      try {
        const version = await savePromise;
        if (onVersionUpdate && version > 0) onVersionUpdate(version);
      } catch (err) {
        console.error('[ScheduleService] Debounced save failed:', err);
      }
      savePromise = null;
    }
  };

  const save = (data) => {
    pendingData = data;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(flush, delayMs);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingData = null;
  };

  return { save, flush, cancel };
}
