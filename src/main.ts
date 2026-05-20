import Phaser from 'phaser';
import { MusicManager } from './audio/MusicManager';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig';
import { AssetLoaderScene } from './scenes/AssetLoaderScene';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { RulesScene } from './scenes/RulesScene';
import { PreloadScene } from './scenes/PreloadScene';
import { initInstallPromptCapture } from './pwa/installPrompt';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { isMobilePhone } from './scale/displayScale';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#b8dce8',
  render: {
    powerPreference: 'high-performance',
    antialias: true,
    roundPixels: true,
  },
  fps: {
    target: 60,
    smoothStep: true,
  },
  scale: {
    mode: isMobilePhone() ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: isMobilePhone(),
  },
  input: {
    activePointers: 2,
  },
  audio: {
    disableWebAudio: false,
  },
  scene: [
    BootScene,
    PreloadScene,
    AssetLoaderScene,
    MenuScene,
    RulesScene,
    GameScene,
    GameOverScene,
  ],
};

MusicManager.startEarly();

initInstallPromptCapture();
registerServiceWorker();

const stopAudioUnlockListeners = (): void => {
  document.removeEventListener('pointerdown', unlockAudioOnGesture);
  document.removeEventListener('touchstart', unlockAudioOnGesture);
  document.removeEventListener('keydown', unlockAudioOnGesture);
};

const unlockAudioOnGesture = (): void => {
  const music = MusicManager.getInstance();
  music.tryUnlock();
  if (music.isActiveTrackPlaying()) {
    stopAudioUnlockListeners();
  }
};

document.addEventListener('pointerdown', unlockAudioOnGesture, { passive: true });
document.addEventListener('touchstart', unlockAudioOnGesture, { passive: true });
document.addEventListener('keydown', unlockAudioOnGesture);

const game = new Phaser.Game(config);

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const music = MusicManager.getInstance();
    if (document.hidden) {
      game.loop.sleep();
      music.pauseForInterruption();
    } else {
      game.loop.wake();
      music.resumeFromInterruption();
    }
  });
}
