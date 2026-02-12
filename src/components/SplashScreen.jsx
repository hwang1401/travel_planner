/*
 * ── Splash Screen ──
 * 앱 초기 세션 체크 시 표시. AuthContext loading 중에만 노출.
 * 규칙: primary(푸른/보라) 배경일 때는 흰색 로고 사용.
 */
import { SPACING } from '../styles/tokens';

export default function SplashScreen() {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-primary)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'var(--safe-area-bottom, 0px)',
      }}
    >
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
      <h1
        style={{
          margin: `0 0 ${SPACING.md}`,
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--color-on-primary)',
          letterSpacing: '-0.5px',
        }}
      >
        Travelunu
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: '14px',
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        함께 만드는 여행 일정
      </p>
      <div
        style={{
          marginTop: '40px',
          width: '28px',
          height: '28px',
          border: '2.5px solid rgba(255,255,255,0.3)',
          borderTopColor: 'rgba(255,255,255,0.95)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
