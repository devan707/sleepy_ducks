import type Phaser from 'phaser';
import { MusicManager } from './MusicManager';
import { SoundManager } from './SoundManager';

let appHidden = false;
let listenersAttached = false;

function pauseAllAudio(): void {
  MusicManager.getInstance().pauseForInterruption();
  SoundManager.getInstance().pauseForInterruption();
}

function resumeAllAudio(): void {
  SoundManager.getInstance().resumeFromInterruption();
  MusicManager.getInstance().resumeFromInterruption();
}

function syncAppVisibility(game: Phaser.Game): void {
  if (typeof document === 'undefined') return;

  const hidden = document.hidden;

  if (hidden) {
    if (!appHidden) {
      appHidden = true;
      game.loop.sleep();
      pauseAllAudio();
    }
    return;
  }

  if (appHidden) {
    appHidden = false;
    game.loop.wake();
    resumeAllAudio();
    return;
  }

  // Recover a stuck sleep when the document is visible (common in installed PWAs).
  game.loop.wake();
}

/** Wake the game loop and reconcile audio if the app is in the foreground. */
export function ensureAppActive(game: Phaser.Game): void {
  syncAppVisibility(game);
}

/** Pause every sound when the tab or installed app goes to the background. */
export function initAppAudioLifecycle(game: Phaser.Game): void {
  if (listenersAttached || typeof document === 'undefined') return;
  listenersAttached = true;

  const onLifecycleChange = (): void => {
    syncAppVisibility(game);
  };

  document.addEventListener('visibilitychange', onLifecycleChange);
  window.addEventListener('pagehide', onLifecycleChange);
  window.addEventListener('pageshow', onLifecycleChange);
  window.addEventListener('blur', onLifecycleChange);
  window.addEventListener('focus', onLifecycleChange);
  document.addEventListener('freeze', onLifecycleChange);
  document.addEventListener('resume', onLifecycleChange);

  // First interaction after a missed pageshow — unstick loop + audio.
  document.addEventListener(
    'pointerdown',
    () => {
      if (!document.hidden) {
        game.loop.wake();
        if (appHidden) {
          appHidden = false;
          resumeAllAudio();
        }
      }
    },
    true,
  );

  syncAppVisibility(game);
}
