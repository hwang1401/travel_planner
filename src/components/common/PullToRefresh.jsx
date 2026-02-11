import { useState, useRef, useCallback, useEffect } from 'react';
import Icon from './Icon';
import { SPACING } from '../../styles/tokens';

const PULL_THRESHOLD = 56;
const RESISTANCE = 0.45;

/**
 * 당겨서 새로고침 (앱/PWA·터치 환경용).
 * 터치만 지원 — 웹 데스크톱 마우스 스크롤 시 오동작 방지.
 */
export default function PullToRefresh({ children, onRefresh, disabled }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef(null);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    startY.current = e.touches[0].clientY;
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
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  );
}
