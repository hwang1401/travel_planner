import { useState, useEffect } from 'react';

/**
 * visualViewport + #root 컨테이너 기준으로 fixed 요소의 위치/크기를 반환.
 * 데스크탑에서 #root가 480px로 제한될 때 fixed 오버레이가 컨테이너 안에 맞게 들어옴.
 */
export function useAppViewportRect() {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const root = document.getElementById('root');
      if (root) {
        const rootRect = root.getBoundingClientRect();
        setRect({
          top: vv.offsetTop,
          left: rootRect.left,
          width: rootRect.width,
          height: vv.height,
        });
      } else {
        setRect({
          top: vv.offsetTop,
          left: vv.offsetLeft,
          width: vv.width,
          height: vv.height,
        });
      }
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return rect;
}
