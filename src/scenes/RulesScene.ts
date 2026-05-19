import Phaser from 'phaser';
import { MusicManager } from '../audio/MusicManager';
import { loadGameAssets } from '../assets/GameAssetLoader';
import { ASSET_KEYS } from '../config/assets';
import { addComboRulesPreview } from '../ui/ComboRulesPreview';
import { MOONFLOWER_ATLAS_KEYS } from '../config/moonflowerAssets';
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
const RULES_BALLOON_HEIGHT = BALLOON.displayHeight * 0.9;

const IMAGE_COLUMN_W = 88;
const PAD_X = 20;
const BODY_X = PAD_X + IMAGE_COLUMN_W + 8;
const BODY_W = GAME_WIDTH - BODY_X - PAD_X;
const SCROLL_BOTTOM_PAD = 28;

type RuleVisual = 'normal' | 'heavy' | 'golden' | 'balloon' | 'decoy' | 'combo' | 'moonflower';

type RuleSection = {
  title: string;
  body: string;
  imageKey?: string;
  visual?: RuleVisual;
  frame?: string;
};

const SECTIONS: RuleSection[] = [
  {
    title: 'Sleeping ducks',
    body: 'Wait until a duck has gone over the lip and is falling — then tap to save it. Tapping too early while it is still cresting shows “Too Early!” — no save, no points, and your combo resets.',
    imageKey: ASSET_KEYS.femaleAsleep,
    visual: 'normal',
  },
  {
    title: 'Heavy sleepers',
    body: 'Heavy sleepers wear a nightcap and mask. Tap one anytime (on the crest or after the lip) for “Tap again!” — the hat and mask come off with no penalty and your combo stays intact. Smart players do this before the lip. After conversion they act like normal sleepers: another crest tap is “Too Early!” and breaks combo; one falling tap saves them.',
    imageKey: ASSET_KEYS.maleDeepSleep,
    visual: 'heavy',
  },
  {
    title: 'Golden ducks',
    body: 'Golden ducks dive from the sky — tap them before they hit the mist! Worth triple points. Each golden save fills the egg halfway (gold on the bottom), then fully on the second save. The egg stays full and golden for a moment, then a toast awards +1 ♥ and the egg resets to an empty golden outline.',
    imageKey: ASSET_KEYS.goldenSleep,
    visual: 'golden',
  },
  {
    title: 'Combo',
    body: 'Combo is a clean streak of successful saves. It grows when you save a duck and boosts your score. Combo only breaks when: the timer runs out between saves, a real duck hits the mist, you tap empty space or a decoy, or you tap too early on a normal sleeper (not the first “Tap again!” on a heavy sleeper). Keep the timer bar alive!',
    visual: 'combo',
  },
  {
    title: 'Heart balloon',
    body: 'Two heart balloons per run (first after 5–60s, second after 60–120s). Pop one for +1 life (up to 5 hearts).',
    imageKey: ASSET_KEYS.atlasBalloon,
    visual: 'balloon',
    frame: 'frame_000',
  },
  {
    title: 'Decoy duck',
    body: 'Decoy ducks look similar but cannot be saved — they always fall on their own. Tapping one counts as a bad tap (a quick whiff/sploosh and yellow X) and resets your combo. Ignore them when you can.',
    imageKey: ASSET_KEYS.decoy,
    visual: 'decoy',
  },
  {
    title: 'Moonflower charm',
    body: 'After sunset, a glowing moonflower blooms on the left cliff — tap it before the run ends. Each one adds to your charms in Settings (×2, ×3, and so on across runs). A hint appears as night falls if you have not collected it yet.',
    imageKey: MOONFLOWER_ATLAS_KEYS.sway,
    visual: 'moonflower',
    frame: 'frame_000',
  },
  {
    title: 'Empty taps',
    body: 'Tapping empty space (not the settings gear or other UI) is a bad tap — you’ll hear a quick whiff/sploosh, see a yellow X, and lose your combo. Aim carefully!',
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
  let h = RULES_DUCK_HEIGHT;
  if (visual === 'heavy') h *= DUCK_KIND_VISUAL.heavy.scaleMult;
  if (visual === 'golden') h *= DUCK_KIND_VISUAL.golden.scaleMult;
  return h;
}

export class RulesScene extends Phaser.Scene {
  private scrollY = 0;
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
    MusicManager.getInstance().playMenuUi();

    if (this.textures.exists(ASSET_KEYS.homeWaterfall)) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ASSET_KEYS.homeWaterfall);
      bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      bg.setAlpha(0.35);
      bg.setDepth(DEPTH.bg);
      bg.setScrollFactor(0);
    }

    const header = this.add
      .text(GAME_WIDTH / 2, 48, 'How to play', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffe566',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);

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
      this.scene.start(SCENE_KEYS.menu);
    });

    const contentTop = header.y + 28;
    const contentBottom = backY - 24;
    const viewportH = contentBottom - contentTop;

    const container = this.add.container(0, contentTop);
    container.setDepth(DEPTH.ui);

    let y = 0;
    for (const section of SECTIONS) {
      y = this.addSection(container, section, y);
      y += 14;
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

    const title = this.add.text(PAD_X, y, section.title, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#f8d78a',
    });
    container.add(title);

    y += 22;

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

    const body = this.add.text(bodyX, bodyY, section.body, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: COLORS.text,
      wordWrap: { width: bodyW },
      lineSpacing: 3,
    });
    container.add(body);

    return Math.max(imageBottom, bodyY + body.height);
  }
}
