import { useEffect, useCallback } from 'react';
import Button from './Button';

/* ── Confirm Dialog ── */
export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  // Lock body scroll when modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleBackdropTouch = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div
      onClick={onCancel}
      onTouchMove={handleBackdropTouch}
      style={{
        position: "fixed", inset: 0, zIndex: 3000,
        background: "color-mix(in srgb, var(--color-scrim) 40%, transparent)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px", animation: "fadeIn 0.15s ease",
        touchAction: "none",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: "320px", background: "var(--color-surface-container-lowest)",
        borderRadius: "var(--radius-md, 8px)", overflow: "hidden",
        animation: "slideUp 0.2s ease",
        boxShadow: "var(--shadow-heavy)",
      }}>
        <div style={{ padding: "24px 24px 16px", textAlign: "center" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>{title}</h3>
          <p style={{ margin: 0, fontSize: "var(--typo-label-2-medium-size)", fontWeight: "var(--typo-label-2-medium-weight)", color: "var(--color-on-surface-variant)", lineHeight: "var(--typo-label-2-medium-line-height)" }}>{message}</p>
        </div>
        <div style={{ display: "flex", borderTop: "1px solid var(--color-outline-variant)" }}>
          <Button variant="ghost-neutral" size="lg" onClick={onCancel}
            style={{ flex: 1, borderRadius: 0, borderRight: "1px solid var(--color-outline-variant)", height: "48px" }}>
            취소
          </Button>
          <Button variant="ghost-primary" size="lg" onClick={onConfirm}
            style={{ flex: 1, borderRadius: 0, height: "48px" }}>
            {confirmLabel || "확인"}
          </Button>
        </div>
      </div>
    </div>
  );
}
