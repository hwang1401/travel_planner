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
import { isNative, getPlatform } from '../utils/platform';

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

    /* 3. 네이티브: 딥링크 콜백으로 OAuth 세션 설정 (PKCE) */
    let appUrlListener;
    if (isNative()) {
      import('@capacitor/app').then(({ App }) => {
        appUrlListener = App.addListener('appUrlOpen', async ({ url }) => {
          console.log('[Auth] appUrlOpen:', url);
          // PKCE: com.travelunu.app://login-callback/?code=xxx
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          if (code) {
            console.log('[Auth] PKCE code received, exchanging...');
            const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeErr) {
              console.error('[Auth] Code exchange error:', exchangeErr);
            }
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
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: 'com.travelunu.app://login-callback/',
          skipBrowserRedirect: true,
        },
      });
      if (err) { setError(err.message); return; }
      if (data?.url) {
        const platform = getPlatform();
        if (platform === 'ios') {
          // iOS: ASWebAuthenticationSession (콜백 자동 처리)
          try {
            const { registerPlugin } = await import('@capacitor/core');
            const AuthSession = registerPlugin('AuthSession');
            const result = await AuthSession.start({
              url: data.url,
              callbackScheme: 'com.travelunu.app',
            });
            if (result?.url) {
              const urlObj = new URL(result.url);
              const code = urlObj.searchParams.get('code');
              if (code) {
                await supabase.auth.exchangeCodeForSession(code);
              }
            }
          } catch (e) {
            if (!e.message?.includes('cancelled')) {
              console.error('[Auth] AuthSession error:', e);
              setError(e.message);
            }
          }
        } else {
          // Android: Chrome Custom Tabs → appUrlOpen 리스너에서 처리
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: data.url });
        }
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
