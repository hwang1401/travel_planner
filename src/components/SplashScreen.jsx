/*
 * ── Splash Screen ──
 * Shows app branding during initial session check.
 * Displayed while AuthContext is loading.
 */


export default function SplashScreen() {
  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-primary)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Logo */}
      <img
        src="/icons/logo-splash.png"
        alt="TravelUnu"
        style={{
          width: '80px',
          height: 'auto',
          marginBottom: '20px',
          objectFit: 'contain',
          filter: 'brightness(0) invert(1)',
          animation: 'fadeIn 0.6s ease',
        }}
      />

      {/* App name */}
      <h1 style={{
        margin: '0 0 8px',
        fontSize: '28px',
        fontWeight: 700,
        color: 'var(--color-on-primary)',
        letterSpacing: '-0.5px',
        animation: 'fadeIn 0.6s ease 0.15s both',
      }}>
        TravelUnu
      </h1>

      <p style={{
        margin: 0,
        fontSize: '14px',
        color: 'rgba(255,255,255,0.7)',
        animation: 'fadeIn 0.6s ease 0.3s both',
      }}>
        함께 만드는 여행 일정
      </p>

      {/* Loading indicator */}
      <div style={{
        marginTop: '48px',
        width: '24px',
        height: '24px',
        border: '2.5px solid rgba(255,255,255,0.3)',
        borderTopColor: 'var(--color-on-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
