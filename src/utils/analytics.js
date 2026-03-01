const GA_ID = 'G-LCB7EY6BFM';

export function trackPageView(path, title) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('config', GA_ID, {
    page_path: path,
    page_title: title,
  });
}

export function trackEvent(action, params = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', action, params);
}
