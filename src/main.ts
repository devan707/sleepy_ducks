import Phaser from 'phaser';
import { initAppAudioLifecycle } from './audio/appAudioLifecycle';
import { initAudioUnlockOnGesture } from './audio/audioUnlock';
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
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
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

initInstallPromptCapture();
registerServiceWorker();
initAudioUnlockOnGesture();

const game = new Phaser.Game(config);

initAppAudioLifecycle(game);
