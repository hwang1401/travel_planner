import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let savedStyles = null;

/**
 * Body scroll lock hook that works on iOS without breaking input focus.
 * Uses overflow:hidden on body/html to prevent background scrolling.
 * A document-level touchmove listener handles iOS Safari edge cases
 * where overflow:hidden alone doesn't fully prevent body scroll.
 *
 * IMPORTANT: Does NOT set touch-action:none on body — that would block
 * native scrolling inside ALL descendant elements (dialogs, sheets, etc.).
 *
 * Supports nested modals via reference counting.
 * @param {boolean} enabled - pass false to skip locking (default: true)
 */
export function useScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      const body = document.body;
      const html = document.documentElement;
      savedStyles = {
        bodyOverflow: body.style.overflow,
        htmlOverflow: html.style.overflow,
      };

      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
    }
    lockCount++;

    // Track touch start position for direction detection
    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    // Prevent body scroll on iOS while allowing scroll inside scrollable children
    const preventScroll = (e) => {
      const currentX = e.touches?.[0]?.clientX ?? 0;
      const currentY = e.touches?.[0]?.clientY ?? 0;
      const deltaX = currentX - touchStartX;
      const deltaY = currentY - touchStartY;
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

      let target = e.target;
      while (target && target !== document.body) {
        const style = window.getComputedStyle(target);

        if (isHorizontal) {
          // Horizontal swipe: check for horizontally scrollable elements
          const overflowX = style.overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll') {
            const { scrollLeft, scrollWidth, clientWidth } = target;
            if (scrollWidth > clientWidth) {
              const atLeft = scrollLeft <= 0;
              const atRight = scrollLeft + clientWidth >= scrollWidth - 1;
              if ((atLeft && deltaX > 0) || (atRight && deltaX < 0)) {
                e.preventDefault();
                return;
              }
              return; // allow horizontal scroll
            }
          }
        } else {
          // Vertical swipe: check for vertically scrollable elements
          const overflowY = style.overflowY;
          if (overflowY === 'auto' || overflowY === 'scroll') {
            const { scrollTop, scrollHeight, clientHeight } = target;
            if (scrollHeight > clientHeight) {
              const atTop = scrollTop <= 0;
              const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
              if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
                e.preventDefault();
                return;
              }
              return; // allow vertical scroll
            }
          }
        }
        target = target.parentElement;
      }
      // Not inside any scrollable element — block to prevent body scroll
      e.preventDefault();
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', preventScroll);
      lockCount--;
      if (lockCount === 0 && savedStyles) {
        const body = document.body;
        const html = document.documentElement;
        body.style.overflow = savedStyles.bodyOverflow;
        html.style.overflow = savedStyles.htmlOverflow;
        savedStyles = null;
        // Restore scroll position
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [enabled]);
}
