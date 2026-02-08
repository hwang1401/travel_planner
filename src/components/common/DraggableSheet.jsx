import { useRef, useState, useCallback, useEffect } from 'react';

/* ── DraggableSheet ──
 * Multi-snap-point draggable bottom panel.
 * Used inside full-page layouts (e.g. AddPlacePage).
 *
 * Props:
 *   snapPoints — array of vh percentages, e.g. [30, 60, 90]
 *   initialSnap — index into snapPoints (default 1 = middle)
 *   onSnapChange — (snapIndex) => void
 *   children — content
 */
export default function DraggableSheet({
  snapPoints = [30, 60, 90],
  initialSnap = 1,
  onSnapChange,
  children,
  style: customStyle,
}) {
  const [snapIdx, setSnapIdx] = useState(initialSnap);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const sheetRef = useRef(null);

  const currentHeight = snapPoints[snapIdx];

  const handleTouchStart = useCallback((e) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startHeight.current = snapPoints[snapIdx];
    setDragOffset(0);
  }, [snapIdx, snapPoints]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return;
    const delta = startY.current - e.touches[0].clientY;
    const deltaVh = (delta / window.innerHeight) * 100;
    setDragOffset(deltaVh);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const targetHeight = startHeight.current + dragOffset;
    // Find closest snap point
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < snapPoints.length; i++) {
      const dist = Math.abs(snapPoints[i] - targetHeight);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    setSnapIdx(closestIdx);
    setDragOffset(0);
    if (onSnapChange) onSnapChange(closestIdx);
  }, [dragOffset, snapPoints, onSnapChange]);

  const height = isDragging.current
    ? Math.max(snapPoints[0], Math.min(snapPoints[snapPoints.length - 1], startHeight.current + dragOffset))
    : currentHeight;

  return (
    <div
      ref={sheetRef}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${height}vh`,
        background: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: isDragging.current ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 10,
        ...customStyle,
      }}
    >
      {/* Drag Handle */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          padding: '10px 0 6px',
          display: 'flex',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <div style={{
          width: '36px',
          height: '4px',
          borderRadius: '2px',
          background: 'var(--color-outline-variant)',
        }} />
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}>
        {children}
      </div>
    </div>
  );
}
