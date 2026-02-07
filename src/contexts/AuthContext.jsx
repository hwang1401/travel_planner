/*
 * ── Auth Context ──
 * Provides authentication state and methods to the entire app.
 *
 * Wraps Supabase Auth:
 *   - Tracks current user session
 *   - Provides signInWithKakao, signOut
 *   - Auto-refreshes token and persists session
 *   - Loads user profile from profiles table
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Supabase Auth user
  const [profile, setProfile] = useState(null);  // profiles table row
  const [loading, setLoading] = useState(true);  // initial session check
  const [error, setError] = useState(null);

  /* ── Load profile from profiles table ── */
  const loadProfile = useCallback(async (userId) => {
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (err) {
        // Profile might not exist yet (trigger delay); retry once
        if (err.code === 'PGRST116') {
          setTimeout(() => loadProfile(userId), 1500);
          return;
        }
        console.warn('[Auth] Profile load error:', err.message);
        return;
      }
      setProfile(data);
    } catch (e) {
      console.warn('[Auth] Profile load exception:', e);
    }
  }, []);

  /* ── Initialize: register listener FIRST, then check session ── */
  useEffect(() => {
    let mounted = true;

    /* 1. Register auth state change listener FIRST
     *    This ensures we catch the SIGNED_IN event from OAuth callback */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] State change:', event, !!session);
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          setLoading(false);
          // Load profile in background (don't block)
          loadProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    /* 2. Then check for existing session */
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      console.log('[Auth] Initial session:', !!session);
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  /* ── Sign in with Kakao ── */
  const signInWithKakao = useCallback(async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (err) setError(err.message);
  }, []);

  /* ── Sign out ── */
  const signOut = useCallback(async () => {
    setError(null);
    const { error: err } = await supabase.auth.signOut();
    if (err) setError(err.message);
    setUser(null);
    setProfile(null);
  }, []);

  /* ── Update profile ── */
  const updateProfile = useCallback(async (updates) => {
    if (!user) return;
    const { data, error: err } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (err) {
      console.error('[Auth] Profile update error:', err);
      return;
    }
    setProfile(data);
  }, [user]);

  const value = {
    user,
    profile,
    loading,
    error,
    signInWithKakao,
    signOut,
    updateProfile,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ── */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
