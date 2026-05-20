import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';

const FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Extra-heavy face for settings drawer labels. */
const SETTINGS_HEAVY_FONT =
  '"Arial Black", "Arial Bold", "Helvetica Neue", system-ui, sans-serif';

/** Cartoon display face (Google Font + fallbacks) used for menu tagline + level banners. */
export const LILITA_FONT =
  '"Lilita One", "Fredoka One", "Luckiest Guy", "Comic Sans MS", cursive';

/**
 * Phaser bakes text into a canvas as soon as it's added. If a web font is still
 * loading when that happens, the fallback face gets baked in. Repaint after the
 * font arrives so the styled face replaces the fallback in place.
 */
export async function ensureLilitaFont(
  text: Phaser.GameObjects.Text,
  fontSizePx = 26,
): Promise<void> {
  const fontset = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fontset || typeof fontset.load !== 'function') return;
  try {
    await fontset.load(`${fontSizePx}px "Lilita One"`);
  } catch {
    /* Font failed — fallback stack stays. */
  }
  if (!text.active) return;
  const original = text.text;
  text.setText(' ');
  text.setText(original);
}

/** Shared bold cartoon style: matches menu "Save the Falling Ducks!" tagline. */
export function lilitaDisplayStyle(
  overrides?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: LILITA_FONT,
    fontStyle: 'normal',
    fontSize: '26px',
    color: '#ffffff',
    stroke: '#1a0e08',
    strokeThickness: 6,
    shadow: {
      offsetX: 0,
      offsetY: 3,
      color: '#000000',
      blur: 4,
      stroke: false,
      fill: true,
    },
    ...overrides,
  };
}

export const UI_CHROME = {
  accentGold: '#ffe566',
  textPrimary: '#ffffff',
  textSoft: '#e8f4fc',
  textMuted: '#b8d4e8',
  labelLight: '#e2eef6',
  ink: '#0a1620',
} as const;

/** Stroke outline only — readable over bright art without drop shadow. */
export function outlinedTextStyle(
  overrides: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    color: UI_CHROME.textPrimary,
    stroke: UI_CHROME.ink,
    strokeThickness: 2,
    ...overrides,
  };
}

export function titleTextStyle(
  overrides?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return outlinedTextStyle({
    fontSize: '18px',
    fontStyle: 'bold',
    color: UI_CHROME.textSoft,
    strokeThickness: 3,
    ...overrides,
  });
}

export function scoreTextStyle(
  overrides?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return outlinedTextStyle({
    fontSize: '32px',
    fontStyle: 'bold',
    color: UI_CHROME.accentGold,
    strokeThickness: 4,
    ...overrides,
  });
}

export function captionTextStyle(
  overrides?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return outlinedTextStyle({
    fontSize: '12px',
    fontStyle: 'bold',
    color: UI_CHROME.textMuted,
    letterSpacing: 2,
    strokeThickness: 2,
    ...overrides,
  });
}

/** Arcade HUD numerals — gold fill, heavy outline, soft drop shadow. */
export function arcadeHudTextStyle(
  overrides?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return outlinedTextStyle({
    fontSize: '28px',
    fontStyle: 'bold',
    color: UI_CHROME.accentGold,
    stroke: UI_CHROME.ink,
    strokeThickness: 5,
    shadow: {
      offsetX: 2,
      offsetY: 2,
      color: '#000000',
      blur: 2,
      stroke: true,
      fill: true,
    },
    ...overrides,
  });
}

export function arcadeHudTimerStyle(
  overrides?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return outlinedTextStyle({
    fontSize: '20px',
    fontStyle: 'bold',
    color: UI_CHROME.textSoft,
    stroke: UI_CHROME.ink,
    strokeThickness: 4,
    shadow: {
      offsetX: 1,
      offsetY: 1,
      color: '#000000',
      blur: 1,
      stroke: true,
      fill: true,
    },
    ...overrides,
  });
}

export function labelTextStyle(
  overrides?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return outlinedTextStyle({
    fontSize: '11px',
    fontStyle: 'bold',
    color: UI_CHROME.labelLight,
    letterSpacing: 4,
    strokeThickness: 2,
    ...overrides,
  });
}

/** Settings drawer — section and field labels (not stat values). */
export function settingsLabelTextStyle(
  overrides?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return outlinedTextStyle({
    fontFamily: SETTINGS_HEAVY_FONT,
    fontStyle: 'bold',
    fontSize: '11px',
    color: UI_CHROME.textPrimary,
    stroke: UI_CHROME.ink,
    strokeThickness: 3,
    letterSpacing: 2,
    ...overrides,
  });
}

/** Thin gradient at top of gameplay — fades HUD text in, not a bar. */
export function addTopHudFade(
  scene: Phaser.Scene,
  depth: number,
  height = 88,
  strength = 0.5,
): Phaser.GameObjects.Graphics {
  const shade = 0x061018;
  const g = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  g.fillGradientStyle(shade, shade, shade, shade, strength, strength, 0, 0);
  g.fillRect(0, 0, GAME_WIDTH, height);
  return g;
}

/** Darkens top/bottom of menu-style scenes so type stays readable. */
export function addVerticalVignettes(
  scene: Phaser.Scene,
  depth: number,
  opts?: { topHeight?: number; bottomHeight?: number; strength?: number },
): Phaser.GameObjects.Graphics {
  const topH = opts?.topHeight ?? 320;
  const bottomH = opts?.bottomHeight ?? 300;
  const strength = opts?.strength ?? 0.62;
  const shade = 0x061018;

  const g = scene.add.graphics().setDepth(depth).setScrollFactor(0);

  g.fillGradientStyle(shade, shade, shade, shade, strength, strength, 0, 0);
  g.fillRect(0, 0, GAME_WIDTH, topH);

  g.fillGradientStyle(shade, shade, shade, shade, 0, 0, strength, strength);
  g.fillRect(0, GAME_HEIGHT - bottomH, GAME_WIDTH, bottomH);

  return g;
}

/** Text link with underline — stroke only, no shadow. */
export function createTextLink(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  depth: number,
  styleOverrides?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Container {
  const text = scene.add
    .text(0, 0, label, outlinedTextStyle({
      fontSize: '17px',
      fontStyle: 'bold',
      color: UI_CHROME.accentGold,
      strokeThickness: 3,
      ...styleOverrides,
    }))
    .setOrigin(0.5);

  const underline = scene.add.graphics();
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

  const hit = scene.add
    .rectangle(0, 0, Math.max(text.width + 24, 120), text.height + 20, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });

  const root = scene.add.container(x, y, [text, underline, hit]);
  root.setDepth(depth).setScrollFactor(0);

  hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    pointer.event?.stopPropagation();
    onClick();
  });

  hit.on('pointerover', () => {
    text.setColor('#fff8c8');
    scene.tweens.add({ targets: root, scaleX: 1.04, scaleY: 1.04, duration: 90 });
  });
  hit.on('pointerout', () => {
    text.setColor(UI_CHROME.accentGold);
    scene.tweens.add({ targets: root, scaleX: 1, scaleY: 1, duration: 90 });
  });

  return root;
}
