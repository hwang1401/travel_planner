import { useState, useEffect } from 'react';
import Icon from './Icon';
import { SPACING } from '../../styles/tokens';

/* ── Toast Notification Component ── */
export default function Toast({ message, icon, duration, onDone, actionLabel, onAction }) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const d = duration ?? (actionLabel && onAction ? 2500 : 1500);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), d - 300);
    const doneTimer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, d);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [d, onDone]);

  if (!visible) return null;

  const handleAction = () => {
    onAction?.();
  };

  const hasAction = actionLabel && onAction;
  const horizontalPadding = 24; // 좌우 동일 패딩 (앱/웹 일관, 빡빡함 방지)
  const edgeInset = 24; // 뷰포트 좌우 최소 여백 (앱에서 화면에 붙지 않도록)
  return (
    <div
      className="toast-root"
      style={{
      position: "fixed",
      bottom: "calc(32px + var(--safe-area-bottom, 0px))",
      left: "50%",
      transform: `translateX(-50%) translateY(${exiting ? "20px" : "0"})`,
      width: "max-content",
      maxWidth: `calc(100vw - ${edgeInset * 2}px)`,
      zIndex: "var(--z-toast)",
      background: "var(--color-inverse-surface)",
      color: "var(--color-on-inverse-surface)",
      padding: `${SPACING.lg} ${horizontalPadding}px ${SPACING.lg} ${horizontalPadding}px`,
      borderRadius: "var(--radius-md, 8px)",
      boxShadow: "var(--shadow-heavy)",
      display: "flex",
      alignItems: "center",
      gap: SPACING.lg,
      fontSize: "var(--typo-label-2-medium-size)",
      fontWeight: "var(--typo-label-2-medium-weight)",
      opacity: exiting ? 0 : 1,
      transition: "opacity var(--transition-slow), transform var(--transition-slow)",
      pointerEvents: onAction ? "auto" : "none",
      whiteSpace: "nowrap",
      boxSizing: "border-box",
    }}>
      {icon && (
        <span className="toast-icon" style={{ display: "flex" }}>
          <Icon name={icon} size={16} />
        </span>
      )}
      <span style={{ flex: 1 }}>{message}</span>
      {hasAction && (
        <button
          type="button"
          onClick={handleAction}
          style={{
            background: "var(--toast-action-bg, rgba(255,255,255,0.2))",
            color: "inherit",
            border: "none",
            borderRadius: "var(--radius-sm, 6px)",
            padding: `${SPACING.xs} ${SPACING.ml}`,
            fontSize: "inherit",
            fontWeight: "var(--typo-label-2-bold-weight)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
