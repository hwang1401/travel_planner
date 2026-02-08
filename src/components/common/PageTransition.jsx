import { useRef, useCallback, useEffect } from 'react';
import { useScrollLock } from '../../hooks/useScrollLock';

/* ── PageTransition ──
 * Full-screen overlay that slides in from right (iOS push style).
 * Used for wizards, add place page, paste info page, etc.
 */
export default function PageTransition({ open, onClose, viewportRect, children }) {
  const containerRef = useRef(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  useScrollLock(open);

  // Edge swipe back gesture
  const handleTouchStart = useCallback((e) => {
    const x = e.touches[0].clientX;
    // Only trigger from left edge (first 24px)
    if (x < 24) {
      isDragging.current = true;
      startX.current = x;
      currentX.current = 0;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientX - startX.current;
    if (delta > 0) {
      currentX.current = delta;
      if (containerRef.current) {
        containerRef.current.style.transform = `translateX(${delta}px)`;
        containerRef.current.style.transition = 'none';
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (currentX.current > 120) {
      // Swipe far enough → close
      if (containerRef.current) {
        containerRef.current.style.transform = 'translateX(100%)';
        containerRef.current.style.transition = 'transform 0.25s ease';
      }
      setTimeout(() => onClose(), 250);
    } else {
      // Snap back
      if (containerRef.current) {
        containerRef.current.style.transform = 'translateX(0)';
        containerRef.current.style.transition = 'transform 0.25s ease';
      }
    }
    currentX.current = 0;
  }, [onClose]);

  // Reset transform when opening
  useEffect(() => {
    if (open && containerRef.current) {
      containerRef.current.style.transform = '';
      containerRef.current.style.transition = '';
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        ...(viewportRect != null
          ? {
              top: viewportRect.top,
              left: viewportRect.left,
              width: viewportRect.width,
              height: viewportRect.height,
            }
          : { inset: 0 }),
        zIndex: 'var(--z-dialog, 2000)',
        background: 'var(--color-surface)',
        animation: 'pageSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}

      <style>{`
        @keyframes pageSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
