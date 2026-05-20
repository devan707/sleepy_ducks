import Phaser from 'phaser';
import { arcadeHudTextStyle, captionTextStyle, outlinedTextStyle, settingsLabelTextStyle, UI_CHROME } from './uiChrome';

/** Bright green for sound/music ON toggle in settings. */
const SOUND_ON_GREEN = 0x52e078;

export type BubbleRectOptions = {
  fill?: number;
  fillAlpha?: number;
  radius?: number;
  highlight?: boolean;
};

/** Lazy-river bubble panel — soft fill, gloss, chunky outline. */
export function drawBubbleRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: BubbleRectOptions = {},
): void {
  const radius = opts.radius ?? 18;
  const fill = opts.fill ?? 0x3a8cad;
  const fillAlpha = opts.fillAlpha ?? 0.9;
  const highlight = opts.highlight ?? true;

  g.fillStyle(fill, fillAlpha);
  g.fillRoundedRect(x, y, w, h, radius);

  if (highlight) {
    g.fillStyle(0xffffff, 0.24);
    g.fillEllipse(x + w * 0.3, y + h * 0.2, w * 0.5, h * 0.32);
    g.fillStyle(0xffffff, 0.08);
    g.fillEllipse(x + w * 0.72, y + h * 0.78, w * 0.22, h * 0.14);
  }

  g.lineStyle(3.5, 0xffffff, 0.62);
  g.strokeRoundedRect(x, y, w, h, radius);
  g.lineStyle(2, 0xffe566, 0.28);
  g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, Math.max(4, radius - 2));
}

export type BubbleStatCardOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: string;
  fill: number;
};

/** Single personal-best stat in a bubbly card. */
export function createBubbleStatCard(
  scene: Phaser.Scene,
  opts: BubbleStatCardOptions,
): Phaser.GameObjects.Container {
  const { x, y, width, height, label, value, fill } = opts;
  const g = scene.add.graphics();
  drawBubbleRect(g, 0, 0, width, height, { fill, radius: 16 });

  const labelText = scene.add
    .text(width / 2, height - 10, label.toUpperCase(), settingsLabelTextStyle({
      fontSize: '10px',
      letterSpacing: 1,
      align: 'center',
    }))
    .setOrigin(0.5, 1);

  const valueFontSize = value.length > 6 ? '17px' : value.length > 4 ? '20px' : '22px';
  const valueText = scene.add
    .text(width / 2, height / 2 - 6, value, arcadeHudTextStyle({
      fontSize: valueFontSize,
      color: UI_CHROME.accentGold,
      strokeThickness: 4,
      align: 'center',
    }))
    .setOrigin(0.5, 0.5);

  const root = scene.add.container(x, y, [g, labelText, valueText]);
  return root;
}

export function createBubbleToggleRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  initialOn: boolean,
  onChange: (enabled: boolean) => void,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  drawBubbleRect(g, 0, 0, width, height, { fill: 0x2f6f88, radius: 16 });

  const labelText = scene.add
    .text(14, height / 2, label, outlinedTextStyle({ fontSize: '15px' }))
    .setOrigin(0, 0.5);

  let enabled = initialOn;
  const pillW = 52;
  const pillH = 28;
  const pillX = width - pillW - 12;
  const pillY = (height - pillH) / 2;

  const pill = scene.add.graphics();
  const stateText = scene.add
    .text(pillX + pillW / 2, height / 2, enabled ? 'ON' : 'OFF', {
      ...outlinedTextStyle({ fontSize: '13px' }),
      color: enabled ? '#1a3a2a' : '#4a5a62',
    })
    .setOrigin(0.5);

  const redrawPill = () => {
    pill.clear();
    pill.fillStyle(enabled ? 0xa8e6cf : 0x6a8a9a, 1);
    pill.fillRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
    pill.lineStyle(2, 0xffffff, enabled ? 0.7 : 0.35);
    pill.strokeRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
    stateText.setText(enabled ? 'ON' : 'OFF');
    stateText.setColor(enabled ? '#1a3a2a' : '#eef6fa');
  };
  redrawPill();

  const hit = scene.add
    .rectangle(width / 2, height / 2, width, height, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });

  hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
    p.event?.stopPropagation();
    enabled = !enabled;
    redrawPill();
    onChange(enabled);
  });

  return scene.add.container(x, y, [g, labelText, pill, stateText, hit]);
}

export type BubbleVolumeSliderOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  initial01: number;
  /** Bubble panel fill (defaults to settings teal). */
  backgroundFill?: number;
  onChange: (volume01: number) => void;
  /** Called when the sound-off toggle changes. */
  onMuteChange?: (muted: boolean) => void;
};

/** Horizontal volume slider (0–1) with bubble styling and sound-off toggle. */
export function createBubbleVolumeSlider(
  scene: Phaser.Scene,
  opts: BubbleVolumeSliderOptions,
): Phaser.GameObjects.Container {
  const { x, y, width, height, label, initial01, onChange, onMuteChange, backgroundFill } =
    opts;
  const g = scene.add.graphics();
  drawBubbleRect(g, 0, 0, width, height, {
    fill: backgroundFill ?? 0x2f6f88,
    radius: 16,
  });

  const labelText = scene.add
    .text(14, 10, label, settingsLabelTextStyle({ fontSize: '15px', letterSpacing: 0 }))
    .setOrigin(0, 0);

  const trackPad = 14;
  const trackY = height - 24;
  const trackW = width - trackPad * 2;
  const trackH = 10;

  const trackGfx = scene.add.graphics();
  const fillGfx = scene.add.graphics();
  const knob = scene.add.graphics();

  const pctText = scene.add
    .text(width - trackPad - 58, 10, '', captionTextStyle({ fontSize: '11px' }))
    .setOrigin(1, 0);

  const mutePill = scene.add.graphics();
  const muteText = scene.add
    .text(0, 0, '', outlinedTextStyle({ fontSize: '11px', strokeThickness: 2 }))
    .setOrigin(0.5);

  let value = Phaser.Math.Clamp(initial01, 0, 1);
  let savedVolume = value > 0.001 ? value : 0.42;
  let muted = value <= 0.001;

  const mutePillW = 46;
  const mutePillH = 22;
  const mutePillX = width - trackPad - mutePillW;
  const mutePillY = 8;

  const redrawMute = () => {
    mutePill.clear();
    mutePill.fillStyle(muted ? 0x6a4a4a : SOUND_ON_GREEN, muted ? 0.95 : 0.95);
    mutePill.fillRoundedRect(mutePillX, mutePillY, mutePillW, mutePillH, mutePillH / 2);
    mutePill.lineStyle(2, 0xffffff, muted ? 0.45 : 0.65);
    mutePill.strokeRoundedRect(mutePillX, mutePillY, mutePillW, mutePillH, mutePillH / 2);
    muteText.setPosition(mutePillX + mutePillW / 2, mutePillY + mutePillH / 2);
    muteText.setText(muted ? 'OFF' : 'ON');
    if (muted) {
      muteText.setColor('#ffd0d0');
    } else {
      muteText.setColor(UI_CHROME.textPrimary);
    }
    muteText.setStroke(UI_CHROME.ink, 2);
  };

  const knobX = () => trackPad + value * trackW;

  const redraw = () => {
    trackGfx.clear();
    fillGfx.clear();
    knob.clear();

    trackGfx.fillStyle(0x1a3a4a, muted ? 0.55 : 0.85);
    trackGfx.fillRoundedRect(trackPad, trackY, trackW, trackH, trackH / 2);

    if (value > 0 && !muted) {
      fillGfx.fillStyle(0xffe566, 0.95);
      fillGfx.fillRoundedRect(trackPad, trackY, Math.max(trackH, trackW * value), trackH, trackH / 2);
    }

    const kx = knobX();
    knob.fillStyle(muted ? 0x9aa8b0 : 0xffffff, muted ? 0.65 : 1);
    knob.fillCircle(kx, trackY + trackH / 2, 9);
    knob.lineStyle(2, muted ? 0x556068 : 0xc97a1a, 1);
    knob.strokeCircle(kx, trackY + trackH / 2, 9);

    pctText.setText(muted ? 'Muted' : `${Math.round(value * 100)}%`);
    redrawMute();
  };

  const setFromPointer = (localX: number) => {
    if (muted) return;
    value = Phaser.Math.Clamp((localX - trackPad) / trackW, 0, 1);
    if (value > 0.001) savedVolume = value;
    if (value <= 0.001 && !muted) {
      muted = true;
      onMuteChange?.(true);
    } else if (value > 0.001 && muted) {
      muted = false;
      onMuteChange?.(false);
    }
    redraw();
    onChange(value);
  };

  const setMuted = (nextMuted: boolean) => {
    if (nextMuted === muted) return;
    muted = nextMuted;
    if (muted) {
      if (value > 0.001) savedVolume = value;
      value = 0;
      onChange(0);
    } else {
      value = savedVolume > 0.001 ? savedVolume : 0.42;
      onChange(value);
    }
    onMuteChange?.(muted);
    redraw();
  };

  const trackHit = scene.add
    .rectangle(trackPad + trackW / 2, trackY + trackH / 2, trackW + 24, 28, 0xffffff, 0)
    .setInteractive({ useHandCursor: true, draggable: true });

  const muteHit = scene.add
    .rectangle(mutePillX + mutePillW / 2, mutePillY + mutePillH / 2, mutePillW, mutePillH, 0xffffff, 0)
    .setInteractive({ useHandCursor: true });

  const root = scene.add.container(x, y, [
    g,
    labelText,
    trackGfx,
    fillGfx,
    knob,
    pctText,
    mutePill,
    muteText,
    trackHit,
    muteHit,
  ]);

  const pointerToVolume = (pointer: Phaser.Input.Pointer) => {
    const local = root.getLocalPoint(pointer.worldX, pointer.worldY);
    setFromPointer(local.x);
  };

  trackHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
    p.event?.stopPropagation();
    SettingsDrawerSuppress.mark();
    pointerToVolume(p);
  });

  trackHit.on('drag', (p: Phaser.Input.Pointer) => {
    pointerToVolume(p);
  });

  muteHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
    p.event?.stopPropagation();
    SettingsDrawerSuppress.mark();
    setMuted(!muted);
  });

  redraw();

  return root;
}

/** Shared flag so slider drags don't click through to the scene. */
export const SettingsDrawerSuppress = {
  flagged: false,
  mark(): void {
    this.flagged = true;
  },
  consume(): boolean {
    if (!this.flagged) return false;
    this.flagged = false;
    return true;
  },
};
