import Phaser from 'phaser';
import { AssetManager } from '../assets/AssetManager';
import { loadGameAssets } from '../assets/GameAssetLoader';
import { registerDuckAnimations } from '../assets/DuckAnimations';
import { ASSET_KEYS } from '../config/assets';
import { MusicManager } from '../audio/MusicManager';
import { SoundManager } from '../audio/SoundManager';
import { SettingsButton } from '../ui/SettingsButton';
import { SettingsDrawer } from '../ui/SettingsDrawer';
import {
  BALLOON,
  COLORS,
  COMBO_TIMEOUT_MS,
  DUCK,
  MAX_LIVES,
  MAX_LIVES_CAP,
  SCENE_KEYS,
  STAGE,
} from '../config/gameConfig';
import { GameEvents } from '../core/GameEvents';
import type { GameOverData } from '../core/types';
import { burstSplash } from '../effects/ParticleEffects';
import {
  createRunStats,
  recordDuckMissed,
  tickSurvivalTime,
  recordDuckSaved,
  updateLongestCombo,
  type RunStats,
} from '../models/RunStats';
import {
  Duck,
  type DuckMissedPayload,
  type DuckSavedPayload,
  type DuckTapResult,
} from '../objects/Duck';
import { HeartBalloon } from '../objects/HeartBalloon';
import { comboTimeLeft01 } from '../objects/ComboCounter';
import { scoreDuckSave } from '../scoring/runScore';
import { HUD } from '../objects/HUD';
import { WaterfallStage } from '../objects/WaterfallStage';
import {
  CALIBRATION_MODE_EVENT,
  isCalibrateCliffUrlParam,
  isCalibrateFlowUrlParam,
  isCalibrateUrlParam,
} from '../dev/calibrationMode';
import { DevControlsLegend } from '../dev/DevControlsLegend';
import { isDevMode } from '../dev/isDevMode';
import { isWatchModeActive, resetWatchMode } from '../dev/watchMode';
import { isWatchTimePaused, resetWatchTime } from '../dev/watchTime';
import { WatchModeControls } from '../dev/WatchModeControls';
import { clearEnvironmentGeometryOverride } from '../config/environmentGeometry';
import { DifficultyManager } from '../systems/DifficultyManager';
import { MoonflowerController } from '../systems/MoonflowerController';
import { SpawnController } from '../systems/SpawnController';

export class GameScene extends Phaser.Scene {
  private hud!: HUD;
  private difficulty!: DifficultyManager;
  private spawner!: SpawnController;
  private soundManager!: SoundManager;
  private musicManager!: MusicManager;
  private settingsDrawer!: SettingsDrawer;
  private settingsButton!: SettingsButton;
  private settingsPaused = false;
  private leavingViaSettings = false;
  private stage!: WaterfallStage;
  private moonflowerController!: MoonflowerController;
  private ducks!: Phaser.GameObjects.Group;

  private score = 0;
  private lives = MAX_LIVES;
  private combo = 0;
  private comboTimer = 0;
  private isGameOver = false;
  private calibrationMode = false;
  private devLegend: DevControlsLegend | null = null;
  private watchModeControls: WatchModeControls | null = null;
  private stats: RunStats = createRunStats();
  private activeBalloons: HeartBalloon[] = [];
  private pointerDownX = 0;
  private pointerDownY = 0;
  /** Skip pointerup when pointerdown already hit a duck/balloon. */
  private suppressTapOnPointerUp = false;
  /** Prevents double life loss from one mistake in the same frame. */
  private lifeLossCooldown = false;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    if (!AssetManager.hasRealGameplayArt()) {
      const wait = this.add
        .text(this.scale.width / 2, this.scale.height / 2, 'Loading…', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '20px',
          color: COLORS.text,
        })
        .setOrigin(0.5)
        .setDepth(200);

      loadGameAssets(this).then(() => {
        wait.destroy();
        this.initRound();
      });
      return;
    }

    this.initRound();
  }

  private initRound(): void {
    clearEnvironmentGeometryOverride();
    this.isGameOver = false;
    this.score = 0;
    this.lives = MAX_LIVES;
    this.combo = 0;
    this.comboTimer = 0;
    this.stats = createRunStats();
    this.activeBalloons = [];
    this.suppressTapOnPointerUp = false;

    this.cameras.main.setBackgroundColor(COLORS.skyBottom);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    registerDuckAnimations(this);

    this.stage = new WaterfallStage(this);
    const layout = this.stage.getLayout();

    this.soundManager = SoundManager.forScene(this);
    this.musicManager = MusicManager.getInstance();
    this.musicManager.playGameplay();
    this.settingsDrawer = new SettingsDrawer(this, {
      depth: STAGE.hudDepth + 20,
      musicManager: this.musicManager,
      soundManager: this.soundManager,
      musicContext: 'gameplay',
      mode: 'gameplay',
      onOpen: () => this.applySettingsPause(),
      onClose: () => {
        if (!this.leavingViaSettings) this.applySettingsResume();
      },
      onQuitToMenu: () => this.quitToMenu(),
    });
    this.settingsButton = new SettingsButton(this, {
      drawer: this.settingsDrawer,
      depth: STAGE.hudDepth + 3,
    });
    if (this.textures.exists(ASSET_KEYS.uiGear)) {
      this.settingsButton.refreshGearGraphic();
    }
    this.difficulty = new DifficultyManager();
    this.hud = new HUD(this);
    this.hud.setScore(0);
    this.hud.setLives(this.lives);
    this.hud.setCombo(0);

    this.ducks = this.add.group({ runChildUpdate: false });

    this.spawner = new SpawnController(
      this,
      this.difficulty,
      this.ducks,
      layout,
      this.stage,
    );

    this.moonflowerController = new MoonflowerController(this, this.stage);

    this.events.on('duck-spawned', this.onDuckSpawned, this);
    this.events.on('duck-partial-tap', this.onPartialTap, this);
    this.events.on(GameEvents.DUCK_TAPPED, this.onDuckTapped, this);
    this.events.on(GameEvents.DUCK_SAVED, this.onDuckSaved, this);
    this.events.on(GameEvents.DUCK_MISSED, this.onDuckMissed, this);
    this.events.on(GameEvents.DECOY_TAPPED, this.onDecoyTapped, this);

    this.scheduleHeartBalloons();

    if (isDevMode()) {
      this.devLegend = new DevControlsLegend(this);
      this.watchModeControls = new WatchModeControls(this, {
        onChange: (active) => {
          if (active) this.devLegend?.setVisible(true);
        },
        onSkipTime: (deltaSec) => {
          this.difficulty.skipElapsedSeconds(deltaSec);
        },
      });
      this.events.on(CALIBRATION_MODE_EVENT, this.onCalibrationModeChanged, this);
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch && pointer.button !== 0) return;
      this.soundManager.tryUnlock();
    });
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);

    if (isDevMode() && isCalibrateCliffUrlParam()) {
      this.moonflowerController.setEnabled(false);
      this.stage.enterLeftCliffAlignMode();
    } else if (isDevMode() && isCalibrateFlowUrlParam()) {
      this.moonflowerController.setEnabled(false);
      this.stage.enterFlowAlignMode();
    } else if (isDevMode() && isCalibrateUrlParam()) {
      this.moonflowerController.setEnabled(false);
      this.stage.enterCalibrationMode();
    } else {
      this.spawner.start();
      if (isDevMode()) {
        this.devLegend?.setVisible(false);
      }
    }
  }

  private onCalibrationModeChanged(active: boolean): void {
    if (active) {
      this.applyCalibrationPause();
    } else {
      this.applyCalibrationResume();
    }
  }

  private applySettingsPause(): void {
    if (this.settingsPaused || this.isGameOver || this.calibrationMode) return;
    this.settingsPaused = true;
    this.spawner.stop();
    this.moonflowerController?.setEnabled(false);
  }

  private applySettingsResume(): void {
    if (!this.settingsPaused) return;
    this.settingsPaused = false;
    if (!this.isGameOver && !this.calibrationMode) {
      this.moonflowerController?.setEnabled(true);
      this.spawner.start();
    }
  }

  private quitToMenu(): void {
    this.leavingViaSettings = true;
    this.settingsDrawer.close();
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(280, () => {
      this.leavingViaSettings = false;
      this.scene.start(SCENE_KEYS.menu);
    });
  }

  private applyCalibrationPause(): void {
    if (this.calibrationMode) return;
    this.calibrationMode = true;
    this.moonflowerController?.setEnabled(false);
    this.spawner.stop();
    this.freezeDucks();
    this.stage.setCalibrationVisuals(true);
    this.devLegend?.setVisible(true);
  }

  private applyCalibrationResume(): void {
    if (!this.calibrationMode) return;
    this.calibrationMode = false;
    this.stage.setCalibrationVisuals(false);
    this.devLegend?.setVisible(false);
    this.unfreezeDucks();
    if (!this.isGameOver) {
      this.moonflowerController?.setEnabled(true);
      this.spawner.start();
    }
  }

  private freezeDucks(): void {
    /* Ducks use scene-level picking; calibration pause blocks onPointerDown. */
  }

  private unfreezeDucks(): void {
    /* Ducks use scene-level picking; no per-duck input to restore. */
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0) return;
    if (SettingsButton.consumeSceneSuppress()) return;
    if (MoonflowerController.consumeTapSuppress()) return;
    if (this.settingsDrawer?.isOpen()) return;

    this.pointerDownX = pointer.worldX;
    this.pointerDownY = pointer.worldY;
    this.musicManager.tryUnlock();
    this.soundManager.tryUnlock();

    this.suppressTapOnPointerUp = this.tryPointerTap(pointer.worldX, pointer.worldY);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0) return;
    if (SettingsButton.consumeSceneSuppress()) return;
    if (MoonflowerController.consumeTapSuppress()) return;
    if (this.settingsDrawer?.isOpen()) return;

    if (this.suppressTapOnPointerUp) {
      this.suppressTapOnPointerUp = false;
      return;
    }

    const dx = pointer.worldX - this.pointerDownX;
    const dy = pointer.worldY - this.pointerDownY;
    const slop = DUCK.tapSlopPx;
    const useDown = dx * dx + dy * dy <= slop * slop;
    const worldX = useDown ? this.pointerDownX : pointer.worldX;
    const worldY = useDown ? this.pointerDownY : pointer.worldY;

    this.tryPointerTap(worldX, worldY);
  }

  private tryPointerTap(worldX: number, worldY: number): boolean {
    if (this.calibrationMode || this.isGameOver || this.settingsPaused) return false;

    if (this.moonflowerController?.tryTap(worldX, worldY)) {
      this.soundManager.play('bonus');
      return true;
    }

    const balloonHits = this.activeBalloons.filter(
      (b) => b.active && b.containsWorldPoint(worldX, worldY),
    );
    if (balloonHits.length > 0) {
      balloonHits.sort((a, b) => b.depth - a.depth);
      const balloon = balloonHits[0];
      const bx = balloon.x;
      const by = balloon.y;
      if (balloon.tap() === 'popped') {
        this.onBalloonPopped(bx, by);
      }
      return true;
    }

    return this.tryTapDuckAt(worldX, worldY) !== 'none';
  }

  private tryTapDuckAt(worldX: number, worldY: number): DuckTapResult {
    if (this.calibrationMode || this.isGameOver) return 'none';

    const sleeping = (this.ducks.getChildren() as Duck[]).filter(
      (d) =>
        d.active &&
        d.canReceiveTap() &&
        d.containsWorldPoint(worldX, worldY),
    );
    if (sleeping.length === 0) return 'none';

    sleeping.sort((a, b) => b.depth - a.depth);
    return sleeping[0].tap();
  }

  private scheduleHeartBalloons(): void {
    const delays = [
      Phaser.Math.Between(BALLOON.firstMinDelayMs, BALLOON.firstMaxDelayMs),
      Phaser.Math.Between(BALLOON.secondMinDelayMs, BALLOON.secondMaxDelayMs),
    ];
    for (const delay of delays) {
      this.time.delayedCall(delay, () => this.spawnHeartBalloon());
    }
  }

  private spawnHeartBalloon(): void {
    if (this.isGameOver || this.calibrationMode) return;
    const balloon = new HeartBalloon(this);
    balloon.once('destroy', () => {
      this.activeBalloons = this.activeBalloons.filter((b) => b !== balloon);
    });
    this.activeBalloons.push(balloon);
  }

  private onBalloonPopped(x: number, y: number): void {
    if (this.isGameOver) return;
    this.lives = Math.min(MAX_LIVES_CAP, this.lives + 1);
    this.hud.setLives(this.lives);
    this.soundManager.play('bonus');
    this.showFloatingText(x, y - 20, '+1 ♥', '#ff8fab');
    this.events.emit(GameEvents.LIVES_CHANGED, this.lives);
    this.events.emit(GameEvents.BALLOON_POPPED);
  }

  private onDecoyTapped(payload: { x: number; y: number }): void {
    if (this.isGameOver || this.calibrationMode) return;
    this.loseOneLife(payload.x, payload.y, {
      text: '-1 ♥',
      color: '#e74c3c',
      sound: 'bad',
      resetCombo: true,
      shake: 100,
    });
  }

  /**
   * Single path for losing a life — avoids double penalties (e.g. decoy + splash same frame).
   */
  private loseOneLife(
    x: number,
    y: number,
    opts: {
      text: string;
      color: string;
      sound: 'miss' | 'bad';
      resetCombo?: boolean;
      shake?: number;
    },
  ): void {
    if (this.isGameOver || this.lifeLossCooldown) return;

    if (isWatchModeActive()) {
      if (opts.resetCombo) this.resetCombo();
      return;
    }

    this.lifeLossCooldown = true;
    this.time.delayedCall(120, () => {
      this.lifeLossCooldown = false;
    });

    if (opts.resetCombo) {
      this.resetCombo();
    }

    this.lives = Math.max(0, this.lives - 1);
    this.hud.setLives(this.lives);
    this.hud.flashMiss();
    this.soundManager.play(opts.sound);
    if (opts.sound === 'miss') {
      this.soundManager.play('lifeLost');
    }
    if (opts.shake) {
      this.cameras.main.shake(opts.shake, 0.008);
    }
    this.showFloatingText(x, y, opts.text, opts.color);
    this.events.emit(GameEvents.LIVES_CHANGED, this.lives);

    if (this.lives <= 0) {
      this.triggerGameOver();
    } else {
      this.spawner.scheduleGoldenAfterLifeLoss();
    }
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    const watchPaused = isWatchModeActive() && isWatchTimePaused();
    const simDelta = watchPaused ? 0 : delta;

    this.stage.update(_time, simDelta, this.difficulty.elapsedSeconds);
    this.musicManager.updateGameplayMusicCrossfade(this.difficulty.elapsedSeconds);

    if (this.calibrationMode || watchPaused || this.settingsPaused) return;

    tickSurvivalTime(this.stats, delta);
    this.hud.setElapsedTime(this.stats.timeSurvivedMs);
    this.difficulty.update(delta);
    const motion = this.difficulty.getMotionParams();

    const children = this.ducks.getChildren() as unknown as Duck[];
    for (const duck of children) {
      if (!duck.active) continue;
      duck.setMotionDifficulty(motion);
      duck.updateDuck(_time, delta);
    }

    for (const balloon of this.activeBalloons) {
      if (balloon.active) {
        balloon.updateBalloon(delta);
      }
    }

    if (this.combo > 1) {
      this.comboTimer += delta;
      this.hud.updateComboTimer(comboTimeLeft01(this.comboTimer));
      if (this.comboTimer >= COMBO_TIMEOUT_MS) {
        this.resetCombo();
      }
    }
  }

  private onDuckSpawned(_duck: Duck): void {
    /* Duck emits saved/missed on its own. */
  }

  private onDuckTapped(payload: { duck: Duck }): void {
    if (this.calibrationMode) return;
    if (payload.duck.kind === 'golden') {
      this.soundManager.play('goldenWake');
    } else {
      this.soundManager.play('wake');
    }
  }

  private onPartialTap(duck: Duck): void {
    if (this.calibrationMode || duck.kind !== 'heavy') return;
    this.showFloatingText(duck.x, duck.y - 24, 'Tap again!', '#5dade2');
  }

  private onDuckSaved(payload: DuckSavedPayload): void {
    if (this.isGameOver || this.calibrationMode) return;

    const { duck, kind, points: basePoints } = payload;

    this.combo += 1;
    this.comboTimer = 0;
    updateLongestCombo(this.stats, this.combo);
    const ducksSavedBefore = this.stats.ducksSaved;
    recordDuckSaved(this.stats);

    const points = scoreDuckSave({
      kindBasePoints: basePoints,
      combo: this.combo,
      timeSurvivedMs: this.stats.timeSurvivedMs,
      ducksSavedBefore,
    });
    this.score += points;

    this.hud.setScore(this.score);
    this.hud.setCombo(this.combo);
    this.events.emit(GameEvents.SCORE_CHANGED, this.score);
    this.events.emit(GameEvents.COMBO_CHANGED, this.combo);

    if (kind === 'golden') {
      this.showFloatingText(duck.x, duck.y, `+${points}!`, '#ffd700');
    } else {
      this.showFloatingText(duck.x, duck.y, `+${points}`, '#ecf0f1');
    }

    if (this.combo >= 5 && this.combo % 5 === 0) {
      this.soundManager.play('combo');
    }
  }

  private onDuckMissed(payload: DuckMissedPayload): void {
    if (this.calibrationMode) return;

    const { x, y } = payload;

    recordDuckMissed(this.stats);
    burstSplash(this, x, y + 20);

    if (this.isGameOver) return;

    this.loseOneLife(x, y, {
      text: '-1 ♥',
      color: '#ff6b6b',
      sound: 'miss',
      resetCombo: true,
      shake: 140,
    });
  }

  private resetCombo(): void {
    this.combo = 0;
    this.comboTimer = 0;
    this.hud.setCombo(0);
    this.events.emit(GameEvents.COMBO_CHANGED, 0);
  }

  private triggerGameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.lifeLossCooldown = true;
    this.events.emit(GameEvents.GAME_OVER);
    this.spawner.stop();
    this.soundManager.play('gameOver');

    const data: GameOverData = {
      score: this.score,
      stats: { ...this.stats },
      isNewHighScore: false,
      isNewLongestTime: false,
    };

    this.time.delayedCall(600, () => {
      this.scene.start(SCENE_KEYS.gameOver, data);
    });
  }

  private showFloatingText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(STAGE.hudDepth);

    this.tweens.add({
      targets: t,
      y: y - 50,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy(),
    });
  }

  shutdown(): void {
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.events.off('duck-spawned', this.onDuckSpawned, this);
    this.events.off('duck-partial-tap', this.onPartialTap, this);
    this.events.off(GameEvents.DUCK_TAPPED, this.onDuckTapped, this);
    this.events.off(GameEvents.DUCK_SAVED, this.onDuckSaved, this);
    this.events.off(GameEvents.DUCK_MISSED, this.onDuckMissed, this);
    this.events.off(GameEvents.DECOY_TAPPED, this.onDecoyTapped, this);
    for (const balloon of this.activeBalloons) {
      balloon.destroy();
    }
    this.activeBalloons = [];
    if (isDevMode()) {
      this.events.off(CALIBRATION_MODE_EVENT, this.onCalibrationModeChanged, this);
    }
    this.devLegend?.destroy();
    this.watchModeControls?.destroy();
    this.watchModeControls = null;
    resetWatchMode();
    resetWatchTime();
    this.moonflowerController?.destroy();
    this.spawner?.destroy();
    this.settingsDrawer?.destroy();
    this.settingsButton?.destroy();
    this.soundManager?.detach();
    this.hud?.destroy();
    this.stage?.destroy();
    this.ducks?.clear(true, true);
  }
}
