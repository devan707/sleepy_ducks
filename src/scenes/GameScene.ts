import Phaser from 'phaser';
import { AssetManager } from '../assets/AssetManager';
import { loadGameAssets } from '../assets/GameAssetLoader';
import { registerDuckAnimations } from '../assets/DuckAnimations';
import { ASSET_KEYS } from '../config/assets';
import { MusicManager } from '../audio/MusicManager';
import { SoundManager } from '../audio/SoundManager';
import { SettingsButton, getDefaultSettingsButtonPosition } from '../ui/SettingsButton';
import { SettingsDrawer } from '../ui/SettingsDrawer';
import { MasterMuteButton, getGameMasterMutePosition } from '../ui/MasterMuteButton';
import { LevelPassedBanner } from '../ui/LevelPassedBanner';
import { MOONFLOWER_ATLAS_KEYS } from '../config/moonflowerAssets';
import {
  BALLOON,
  COLORS,
  COMBO,
  getComboMilestoneTier,
  DUCK,
  GOLDEN_EGG,
  HUD_RUN_CLOCK,
  MAX_LIVES,
  MAX_LIVES_CAP,
  SCENE_KEYS,
  STAGE,
} from '../config/gameConfig';
import { GameplayBottomToast } from '../ui/GameplayBottomToast';
import { formatScore } from '../util/formatScore';
import { GameEvents } from '../core/GameEvents';
import type { GameOverData } from '../core/types';
import { burstSplash } from '../effects/ParticleEffects';
import {
  createRunStats,
  isDuckMissForStats,
  recordDuckMissed,
  recordDuckSaved,
  recordMissedTap,
  tickSurvivalTime,
  updateLongestCombo,
  type RunStats,
} from '../models/RunStats';
import {
  Duck,
  type DuckEarlyTapPayload,
  type DuckMissedPayload,
  type DuckSavedPayload,
  type DuckTapResult,
} from '../objects/Duck';
import { HeartBalloon } from '../objects/HeartBalloon';
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
import { isWatchInstructionsVisible } from '../dev/watchInstructions';

type BadTapKind = 'empty' | 'decoy';
import { isWatchTimePaused, resetWatchTime } from '../dev/watchTime';
import { resetWatchInstructions } from '../dev/watchInstructions';
import { WatchModeControls } from '../dev/WatchModeControls';
import { clearEnvironmentGeometryOverride } from '../config/environmentGeometry';
import { DifficultyManager } from '../systems/DifficultyManager';
import { MoonflowerController } from '../systems/MoonflowerController';
import { SpawnController } from '../systems/SpawnController';

const REOPEN_SETTINGS_AFTER_RULES = 'reopen-settings-after-rules';

export class GameScene extends Phaser.Scene {
  private hud!: HUD;
  private difficulty!: DifficultyManager;
  private spawner!: SpawnController;
  private soundManager!: SoundManager;
  private musicManager!: MusicManager;
  private settingsDrawer!: SettingsDrawer;
  private settingsButton!: SettingsButton;
  private masterMuteButton!: MasterMuteButton;
  private settingsPaused = false;
  private leavingViaSettings = false;
  private viewingRulesFromSettings = false;
  private stage!: WaterfallStage;
  private moonflowerController!: MoonflowerController;
  private ducks!: Phaser.GameObjects.Group;

  private score = 0;
  private lives = MAX_LIVES;
  private goldenEggSaves = 0;
  private combo = 0;
  private comboDrainProgress = 0;
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
  private bottomToast!: GameplayBottomToast;
  private moonflowerHintShown = false;
  private goldenEggRewardTimer: Phaser.Time.TimerEvent | null = null;
  /** Prevents one golden duck from crediting the egg twice (e.g. duplicate save events). */
  private goldenEggCreditedDucks = new WeakSet<Duck>();
  private levelPassedThisRun = false;
  private levelPassedBanner: LevelPassedBanner | null = null;

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
    this.goldenEggSaves = 0;
    this.cancelGoldenEggRewardTimer();
    this.goldenEggCreditedDucks = new WeakSet<Duck>();
    this.moonflowerHintShown = false;
    this.levelPassedThisRun = false;
    this.combo = 0;
    this.comboDrainProgress = 0;
    this.stats = createRunStats();
    this.activeBalloons = [];
    this.suppressTapOnPointerUp = false;

    this.cameras.main.setBackgroundColor(COLORS.skyBottom);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    registerDuckAnimations(this);

    this.stage = new WaterfallStage(this);
    const layout = this.stage.getLayout();

    this.soundManager = SoundManager.forScene(this);
    this.soundManager.startGameplayBackground();
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
        if (this.viewingRulesFromSettings) return;
        if (!this.leavingViaSettings) this.applySettingsResume();
      },
      onQuitToMenu: () => this.quitToMenu(),
      onOpenRules: () => this.openRulesFromSettings(),
    });
    this.settingsButton = new SettingsButton(this, {
      drawer: this.settingsDrawer,
      depth: STAGE.hudDepth + 3,
    });
    if (this.textures.exists(ASSET_KEYS.uiGear)) {
      this.settingsButton.refreshGearGraphic();
    }
    const gearPos = getDefaultSettingsButtonPosition();
    const mutePos = getGameMasterMutePosition(gearPos);
    this.masterMuteButton = new MasterMuteButton(this, {
      depth: STAGE.hudDepth + 3,
      ...mutePos,
    });
    MasterMuteButton.setActiveGameplayPosition(mutePos);
    this.difficulty = new DifficultyManager();
    this.hud = new HUD(this);
    this.hud.setScore(0);
    this.hud.setLives(this.lives);
    this.hud.setGoldenEggState('empty');
    this.hud.setCombo(0);
    this.bottomToast = new GameplayBottomToast(this);

    this.ducks = this.add.group({ runChildUpdate: false });

    this.spawner = new SpawnController(
      this,
      this.difficulty,
      this.ducks,
      layout,
      this.stage,
    );

    this.moonflowerController = new MoonflowerController(this, this.stage, this.bottomToast);
    this.hud.setMoonflowerCollectedThisRun(false);

    this.events.off('duck-spawned', this.onDuckSpawned, this);
    this.events.off('duck-partial-tap', this.onPartialTap, this);
    this.events.off(GameEvents.DUCK_TAPPED, this.onDuckTapped, this);
    this.events.off(GameEvents.DUCK_SAVED, this.onDuckSaved, this);
    this.events.off(GameEvents.DUCK_MISSED, this.onDuckMissed, this);
    this.events.off(GameEvents.EARLY_TAP, this.onEarlyTap, this);
    this.events.off(GameEvents.CHARM_COLLECTED, this.onCharmCollected, this);

    this.events.on('duck-spawned', this.onDuckSpawned, this);
    this.events.on('duck-partial-tap', this.onPartialTap, this);
    this.events.on(GameEvents.DUCK_TAPPED, this.onDuckTapped, this);
    this.events.on(GameEvents.DUCK_SAVED, this.onDuckSaved, this);
    this.events.on(GameEvents.DUCK_MISSED, this.onDuckMissed, this);
    this.events.on(GameEvents.EARLY_TAP, this.onEarlyTap, this);
    this.events.on(GameEvents.CHARM_COLLECTED, this.onCharmCollected, this);
    this.events.on(REOPEN_SETTINGS_AFTER_RULES, this.reopenSettingsAfterRules, this);

    this.levelPassedBanner?.destroy();
    this.levelPassedBanner = new LevelPassedBanner(this);

    this.scheduleHeartBalloons();

    if (isDevMode()) {
      this.devLegend = new DevControlsLegend(this);
      this.watchModeControls = new WatchModeControls(this, {
        onChange: () => {
          this.syncWatchHelpUi();
        },
        onInstructionsVisibleChange: () => {
          this.syncWatchHelpUi();
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
    this.musicManager.pauseForInterruption();
    this.soundManager.pauseForInterruption();
  }

  private applySettingsResume(): void {
    if (!this.settingsPaused) return;
    this.settingsPaused = false;
    this.musicManager.resumeFromInterruption();
    this.soundManager.resumeFromInterruption();
    if (!this.isGameOver && !this.calibrationMode) {
      this.moonflowerController?.setEnabled(true);
      this.spawner.start();
    }
  }

  private openRulesFromSettings(): void {
    this.viewingRulesFromSettings = true;
    this.settingsDrawer.close();
    this.time.delayedCall(260, () => {
      if (!this.scene.isActive()) return;
      this.scene.launch(SCENE_KEYS.rules, { returnToGame: true });
    });
  }

  private reopenSettingsAfterRules(): void {
    this.viewingRulesFromSettings = false;
    if (!this.settingsPaused && !this.isGameOver && !this.calibrationMode) {
      this.applySettingsPause();
    }
    this.settingsDrawer.open();
  }

  private quitToMenu(): void {
    this.leavingViaSettings = true;
    this.settingsPaused = true;
    this.spawner.stop();
    this.settingsDrawer.close();
    this.musicManager.clearPlaybackInterruptions();
    this.musicManager.pauseAll();
    this.soundManager.stopGameplayBackground();
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

  private syncWatchHelpUi(): void {
    if (!isDevMode()) return;
    const show = isWatchModeActive() && isWatchInstructionsVisible();
    this.devLegend?.setVisible(show);
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

  private isGameplayUiTap(worldX: number, worldY: number): boolean {
    return (
      SettingsButton.hitsWorldPoint(worldX, worldY) ||
      MasterMuteButton.hitsWorldPoint(worldX, worldY)
    );
  }

  private tryPointerTap(worldX: number, worldY: number): boolean {
    if (this.calibrationMode || this.isGameOver || this.settingsPaused) return false;
    if (this.isGameplayUiTap(worldX, worldY)) return false;

    if (this.moonflowerController?.tryTap(worldX, worldY)) {
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

    const duckResult = this.tryTapDuckAt(worldX, worldY);
    if (duckResult !== 'none') return true;

    if (this.isTapOnEarlyLockedDuck(worldX, worldY)) return true;

    if (this.isTapOnDecoy(worldX, worldY)) {
      this.recordBadTap('decoy', worldX, worldY);
      return true;
    }

    this.recordBadTap('empty', worldX, worldY);
    return true;
  }

  /** Tap on a duck frozen in the too-early penalty — ignore (no save, no bad tap). */
  private isTapOnEarlyLockedDuck(worldX: number, worldY: number): boolean {
    return (this.ducks.getChildren() as Duck[]).some(
      (d) =>
        d.active &&
        d.isEarlyTapLocked() &&
        d.containsWorldPoint(worldX, worldY),
    );
  }

  /** Tap landed on a decoy (motion unaffected; still a bad tap). */
  private isTapOnDecoy(worldX: number, worldY: number): boolean {
    return (this.ducks.getChildren() as Duck[]).some(
      (d) => d.active && d.kind === 'decoy' && d.containsWorldPoint(worldX, worldY),
    );
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

  private grantBonusLife(
    x: number,
    y: number,
    floatingColor = '#ff8fab',
    showFloat = true,
  ): void {
    if (this.isGameOver) return;
    if (this.lives >= MAX_LIVES_CAP) return;

    this.lives = Math.min(MAX_LIVES_CAP, this.lives + 1);
    this.hud.setLives(this.lives);
    this.soundManager.playLifeGain();
    if (showFloat) {
      this.showFloatingText(x, y - 20, '+1 ♥', floatingColor);
    }
    this.events.emit(GameEvents.LIVES_CHANGED, this.lives);
  }

  private onBalloonPopped(x: number, y: number): void {
    this.grantBonusLife(x, y);
    this.events.emit(GameEvents.BALLOON_POPPED);
  }

  private onEarlyTap(payload: DuckEarlyTapPayload): void {
    if (this.calibrationMode) return;

    if (isWatchModeActive()) {
      if (payload.breaksCombo) this.resetCombo();
      return;
    }

    recordMissedTap(this.stats);
    if (payload.breaksCombo) {
      this.resetCombo();
    }
    this.soundManager.play('earlyBuzzer');
    this.showFloatingText(payload.x, payload.y - 32, 'Too Early!', '#ffd700');
  }

  /** Empty space or decoy — breaks combo; does not apply to heavy-sleeper conversion taps. */
  private recordBadTap(kind: BadTapKind, x: number, y: number): void {
    if (this.isGameOver || this.calibrationMode) return;

    if (isWatchModeActive()) {
      this.resetCombo();
      return;
    }

    recordMissedTap(this.stats);
    this.resetCombo();
    this.soundManager.play('badTap');
    this.showBadTapX(x, y);
    this.events.emit(GameEvents.BAD_TAP, { kind, x, y });
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
      const drainMult = this.difficulty.getComboDrainMultiplier(this.combo);
      this.comboDrainProgress += (delta / COMBO.baseTimeoutMs) * drainMult;
      this.hud.updateComboTimer(1 - this.comboDrainProgress);
      if (this.comboDrainProgress >= 1) {
        this.resetCombo();
      }
    }

    this.tryHudRunClockEvents();
  }

  /** Moonflower hint, sprout, and level pass — keyed to the HUD MM:SS timer. */
  private tryHudRunClockEvents(): void {
    const hudSec = this.stats.timeSurvivedMs / 1000;

    if (
      !this.moonflowerHintShown &&
      !this.calibrationMode &&
      !this.moonflowerController.isCollectedThisRun() &&
      hudSec >= HUD_RUN_CLOCK.moonflowerHintSec
    ) {
      this.moonflowerHintShown = true;
      this.bottomToast.show({
        text: 'Collect the moonflower after sunset',
        imageKey: MOONFLOWER_ATLAS_KEYS.sway,
        imageFrame: 'frame_000',
      });
    }

    if (hudSec >= HUD_RUN_CLOCK.moonflowerSproutSec) {
      this.moonflowerController.spawnForRun();
    }

    if (hudSec >= HUD_RUN_CLOCK.levelPassSec) {
      this.triggerLevelPassed();
    }
  }

  private triggerLevelPassed(): void {
    if (this.levelPassedThisRun || this.isGameOver) return;
    this.levelPassedThisRun = true;
    this.soundManager.playLevelPassedCelebration();
    this.levelPassedBanner?.show();
  }

  private onCharmCollected(payload: { id: string; x?: number; y?: number }): void {
    if (payload.id === 'moonflower' && payload.x != null && payload.y != null) {
      this.soundManager.playMoonflowerCollect();
      this.hud.playMoonflowerCollectFly(payload.x, payload.y);
      return;
    }
    this.hud.setMoonflowerCollectedThisRun(true, false);
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
    this.comboDrainProgress = 0;
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

    if (this.combo === 2) {
      this.hud.celebrateCombo('start');
      this.soundManager.playComboReward('start');
    }

    const milestoneTier = getComboMilestoneTier(this.combo);
    if (milestoneTier !== null) {
      this.hud.celebrateCombo('milestone', milestoneTier);
      this.soundManager.playComboReward('milestone', milestoneTier);
    }

    if (kind === 'golden') {
      this.showFloatingText(duck.x, duck.y, `+${formatScore(points)}!`, '#ffd700');
      this.onGoldenDuckSavedForEgg(duck.x, duck.y, duck);
    } else {
      this.showFloatingText(duck.x, duck.y, `+${formatScore(points)}`, '#ecf0f1');
    }
  }

  private cancelGoldenEggRewardTimer(): void {
    this.goldenEggRewardTimer?.remove(false);
    this.goldenEggRewardTimer = null;
  }

  private onGoldenDuckSavedForEgg(x: number, y: number, duck: Duck): void {
    if (this.goldenEggCreditedDucks.has(duck)) return;

    if (this.lives >= MAX_LIVES_CAP) {
      this.goldenEggCreditedDucks.add(duck);
      this.cancelGoldenEggRewardTimer();
      this.goldenEggSaves = 0;
      this.hud.setGoldenEggState('empty');
      return;
    }

    // Full egg reward countdown — wait until it finishes before counting new saves.
    if (this.goldenEggRewardTimer) {
      this.goldenEggCreditedDucks.add(duck);
      return;
    }

    this.goldenEggCreditedDucks.add(duck);
    this.goldenEggSaves += 1;

    if (this.goldenEggSaves >= GOLDEN_EGG.savesRequired) {
      this.goldenEggSaves = 0;
      this.hud.setGoldenEggState('full');
      this.hud.pulseGoldenEggFull();

      this.goldenEggRewardTimer = this.time.delayedCall(
        GOLDEN_EGG.fullDisplayMs,
        () => {
          this.goldenEggRewardTimer = null;
          this.soundManager.playGoldenEggCrack();
          this.grantBonusLife(x, y, '#ffd700', false);
          this.hud.setGoldenEggState('empty');
          this.bottomToast.show({ text: 'Golden Egg! + 1 ♥' });
        },
      );
      return;
    }

    this.hud.setGoldenEggState('half');
  }

  private onDuckMissed(payload: DuckMissedPayload): void {
    if (this.calibrationMode || payload.kind === 'golden') return;
    if (!isDuckMissForStats(payload.kind)) return;

    const { x, y } = payload;

    if (!isWatchModeActive()) {
      recordDuckMissed(this.stats, payload.kind);
    }
    burstSplash(this, x, y + 20);

    if (this.isGameOver || isWatchModeActive()) return;

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
    this.comboDrainProgress = 0;
    this.hud.setCombo(0);
    this.events.emit(GameEvents.COMBO_CHANGED, 0);
  }

  private triggerGameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.lifeLossCooldown = true;
    this.events.emit(GameEvents.GAME_OVER);
    this.spawner.stop();
    this.soundManager.stopGameplayBackground();
    this.soundManager.play('gameOver');

    const moonflowerCollected = this.moonflowerController?.isCollectedThisRun() ?? false;
    const levelPassed = this.levelPassedThisRun;
    const outcome: GameOverData['outcome'] = levelPassed
      ? moonflowerCollected
        ? 'passedWithMoonflower'
        : 'passed'
      : 'failed';

    const data: GameOverData = {
      score: this.score,
      stats: { ...this.stats },
      isNewHighScore: false,
      isNewLongestTime: false,
      levelPassed,
      moonflowerCollected,
      outcome,
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

  /** Small yellow X at the tap point for any bad tap. */
  private showBadTapX(x: number, y: number): void {
    const mark = this.add
      .text(x, y - 6, 'X', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffd700',
        stroke: '#5a4a00',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(STAGE.hudDepth + 2);

    mark.setScale(0.35);
    this.tweens.add({
      targets: mark,
      scale: 1,
      duration: 85,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: mark,
          alpha: 0,
          scale: 0.9,
          duration: 320,
          delay: 100,
          onComplete: () => mark.destroy(),
        });
      },
    });
  }

  shutdown(): void {
    this.musicManager?.clearPlaybackInterruptions();
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.events.off('duck-spawned', this.onDuckSpawned, this);
    this.events.off('duck-partial-tap', this.onPartialTap, this);
    this.events.off(GameEvents.DUCK_TAPPED, this.onDuckTapped, this);
    this.events.off(GameEvents.DUCK_SAVED, this.onDuckSaved, this);
    this.events.off(GameEvents.DUCK_MISSED, this.onDuckMissed, this);
    this.events.off(GameEvents.EARLY_TAP, this.onEarlyTap, this);
    this.events.off(GameEvents.CHARM_COLLECTED, this.onCharmCollected, this);
    this.events.off(REOPEN_SETTINGS_AFTER_RULES, this.reopenSettingsAfterRules, this);
    this.levelPassedBanner?.destroy();
    this.levelPassedBanner = null;
    this.cancelGoldenEggRewardTimer();
    this.bottomToast?.destroy();
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
    resetWatchInstructions();
    this.moonflowerController?.destroy();
    this.spawner?.destroy();
    this.settingsDrawer?.destroy();
    this.settingsButton?.destroy();
    this.masterMuteButton?.destroy();
    MasterMuteButton.setActiveGameplayPosition(null);
    this.soundManager?.detach();
    this.hud?.destroy();
    this.stage?.destroy();
    this.ducks?.clear(true, true);
  }
}
