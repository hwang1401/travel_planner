import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SPACING, RADIUS } from '../../styles/tokens';

/**
 * CenterPopup — 화면 중앙 팝업 (인라인 필드 수정용).
 *
 * Props:
 *  - title    : 상단 제목 (optional)
 *  - onClose  : 백드롭 클릭 / ESC로 닫기
 *  - children : 내부 콘텐츠
 *  - maxWidth : (default 320)
 */
export default function CenterPopup({ title, onClose, children, maxWidth = 320 }) {
  const [vpOffset, setVpOffset] = useState({ top: 0, height: window.innerHeight });
  const backdropRef = useRef(null);

  // visualViewport 추적 — 키보드가 올라와도 중앙 유지
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVpOffset({ top: vv.offsetTop, height: vv.height });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  // ESC 키
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const popup = (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose?.(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        // 키보드 대응
        paddingTop: vpOffset.top,
        height: vpOffset.height + vpOffset.top,
        animation: 'centerPopupFadeIn 0.15s ease',
      }}
    >
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: RADIUS.xl,
        width: `min(${maxWidth}px, calc(100vw - 32px))`,
        maxHeight: `calc(${vpOffset.height}px - 48px)`,
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        animation: 'centerPopupScaleIn 0.15s ease',
      }}>
        {title && (
          <div style={{
            padding: `${SPACING.lg} ${SPACING.xl}`,
            borderBottom: '1px solid var(--color-outline-variant)',
            fontSize: 'var(--typo-label-1-bold-size, 15px)',
            fontWeight: 600,
            color: 'var(--color-on-surface)',
          }}>
            {title}
          </div>
        )}
        <div style={{ padding: SPACING.xl }}>
          {children}
        </div>
      </div>

      {/* animations */}
      <style>{`
        @keyframes centerPopupFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes centerPopupScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );

  return createPortal(popup, document.body);
}
