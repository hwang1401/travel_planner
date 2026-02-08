import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let savedStyles = null;

/** 터치 시작 시 스크롤 가능한 조상 한 번만 찾기 (getComputedStyle은 여기서만) */
function findScrollableParent(node) {
  let target = node;
  while (target && target !== document.body) {
    const style = window.getComputedStyle(target);
    const oy = style.overflowY;
    const ox = style.overflowX;
    const scrollable = oy === 'auto' || oy === 'scroll' || ox === 'auto' || ox === 'scroll';
    if (scrollable) {
      const { scrollHeight, clientHeight } = target;
      if (scrollHeight > clientHeight) return target;
    }
    target = target.parentElement;
  }
  return null;
}

/**
 * Body scroll lock: 배경만 스크롤 막고, 모달/시트 내부 overflow 영역은 스크롤 허용.
 * touchmove에서 getComputedStyle을 반복 호출하지 않도록, touchstart 시 스크롤 영역을
 * 한 번만 찾아 캐시하고 touchmove에서는 그 엘리먼트만 사용 → 모바일 드래그 스크롤 버벅임 완화.
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

    let cachedScrollable = null;
    let lastY = 0;

    const onTouchStart = (e) => {
      cachedScrollable = findScrollableParent(e.target);
      lastY = e.touches?.[0]?.clientY ?? 0;
    };

    const onTouchMove = (e) => {
      const py = e.touches?.[0]?.clientY ?? 0;
      const movingUp = py < lastY;
      lastY = py;

      if (cachedScrollable) {
        const { scrollTop, scrollHeight, clientHeight } = cachedScrollable;
        const atTop = scrollTop <= 2;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 2;
        if ((atTop && movingUp) || (atBottom && !movingUp)) {
          e.preventDefault();
        }
        return;
      }
      e.preventDefault();
    };

    const onTouchEnd = () => {
      cachedScrollable = null;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
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
