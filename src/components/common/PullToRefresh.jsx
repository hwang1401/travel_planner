import { useState, useRef, useCallback, useEffect } from 'react';
import Icon from './Icon';
import { SPACING } from '../../styles/tokens';

const PULL_THRESHOLD = 56;
const RESISTANCE = 0.45;

/**
 * 당겨서 새로고침 (iOS 등에서 새로고침 버튼이 없을 때).
 * 스크롤이 맨 위일 때 아래로 당기면 onRefresh 호출.
 */
export default function PullToRefresh({ children, onRefresh, disabled }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef(null);
  const startY = useRef(0);
  const startScrollTop = useRef(0);

  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    startY.current = e.touches[0].clientY;
    startScrollTop.current = scrollRef.current?.scrollTop ?? 0;
  }, [disabled]);

  const handleTouchMove = useCallback((e) => {
    if (disabled) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY.current;
    if (scrollTop <= 0 && deltaY > 0) {
      const pull = Math.min(deltaY * RESISTANCE, PULL_THRESHOLD * 1.5);
      setPullY(pull);
      if (pull > 5) e.preventDefault();
    }
  }, [disabled]);

  /* iOS: preventDefault는 passive: false일 때만 동작 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, [handleTouchMove]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled) return;
    const pull = pullY;
    setPullY(0);
    if (pull >= PULL_THRESHOLD && typeof onRefresh === 'function' && !refreshing) {
      setRefreshing(true);
      try {
        await Promise.resolve(onRefresh());
      } finally {
        setRefreshing(false);
      }
    }
  }, [disabled, pullY, onRefresh, refreshing]);

  const handlePointerDown = useCallback((e) => {
    if (e.pointerType !== 'mouse' || disabled) return;
    startY.current = e.clientY;
    startScrollTop.current = scrollRef.current?.scrollTop ?? 0;
  }, [disabled]);

  const handlePointerMove = useCallback((e) => {
    if (e.pointerType !== 'mouse' || disabled) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const currentY = e.clientY;
    const deltaY = currentY - startY.current;
    if (scrollTop <= 0 && deltaY > 0) {
      const pull = Math.min(deltaY * RESISTANCE, PULL_THRESHOLD * 1.5);
      setPullY(pull);
    }
  }, [disabled]);

  const handlePointerUp = useCallback(async () => {
    if (disabled) return;
    const pull = pullY;
    setPullY(0);
    if (pull >= PULL_THRESHOLD && typeof onRefresh === 'function' && !refreshing) {
      setRefreshing(true);
      try {
        await Promise.resolve(onRefresh());
      } finally {
        setRefreshing(false);
      }
    }
  }, [disabled, pullY, onRefresh, refreshing]);

  const showIndicator = pullY > 0 || refreshing;

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          flexShrink: 0,
          height: showIndicator ? `${Math.max(pullY, refreshing ? PULL_THRESHOLD : 0)}px` : 0,
          overflow: 'hidden',
          transition: pullY === 0 ? 'height 0.25s ease' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-surface-container-lowest)',
          color: 'var(--color-on-surface-variant2)',
          fontSize: 'var(--typo-caption-2-regular-size)',
        }}
      >
        {refreshing ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
            <Icon name="sync" size={18} style={{ animation: 'ptr-spin 0.8s linear infinite' }} />
            새로고침 중...
          </span>
        ) : pullY > 10 ? (
          <span style={{ opacity: Math.min(1, pullY / PULL_THRESHOLD) }}>
            {pullY >= PULL_THRESHOLD ? '놓으면 새로고침' : '당겨서 새로고침'}
          </span>
        ) : null}
      </div>
      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  );
}
