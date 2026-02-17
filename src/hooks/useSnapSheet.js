import { useState, useRef, useCallback, useMemo } from 'react';

/**
 * useSnapSheet — vh-based snap sheet with drag + scroll conflict handling.
 *
 * All gesture callbacks are stable (no deps) by reading from refs.
 * This prevents React from tearing down/recreating refs on every render.
 */
export function useSnapSheet({ snapPoints = [45, 85], initialSnap = 0 } = {}) {
  const [snapIdx, setSnapIdx] = useState(initialSnap);
  const [height, setHeight] = useState(snapPoints[initialSnap]);
  const [isDragging, setIsDragging] = useState(false);

  // Keep snapPoints & height in refs so stable callbacks can read them
  const snapPointsRef = useRef(snapPoints);
  snapPointsRef.current = snapPoints;
  const heightRef = useRef(height);
  heightRef.current = height;

  // Gesture tracking refs
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const draggingRef = useRef(false);

  // Content scroll conflict refs
  const phaseRef = useRef('idle');
  const contentStartYRef = useRef(0);
  const scrollableRef = useRef(null);

  // ── Snap helpers (stable — read from refs) ──
  const snapToNearest = useCallback((h) => {
    const pts = snapPointsRef.current;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(h - pts[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    setSnapIdx(bestIdx);
    setHeight(pts[bestIdx]);
    setIsDragging(false);
  }, []);

  const setSnapIdxExternal = useCallback((idx) => {
    const pts = snapPointsRef.current;
    const clamped = Math.max(0, Math.min(pts.length - 1, idx));
    setSnapIdx(clamped);
    setHeight(pts[clamped]);
    setIsDragging(false);
  }, []);

  // ── Handle (drag bar) touch events — all stable ──
  const onHandleTouchStart = useCallback((e) => {
    startYRef.current = e.touches[0].clientY;
    startHeightRef.current = heightRef.current;
    draggingRef.current = true;
    setIsDragging(true);
  }, []);

  const onHandleTouchMove = useCallback((e) => {
    if (!draggingRef.current) return;
    const deltaY = startYRef.current - e.touches[0].clientY;
    const vhPx = window.innerHeight / 100;
    const minH = snapPointsRef.current[0] * 0.5;
    const newH = Math.max(minH, Math.min(95, startHeightRef.current + deltaY / vhPx));
    setHeight(newH);
  }, []);

  const onHandleTouchEnd = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    snapToNearest(heightRef.current);
  }, [snapToNearest]);

  // ── Content area touch events — all stable ──
  const onContentTouchStart = useCallback((e) => {
    contentStartYRef.current = e.touches[0].clientY;
    startHeightRef.current = heightRef.current;
    phaseRef.current = 'undecided';
  }, []);

  const onContentTouchEnd = useCallback(() => {
    if (phaseRef.current === 'dragging') {
      snapToNearest(heightRef.current);
      const el = scrollableRef.current;
      if (el) el.style.overflowY = 'auto';
    }
    phaseRef.current = 'idle';
  }, [snapToNearest]);

  // Content ref — stable callback, attaches passive:false touchmove for iOS
  const contentRef = useCallback((node) => {
    if (scrollableRef.current && scrollableRef.current._snapCleanup) {
      scrollableRef.current._snapCleanup();
      scrollableRef.current._snapCleanup = null;
    }
    scrollableRef.current = node;
    if (!node) return;

    const handler = (e) => {
      const phase = phaseRef.current;
      if (phase === 'idle' || phase === 'scrolling') return;

      const deltaY = contentStartYRef.current - e.touches[0].clientY;

      if (phase === 'undecided') {
        if (Math.abs(deltaY) < 8) return;
        const el = scrollableRef.current;
        const atTop = el ? el.scrollTop <= 0 : true;
        if (atTop && deltaY < -8) {
          phaseRef.current = 'dragging';
          setIsDragging(true);
          if (el) el.style.overflowY = 'hidden';
          e.preventDefault();
        } else {
          phaseRef.current = 'scrolling';
        }
        return;
      }

      if (phase === 'dragging') {
        e.preventDefault();
        const vhPx = window.innerHeight / 100;
        const minH = snapPointsRef.current[0] * 0.5;
        const newH = Math.max(minH, Math.min(95, startHeightRef.current + deltaY / vhPx));
        setHeight(newH);
      }
    };

    node.addEventListener('touchmove', handler, { passive: false });
    node._snapCleanup = () => {
      node.removeEventListener('touchmove', handler);
    };
  }, []); // stable — all reads via refs

  // ── Returned objects ──
  const sheetStyle = useMemo(() => ({
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: `${height}vh`,
    transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.16,1,0.3,1)',
    willChange: 'height',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    overscrollBehavior: 'contain',
    zIndex: 10,
    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
    background: 'var(--color-surface-container-lowest)',
    boxShadow: 'var(--shadow-normal)',
  }), [height, isDragging]);

  const handleProps = useMemo(() => ({
    onTouchStart: onHandleTouchStart,
    onTouchMove: onHandleTouchMove,
    onTouchEnd: onHandleTouchEnd,
  }), [onHandleTouchStart, onHandleTouchMove, onHandleTouchEnd]);

  const contentProps = useMemo(() => ({
    ref: contentRef,
    onTouchStart: onContentTouchStart,
    onTouchEnd: onContentTouchEnd,
  }), [contentRef, onContentTouchStart, onContentTouchEnd]);

  return {
    snapIdx,
    setSnapIdx: setSnapIdxExternal,
    sheetStyle,
    handleProps,
    contentProps,
    snapHeight: height,
  };
}
