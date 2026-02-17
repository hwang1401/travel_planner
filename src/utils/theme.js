/**
 * 테마 설정 (라이트 / 다크 / 시스템)
 * localStorage 'app-theme' = 'light' | 'dark' | 'system'
 */

const STORAGE_KEY = 'app-theme';

export function getTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch (_) {}
  return 'system';
}

export function setTheme(value) {
  try {
    if (value === 'light' || value === 'dark' || value === 'system') {
      localStorage.setItem(STORAGE_KEY, value);
    }
  } catch (_) {}
}

export function applyTheme() {
  const theme = getTheme();
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    const dark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}
