import Phaser from 'phaser';
import type { MusicManager } from '../audio/MusicManager';
import type { SoundManager } from '../audio/SoundManager';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/gameConfig';
import {
  getPersonalBests,
  hasAnyPersonalBests,
  PERSONAL_STAT_CARDS,
} from '../storage/personalBests';
import { getMusicVolume, getSfxVolume } from '../storage/audioSettings';
import { CharmsGrid } from './CharmsGrid';
import {
  createBubbleStatCard,
  createBubbleVolumeSlider,
  drawBubbleRect,
  SettingsDrawerSuppress,
} from './bubbleChrome';
import { outlinedTextStyle, settingsLabelTextStyle, titleTextStyle, UI_CHROME } from './uiChrome';
import {
  hidePlayerNameOverlay,
  showPlayerNameOverlay,
  syncPlayerNameOverlayValue,
} from './playerNameOverlay';
import { getDrawerLayout, DRAWER_PANEL_H, type DrawerLayout } from '../scale/displayScale';

const DRAWER_W = 318;

/**
 * Vertical layout (panel-local). Section blocks are spaced by SECTION_GAP;
 * label → content within a block uses the tighter INNER_GAP.
 */
const DRAWER_LAYOUT = {
  titleY: 26,
  closeBubbleX: DRAWER_W - 24 - 44,
  closeBubbleY: 20,
  closeBubbleSize: 44,
  nameY: 74,
  nameH: 56,
  nameLabelY: 84,
  musicY: 140,
  volumeRowH: 64,
  sfxY: 214,
  bestsTitleY: 288,
  bestsTitleH: 36,
  bestsStartY: 332,
  statCardH: 70,
  statGap: 8,
  emptyStatsH: 84,
  charmsHeaderY: 490,
  charmsHeaderH: 44,
  charmsGridY: 571,
  footerY: 628,
} as const;
const SETTINGS_GOLD = 0xffe566;
/** Settings panel shell — true blue (not pastel sky). */
const SETTINGS_PANEL_BLUE = 0x3d7ec8;
const SETTINGS_PANEL_BLUE_INNER = 0x3578be;
/** Name + volume row bubbles — brighter blue. */
const SETTINGS_BRIGHT_BLUE = 0x5eb4ea;
const SETTINGS_PRIMARY_GREEN = COLORS.moss;
/** Charms section header — lighter/brighter than cliff moss. */
const SETTINGS_CHARMS_GREEN = 0x9ef8b0;

export type SettingsDrawerMode = 'menu' | 'gameplay' | 'gameOver';

export type SettingsDrawerOptions = {
  depth: number;
  musicManager: MusicManager;
  soundManager: SoundManager;
  musicContext?: 'menuUi' | 'gameplay' | 'gameOver';
  mode?: SettingsDrawerMode;
  onOpen?: () => void;
  onClose?: () => void;
  onQuitToMenu?: () => void;
};

export class SettingsDrawer {
  private static suppressScenePointer = false;

  static consumeSceneSuppress(): boolean {
    if (SettingsDrawerSuppress.consume()) return true;
    if (!SettingsDrawer.suppressScenePointer) return false;
    SettingsDrawer.suppressScenePointer = false;
    return true;
  }

  private scene: Phaser.Scene;
  private opts: SettingsDrawerOptions;
  private root: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private personalBestNodes: Phaser.GameObjects.GameObject[] = [];
  private charmsNodes: Phaser.GameObjects.GameObject[] = [];
  private visible = false;
  private scaleResizeHandler: (() => void) | null = null;
  private panelXOpen = GAME_WIDTH - DRAWER_W;
  private panelXClosed = GAME_WIDTH + 4;
  private panelLayoutScale = 1;
  private panelMaskGfx: Phaser.GameObjects.Graphics | null = null;
  private panelMask: Phaser.Display.Masks.GeometryMask | null = null;
  private footerLink!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, opts: SettingsDrawerOptions) {
    this.scene = scene;
    this.opts = opts;

    this.root = scene.add.container(0, 0);
    this.root.setDepth(opts.depth).setScrollFactor(0).setVisible(false);

    this.backdrop = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x061018,
      0.5,
    );
    this.backdrop.setInteractive();
    this.backdrop.on('pointerdown', () => this.close());

    this.panel = scene.add.container(this.panelXClosed, 0);
    this.buildPanel();
    this.syncPanelLayout(false);

    this.root.add([this.backdrop, this.panel]);
    this.scene.game.scale.refresh();
    this.scene.time.delayedCall(0, () => this.syncPanelLayout(false));
  }

  isOpen(): boolean {
    return this.visible;
  }

  open(): void {
    if (this.visible) return;
    this.visible = true;
    SettingsDrawer.suppressScenePointer = true;
    this.root.setVisible(true);
    this.scene.game.scale.refresh();
    this.syncPanelLayout(false);
    this.refreshPersonalBests();
    syncPlayerNameOverlayValue();
    this.refreshCharmsSection();
    this.repositionNameOverlay();
    this.opts.onOpen?.();

    this.scaleResizeHandler = () => {
      if (this.visible) {
        this.syncPanelLayout(true);
        this.refreshCharmsSection();
        this.repositionNameOverlay();
      }
    };
    this.scene.scale.on('resize', this.scaleResizeHandler);

    this.scene.tweens.add({
      targets: this.panel,
      x: this.panelXOpen,
      duration: 280,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.repositionNameOverlay(),
      onComplete: () => this.repositionNameOverlay(),
    });
    this.backdrop.setAlpha(0);
    this.scene.tweens.add({
      targets: this.backdrop,
      alpha: 0.5,
      duration: 220,
    });
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    hidePlayerNameOverlay();
    if (this.scaleResizeHandler) {
      this.scene.scale.off('resize', this.scaleResizeHandler);
      this.scaleResizeHandler = null;
    }
    this.opts.onClose?.();

    this.scene.tweens.add({
      targets: this.panel,
      x: this.panelXClosed,
      duration: 240,
      ease: 'Cubic.easeIn',
    });
    this.scene.tweens.add({
      targets: this.backdrop,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        if (!this.visible) this.root.setVisible(false);
      },
    });
  }

  toggle(): void {
    if (this.visible) this.close();
    else this.open();
  }

  destroy(): void {
    hidePlayerNameOverlay();
    if (this.scaleResizeHandler) {
      this.scene.scale.off('resize', this.scaleResizeHandler);
      this.scaleResizeHandler = null;
    }
    this.panel.clearMask();
    this.panelMaskGfx?.destroy();
    this.panelMaskGfx = null;
    this.panelMask = null;
    this.root.destroy();
  }

  private syncPanelLayout(preserveOpenX: boolean): void {
    const layout = getDrawerLayout(this.scene.game);
    const wasOpen = this.visible;

    this.panelXOpen = layout.panelXOpen;
    this.panelXClosed = layout.panelXClosed;
    this.panelLayoutScale = layout.panelScale;
    this.panel.setScale(layout.panelScale);
    this.panel.y = layout.panelY;
    this.updatePanelMask(layout);

    if (wasOpen && preserveOpenX) {
      this.panel.x = layout.panelXOpen;
    } else if (!wasOpen) {
      this.panel.x = layout.panelXClosed;
    }
  }

  private updatePanelMask(layout: DrawerLayout): void {
    if (!layout.safeRect || layout.panelScale >= 0.999) {
      this.panel.clearMask();
      return;
    }

    const w = DRAWER_W * layout.panelScale;
    const h = layout.panelHeight;
    const x = this.panel.x;
    const y = this.panel.y;

    if (!this.panelMaskGfx) {
      this.panelMaskGfx = this.scene.add.graphics().setScrollFactor(0).setVisible(false);
      this.root.add(this.panelMaskGfx);
      this.panelMask = this.panelMaskGfx.createGeometryMask();
    }

    this.panelMaskGfx.clear();
    this.panelMaskGfx.fillStyle(0xffffff, 1);
    this.panelMaskGfx.fillRect(x, y, w, h);
    this.panel.setMask(this.panelMask!);
  }

  private buildPanel(): void {
    const h = DRAWER_PANEL_H;
    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(SETTINGS_PANEL_BLUE, 0.98);
    panelBg.fillRoundedRect(0, 0, DRAWER_W, h, { tl: 22, bl: 22, tr: 0, br: 0 });
    drawBubbleRect(panelBg, 6, 8, DRAWER_W - 12, h - 16, {
      fill: SETTINGS_PANEL_BLUE_INNER,
      fillAlpha: 0.5,
      radius: 20,
      highlight: false,
    });
    panelBg.lineStyle(4, SETTINGS_GOLD, 0.92);
    panelBg.strokeRoundedRect(0, 0, DRAWER_W, h, { tl: 22, bl: 22, tr: 0, br: 0 });

    const panelHit = this.scene.add
      .rectangle(DRAWER_W / 2, h / 2, DRAWER_W, h, 0x000000, 0)
      .setInteractive();
    panelHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation();
      SettingsDrawer.suppressScenePointer = true;
    });

    const title = this.scene.add
      .text(28, DRAWER_LAYOUT.titleY, 'Settings', {
        ...titleTextStyle({ fontSize: '26px', color: UI_CHROME.accentGold }),
        stroke: UI_CHROME.ink,
        strokeThickness: 7,
      })
      .setOrigin(0, 0);

    const closeBubble = this.scene.add.graphics();
    const cbSize = DRAWER_LAYOUT.closeBubbleSize;
    drawBubbleRect(
      closeBubble,
      DRAWER_LAYOUT.closeBubbleX,
      DRAWER_LAYOUT.closeBubbleY,
      cbSize,
      cbSize,
      { fill: 0x3a8cad, radius: 14 },
    );
    const closeBtn = this.scene.add
      .text(
        DRAWER_LAYOUT.closeBubbleX + cbSize / 2,
        DRAWER_LAYOUT.closeBubbleY + cbSize / 2,
        '✕',
        outlinedTextStyle({ fontSize: '20px' }),
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation();
      SettingsDrawer.suppressScenePointer = true;
      this.close();
    });

    const nameBubble = this.scene.add.graphics();
    drawBubbleRect(nameBubble, 24, DRAWER_LAYOUT.nameY, DRAWER_W - 48, DRAWER_LAYOUT.nameH, {
      fill: SETTINGS_BRIGHT_BLUE,
      radius: 16,
    });
    const nameLabel = this.scene.add
      .text(40, DRAWER_LAYOUT.nameLabelY, 'YOUR NAME', settingsLabelTextStyle({ fontSize: '11px', letterSpacing: 2 }))
      .setOrigin(0, 0);

    const musicRow = createBubbleVolumeSlider(this.scene, {
      x: 24,
      y: DRAWER_LAYOUT.musicY,
      width: DRAWER_W - 48,
      height: DRAWER_LAYOUT.volumeRowH,
      label: 'Music volume',
      backgroundFill: SETTINGS_BRIGHT_BLUE,
      initial01: getMusicVolume(),
      onChange: (volume) => {
        this.opts.musicManager.setMusicVolume(volume);
        if (volume > 0 && !this.opts.musicManager.getActiveTrack()) {
          this.resumeMusicContext();
        }
      },
      onMuteChange: (muted) => {
        this.opts.musicManager.setMusicEnabled(!muted);
      },
    });

    const sfxRow = createBubbleVolumeSlider(this.scene, {
      x: 24,
      y: DRAWER_LAYOUT.sfxY,
      width: DRAWER_W - 48,
      height: DRAWER_LAYOUT.volumeRowH,
      label: 'Sound effects',
      backgroundFill: SETTINGS_BRIGHT_BLUE,
      initial01: getSfxVolume(),
      onChange: (volume) => {
        this.opts.soundManager.setSfxVolume(volume);
        if (volume > 0) {
          this.opts.soundManager.tryUnlock();
          this.opts.soundManager.play('tap');
        }
      },
      onMuteChange: (muted) => {
        this.opts.soundManager.setSfxEnabled(!muted);
      },
    });

    const bestsTitleBubble = this.scene.add.graphics();
    drawBubbleRect(
      bestsTitleBubble,
      24,
      DRAWER_LAYOUT.bestsTitleY,
      DRAWER_W - 48,
      DRAWER_LAYOUT.bestsTitleH,
      {
        fill: SETTINGS_PRIMARY_GREEN,
        fillAlpha: 0.9,
        radius: 14,
      },
    );
    const bestsTitle = this.scene.add
      .text(
        DRAWER_W / 2,
        DRAWER_LAYOUT.bestsTitleY + DRAWER_LAYOUT.bestsTitleH / 2,
        'YOUR PERSONAL BESTS',
        settingsLabelTextStyle({ fontSize: '11px', letterSpacing: 2 }),
      )
      .setOrigin(0.5);

    const charmsSection = this.buildCharmsSection();
    this.footerLink = this.createFooterLink(
      DRAWER_LAYOUT.footerY,
      this.opts.mode === 'gameplay' ? 'Back to home →' : 'How to play →',
      () => {
        if (this.opts.mode === 'gameplay') {
          this.opts.onQuitToMenu?.();
          return;
        }
        this.close();
        this.scene.time.delayedCall(260, () => {
          this.scene.scene.start(SCENE_KEYS.rules);
        });
      },
    );

    this.panel.add([
      panelHit,
      panelBg,
      title,
      closeBubble,
      closeBtn,
      nameBubble,
      nameLabel,
      musicRow,
      sfxRow,
      bestsTitleBubble,
      bestsTitle,
      ...charmsSection,
      this.footerLink,
    ]);

    this.refreshPersonalBests();
    this.refreshCharmsSection();
  }

  private buildCharmsSection(): Phaser.GameObjects.GameObject[] {
    const charmsY = DRAWER_LAYOUT.charmsHeaderY;
    const glowW = DRAWER_W - 48;
    const glowH = DRAWER_LAYOUT.charmsHeaderH;
    const glowX = 24;
    const glow = this.createCharmsGlow(glowX, charmsY, glowW, glowH);
    const title = this.scene.add
      .text(
        DRAWER_W / 2,
        charmsY + glowH / 2,
        'CHARMS',
        settingsLabelTextStyle({ fontSize: '14px', letterSpacing: 2 }),
      )
      .setOrigin(0.5);

    return [glow, title];
  }

  /** Soft green radiance behind the charms header (no pill chrome). */
  private createCharmsGlow(
    x: number,
    y: number,
    w: number,
    h: number,
  ): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.setBlendMode(Phaser.BlendModes.ADD);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const green = SETTINGS_CHARMS_GREEN;

    g.fillStyle(green, 0.04);
    g.fillEllipse(cx, cy, w * 1.05, h * 2.4);
    g.fillStyle(green, 0.07);
    g.fillEllipse(cx, cy, w * 0.88, h * 1.75);
    g.fillStyle(green, 0.11);
    g.fillEllipse(cx, cy, w * 0.62, h * 1.15);
    g.fillStyle(green, 0.08);
    g.fillEllipse(cx, cy, w * 0.38, h * 0.62);

    return g;
  }

  private refreshCharmsSection(): void {
    for (const node of this.charmsNodes) {
      node.destroy();
    }
    this.charmsNodes = [];

    const gridY = DRAWER_LAYOUT.charmsGridY;
    const grid = new CharmsGrid(this.scene, {
      centerX: DRAWER_W / 2,
      centerY: gridY,
      scale: 0.92,
      showLocked: true,
      bareRow: true,
    });
    this.panel.add(grid);
    this.charmsNodes.push(grid);
  }

  private resumeMusicContext(): void {
    const ctx = this.opts.musicContext ?? 'menuUi';
    if (ctx === 'gameOver') this.opts.musicManager.playGameOver();
    else if (ctx === 'gameplay') this.opts.musicManager.playGameplay();
    else this.opts.musicManager.playMenuUi();
  }

  private createFooterLink(
    y: number,
    label: string,
    onSelect: () => void,
  ): Phaser.GameObjects.Container {
    const text = this.scene.add
      .text(0, 0, label, outlinedTextStyle({
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffe566',
        strokeThickness: 4,
      }))
      .setOrigin(0.5);

    const underline = this.scene.add.graphics();
    const refreshUnderline = () => {
      const w = text.width + 8;
      underline.clear();
      underline.lineStyle(2, 0xffe566, 0.85);
      underline.beginPath();
      underline.moveTo(-w / 2, text.height / 2 + 6);
      underline.lineTo(w / 2, text.height / 2 + 6);
      underline.strokePath();
    };
    refreshUnderline();

    const hit = this.scene.add
      .rectangle(0, 0, Math.max(text.width + 32, 160), text.height + 24, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    const root = this.scene.add.container(DRAWER_W / 2, y, [text, underline, hit]);

    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation();
      SettingsDrawer.suppressScenePointer = true;
      onSelect();
    });

    hit.on('pointerover', () => {
      text.setColor('#fff8c8');
      this.scene.tweens.add({ targets: root, scaleX: 1.04, scaleY: 1.04, duration: 90 });
    });
    hit.on('pointerout', () => {
      text.setColor('#ffe566');
      this.scene.tweens.add({ targets: root, scaleX: 1, scaleY: 1, duration: 90 });
    });

    return root;
  }

  private repositionNameOverlay(): void {
    if (!this.visible) {
      hidePlayerNameOverlay();
      return;
    }
    showPlayerNameOverlay(
      this.scene.game,
      this.panel.x,
      this.panel.y,
      this.panelLayoutScale,
    );
  }

  private refreshPersonalBests(): void {
    for (const node of this.personalBestNodes) {
      node.destroy();
    }
    this.personalBestNodes = [];

    const bests = getPersonalBests();
    const startY = DRAWER_LAYOUT.bestsStartY;
    const colW = (DRAWER_W - 48 - 10) / 2;
    const cardH = DRAWER_LAYOUT.statCardH;
    const gap = DRAWER_LAYOUT.statGap;

    if (!hasAnyPersonalBests(bests)) {
      const emptyBubble = this.scene.add.graphics();
      drawBubbleRect(emptyBubble, 24, startY, DRAWER_W - 48, DRAWER_LAYOUT.emptyStatsH, {
        fill: 0x3a8cad,
        radius: 18,
      });
      const empty = this.scene.add
        .text(DRAWER_W / 2, startY + DRAWER_LAYOUT.emptyStatsH / 2, 'Float downstream once\nto set your records!', {
          ...outlinedTextStyle({ fontSize: '14px', color: '#e8f4fc' }),
          align: 'center',
          lineSpacing: 6,
        })
        .setOrigin(0.5);
      this.panel.add([emptyBubble, empty]);
      this.personalBestNodes.push(emptyBubble, empty);
      return;
    }

    PERSONAL_STAT_CARDS.forEach((stat, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 24 + col * (colW + gap);
      const y = startY + row * (cardH + gap);

      const card = createBubbleStatCard(this.scene, {
        x,
        y,
        width: colW,
        height: cardH,
        label: stat.label,
        value: stat.format(bests),
        fill: stat.fill,
      });
      this.panel.add(card);
      this.personalBestNodes.push(card);
    });
  }
}
