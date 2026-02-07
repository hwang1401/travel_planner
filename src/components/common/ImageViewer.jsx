import Button from './Button';

/* ── Image Viewer (fullscreen lightbox) ── */
export default function ImageViewer({ src, alt, onClose }) {
  if (!src) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "color-mix(in srgb, var(--color-scrim) 90%, transparent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.15s ease",
        cursor: "zoom-out",
      }}
    >
      <Button variant="ghost-neutral" size="lg" iconOnly="close" onClick={onClose}
        style={{
          position: "absolute", top: "16px", right: "16px", zIndex: 2001,
          background: "color-mix(in srgb, var(--color-surface-container-lowest) 15%, transparent)", backdropFilter: "blur(4px)",
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
    </div>
  );
}
