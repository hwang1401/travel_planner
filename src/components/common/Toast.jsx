import { useState, useEffect } from 'react';
import Icon from './Icon';

/* ── Toast Notification Component ── */
export default function Toast({ message, icon, duration = 2500, onDone }) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), duration - 300);
    const doneTimer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, duration);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [duration, onDone]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
      left: "50%",
      transform: `translateX(-50%) translateY(${exiting ? "20px" : "0"})`,
      zIndex: "var(--z-toast)",
      background: "var(--color-inverse-surface)",
      color: "var(--color-on-inverse-surface)",
      padding: "10px 20px",
      borderRadius: "var(--radius-md, 8px)",
      boxShadow: "var(--shadow-heavy)",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "var(--typo-label-2-medium-size)",
      fontWeight: "var(--typo-label-2-medium-weight)",
      opacity: exiting ? 0 : 1,
      transition: "opacity var(--transition-slow), transform var(--transition-slow)",
      pointerEvents: "none",
      whiteSpace: "nowrap",
    }}>
      {icon && <Icon name={icon} size={16} style={{ filter: "brightness(0) invert(1)" }} />}
      {message}
    </div>
  );
}
