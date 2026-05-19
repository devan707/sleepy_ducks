const DISMISS_KEY = 'sleepy-ducks-install-dismissed';

const PRODUCTION_HOSTS = new Set(['sleepyducks.app', 'www.sleepyducks.app']);

/** Minimal shape for the deferred install prompt (not in all TS DOM libs). */
export interface DeferredInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: DeferredInstallPrompt | null = null;

type InstallPromptListener = () => void;
const readyListeners = new Set<InstallPromptListener>();

export function onInstallPromptReady(listener: InstallPromptListener): () => void {
  readyListeners.add(listener);
  if (deferredPrompt) listener();
  return () => {
    readyListeners.delete(listener);
  };
}

function notifyInstallPromptReady(): void {
  for (const listener of readyListeners) {
    listener();
  }
}

export function isInstallPromptHost(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('installToast') === '1') return true;
  return PRODUCTION_HOSTS.has(window.location.hostname);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return (isIos || isIpadOs) && !isStandalone();
}

export function isDismissedThisSession(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissForSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function initInstallPromptCapture(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as DeferredInstallPrompt;
    notifyInstallPromptReady();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
  });
}

export function hasDeferredInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

export type InstallPromptKind = 'install' | 'ios';

export function getInstallPromptKind(): InstallPromptKind | null {
  if (!isInstallPromptHost()) return null;
  if (isStandalone()) return null;
  if (isDismissedThisSession()) return null;
  if (isIosBrowser()) return 'ios';
  if (hasDeferredInstallPrompt()) return 'install';
  return null;
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = deferredPrompt;
  if (!prompt) return 'unavailable';
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
    }
    return outcome;
  } catch {
    return 'unavailable';
  }
}
