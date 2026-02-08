/**
 * Google Maps JavaScript API 동적 로드
 * Places Autocomplete/Details 사용 전 한 번만 로드
 */

const GOOGLE_SCRIPT_URL = 'https://maps.googleapis.com/maps/api/js';
let loadPromise = null;

export function loadGoogleMapsScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('window undefined'));
  if (window.google?.maps?.places) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[Google Maps] VITE_GOOGLE_MAPS_API_KEY is not set. ' +
        'Set it in .env (local) or in your deploy environment (e.g. Vercel Environment Variables). ' +
        'See docs/google-places-setup.md'
      );
    }
    loadPromise = Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY not set'));
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${GOOGLE_SCRIPT_URL}"]`);
    if (existing) {
      if (window.google?.maps?.places) return resolve();
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = `${GOOGLE_SCRIPT_URL}?key=${encodeURIComponent(key)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps script failed to load'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
