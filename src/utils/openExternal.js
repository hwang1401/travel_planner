/**
 * Open URL externally so the current app screen is preserved (e.g. in WebView).
 * Uses anchor with target="_blank" and rel="noopener noreferrer" so many
 * app/WebView environments open the link in system browser or new window
 * instead of replacing the current view.
 * @param {string} url - Full URL to open
 */
export function openExternalUrl(url) {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
