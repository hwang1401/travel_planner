import { useEffect, useRef } from 'react';

let seq = 0;

/**
 * Android/PWA back-button hook.
 * When a dialog opens, pushes a dummy history entry.
 * Pressing back pops it and calls onClose instead of navigating away.
 * If the dialog closes by other means (X button, overlay tap),
 * the cleanup removes the dummy entry via history.back().
 *
 * Supports nested dialogs — each dialog pushes its own uniquely-keyed entry.
 */
export function useBackClose(isOpen, onClose, key) {
  const cbRef = useRef(onClose);
  cbRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const marker = `_bc${++seq}`;
    let alive = true;

    history.pushState({ ...(history.state || {}), [marker]: 1 }, '');

    const handle = () => {
      if (!alive) return;
      // Our entry was popped only if our marker is no longer in current state
      if (!history.state?.[marker]) {
        alive = false;
        cbRef.current();
      }
    };

    window.addEventListener('popstate', handle);
    return () => {
      window.removeEventListener('popstate', handle);
      if (alive) {
        alive = false;
        history.back();
      }
    };
  }, [isOpen, key]);
}
