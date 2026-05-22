import Phaser from 'phaser';
import { initAppAudioLifecycle } from './audio/appAudioLifecycle';
import { initAudioSessionDevLog } from './audio/AudioSession';
import { initAudioUnlockOnGesture } from './audio/audioUnlock';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig';
import { isMobileGameplayProfile } from './config/performanceProfile';
import { initCanvasResolution } from './scale/canvasDiagnostics';
import { getCanvasDpr } from './scale/canvasResolution';
import { AssetLoaderScene } from './scenes/AssetLoaderScene';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { RulesScene } from './scenes/RulesScene';
import { PreloadScene } from './scenes/PreloadScene';
import { isPoolSprayBakeUrlParam } from './dev/poolSprayBakeMode';
import { initInstallPromptCapture } from './pwa/installPrompt';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { PoolSprayBakeScene } from './scenes/PoolSprayBakeScene';

const mobileProfile = isMobileGameplayProfile();
const poolSprayBakeMode = isPoolSprayBakeUrlParam();
const canvasDpr = getCanvasDpr();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a3a4a',
  render: {
    powerPreference: 'high-performance',
    antialias: canvasDpr > 1 || !mobileProfile,
    roundPixels: true,
    preserveDrawingBuffer: poolSprayBakeMode,
  },
  fps: {
    target: 60,
    smoothStep: !mobileProfile,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    zoom: canvasDpr,
  },
  input: {
    activePointers: 2,
  },
  audio: {
    disableWebAudio: false,
  },
  scene: poolSprayBakeMode
    ? [BootScene, PreloadScene, PoolSprayBakeScene]
    : [
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
initAudioSessionDevLog();

const game = new Phaser.Game(config);

// Dev-only: optional boot probe for scripts/check-boot.mjs
if (import.meta.env.DEV) {
  (globalThis as { __phaserGame?: Phaser.Game }).__phaserGame = game;
}

initCanvasResolution(game);
initAppAudioLifecycle(game);
