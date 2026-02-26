import { useState, useEffect } from 'react';
import Button from './Button';
import Icon from './Icon';
import BottomSheet from './BottomSheet';
import { SPACING } from '../../styles/tokens';

const STORAGE_KEY = 'pwa-install-dismissed';

/** 카카오톡 등 인앱브라우저 감지 */
function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /KAKAOTALK|NAVER|LINE|Instagram|FBAN|FBAV/i.test(ua);
}

function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** 인앱브라우저에서 외부 브라우저로 열기 */
function openExternalBrowser() {
  const url = window.location.href;
  const ua = navigator.userAgent || '';

  // 카카오톡: 공식 외부 브라우저 열기 scheme (Android/iOS 공통)
  if (/KAKAOTALK/i.test(ua)) {
    window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    return;
  }

  // 네이버 앱
  if (/NAVER/i.test(ua)) {
    // 네이버 앱 외부 브라우저 scheme
    window.location.href = 'naversearchapp://openExternal?url=' + encodeURIComponent(url);
    return;
  }

  // LINE
  if (/Line\//i.test(ua)) {
    window.open(url + (url.includes('?') ? '&' : '?') + 'openExternalBrowser=1', '_blank');
    return;
  }

  // 안드로이드: intent scheme으로 Chrome 열기
  if (/Android/i.test(ua)) {
    window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }

  // iOS Instagram/Facebook 등: Safari로 직접 열기 시도
  window.open(url, '_blank');
}

const GUIDE = {
  ios: {
    steps: [
      { num: '1', title: '하단의 공유 버튼 탭', desc: <>Safari 하단 가운데의 <Icon name="share" size={14} style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'brightness(0) invert(1)', margin: '0 2px' }} /> 아이콘을 눌러주세요</> },
      { num: '2', title: '"홈 화면에 추가" 선택', desc: '공유 메뉴를 아래로 스크롤하면 찾을 수 있어요' },
      { num: '3', title: '오른쪽 상단 "추가" 탭', desc: '홈 화면에 Travelunu 앱 아이콘이 생겨요' },
    ],
    footer: 'Safari 하단 바에서 시작하세요',
  },
  android: {
    steps: [
      { num: '1', title: 'Chrome 메뉴(⋮) 탭', desc: '오른쪽 상단의 더보기 메뉴를 눌러주세요' },
      { num: '2', title: '"앱 설치" 또는 "홈 화면에 추가"', desc: '메뉴에서 해당 항목을 선택해주세요' },
      { num: '3', title: '"설치" 확인', desc: '홈 화면에 Travelunu 앱 아이콘이 생겨요' },
    ],
    footer: 'Chrome 오른쪽 상단에서 시작하세요',
  },
  desktop: {
    steps: [
      { num: '1', title: '브라우저 메뉴(⋮) 열기', desc: 'Chrome/Edge 오른쪽 상단의 메뉴를 열어주세요' },
      { num: '2', title: '"앱 설치" 또는 "바로가기 만들기"', desc: '메뉴에서 해당 항목을 선택해주세요' },
      { num: '3', title: '"설치" 확인', desc: '독립 창에서 Travelunu를 사용할 수 있어요' },
    ],
    footer: '주소창 오른쪽 설치 아이콘 또는 메뉴에서 시작하세요',
  },
};

/* ── 설치 가이드 바텀시트 ── */
function InstallGuideSheet({ platform, onClose }) {
  const { steps, footer } = GUIDE[platform] || GUIDE.desktop;

  return (
    <BottomSheet onClose={onClose} maxHeight="auto" zIndex={10001} title="앱 설치 방법">
      <div style={{ padding: `${SPACING.xl} ${SPACING.xxl} ${SPACING.xxxl}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
          {steps.map((step) => (
            <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg }}>
              <div style={{
                flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                background: 'var(--color-primary)', color: 'var(--color-on-primary)',
                fontSize: 'var(--typo-caption-1-bold-size, 12px)',
                fontWeight: 'var(--typo-caption-1-bold-weight, 600)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {step.num}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontSize: 'var(--typo-body-2-n---bold-size, 14px)',
                  fontWeight: 'var(--typo-body-2-n---bold-weight, 600)',
                  color: 'var(--color-on-surface)',
                  lineHeight: 1.5,
                }}>
                  {step.title}
                </p>
                <p style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--typo-caption-1-regular-size, 13px)',
                  color: 'var(--color-on-surface-variant)',
                  lineHeight: 1.5,
                }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p style={{
          margin: `${SPACING.xl} 0 0`, textAlign: 'center',
          fontSize: 'var(--typo-caption-2-regular-size, 12px)',
          color: 'var(--color-on-surface-variant)',
        }}>
          {footer}
        </p>
      </div>
    </BottomSheet>
  );
}

/* primary 배경 위 흰색 버튼 스타일 오버라이드 */
const whiteBtnStyle = {
  background: 'rgba(255,255,255,0.2)',
  border: '1px solid rgba(255,255,255,0.8)',
  color: '#fff',
};
const whiteGhostStyle = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  opacity: 0.9,
};

/** PWA로 설치되지 않은 웹 진입 시 하단에 "앱 설치" 툴팁 표시. */
export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [inApp, setInApp] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const platform = detectPlatform();

  // body attribute로 visible 여부 공유
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
    }
  };

  const handleDismiss = (remember) => {
    setVisible(false);
    if (remember) localStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible || isStandalone) return null;

  // 하단 바 공통 스타일
  const barStyle = {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10000,
    padding: `${SPACING.lg} ${SPACING.xxl}`,
    paddingBottom: 'calc(var(--spacing-sp120, 12px) + var(--safe-area-bottom, 0px))',
    background: 'var(--color-primary)', color: 'var(--color-on-primary)',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
    display: 'flex', alignItems: 'center', gap: SPACING.lg,
  };

  // 인앱브라우저: 외부 브라우저로 열기
  if (inApp) {
    return (
      <div role="region" aria-label="외부 브라우저 안내" style={barStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--typo-label-2-bold-size)', fontWeight: 'var(--typo-label-2-bold-weight)', lineHeight: 1.4 }}>
            외부 브라우저에서 열면 더 편해요
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--typo-caption-2-regular-size)', opacity: 0.9 }}>
            앱 설치 및 전체 기능을 이용할 수 있어요
          </p>
        </div>
        <Button variant="neutral" size="sm" onClick={openExternalBrowser} style={whiteBtnStyle}>
          브라우저로 열기
        </Button>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={() => setVisible(false)}
          aria-label="닫기" style={whiteGhostStyle} />
      </div>
    );
  }

  // 일반 브라우저
  const subText = {
    ios: 'Safari에서 공유 → "홈 화면에 추가"',
    android: 'Chrome 메뉴 → "앱 설치" 또는 "홈 화면에 추가"',
    desktop: '브라우저 메뉴에서 이 사이트를 설치할 수 있어요',
  }[platform];

  return (
    <>
      {showGuide && <InstallGuideSheet platform={platform} onClose={() => setShowGuide(false)} />}
      <div role="region" aria-label="앱 설치 안내" style={barStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--typo-label-2-bold-size)', fontWeight: 'var(--typo-label-2-bold-weight)', lineHeight: 1.4 }}>
            앱으로 설치하면 더 편해요
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--typo-caption-2-regular-size)', opacity: 0.9 }}>
            {deferredPrompt ? '한 번의 탭으로 설치할 수 있어요' : subText}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flexShrink: 0 }}>
          {deferredPrompt ? (
            <Button variant="neutral" size="sm" onClick={handleInstall} style={whiteBtnStyle}>
              설치하기
            </Button>
          ) : (
            <Button variant="neutral" size="sm" onClick={() => setShowGuide(true)} style={whiteBtnStyle}>
              설치 방법 보기
            </Button>
          )}
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={() => handleDismiss(false)}
            aria-label="닫기" style={whiteGhostStyle} />
        </div>
      </div>
    </>
  );
}
