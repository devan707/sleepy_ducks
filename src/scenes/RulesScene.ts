import Phaser from 'phaser';
import { MusicManager } from '../audio/MusicManager';
import { loadGameAssets } from '../assets/GameAssetLoader';
import { ASSET_KEYS } from '../config/assets';
import { addComboRulesPreview } from '../ui/ComboRulesPreview';
import { MOONFLOWER_ATLAS_KEYS } from '../config/moonflowerAssets';
import { GoldenEggMeter } from '../objects/GoldenEggMeter';
import { ensureLilitaFont, lilitaDisplayStyle } from '../ui/uiChrome';
import {
  BALLOON,
  COLORS,
  DUCK_KIND_VISUAL,
  DUCK_SPRITE,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENE_KEYS,
} from '../config/gameConfig';

const DEPTH = { bg: 0, ui: 10 } as const;

/** Slightly larger than in-game ducks so illustrations read on the help screen. */
const RULES_DUCK_HEIGHT = DUCK_SPRITE.displayHeight * 1.12;
const RULES_MALE_DUCK_HEIGHT = RULES_DUCK_HEIGHT * 0.75;
const RULES_HEAVY_DUCK_SCALE = 0.85;
const RULES_GOLDEN_DUCK_SCALE = 0.82;
const RULES_GOLDEN_EGG_SCALE = 1.2;
const RULES_BALLOON_HEIGHT = BALLOON.displayHeight * 0.9;

const IMAGE_COLUMN_W = 88;
const PAD_X = 20;
const BODY_X = PAD_X + IMAGE_COLUMN_W + 8;
const BODY_W = GAME_WIDTH - BODY_X - PAD_X;
const SCROLL_BOTTOM_PAD = 28;
const SECTION_GAP = 8;

const TITLE_FONT_SIZE = 24;
const BODY_FONT_SIZE = 16;
/** Clear gap between section title bottom and tinted box top edge. */
const TITLE_BOX_GAP = 14;
const BODY_BOX_PAD_X = 10;
const BODY_BOX_PAD_Y = 8;
const BODY_BOX_RADIUS = 10;
const BODY_BOX_FILL_ALPHA = 0.26;
const BAD_TAP_X_COLOR = '#ffd700';
const BAD_TAP_X_STROKE = '#5a4a00';

/** Capitalize every word after the first (Save The Ducks, Heart Balloon, …). */
function rulesTitleCase(title: string): string {
  const words = title.split(' ');
  if (words.length <= 1) return title;
  return words
    .map((word, i) =>
      i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

const rulesHeaderStyle = () =>
  lilitaDisplayStyle({
    fontSize: '34px',
    color: '#ffe566',
    stroke: '#1a0e08',
    strokeThickness: 5,
  });

const rulesSectionTitleStyle = () =>
  lilitaDisplayStyle({
    fontSize: `${TITLE_FONT_SIZE}px`,
    color: '#f8d78a',
    stroke: '#1a0e08',
    strokeThickness: 4,
    shadow: {
      offsetX: 0,
      offsetY: 2,
      color: '#000000',
      blur: 3,
      stroke: false,
      fill: true,
    },
  });

type RuleVisual =
  | 'normalPair'
  | 'heavyPair'
  | 'goldenWithEgg'
  | 'balloon'
  | 'decoy'
  | 'combo'
  | 'moonflower'
  | 'dreamweed';

type RuleSection = {
  title: string;
  body: string;
  imageKey?: string;
  visual?: RuleVisual;
  frame?: string;
  /** Extra space before the next section (default {@link SECTION_GAP}). */
  gapAfter?: number;
};

const SECTIONS: RuleSection[] = [
  {
    title: 'Save the ducks',
    body: 'Tap a duck when it starts to fall into the water. If you tap too soon, it does not count!',
    visual: 'normalPair',
    gapAfter: 16,
  },
  {
    title: 'Heavy sleepers',
    body: 'Some ducks wear a night cap. Tap them once on the cliff, then tap again when they fall.',
    visual: 'heavyPair',
  },
  {
    title: 'Golden ducks',
    body: 'Golden ducks fall from the sky! Tap them fast. Each save fills the golden egg. Fill it up to win a bonus heart!',
    imageKey: ASSET_KEYS.goldenSleep,
    visual: 'goldenWithEgg',
  },
  {
    title: 'Decoys',
    body: 'Some ducks are wooden fakes! You cannot save them. Tapping them breaks your combo.',
    imageKey: ASSET_KEYS.decoy,
    visual: 'decoy',
  },
  {
    title: 'Combo',
    body: 'Save ducks one after another to build a combo. More combo = more points!',
    visual: 'combo',
  },
  {
    title: 'Heart balloon',
    body: 'See a heart balloon? Tap it to get an extra life!',
    imageKey: ASSET_KEYS.atlasBalloon,
    visual: 'balloon',
    frame: 'frame_000',
    gapAfter: 2,
  },
  {
    title: 'Dreamweed',
    body: 'Dreamweed drifts from the waterfall lip. Grab it, then swipe left or right to collect it — tapping alone will not work!',
    imageKey: ASSET_KEYS.dreamweed,
    visual: 'dreamweed',
  },
  {
    title: 'Charms',
    body: 'Charms are special keepsakes you collect during a run. Open Settings to see your collection. After sunset, tap the glowing moonflower on the cliff. Swipe falling dreamweed from the waterfall to collect it too!',
    imageKey: MOONFLOWER_ATLAS_KEYS.sway,
    visual: 'moonflower',
    frame: 'frame_000',
  },
];

function fitDisplaySize(sprite: Phaser.GameObjects.Image, targetHeight: number): void {
  const frame = sprite.frame;
  const fit = targetHeight / frame.height;
  sprite.setDisplaySize(frame.width * fit, targetHeight);
}

function rulesImageHeight(visual?: RuleVisual): number {
  if (visual === 'balloon') return RULES_BALLOON_HEIGHT;
  if (visual === 'combo') return 0;
  if (visual === 'moonflower') return 52;
  if (visual === 'dreamweed') return 52;
  let h = RULES_DUCK_HEIGHT;
  if (visual === 'heavyPair') h *= DUCK_KIND_VISUAL.heavy.scaleMult;
  if (visual === 'goldenWithEgg') h *= DUCK_KIND_VISUAL.golden.scaleMult;
  return h;
}

export class RulesScene extends Phaser.Scene {
  private scrollY = 0;
  private returnToGame = false;
  private wheelHandler?: (
    p: Phaser.Input.Pointer,
    g: Phaser.GameObjects.GameObject,
    dx: number,
    dy: number,
  ) => void;
  private pointerDownHandler?: (p: Phaser.Input.Pointer) => void;
  private pointerMoveHandler?: (p: Phaser.Input.Pointer) => void;
  private pointerUpHandler?: () => void;

  constructor() {
    super(SCENE_KEYS.rules);
  }

  init(data?: { returnToGame?: boolean }): void {
    this.returnToGame = !!data?.returnToGame;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a3a4a');

    const build = () => this.buildRulesUi();
    if (
      this.textures.exists(ASSET_KEYS.femaleAsleep) &&
      this.textures.exists(ASSET_KEYS.atlasBalloon)
    ) {
      build();
    } else {
      loadGameAssets(this).then(build);
    }
  }

  shutdown(): void {
    if (this.wheelHandler) this.input.off('wheel', this.wheelHandler);
    if (this.pointerDownHandler) this.input.off('pointerdown', this.pointerDownHandler);
    if (this.pointerMoveHandler) this.input.off('pointermove', this.pointerMoveHandler);
    if (this.pointerUpHandler) this.input.off('pointerup', this.pointerUpHandler);
  }

  private buildRulesUi(): void {
    if (!this.returnToGame) {
      MusicManager.getInstance().playMenuUi();
    }

    if (this.textures.exists(ASSET_KEYS.homeWaterfall)) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ASSET_KEYS.homeWaterfall);
      bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      bg.setAlpha(0.35);
      bg.setDepth(DEPTH.bg);
      bg.setScrollFactor(0);
    }

    const header = this.add
      .text(GAME_WIDTH / 2, 48, rulesTitleCase('How to play'), rulesHeaderStyle())
      .setOrigin(0.5)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);
    void ensureLilitaFont(header, 34);

    const backY = GAME_HEIGHT - 48;
    const backBtn = this.add
      .text(GAME_WIDTH / 2, backY, '← Back', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      if (this.returnToGame) {
        this.scene.stop();
        this.scene.get(SCENE_KEYS.game).events.emit('reopen-settings-after-rules');
        return;
      }
      this.scene.start(SCENE_KEYS.menu);
    });

    const contentTop = header.y + 28;
    const contentBottom = backY - 24;
    const viewportH = contentBottom - contentTop;

    const container = this.add.container(0, contentTop);
    container.setDepth(DEPTH.ui);

    let y = 0;
    for (let i = 0; i < SECTIONS.length; i++) {
      y = this.addSection(container, SECTIONS[i], y);
      if (i < SECTIONS.length - 1) {
        y += SECTIONS[i].gapAfter ?? SECTION_GAP;
      }
    }
    const contentHeight = y + SCROLL_BOTTOM_PAD;
    const maxScroll = Math.max(0, contentHeight - viewportH);
    this.scrollY = 0;

    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, contentTop, GAME_WIDTH, viewportH);
    const mask = maskShape.createGeometryMask();
    container.setMask(mask);

    if (maxScroll > 0) {
      this.wheelHandler = (_p, _g, _dx, deltaY) => {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.35, 0, maxScroll);
        container.y = contentTop - this.scrollY;
      };
      this.input.on('wheel', this.wheelHandler);

      let dragging = false;
      let dragStartY = 0;
      let scrollStart = 0;

      this.pointerDownHandler = (p) => {
        if (p.y >= contentTop && p.y <= contentBottom && p.x < GAME_WIDTH - 8) {
          dragging = true;
          dragStartY = p.y;
          scrollStart = this.scrollY;
        }
      };
      this.pointerMoveHandler = (p) => {
        if (!dragging || !p.isDown) return;
        const dy = dragStartY - p.y;
        this.scrollY = Phaser.Math.Clamp(scrollStart + dy, 0, maxScroll);
        container.y = contentTop - this.scrollY;
      };
      this.pointerUpHandler = () => {
        dragging = false;
      };

      this.input.on('pointerdown', this.pointerDownHandler);
      this.input.on('pointermove', this.pointerMoveHandler);
      this.input.on('pointerup', this.pointerUpHandler);
    }
  }

  private addSection(
    container: Phaser.GameObjects.Container,
    section: RuleSection,
    startY: number,
  ): number {
    let y = startY;

    const title = this.add.text(
      PAD_X,
      y,
      rulesTitleCase(section.title),
      rulesSectionTitleStyle(),
    );
    container.add(title);
    void ensureLilitaFont(title, TITLE_FONT_SIZE);

    y += title.height + TITLE_BOX_GAP;

    const bodyY = y;
    let bodyX = PAD_X;
    let bodyW = GAME_WIDTH - PAD_X * 2;
    let imageBottom = bodyY;

    if (section.visual === 'combo') {
      const previewH = addComboRulesPreview(
        this,
        container,
        PAD_X + IMAGE_COLUMN_W / 2,
        bodyY,
      );
      imageBottom = bodyY + previewH;
      bodyX = BODY_X;
      bodyW = BODY_W;
    } else if (section.visual === 'normalPair') {
      imageBottom = this.addNormalDuckPair(container, bodyY);
      bodyX = BODY_X;
      bodyW = BODY_W;
    } else if (section.visual === 'heavyPair') {
      imageBottom = this.addHeavySleeperPair(container, bodyY);
      bodyX = BODY_X;
      bodyW = BODY_W;
    } else if (section.visual === 'goldenWithEgg' && section.imageKey) {
      imageBottom = this.addGoldenDuckWithEgg(container, bodyY, section.imageKey);
      bodyX = BODY_X;
      bodyW = BODY_W;
    } else if (section.imageKey && this.textures.exists(section.imageKey)) {
      const img = this.add.image(PAD_X + IMAGE_COLUMN_W / 2, bodyY, section.imageKey);
      if (section.frame) img.setFrame(section.frame);
      fitDisplaySize(img, rulesImageHeight(section.visual));
      img.setOrigin(0.5, 0);
      container.add(img);

      imageBottom = bodyY + img.displayHeight;
      bodyX = BODY_X;
      bodyW = BODY_W;
    }

    const bodyBlock = this.addRulesBody(bodyX, bodyY, bodyW, section);

    const boxX = bodyX - BODY_BOX_PAD_X;
    const boxY = bodyY - BODY_BOX_PAD_Y;
    const boxW = bodyW + BODY_BOX_PAD_X * 2;
    const boxH = bodyBlock.height + BODY_BOX_PAD_Y * 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x0e2230, BODY_BOX_FILL_ALPHA);
    panel.fillRoundedRect(boxX, boxY, boxW, boxH, BODY_BOX_RADIUS);
    panel.lineStyle(1, 0xffffff, 0.08);
    panel.strokeRoundedRect(boxX, boxY, boxW, boxH, BODY_BOX_RADIUS);
    container.add(panel);
    for (const child of bodyBlock.children) {
      container.add(child);
    }

    return Math.max(imageBottom, boxY + boxH);
  }

  private rulesBodyStyle(bodyW: number): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${BODY_FONT_SIZE}px`,
      color: COLORS.text,
      wordWrap: { width: bodyW },
      lineSpacing: 4,
    };
  }

  private addRulesBody(
    bodyX: number,
    bodyY: number,
    bodyW: number,
    section: RuleSection,
  ): { height: number; children: Phaser.GameObjects.Text[] } {
    const style = this.rulesBodyStyle(bodyW);

    if (section.visual === 'combo') {
      const main = this.add.text(
        bodyX,
        bodyY,
        'Save ducks one after another to build a combo. More combo = more points!',
        style,
      );
      const noteY = bodyY + main.height + 4;
      const paren = this.add.text(bodyX, noteY, '( ', style);
      const xMark = this.add.text(paren.x + paren.width, noteY, 'X', {
        fontFamily: style.fontFamily as string,
        fontSize: style.fontSize,
        fontStyle: 'bold',
        color: BAD_TAP_X_COLOR,
        stroke: BAD_TAP_X_STROKE,
        strokeThickness: 2,
      });
      const suffix = this.add.text(
        xMark.x + xMark.width,
        noteY,
        ' Bad taps break your combo.)',
        style,
      );
      const noteH = Math.max(paren.height, xMark.height, suffix.height);
      return {
        height: main.height + 4 + noteH,
        children: [main, paren, xMark, suffix],
      };
    }

    const body = this.add.text(bodyX, bodyY, section.body, style);
    return { height: body.height, children: [body] };
  }

  private addNormalDuckPair(
    container: Phaser.GameObjects.Container,
    bodyY: number,
  ): number {
    const h = RULES_DUCK_HEIGHT;
    const colCenter = PAD_X + IMAGE_COLUMN_W / 2;
    const offsetX = 22;
    let bottom = bodyY;

    if (this.textures.exists(ASSET_KEYS.femaleAsleep)) {
      const female = this.add.image(colCenter - offsetX, bodyY, ASSET_KEYS.femaleAsleep);
      fitDisplaySize(female, h);
      female.setOrigin(0.5, 0);
      container.add(female);
      bottom = Math.max(bottom, bodyY + female.displayHeight);
    }

    if (this.textures.exists(ASSET_KEYS.atlasDuckSleep)) {
      const male = this.add.image(
        colCenter + offsetX,
        bodyY,
        ASSET_KEYS.atlasDuckSleep,
        'frame_000',
      );
      fitDisplaySize(male, RULES_MALE_DUCK_HEIGHT);
      male.setOrigin(0.5, 0);
      container.add(male);
      bottom = Math.max(bottom, bodyY + male.displayHeight);
    }

    return bottom;
  }

  private addHeavySleeperPair(
    container: Phaser.GameObjects.Container,
    bodyY: number,
  ): number {
    const h = rulesImageHeight('heavyPair') * RULES_HEAVY_DUCK_SCALE;
    const colCenter = PAD_X + IMAGE_COLUMN_W / 2;
    const offsetX = 22;
    let bottom = bodyY;

    if (this.textures.exists(ASSET_KEYS.femaleDeepSleep)) {
      const female = this.add.image(
        colCenter - offsetX,
        bodyY,
        ASSET_KEYS.femaleDeepSleep,
      );
      fitDisplaySize(female, h);
      female.setOrigin(0.5, 0);
      container.add(female);
      bottom = Math.max(bottom, bodyY + female.displayHeight);
    }

    if (this.textures.exists(ASSET_KEYS.maleDeepSleep)) {
      const male = this.add.image(
        colCenter + offsetX,
        bodyY,
        ASSET_KEYS.maleDeepSleep,
      );
      fitDisplaySize(male, h);
      male.setOrigin(0.5, 0);
      container.add(male);
      bottom = Math.max(bottom, bodyY + male.displayHeight);
    }

    return bottom;
  }

  private addGoldenDuckWithEgg(
    container: Phaser.GameObjects.Container,
    bodyY: number,
    duckKey: string,
  ): number {
    const colCenter = PAD_X + IMAGE_COLUMN_W / 2;
    const duckH = rulesImageHeight('goldenWithEgg') * RULES_GOLDEN_DUCK_SCALE;
    const goldenVisual = DUCK_KIND_VISUAL.golden;

    if (!this.textures.exists(duckKey)) {
      return bodyY + duckH;
    }

    const duckCenterX = colCenter + 18;
    const duck = this.add.image(duckCenterX, bodyY, duckKey);
    fitDisplaySize(duck, duckH);
    duck.setOrigin(0.5, 0);
    if (duck.preFX) {
      duck.preFX.addGlow(
        goldenVisual.glowColor,
        goldenVisual.glowStrength,
        0,
        false,
        0.08,
        12,
      );
    }

    const eggScale = RULES_GOLDEN_EGG_SCALE;
    const eggW = 22 * eggScale;
    const eggGap = 5;
    const eggX =
      duckCenterX - duck.displayWidth * 0.5 - eggGap - eggW * 0.5;
    const eggY = bodyY + duckH * 0.58;
    const eggMeter = new GoldenEggMeter(this, 0, 0);
    eggMeter.setState('half');
    const eggRoot = eggMeter.getContainer();
    eggRoot.setScale(eggScale);
    eggRoot.setPosition(eggX, eggY);
    container.add(eggRoot);
    container.add(duck);

    return bodyY + duckH;
  }
}
