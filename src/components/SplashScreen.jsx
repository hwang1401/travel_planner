/*
 * -- Splash Screen --
 * 앱 초기 세션 체크 시 표시. AuthContext loading 중에만 노출.
 * 라이트/다크 모드 대응: 배경색 자동 전환, og-image 로고 사용.
 */

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
        background: 'var(--color-surface, #fff)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'var(--safe-area-bottom, 0px)',
      }}
    >
      <img
        src="/images/logo-transparent.png"
        alt="travelunu"
        style={{
          width: '220px',
          height: 'auto',
          objectFit: 'contain',
        }}
      />
      <p
        style={{
          margin: '16px 0 0',
          fontSize: '14px',
          color: 'var(--color-on-surface-variant2, rgba(0,0,0,0.5))',
        }}
      >
        함께 만드는 여행 일정
      </p>
      <div
        style={{
          marginTop: '40px',
          width: '28px',
          height: '28px',
          border: '2.5px solid var(--color-outline-variant, rgba(0,0,0,0.1))',
          borderTopColor: 'var(--color-primary, #4a90d9)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
