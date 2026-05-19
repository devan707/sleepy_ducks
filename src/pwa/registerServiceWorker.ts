import { isInstallPromptHost } from './installPrompt';

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!isInstallPromptHost()) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* ignore — install banner still works on iOS */
    });
  });
}
