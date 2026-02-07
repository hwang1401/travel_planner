/*
 * ── Member Service ──
 * Handles trip membership and sharing via Supabase.
 */

import { supabase } from '../lib/supabase';

/**
 * Get all members of a trip.
 */
export async function getTripMembers(tripId) {
  const { data, error } = await supabase
    .from('trip_members')
    .select(`
      id,
      user_id,
      role,
      joined_at,
      profiles:user_id ( id, name, email, avatar_url )
    `)
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('[MemberService] getTripMembers error:', error);
    return [];
  }

  return (data || []).map(formatMember);
}

/**
 * Get current user's role for a trip.
 * Returns 'owner' | 'editor' | 'viewer' | null
 */
export async function getMyRole(tripId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data?.role || null;
}

/**
 * Add a member to a trip (by user ID).
 */
export async function addMember(tripId, userId, role = 'editor') {
  const { data, error } = await supabase
    .from('trip_members')
    .insert({ trip_id: tripId, user_id: userId, role })
    .select(`
      id,
      user_id,
      role,
      joined_at,
      profiles:user_id ( id, name, email, avatar_url )
    `)
    .single();

  if (error) {
    console.error('[MemberService] addMember error:', error);
    throw error;
  }

  return formatMember(data);
}

/**
 * Update a member's role.
 */
export async function updateMemberRole(tripId, userId, newRole) {
  const { error } = await supabase
    .from('trip_members')
    .update({ role: newRole })
    .eq('trip_id', tripId)
    .eq('user_id', userId);

  if (error) {
    console.error('[MemberService] updateMemberRole error:', error);
    throw error;
  }
}

/**
 * Remove a member from a trip.
 */
export async function removeMember(tripId, userId) {
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);

  if (error) {
    console.error('[MemberService] removeMember error:', error);
    throw error;
  }
}

/**
 * Join a trip using a share code.
 * Uses the RPC function defined in schema.sql.
 * Returns the trip ID.
 */
export async function joinByShareCode(shareCode) {
  const { data, error } = await supabase
    .rpc('join_trip_by_share_code', { p_share_code: shareCode });

  if (error) {
    console.error('[MemberService] joinByShareCode error:', error);
    throw error;
  }

  return data; // trip ID (UUID)
}

/**
 * Get the share link for a trip.
 */
export function getShareLink(shareCode) {
  return `${window.location.origin}/invite/${shareCode}`;
}

/**
 * Subscribe to member changes for realtime updates.
 */
export function subscribeToMembers(tripId, onUpdate) {
  const channel = supabase
    .channel(`trip-members:${tripId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trip_members',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ── Helper ── */
function formatMember(raw) {
  return {
    id: raw.user_id,
    name: raw.profiles?.name || raw.profiles?.email || 'Unknown',
    email: raw.profiles?.email,
    avatarUrl: raw.profiles?.avatar_url,
    role: raw.role,
    joinedAt: raw.joined_at,
  };
}
