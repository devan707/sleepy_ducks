import type Phaser from 'phaser';
import { AudioSession } from './AudioSession';

let appHidden = false;
let listenersAttached = false;

function syncAppVisibility(game: Phaser.Game): void {
  if (typeof document === 'undefined') return;

  const hidden = document.hidden;
  const session = AudioSession.getInstance();

  if (hidden) {
    if (!appHidden) {
      appHidden = true;
      game.loop.sleep();
      session.onForegroundChange(false);
    }
    return;
  }

  game.scale.refresh();
  game.loop.wake();

  if (appHidden) {
    appHidden = false;
    session.onForegroundChange(true);
  } else {
    session.ensureReady();
  }
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
  document.addEventListener('freeze', onLifecycleChange);
  document.addEventListener('resume', onLifecycleChange);

  const onViewportChange = (): void => {
    game.scale.refresh();
    if (!document.hidden) {
      game.loop.wake();
    }
  };
  window.addEventListener('resize', onViewportChange);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportChange);
    window.visualViewport.addEventListener('scroll', onViewportChange);
  }

  // First interaction after a missed pageshow — unstick loop + audio.
  document.addEventListener(
    'pointerdown',
    () => {
      if (!document.hidden) {
        game.scale.refresh();
        game.loop.wake();
        const session = AudioSession.getInstance();
        if (appHidden) {
          appHidden = false;
          session.onForegroundChange(true);
        } else {
          session.ensureReady();
        }
      }
    },
    true,
  );

  syncAppVisibility(game);
}
