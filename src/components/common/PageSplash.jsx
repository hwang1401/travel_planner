/**
 * ── PageSplash ──
 * 인앱 로딩용 스플래시 (메인 복귀, 일정 로드 등).
 * App 초기화용 SplashScreen과 스타일을 맞추되, surface 배경으로 구분.
 *
 * message: 로딩 문구 (예: "여행 목록 불러오는 중", "일정을 불러오는 중")
 * showLogo: 로고 표시 여부 (기본 true)
 * fillContainer: true면 부모 높이만 채움, false면 100vh (전체 화면)
 */
import { SPACING } from '../../styles/tokens';

export default function PageSplash({ message, showLogo = true, fillContainer = false }) {
  return (
    <div style={{
      width: '100%',
      ...(fillContainer ? { height: '100%', minHeight: 0 } : { minHeight: '100vh' }),
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-surface)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {showLogo && (
        <img
          src="/icons/logo-splash.png"
          alt=""
          style={{
            width: '56px',
            height: 'auto',
            marginBottom: SPACING.xl,
            objectFit: 'contain',
            opacity: 0.9,
            animation: 'fadeIn 0.5s ease',
          }}
        />
      )}
      <div style={{
        width: '28px',
        height: '28px',
        border: '2.5px solid var(--color-surface-container)',
        borderTopColor: 'var(--color-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      {message && (
        <p style={{
          margin: `${SPACING.xl} 0 0`,
          fontSize: 'var(--typo-caption-1-regular-size)',
          color: 'var(--color-on-surface-variant2)',
          animation: 'fadeIn 0.4s ease 0.15s both',
        }}>
          {message}
        </p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
