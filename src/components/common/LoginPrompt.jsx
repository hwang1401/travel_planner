/*
 * Login Prompt — shown when guest tries account-only features.
 * Based on ConfirmDialog pattern with Apple/Kakao login buttons.
 */

import { useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { SPACING } from '../../styles/tokens';

export default function LoginPrompt({ onClose, context }) {
  const { signInWithKakao, signInWithApple, user, isGuest } = useAuth();
  useScrollLock();

  /* 로그인 성공 감지 → 자동 닫기 */
  useEffect(() => {
    if (user && !isGuest) onClose();
  }, [user, isGuest, onClose]);

  const handleLogin = useCallback((signInFn) => {
    if (context) sessionStorage.setItem('login_context', context);
    signInFn();
  }, [context]);

  const handleBackdropTouch = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div
      onClick={onClose}
      onTouchMove={handleBackdropTouch}
      style={{
        position: 'fixed', top: 0, bottom: 0, left: 'var(--app-left, 0)', right: 'var(--app-right, 0)',
        zIndex: 'var(--z-confirm)',
        background: 'color-mix(in srgb, var(--color-scrim) 40%, transparent)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: SPACING.xxxl, animation: 'fadeIn 0.15s ease',
        touchAction: 'none',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '320px',
          background: 'var(--color-surface-container-lowest)',
          borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden',
          animation: 'slideUp 0.2s ease',
          boxShadow: 'var(--shadow-heavy)',
        }}
      >
        {/* Header */}
        <div style={{ padding: `${SPACING.xxxl} ${SPACING.xxxl} ${SPACING.lg}`, textAlign: 'center' }}>
          <h3 style={{
            margin: `0 0 ${SPACING.md}`,
            fontSize: 'var(--typo-body-1-n---bold-size)',
            fontWeight: 'var(--typo-body-1-n---bold-weight)',
            color: 'var(--color-on-surface)',
          }}>
            로그인이 필요합니다
          </h3>
          <p style={{
            margin: 0,
            fontSize: 'var(--typo-label-2-medium-size)',
            fontWeight: 'var(--typo-label-2-medium-weight)',
            color: 'var(--color-on-surface-variant)',
            lineHeight: 'var(--typo-label-2-medium-line-height)',
            whiteSpace: 'pre-line',
          }}>
            {'여행을 만들고, AI 일정 추천을 받으려면\n로그인해주세요.'}
          </p>
        </div>

        {/* Login buttons */}
        <div style={{ padding: `0 ${SPACING.xxxl} ${SPACING.lg}`, display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {/* Apple */}
          <button
            onClick={() => handleLogin(signInWithApple)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACING.md,
              width: '100%', height: '44px', borderRadius: 'var(--radius-md, 8px)',
              border: 'none', background: '#000000', color: '#FFFFFF',
              fontSize: 'var(--typo-label-1-n---bold-size, 15px)',
              fontWeight: 'var(--typo-label-1-n---bold-weight, 700)',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M14.94 10.56c-.02-2.19 1.79-3.24 1.87-3.29-1.02-1.49-2.6-1.69-3.16-1.72-1.35-.14-2.63.79-3.31.79-.68 0-1.74-.77-2.86-.75-1.47.02-2.83.86-3.59 2.17-1.53 2.65-.39 6.59 1.1 8.74.73 1.05 1.6 2.24 2.74 2.19 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.35-3.52zM12.77 4.04c.61-.74 1.02-1.76.91-2.79-.88.04-1.94.58-2.57 1.32-.56.65-1.06 1.69-.93 2.69.99.07 1.99-.5 2.59-1.22z" fill="#FFFFFF"/>
            </svg>
            Apple로 시작하기
          </button>

          {/* Kakao */}
          <button
            onClick={() => handleLogin(signInWithKakao)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACING.md,
              width: '100%', height: '44px', borderRadius: 'var(--radius-md, 8px)',
              border: 'none', background: '#FEE500', color: '#191919',
              fontSize: 'var(--typo-label-1-n---bold-size, 15px)',
              fontWeight: 'var(--typo-label-1-n---bold-weight, 700)',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C5.029 2 1 5.143 1 9.036c0 2.458 1.614 4.618 4.054 5.89l-1.03 3.78a.3.3 0 00.457.336l4.382-2.907c.373.034.752.052 1.137.052 4.971 0 9-3.143 9-7.036C19 5.143 14.971 2 10 2z" fill="#191919"/>
            </svg>
            카카오로 시작하기
          </button>
        </div>

        {/* Close button */}
        <div style={{ padding: `0 ${SPACING.xxxl} ${SPACING.xxl}`, textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', padding: `${SPACING.md} 0`,
              fontSize: 'var(--typo-label-2-medium-size)',
              fontWeight: 'var(--typo-label-2-medium-weight)',
              color: 'var(--color-on-surface-variant2)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
