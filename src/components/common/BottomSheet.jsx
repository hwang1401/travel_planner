import { useRef, useState, useCallback, useEffect } from 'react';
import { useScrollLock } from '../../hooks/useScrollLock';
import Button from './Button';

/* ── Bottom Sheet (reusable wrapper for mobile-style modals) ── */
export default function BottomSheet({ onClose, maxHeight = "85vh", minHeight, zIndex = 1000, title, children }) {
  const sheetRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Track visual viewport for keyboard avoidance (iOS)
  const [vv, setVv] = useState(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setVv({ top: viewport.offsetTop, height: viewport.height });
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    update();
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  useScrollLock();

  // Drag handlers
  const handleTouchStart = useCallback((e) => {
    startY.current = e.touches[0].clientY;
    currentY.current = 0;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e) => {
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      currentY.current = delta;
      setDragY(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (currentY.current > 120) {
      onClose();
    } else {
      setDragY(0);
    }
    currentY.current = 0;
  }, [onClose]);

  // Prevent backdrop touch from scrolling underlying content (native listener for non-passive)
  // 시트 내부 터치는 허용 (가로 스크롤 등 정상 동작 보장)
  const backdropRef = useRef(null);
  useEffect(() => {
    const el = backdropRef.current;
    if (!el) return;
    const handler = (e) => {
      if (sheetRef.current?.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, []);

  return (
    <div
      ref={backdropRef}
      onClick={onClose}
      style={{
        position: "fixed", left: 0, right: 0,
        ...(vv ? { top: vv.top, height: vv.height } : { top: 0, bottom: 0 }),
        zIndex,
        background: "color-mix(in srgb, var(--color-scrim) 35%, transparent)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "420px",
          maxHeight: vv ? `min(${maxHeight}, ${Math.floor(vv.height - 20)}px)` : maxHeight,
          ...(minHeight ? { minHeight } : {}),
          /* 시트 배경: surface-container-lowest. 내부 블록·버튼은 아웃라인 필수, 기본은 --color-outline-variant. */
          background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0",
          overflow: "hidden",
          overscrollBehavior: "contain",
          animation: isDragging ? 'none' : "bottomSheetUp 0.3s cubic-bezier(0.16,1,0.3,1)",
          display: "flex", flexDirection: "column",
          paddingBottom: "var(--safe-area-bottom, 0px)",
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Drag Handle — 가이드 4-5: 36px×4px, 상단 패딩 sp80 */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            padding: "var(--spacing-sp80) 0 var(--spacing-sp20)",
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <div style={{
            width: "36px",
            height: "4px",
            borderRadius: "var(--radius-xsm)",
            background: "var(--color-outline-variant)",
          }} />
        </div>
        {title && (
          <div style={{
            padding: "6px var(--spacing-sp200) var(--spacing-sp120)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--color-outline-variant)",
            flexShrink: 0,
          }}>
            <h3 style={{
              margin: 0,
              fontSize: "var(--typo-body-1-n---bold-size)",
              fontWeight: "var(--typo-body-1-n---bold-weight)",
              color: "var(--color-on-surface)",
            }}>
              {title}
            </h3>
            <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
          </div>
        )}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
