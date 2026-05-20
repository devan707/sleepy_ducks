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

/** Pause every sound when the tab or installed app goes to the background. */
export function initAppAudioLifecycle(game: Phaser.Game): void {
  if (listenersAttached || typeof document === 'undefined') return;
  listenersAttached = true;

  const onHide = (): void => {
    if (appHidden) return;
    appHidden = true;
    game.loop.sleep();
    pauseAllAudio();
  };

  const onShow = (): void => {
    if (!appHidden) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    appHidden = false;
    game.loop.wake();
    resumeAllAudio();
  };

  const onVisibilityChange = (): void => {
    if (document.hidden) onHide();
    else onShow();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('pageshow', onShow);

  if (document.hidden) {
    onHide();
  }
}
