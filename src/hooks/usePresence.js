/*
 * ── usePresence Hook ──
 * Tracks which users are currently viewing a trip.
 * Uses Supabase Realtime Presence.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * @param {string} tripId - The trip to track presence for
 * @param {object} userInfo - { id, name, avatarUrl } of the current user
 * @returns {{ onlineUsers: Array<{ id, name, avatarUrl, onlineAt }> }}
 */
export function usePresence(tripId, userInfo) {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!tripId || !userInfo?.id) return;

    const channel = supabase.channel(`presence:${tripId}`, {
      config: {
        presence: {
          key: userInfo.id,
        },
      },
    });

    // Sync handler: update the online users list
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = [];
      for (const [key, presences] of Object.entries(state)) {
        if (presences.length > 0) {
          users.push({
            id: key,
            name: presences[0].name,
            avatarUrl: presences[0].avatarUrl,
            onlineAt: presences[0].online_at,
          });
        }
      }
      setOnlineUsers(users);
    });

    // Subscribe and track our own presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          name: userInfo.name || 'Anonymous',
          avatarUrl: userInfo.avatarUrl || null,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [tripId, userInfo?.id, userInfo?.name, userInfo?.avatarUrl]);

  return { onlineUsers };
}
