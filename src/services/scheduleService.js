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

  // RPC 함수로 원자적 upsert + version 증가 (fix-schedule-version.sql 배포 필요)
  const { data: rpcVersion, error: rpcError } = await supabase.rpc(
    'save_trip_schedule',
    { p_trip_id: tripId, p_data: scheduleData, p_updated_by: user.id }
  );

  if (!rpcError) return rpcVersion || 1;

  // RPC 미배포 시 fallback: 기존 upsert (version 증가 안 됨)
  if (rpcError.code === '42883') {
    console.warn('[ScheduleService] save_trip_schedule RPC not found, using fallback upsert');
    const { data, error } = await supabase
      .from('trip_schedules')
      .upsert({
        trip_id: tripId,
        data: scheduleData,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }, { onConflict: 'trip_id' })
      .select('version')
      .single();

    if (error) {
      console.error('[ScheduleService] saveSchedule fallback error:', error);
      throw error;
    }
    return data?.version || 1;
  }

  console.error('[ScheduleService] saveSchedule RPC error:', rpcError);
  throw rpcError;
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
