import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SPACING } from '../../styles/tokens';

const STORAGE_KEY = 'pwa-install-dismissed';

/** PWA로 설치되지 않은 웹 진입 시 하단에 "앱 설치" 툴팁 표시. 닫기 시 세션 동안만 숨김 또는 영구 숨김. */
export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(standalone);
    if (standalone) return;

    const dismissed = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    setVisible(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setVisible(false);
      setDeferredPrompt(null);
    } else {
      setVisible(false);
    }
  };

  const handleDismiss = (remember) => {
    setVisible(false);
    if (remember) localStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible || isStandalone) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div
      role="region"
      aria-label="앱 설치 안내"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: `${SPACING.lg} ${SPACING.xxl}`,
        paddingBottom: 'calc(var(--spacing-sp120, 12px) + env(safe-area-inset-bottom, 0px))',
        background: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.lg,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--typo-label-2-bold-size)', fontWeight: 'var(--typo-label-2-bold-weight)', lineHeight: 1.4 }}>
          앱으로 설치하면 더 편해요
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--typo-caption-2-regular-size)', opacity: 0.9 }}>
          {isIOS && 'Safari에서 공유 → "홈 화면에 추가"'}
          {isAndroid && !deferredPrompt && 'Chrome 메뉴 → "앱 설치" 또는 "홈 화면에 추가"'}
          {!isIOS && !isAndroid && deferredPrompt && '한 번의 탭으로 설치할 수 있어요'}
          {!isIOS && !isAndroid && !deferredPrompt && '브라우저 메뉴에서 이 사이트를 설치할 수 있어요'}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flexShrink: 0 }}>
        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            style={{
              padding: `${SPACING.sm} ${SPACING.xl}`,
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255,255,255,0.8)',
              background: 'rgba(255,255,255,0.2)',
              color: 'inherit',
              fontSize: 'var(--typo-caption-1-bold-size)',
              fontWeight: 'var(--typo-caption-1-bold-weight)',
              cursor: 'pointer',
            }}
          >
            설치하기
          </button>
        )}
        <button
          type="button"
          onClick={() => handleDismiss(false)}
          aria-label="닫기"
          style={{
            padding: SPACING.sm,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            opacity: 0.9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="close" size={20} style={{ filter: 'brightness(0) invert(1)' }} />
        </button>
      </div>
    </div>
  );
}
