import { useState, useRef, useCallback, useEffect } from 'react';
import Icon from './Icon';
import { SPACING, RADIUS } from '../../styles/tokens';

const DELETE_WIDTH = 72;
const SWIPE_THRESHOLD = 48;

/**
 * iOS 메일 앱처럼 왼쪽 스와이프 시 오른쪽에 "삭제" 버튼 노출.
 * canSwipeDelete && onDelete 있을 때만 스와이프 동작. 삭제 버튼 탭 시 onDelete() 호출.
 * isOpen/onOpenChange로 부모가 열린 행 제어 (다른 카드 터치·스크롤 시 닫기).
 */
export default function SwipeableRow({ children, canSwipeDelete, onDelete, isOpen, onOpenChange }) {
  const [translateX, setTranslateX] = useState(0);
  const startX = useRef(0);
  const currentX = useRef(0);

  const clamp = useCallback((x) => Math.max(-DELETE_WIDTH, Math.min(0, x)), []);

  const handleTouchStart = useCallback(
    (e) => {
      if (!canSwipeDelete || !onDelete) return;
      startX.current = e.touches[0].clientX;
      currentX.current = translateX;
    },
    [canSwipeDelete, onDelete, translateX]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!canSwipeDelete || !onDelete) return;
      const dx = e.touches[0].clientX - startX.current;
      setTranslateX(clamp(currentX.current + dx));
    },
    [canSwipeDelete, onDelete, clamp]
  );

  const handleTouchEnd = useCallback(() => {
    if (!canSwipeDelete || !onDelete) return;
    if (translateX < -SWIPE_THRESHOLD) {
      setTranslateX(-DELETE_WIDTH);
      onOpenChange?.(true);
    } else {
      setTranslateX(0);
      onOpenChange?.(false);
    }
  }, [canSwipeDelete, onDelete, translateX, onOpenChange]);

  /* 웹: 마우스 드래그로 스와이프 */
  const handlePointerDown = useCallback(
    (e) => {
      if (!canSwipeDelete || !onDelete) return;
      if (e.pointerType === 'touch') return; // 터치는 touch 이벤트로 처리
      e.currentTarget.setPointerCapture?.(e.pointerId);
      startX.current = e.clientX;
      currentX.current = translateX;
    },
    [canSwipeDelete, onDelete, translateX]
  );
  const handlePointerMove = useCallback(
    (e) => {
      if (!canSwipeDelete || !onDelete) return;
      if (e.pointerType === 'touch') return;
      const dx = e.clientX - startX.current;
      setTranslateX(clamp(currentX.current + dx));
    },
    [canSwipeDelete, onDelete, clamp]
  );
  const handlePointerUp = useCallback(
    (e) => {
      if (!canSwipeDelete || !onDelete) return;
      if (e.pointerType === 'touch') return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      if (translateX < -SWIPE_THRESHOLD) {
        setTranslateX(-DELETE_WIDTH);
        onOpenChange?.(true);
      } else {
        setTranslateX(0);
        onOpenChange?.(false);
      }
    },
    [canSwipeDelete, onDelete, translateX, onOpenChange]
  );

  const handleDeleteClick = useCallback(() => {
    onDelete?.();
    setTranslateX(0);
    onOpenChange?.(false);
  }, [onDelete, onOpenChange]);

  useEffect(() => {
    if (isOpen === false) setTranslateX(0);
  }, [isOpen]);

  const effectiveTranslate = isOpen ? -DELETE_WIDTH : translateX;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        borderRadius: RADIUS.md,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          transform: `translateX(${effectiveTranslate}px)`,
          transition: isOpen !== undefined ? 'transform 0.2s ease' : 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        {canSwipeDelete && onDelete && (
          <button
            type="button"
            onClick={handleDeleteClick}
            style={{
              width: DELETE_WIDTH,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: SPACING.xs,
              background: 'var(--color-error)',
              color: 'var(--color-on-error)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--typo-caption-1-bold-size)',
              fontWeight: 'var(--typo-caption-1-bold-weight)',
              padding: `0 ${SPACING.lg}`,
            }}
            aria-label="삭제"
          >
            <Icon name="trash" size={18} />
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
