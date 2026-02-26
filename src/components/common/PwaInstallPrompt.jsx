import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { SPACING } from '../../styles/tokens';

const STORAGE_KEY = 'pwa-install-dismissed';

/** 카카오톡 등 인앱브라우저 감지 */
function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /KAKAOTALK|NAVER|LINE|Instagram|FBAN|FBAV/i.test(ua);
}

/* ── iOS 설치 가이드 오버레이 ── */
function IosInstallGuide({ onClose }) {
  const steps = [
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      ),
      title: '공유 버튼 탭',
      desc: 'Safari 하단 중앙의 공유 버튼을 눌러주세요',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
      title: '"홈 화면에 추가" 선택',
      desc: '공유 메뉴를 아래로 스크롤하여 찾아주세요',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      title: '오른쪽 상단 "추가" 탭',
      desc: '홈 화면에 Travelunu 아이콘이 추가됩니다',
    },
  ];

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          padding: `${SPACING.xxl} ${SPACING.xxl}`,
          paddingBottom: 'calc(var(--spacing-sp120, 12px) + var(--safe-area-bottom, 0px) + 16px)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xl }}>
          <h3 style={{ margin: 0, fontSize: 'var(--typo-heading-3-bold-size, 18px)', fontWeight: 'var(--typo-heading-3-bold-weight, 700)', color: 'var(--color-on-surface)' }}>
            앱 설치 방법
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              padding: SPACING.xs,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* 단계 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: SPACING.lg }}>
              {/* 번호 + 아이콘 */}
              <div style={{
                flexShrink: 0,
                width: 56,
                height: 56,
                borderRadius: 'var(--radius-lg, 12px)',
                background: 'var(--color-primary-container, #f0eeff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                {step.icon}
                <span style={{
                  position: 'absolute',
                  top: -4,
                  left: -4,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {i + 1}
                </span>
              </div>
              {/* 텍스트 */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                <p style={{
                  margin: 0,
                  fontSize: 'var(--typo-label-1-bold-size, 15px)',
                  fontWeight: 'var(--typo-label-1-bold-weight, 600)',
                  color: 'var(--color-on-surface)',
                  lineHeight: 1.4,
                }}>
                  {step.title}
                </p>
                <p style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--typo-caption-1-regular-size, 13px)',
                  color: 'var(--color-on-surface-variant)',
                  lineHeight: 1.4,
                }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 하단 화살표 (Safari 공유 버튼 위치 가리킴) */}
        <div style={{
          marginTop: SPACING.xl,
          textAlign: 'center',
          color: 'var(--color-on-surface-variant)',
          fontSize: 'var(--typo-caption-2-regular-size, 12px)',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 4 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
          Safari 하단 바에서 시작하세요
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** PWA로 설치되지 않은 웹 진입 시 하단에 "앱 설치" 툴팁 표시.
 *  카카오 인앱브라우저에서는 외부 브라우저 열기 안내. */
export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [inApp, setInApp] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // 다른 컴포넌트에서 PWA 프롬프트 visible 여부를 감지할 수 있도록 body attribute 설정
  const shown = visible && !isStandalone;
  useEffect(() => {
    document.body.setAttribute('data-pwa-prompt', shown ? '1' : '0');
    return () => document.body.removeAttribute('data-pwa-prompt');
  }, [shown]);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(standalone);
    if (standalone) return;

    // 인앱브라우저 감지
    if (isInAppBrowser()) {
      setInApp(true);
      setVisible(true);
      return;
    }

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

  const handleOpenExternal = () => {
    const url = window.location.href;
    if (/Android/i.test(navigator.userAgent)) {
      window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    } else {
      navigator.clipboard?.writeText(url);
      alert('링크가 복사되었습니다.\nSafari에서 붙여넣기하여 열어주세요.');
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

  // 인앱브라우저: 외부 브라우저로 열기 안내
  if (inApp) {
    return (
      <div
        role="region"
        aria-label="외부 브라우저 안내"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          padding: `${SPACING.lg} ${SPACING.xxl}`,
          paddingBottom: 'calc(var(--spacing-sp120, 12px) + var(--safe-area-bottom, 0px))',
          background: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.lg,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--typo-label-2-bold-size)', fontWeight: 'var(--typo-label-2-bold-weight)', lineHeight: 1.4 }}>
            외부 브라우저에서 열면 더 편해요
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--typo-caption-2-regular-size)', opacity: 0.9 }}>
            앱 설치 및 전체 기능을 이용할 수 있어요
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenExternal}
          style={{
            padding: `${SPACING.sm} ${SPACING.xl}`,
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.8)',
            background: 'rgba(255,255,255,0.2)',
            color: 'inherit',
            fontSize: 'var(--typo-caption-1-bold-size)',
            fontWeight: 'var(--typo-caption-1-bold-weight)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isAndroid ? '브라우저로 열기' : '링크 복사'}
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="닫기"
          style={{
            padding: SPACING.sm, border: 'none', background: 'transparent',
            color: 'inherit', cursor: 'pointer', opacity: 0.9,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Icon name="close" size={20} style={{ filter: 'brightness(0) invert(1)' }} />
        </button>
      </div>
    );
  }

  return (
    <>
      {showIosGuide && <IosInstallGuide onClose={() => setShowIosGuide(false)} />}
      <div
        role="region"
        aria-label="앱 설치 안내"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          padding: `${SPACING.lg} ${SPACING.xxl}`,
          paddingBottom: 'calc(var(--spacing-sp120, 12px) + var(--safe-area-bottom, 0px))',
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
          {/* iOS: 설치 방법 보기 버튼 */}
          {isIOS && (
            <button
              type="button"
              onClick={() => setShowIosGuide(true)}
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
              설치 방법 보기
            </button>
          )}
          {/* Android/Desktop: beforeinstallprompt 지원 시 설치하기 */}
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
    </>
  );
}
