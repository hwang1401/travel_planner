import { createPortal } from 'react-dom';
import Button from './Button';

/* ── Image Viewer (fullscreen lightbox via Portal) ── */
export default function ImageViewer({ src, alt, onClose }) {
  if (!src) return null;

  // Render via Portal so it escapes any parent overflow:hidden / z-index stacking
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.15s ease",
        cursor: "zoom-out",
      }}
    >
      <Button variant="ghost-neutral" size="lg" iconOnly="close" onClick={onClose}
        style={{
          position: "absolute", top: "16px", right: "16px", zIndex: 10000,
          background: "rgba(255,255,255,0.12)", backdropFilter: "blur(4px)",
          width: "36px", height: "36px",
        }} />
      <img
        src={src}
        alt={alt || ""}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "95vw", maxHeight: "90vh",
          objectFit: "contain", borderRadius: "4px",
          cursor: "default",
        }}
      />
    </div>,
    document.body
  );
}
