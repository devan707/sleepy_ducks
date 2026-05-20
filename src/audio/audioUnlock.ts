import { MusicManager } from './MusicManager';
import { SoundManager } from './SoundManager';

let attached = false;

/**
 * Browser autoplay policies require a user gesture before audio can play.
 * Listen at the document level for any kind of interaction and try to start
 * audio synchronously inside that gesture. Keep listening until music is
 * actually playing (or until music is disabled), so flaky first-load cases
 * recover on the next tap automatically.
 */
export function initAudioUnlockOnGesture(): void {
  if (attached || typeof document === 'undefined') return;
  attached = true;

  const onGesture = (): void => {
    const music = MusicManager.getInstance();
    const sound = SoundManager.getInstance();

    music.tryUnlock();
    sound.tryUnlock();

    if (!music.isMusicEnabled() || music.isActiveTrackPlaying()) {
      remove();
    }
  };

  const opts: AddEventListenerOptions = { passive: true, capture: true };

  const remove = (): void => {
    document.removeEventListener('pointerdown', onGesture, opts);
    document.removeEventListener('touchstart', onGesture, opts);
    document.removeEventListener('keydown', onGesture, opts);
  };

  document.addEventListener('pointerdown', onGesture, opts);
  document.addEventListener('touchstart', onGesture, opts);
  document.addEventListener('keydown', onGesture, opts);
}
