import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let savedStyles = null;

/**
 * Body scroll lock hook that works on iOS without breaking input focus.
 * Uses overflow:hidden + touch-action instead of position:fixed to avoid
 * iOS Safari input caret positioning bugs.
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
        bodyTouchAction: body.style.touchAction,
        htmlOverflow: html.style.overflow,
      };

      body.style.overflow = 'hidden';
      body.style.touchAction = 'none';
      html.style.overflow = 'hidden';
    }
    lockCount++;

    // Prevent touchmove on document level for iOS
    const preventScroll = (e) => {
      // Allow scrolling inside elements that have overflow (modal content)
      let target = e.target;
      while (target && target !== document.body) {
        const style = window.getComputedStyle(target);
        const overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          const { scrollTop, scrollHeight, clientHeight } = target;
          // Allow scroll if content is scrollable and not at boundary
          if (scrollHeight > clientHeight) {
            const atTop = scrollTop <= 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight;
            const isScrollingUp = e.touches?.[0]?.clientY > (preventScroll._lastY || 0);
            preventScroll._lastY = e.touches?.[0]?.clientY;
            if ((atTop && isScrollingUp) || (atBottom && !isScrollingUp)) {
              e.preventDefault();
              return;
            }
            return; // Allow normal scrolling within the element
          }
        }
        target = target.parentElement;
      }
      e.preventDefault();
    };
    preventScroll._lastY = 0;

    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventScroll);
      lockCount--;
      if (lockCount === 0 && savedStyles) {
        const body = document.body;
        const html = document.documentElement;
        body.style.overflow = savedStyles.bodyOverflow;
        body.style.touchAction = savedStyles.bodyTouchAction;
        html.style.overflow = savedStyles.htmlOverflow;
        savedStyles = null;
        // Restore scroll position
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [enabled]);
}
