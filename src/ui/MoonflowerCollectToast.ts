import { MOONFLOWER_ATLAS_KEYS } from '../config/moonflowerAssets';
import { recordCharmCollect } from '../storage/charms';
import { GameplayBottomToast, type GameplayBottomToastOptions } from './GameplayBottomToast';

export type MoonflowerCollectToastOptions = {
  onComplete?: () => void;
};

/** Moonflower collected — bottom toast, gameplay continues. */
export class MoonflowerCollectToast {
  private toast: GameplayBottomToast;

  constructor(toast: GameplayBottomToast) {
    this.toast = toast;
  }

  show(opts: MoonflowerCollectToastOptions = {}): void {
    recordCharmCollect('moonflower', 0);

    const toastOpts: GameplayBottomToastOptions = {
      text: 'Moonflower collected!',
      imageKey: MOONFLOWER_ATLAS_KEYS.sway,
      imageFrame: 'frame_000',
      onComplete: opts.onComplete,
    };
    this.toast.show(toastOpts);
  }
}
