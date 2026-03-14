/*
 * ── Login Page ──
 * Shown when user is not authenticated.
 * Provides Kakao and Google OAuth login buttons.
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SPACING } from '../styles/tokens';
import LegalDialog from './common/LegalDialog';

export default function LoginPage() {
  const { signInWithKakao, signInWithApple, error, enterGuestMode } = useAuth();
  const [legalType, setLegalType] = useState(null); // 'terms' | 'privacy' | null

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-surface)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'var(--safe-area-bottom, 0px)',
    }}>
      {/* Top: Branding — 스플래시와 동일(primary 배경, 흰색 로고, 슬로건) */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `40px ${SPACING.xxxl} ${SPACING.xxl}`,
        minHeight: '50vh',
        background: 'var(--color-primary)',
      }}>
        <img
          src="/icons/logo-splash.png"
          alt="Travelunu"
          style={{
            width: '80px',
            height: 'auto',
            marginBottom: SPACING.xxl,
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
          }}
        />
        <h1 style={{
          margin: `0 0 ${SPACING.md}`,
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--color-on-primary)',
          letterSpacing: '-0.5px',
          textAlign: 'center',
        }}>
          Travelunu
        </h1>
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: 'rgba(255,255,255,0.7)',
          textAlign: 'center',
        }}>
          함께 만드는 여행 일정
        </p>
      </div>

      {/* Bottom: Login buttons */}
      <div style={{
        padding: `${SPACING.xxl} ${SPACING.xxxl} 40px`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.lg,
      }}>
        {/* Error message */}
        {error && (
          <div style={{
            padding: `${SPACING.ml} ${SPACING.lx}`,
            borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--color-error-container, #fde8e8)',
            fontSize: 'var(--typo-caption-1-regular-size)',
            color: 'var(--color-error)',
            textAlign: 'center',
            marginBottom: SPACING.sm,
          }}>
            {error}
          </div>
        )}

        {/* Apple Login */}
        <button
          onClick={signInWithApple}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACING.md,
            width: '100%',
            height: '48px',
            borderRadius: 'var(--radius-md, 8px)',
            border: 'none',
            background: '#000000',
            color: '#FFFFFF',
            fontSize: 'var(--typo-label-1-n---bold-size, 15px)',
            fontWeight: 'var(--typo-label-1-n---bold-weight, 700)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'filter 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
        >
          {/* Apple icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M14.94 10.56c-.02-2.19 1.79-3.24 1.87-3.29-1.02-1.49-2.6-1.69-3.16-1.72-1.35-.14-2.63.79-3.31.79-.68 0-1.74-.77-2.86-.75-1.47.02-2.83.86-3.59 2.17-1.53 2.65-.39 6.59 1.1 8.74.73 1.05 1.6 2.24 2.74 2.19 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.35-3.52zM12.77 4.04c.61-.74 1.02-1.76.91-2.79-.88.04-1.94.58-2.57 1.32-.56.65-1.06 1.69-.93 2.69.99.07 1.99-.5 2.59-1.22z" fill="#FFFFFF"/>
          </svg>
          Apple로 시작하기
        </button>

        {/* Kakao Login */}
        <button
          onClick={signInWithKakao}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACING.md,
            width: '100%',
            height: '48px',
            borderRadius: 'var(--radius-md, 8px)',
            border: 'none',
            background: '#FEE500',
            color: '#191919',
            fontSize: 'var(--typo-label-1-n---bold-size, 15px)',
            fontWeight: 'var(--typo-label-1-n---bold-weight, 700)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'filter 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.95)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
        >
          {/* Kakao icon (speech bubble) */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C5.029 2 1 5.143 1 9.036c0 2.458 1.614 4.618 4.054 5.89l-1.03 3.78a.3.3 0 00.457.336l4.382-2.907c.373.034.752.052 1.137.052 4.971 0 9-3.143 9-7.036C19 5.143 14.971 2 10 2z" fill="#191919"/>
          </svg>
          카카오로 시작하기
        </button>

        {/* Guest mode */}
        <button
          onClick={enterGuestMode}
          style={{
            background: 'none', border: 'none',
            padding: `${SPACING.md} 0`,
            fontSize: 'var(--typo-label-2-medium-size)',
            fontWeight: 'var(--typo-label-2-medium-weight)',
            color: 'var(--color-on-surface-variant2)',
            cursor: 'pointer', textAlign: 'center',
            width: '100%', fontFamily: 'inherit',
          }}
        >
          로그인 없이 둘러보기
        </button>

        {/* Terms notice */}
        <p style={{
          margin: `${SPACING.md} 0 0`,
          fontSize: 'var(--typo-caption-3-regular-size, 11px)',
          color: 'var(--color-on-surface-variant2)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          로그인하면{' '}
          <button type="button" onClick={() => setLegalType('terms')} style={linkStyle}>서비스 이용약관</button>
          {' '}및{' '}
          <button type="button" onClick={() => setLegalType('privacy')} style={linkStyle}>개인정보 처리방침</button>
          에 동의하게 됩니다.
        </p>
      </div>

      {legalType && <LegalDialog type={legalType} onClose={() => setLegalType(null)} />}
    </div>
  );
}

const linkStyle = {
  background: 'none', border: 'none', padding: 0, margin: 0,
  fontSize: 'inherit', fontFamily: 'inherit', cursor: 'pointer',
  color: 'var(--color-primary)', textDecoration: 'underline',
  textUnderlineOffset: '2px',
};
