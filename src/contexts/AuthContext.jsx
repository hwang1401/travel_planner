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
import { isNative } from '../utils/platform';

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

    /* 2. Then check for existing session (항상 loading 해제 — 실패 시에도 로그인 화면 표시) */
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        console.log('[Auth] Initial session:', !!session);
        if (session?.user) {
          setUser(session.user);
          loadProfile(session.user.id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[Auth] getSession failed:', err?.message);
        if (mounted) setLoading(false);
      });

    /* 3. 네이티브: 딥링크 콜백으로 OAuth 세션 설정 */
    let appUrlListener;
    if (isNative()) {
      import('@capacitor/app').then(({ App }) => {
        appUrlListener = App.addListener('appUrlOpen', async ({ url }) => {
          // com.travelunu.app:///#access_token=...&refresh_token=...
          const hash = url.split('#')[1];
          if (!hash) return;
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            // 브라우저 닫기
            import('@capacitor/browser').then(({ Browser }) => Browser.close());
          }
        });
      });
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      appUrlListener?.then?.(l => l.remove());
      if (appUrlListener?.remove) appUrlListener.remove();
    };
  }, [loadProfile]);

  /* ── Sign in with Kakao ── */
  const signInWithKakao = useCallback(async () => {
    setError(null);

    if (isNative()) {
      // 네이티브: 시스템 브라우저로 OAuth 열고 커스텀 스킴으로 콜백
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: 'com.travelunu.app:///',
          skipBrowserRedirect: true,
        },
      });
      if (err) { setError(err.message); return; }
      if (data?.url) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.url, windowName: '_system' });
      }
    } else {
      // 웹: 기본 리다이렉트 방식
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (err) setError(err.message);
    }
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
