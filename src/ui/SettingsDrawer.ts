import Phaser from 'phaser';
import type { MusicManager } from '../audio/MusicManager';
import type { SoundManager } from '../audio/SoundManager';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/gameConfig';
import { displayPlayerName, getPlayerName, setPlayerName } from '../storage/playerName';
import {
  getPersonalBests,
  hasAnyPersonalBests,
  PERSONAL_STAT_CARDS,
} from '../storage/personalBests';
import { ASSET_KEYS } from '../config/assets';
import { getMusicVolume, getSfxVolume } from '../storage/audioSettings';
import { isCharmCollected } from '../storage/charms';
import { CharmsGrid } from './CharmsGrid';
import {
  createBubbleStatCard,
  createBubbleVolumeSlider,
  drawBubbleRect,
  SettingsDrawerSuppress,
} from './bubbleChrome';
import { gameRectToScreen } from './gameScreenCoords';
import { captionTextStyle, outlinedTextStyle, titleTextStyle } from './uiChrome';

const DRAWER_W = 318;
const PANEL_X_CLOSED = GAME_WIDTH + 4;
const PANEL_X_OPEN = GAME_WIDTH - DRAWER_W;

export type SettingsDrawerOptions = {
  depth: number;
  musicManager: MusicManager;
  soundManager: SoundManager;
  musicContext?: 'menuUi' | 'gameOver';
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
  private nameInput: HTMLInputElement | null = null;
  private visible = false;

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

    this.panel = scene.add.container(PANEL_X_CLOSED, 0);
    this.buildPanel();

    this.root.add([this.backdrop, this.panel]);
  }

  isOpen(): boolean {
    return this.visible;
  }

  open(): void {
    if (this.visible) return;
    this.visible = true;
    SettingsDrawer.suppressScenePointer = true;
    this.root.setVisible(true);
    this.refreshPersonalBests();
    this.syncNameInput();
    this.refreshCharmsSection();
    this.showNameInput();

    this.scene.tweens.add({
      targets: this.panel,
      x: PANEL_X_OPEN,
      duration: 280,
      ease: 'Cubic.easeOut',
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
    this.hideNameInput();
    if (this.nameInput) {
      setPlayerName(this.nameInput.value);
    }

    this.scene.tweens.add({
      targets: this.panel,
      x: PANEL_X_CLOSED,
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
    this.hideNameInput();
    this.root.destroy();
  }

  private buildPanel(): void {
    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0x1a5f7a, 0.96);
    panelBg.fillRoundedRect(0, 0, DRAWER_W, GAME_HEIGHT, { tl: 22, bl: 22, tr: 0, br: 0 });
    drawBubbleRect(panelBg, 6, 8, DRAWER_W - 12, GAME_HEIGHT - 16, {
      fill: 0x2d7a9a,
      fillAlpha: 0.55,
      radius: 20,
      highlight: false,
    });
    panelBg.lineStyle(4, 0xffffff, 0.5);
    panelBg.strokeRoundedRect(0, 0, DRAWER_W, GAME_HEIGHT, { tl: 22, bl: 22, tr: 0, br: 0 });

    const title = this.scene.add
      .text(28, 48, 'Settings', {
        ...titleTextStyle({ fontSize: '26px', color: '#ffe566' }),
        stroke: '#0a1620',
        strokeThickness: 7,
      })
      .setOrigin(0, 0);

    const closeBubble = this.scene.add.graphics();
    drawBubbleRect(closeBubble, DRAWER_W - 58, 42, 44, 44, { fill: 0x3a8cad, radius: 14 });
    const closeBtn = this.scene.add
      .text(DRAWER_W - 36, 64, '✕', outlinedTextStyle({ fontSize: '20px' }))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation();
      SettingsDrawer.suppressScenePointer = true;
      this.close();
    });

    const nameBubble = this.scene.add.graphics();
    drawBubbleRect(nameBubble, 24, 100, DRAWER_W - 48, 52, { fill: 0x3a8cad, radius: 16 });
    const nameLabel = this.scene.add
      .text(40, 112, 'YOUR NAME', captionTextStyle({ fontSize: '10px', letterSpacing: 2 }))
      .setOrigin(0, 0);

    const musicRow = createBubbleVolumeSlider(this.scene, {
      x: 24,
      y: 168,
      width: DRAWER_W - 48,
      height: 64,
      label: 'Music volume',
      initial01: getMusicVolume(),
      onChange: (volume) => {
        this.opts.musicManager.setMusicVolume(volume);
        if (volume > 0 && !this.opts.musicManager.getActiveTrack()) {
          const ctx = this.opts.musicContext ?? 'menuUi';
          if (ctx === 'gameOver') this.opts.musicManager.playGameOver();
          else this.opts.musicManager.playMenuUi();
        }
      },
    });

    const sfxRow = createBubbleVolumeSlider(this.scene, {
      x: 24,
      y: 242,
      width: DRAWER_W - 48,
      height: 64,
      label: 'Sound effects',
      initial01: getSfxVolume(),
      onChange: (volume) => {
        this.opts.soundManager.setSfxVolume(volume);
        if (volume > 0) {
          this.opts.soundManager.tryUnlock();
          this.opts.soundManager.play('tap');
        }
      },
    });

    const bestsTitleBubble = this.scene.add.graphics();
    drawBubbleRect(bestsTitleBubble, 24, 318, DRAWER_W - 48, 36, {
      fill: 0xffe566,
      fillAlpha: 0.35,
      radius: 14,
    });
    const bestsTitle = this.scene.add
      .text(DRAWER_W / 2, 336, 'YOUR PERSONAL BESTS', captionTextStyle({
        fontSize: '11px',
        letterSpacing: 2,
        color: '#fff8d0',
      }))
      .setOrigin(0.5);

    const charmsSection = this.buildCharmsSection();
    const howToLink = this.createHowToPlayLink(GAME_HEIGHT - 44);

    this.panel.add([
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
      howToLink,
    ]);

    this.createNameInputDom();
    this.refreshPersonalBests();
    this.refreshCharmsSection();
  }

  private buildCharmsSection(): Phaser.GameObjects.GameObject[] {
    const charmsY = 638;
    const titleBubble = this.scene.add.graphics();
    drawBubbleRect(titleBubble, 24, charmsY, DRAWER_W - 48, 32, {
      fill: 0xa8e8ff,
      fillAlpha: 0.28,
      radius: 14,
    });
    const title = this.scene.add
      .text(DRAWER_W / 2, charmsY + 16, 'CHARMS', captionTextStyle({
        fontSize: '11px',
        letterSpacing: 2,
        color: '#d8f4ff',
      }))
      .setOrigin(0.5);

    const hint = this.scene.add
      .text(DRAWER_W / 2, charmsY + 148, '', outlinedTextStyle({
        fontSize: '12px',
        color: '#c8e8f8',
        align: 'center',
      }))
      .setOrigin(0.5)
      .setName('charms-hint');

    return [titleBubble, title, hint];
  }

  private refreshCharmsSection(): void {
    for (const node of this.charmsNodes) {
      node.destroy();
    }
    this.charmsNodes = [];

    const boxY = 718;
    const boxScale = 0.62;
    if (this.scene.textures.exists(ASSET_KEYS.charmBox)) {
      const box = this.scene.add.image(DRAWER_W / 2, boxY, ASSET_KEYS.charmBox);
      box.setScale(boxScale);
      this.panel.add(box);
      this.charmsNodes.push(box);
    }

    const grid = new CharmsGrid(this.scene, {
      centerX: DRAWER_W / 2,
      centerY: boxY,
      scale: boxScale,
      showLocked: true,
    });
    this.panel.add(grid);
    this.charmsNodes.push(grid);

    const hint = this.panel.getByName('charms-hint') as Phaser.GameObjects.Text | null;
    if (hint) {
      hint.setText(
        isCharmCollected('moonflower')
          ? 'Moonflower collected'
          : 'Play at night to find\nthe Moonflower',
      );
    }
  }

  private createHowToPlayLink(y: number): Phaser.GameObjects.Container {
    const label = 'How to play →';
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
      this.close();
      this.scene.time.delayedCall(260, () => {
        this.scene.scene.start(SCENE_KEYS.rules);
      });
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

  private createNameInputDom(): void {
    if (this.nameInput) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 18;
    input.placeholder = displayPlayerName();
    input.autocomplete = 'name';
    input.className = 'sd-player-name-input';
    input.value = getPlayerName();
    input.addEventListener('change', () => setPlayerName(input.value));
    input.addEventListener('blur', () => setPlayerName(input.value));

    document.body.appendChild(input);
    this.nameInput = input;
    this.hideNameInput();
  }

  private syncNameInput(): void {
    if (this.nameInput) {
      this.nameInput.value = getPlayerName();
    }
  }

  private showNameInput(): void {
    if (!this.nameInput) return;
    const rect = gameRectToScreen(this.scene.game, PANEL_X_OPEN + 40, 124, DRAWER_W - 80, 28);
    const input = this.nameInput;
    input.style.display = 'block';
    input.style.left = `${rect.left}px`;
    input.style.top = `${rect.top}px`;
    input.style.width = `${rect.width}px`;
    input.style.height = `${rect.height}px`;
  }

  private hideNameInput(): void {
    if (this.nameInput) {
      this.nameInput.style.display = 'none';
    }
  }

  private refreshPersonalBests(): void {
    for (const node of this.personalBestNodes) {
      node.destroy();
    }
    this.personalBestNodes = [];

    const bests = getPersonalBests();
    const startY = 366;
    const colW = (DRAWER_W - 48 - 10) / 2;
    const cardH = 78;
    const gap = 10;

    if (!hasAnyPersonalBests(bests)) {
      const emptyBubble = this.scene.add.graphics();
      drawBubbleRect(emptyBubble, 24, startY, DRAWER_W - 48, 88, {
        fill: 0x3a8cad,
        radius: 18,
      });
      const empty = this.scene.add
        .text(DRAWER_W / 2, startY + 44, 'Float downstream once\nto set your records!', {
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
