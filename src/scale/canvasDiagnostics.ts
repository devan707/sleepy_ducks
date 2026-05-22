import Phaser from 'phaser';
import { isDevMode } from '../dev/isDevMode';
import { applyCanvasResolution, captureCanvasDiagnostics } from './canvasResolution';

let logged = false;

/** Log canvas backing store vs CSS size once (dev builds only). */
export function logCanvasDiagnosticsOnce(game: Phaser.Game): void {
  if (!isDevMode() || logged || typeof console === 'undefined') return;
  logged = true;
  console.info('[canvas] diagnostics', captureCanvasDiagnostics(game));
}

/** Re-apply DPR zoom when the browser viewport changes (not on Phaser scale resize). */
export function bindCanvasResolutionRefresh(game: Phaser.Game): void {
  if (typeof window === 'undefined') return;

  const refresh = (): void => {
    applyCanvasResolution(game);
    if (isDevMode()) {
      console.info('[canvas] refresh', captureCanvasDiagnostics(game));
    }
  };

  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', refresh);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', refresh);
  }
}

/** Apply retina zoom after Phaser has finished booting the scale manager. */
export function initCanvasResolution(game: Phaser.Game): void {
  const run = (): void => {
    applyCanvasResolution(game);
    bindCanvasResolutionRefresh(game);
    logCanvasDiagnosticsOnce(game);
  };

  if (game.isBooted) {
    run();
    return;
  }

  game.events.once(Phaser.Core.Events.READY, run);
}
