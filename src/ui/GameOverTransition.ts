import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  GAME_OVER_TRANSITION,
  GAME_WIDTH,
  STAGE,
} from '../config/gameConfig';
import { ensureLuckiestFont, LUCKIEST_FONT } from './uiChrome';

const {
  failTotalMs,
  failDimPeakAlpha,
  failDimFadeInMs,
  failDimFadeOutMs,
  successTotalMs,
  successLaunchGameOverAtMs,
  successBluePeakAlpha,
  successBlueColor,
} = GAME_OVER_TRANSITION;

/** Fail game-over vignette — darken scene, duck stays above dim layer. */
export function playFailTransition(
  scene: Phaser.Scene,
  onComplete: () => void,
): Phaser.GameObjects.Rectangle {
  const dim = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
    .setDepth(STAGE.depthGameOverDim)
    .setScrollFactor(0);

  scene.tweens.add({
    targets: dim,
    alpha: failDimPeakAlpha,
    duration: failDimFadeInMs,
    ease: 'Sine.easeOut',
  });

  scene.time.delayedCall(failTotalMs - failDimFadeOutMs, () => {
    if (!dim.active) return;
    scene.tweens.add({
      targets: dim,
      alpha: 1,
      duration: failDimFadeOutMs,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        onComplete();
      },
    });
  });

  return dim;
}

/** Pass game-over blue overlay + SUCCESS message; callbacks for scene handoff. */
export function playSuccessTransition(
  scene: Phaser.Scene,
  onLaunchGameOver: () => void,
  onComplete: () => void,
): void {
  const overlay = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, successBlueColor, 0)
    .setDepth(STAGE.depthGameOverPassOverlay)
    .setScrollFactor(0);

  const label = scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'SUCCESS', {
      fontFamily: LUCKIEST_FONT,
      fontSize: '54px',
      color: '#ffffff',
      stroke: '#0a1620',
      strokeThickness: 8,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        color: '#000000',
        blur: 6,
        stroke: false,
        fill: true,
      },
    })
    .setOrigin(0.5)
    .setDepth(STAGE.depthGameOverPassOverlay + 1)
    .setScrollFactor(0)
    .setAlpha(0)
    .setScale(0.6);

  void ensureLuckiestFont(label, 54);

  scene.tweens.add({
    targets: overlay,
    alpha: successBluePeakAlpha,
    duration: 600,
    ease: 'Sine.easeOut',
  });

  scene.time.delayedCall(400, () => {
    if (!label.active) return;
    scene.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1,
      duration: 450,
      ease: 'Back.easeOut',
    });
  });

  scene.time.delayedCall(successLaunchGameOverAtMs, () => {
    onLaunchGameOver();
  });

  scene.time.delayedCall(1800, () => {
    if (!label.active) return;
    scene.tweens.add({
      targets: label,
      alpha: 0,
      scale: 0.85,
      duration: 450,
      ease: 'Sine.easeIn',
    });
  });

  scene.time.delayedCall(2400, () => {
    if (!overlay.active) return;
    scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: successTotalMs - 2400,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        overlay.destroy();
        label.destroy();
        onComplete();
      },
    });
  });
}
