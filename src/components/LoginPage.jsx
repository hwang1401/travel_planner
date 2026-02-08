/*
 * ── Login Page ──
 * Shown when user is not authenticated.
 * Provides Kakao and Google OAuth login buttons.
 */

import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signInWithKakao, error } = useAuth();

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-surface)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Top: Branding — 스플래시와 동일(primary 배경, 흰색 로고, 슬로건) */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px 20px',
        minHeight: '50vh',
        background: 'var(--color-primary)',
      }}>
        <img
          src="/icons/logo-splash.png"
          alt="Travelunu"
          style={{
            width: '80px',
            height: 'auto',
            marginBottom: '20px',
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
          }}
        />
        <h1 style={{
          margin: '0 0 8px',
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
        padding: '20px 24px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {/* Error message */}
        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--color-error-container, #fde8e8)',
            fontSize: 'var(--typo-caption-1-regular-size)',
            color: 'var(--color-error)',
            textAlign: 'center',
            marginBottom: '4px',
          }}>
            {error}
          </div>
        )}

        {/* Kakao Login */}
        <button
          onClick={signInWithKakao}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
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

        {/* Terms notice */}
        <p style={{
          margin: '8px 0 0',
          fontSize: 'var(--typo-caption-3-regular-size, 11px)',
          color: 'var(--color-on-surface-variant2)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          로그인하면 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}
