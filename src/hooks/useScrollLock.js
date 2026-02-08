import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let savedStyles = null;

/**
 * Body scroll lock: 배경만 스크롤 막고, 모달/시트 내부 overflow 영역은 스크롤 허용.
 * body에 touch-action 주지 않음 → 내부 스크롤 영역이 터치 스크롤 가능.
 * iOS 등에서 세부 스크롤/전체 스크롤 구분이 잘 되도록 함.
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

    const preventScroll = (e) => {
      let target = e.target;
      while (target && target !== document.body) {
        const style = window.getComputedStyle(target);
        const oy = style.overflowY;
        const ox = style.overflowX;
        const scrollable = oy === 'auto' || oy === 'scroll' || ox === 'auto' || ox === 'scroll';
        if (scrollable) {
          const { scrollTop, scrollHeight, clientHeight } = target;
          if (scrollHeight > clientHeight) {
            const atTop = scrollTop <= 2;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 2;
            const py = e.touches?.[0]?.clientY ?? 0;
            const lastY = preventScroll._lastY ?? py;
            preventScroll._lastY = py;
            const movingUp = py < lastY;
            if ((atTop && movingUp) || (atBottom && !movingUp)) {
              e.preventDefault();
              return;
            }
            return;
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
        html.style.overflow = savedStyles.htmlOverflow;
        savedStyles = null;
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [enabled]);
}
