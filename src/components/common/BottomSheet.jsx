import { useEffect, useRef, useState, useCallback } from 'react';

/* ── Bottom Sheet (reusable wrapper for mobile-style modals) ── */
export default function BottomSheet({ onClose, maxHeight = "85vh", minHeight, zIndex = 1000, children }) {
  const sheetRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Lock body scroll when modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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

  // Prevent backdrop touch from scrolling underlying content
  const handleBackdropTouch = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div
      onClick={onClose}
      onTouchMove={handleBackdropTouch}
      style={{
        position: "fixed", inset: 0, zIndex,
        background: "color-mix(in srgb, var(--color-scrim) 35%, transparent)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fadeIn 0.2s ease",
        touchAction: "none",
        WebkitOverflowScrolling: "auto",
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "420px", maxHeight, ...(minHeight ? { minHeight } : {}),
          background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-md, 8px) var(--radius-md, 8px) 0 0",
          overflow: "hidden",
          animation: isDragging ? 'none' : "bottomSheetUp 0.3s cubic-bezier(0.16,1,0.3,1)",
          display: "flex", flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Drag Handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            padding: "10px 0 2px", display: "flex", justifyContent: "center", flexShrink: 0,
            cursor: "grab", touchAction: "none",
          }}
        >
          <div style={{
            width: "36px", height: "4px", borderRadius: "2px", background: "var(--color-outline-variant)",
          }} />
        </div>
        {children}
      </div>
    </div>
  );
}
