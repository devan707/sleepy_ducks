import Phaser from 'phaser';
import { COLORS } from '../config/gameConfig';
import type { RunStats } from '../models/RunStats';
import { formatSurvivalTime } from '../models/RunStats';
import { formatScore } from '../util/formatScore';

export type EndScreenScoreCardOptions = {
  score: number;
  highScore: number;
  stats: RunStats;
  isNewHighScore: boolean;
  isNewLongestTime: boolean;
  depth: number;
  width?: number;
};

const PANEL_RADIUS = 18;
const PANEL_PAD_TOP = 16;
const PANEL_PAD_BOTTOM = 18;

/**
 * Unified score + run stats panel for end screens.
 * Built as one container so the whole block can be moved or scaled together.
 */
export class EndScreenScoreCard {
  readonly root: Phaser.GameObjects.Container;
  private readonly panelHeight: number;

  constructor(
    scene: Phaser.Scene,
    centerX: number,
    topY: number,
    opts: EndScreenScoreCardOptions,
  ) {
    const width = opts.width ?? 300;

    const accentStyle = {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold' as const,
      color: COLORS.combo,
    };
    const statStyle = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#d5e8ef',
    };

    let innerH = PANEL_PAD_TOP;
    const children: Phaser.GameObjects.GameObject[] = [];
    let y = PANEL_PAD_TOP;

    if (opts.isNewHighScore) {
      const t = scene.add
        .text(0, y, 'NEW HIGH SCORE!', accentStyle)
        .setOrigin(0.5, 0);
      children.push(t);
      y += 26;
    }

    const scoreText = scene.add
      .text(0, y, formatScore(opts.score), {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0);
    children.push(scoreText);
    y += scoreText.height + 4;

    const bestText = scene.add
      .text(0, y, `Best: ${formatScore(opts.highScore)}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#ffe566',
      })
      .setOrigin(0.5, 0);
    children.push(bestText);
    y += bestText.height + 14;

    const divider = scene.add.graphics();
    divider.lineStyle(1, 0xffffff, 0.14);
    divider.lineBetween(-width * 0.38, y, width * 0.38, y);
    children.push(divider);
    y += 12;

    const statLines = [
      `Ducks saved: ${opts.stats.ducksSaved}`,
      `Bad taps: ${opts.stats.missedTaps}`,
      `Longest combo: ${opts.stats.longestCombo}`,
      `Time survived: ${formatSurvivalTime(opts.stats.timeSurvivedMs)}`,
    ];

    for (let i = 0; i < statLines.length; i++) {
      const t = scene.add.text(0, y, statLines[i], statStyle).setOrigin(0.5, 0);
      children.push(t);
      y += 24;

      if (i === statLines.length - 1 && opts.isNewLongestTime) {
        const badge = scene.add
          .text(0, y, 'NEW BEST TIME!', accentStyle)
          .setOrigin(0.5, 0);
        children.push(badge);
        y += 24;
      }
    }

    innerH = y + PANEL_PAD_BOTTOM;
    this.panelHeight = innerH;

    const panel = scene.add.graphics();
    panel.fillStyle(0x000000, 0.45);
    panel.fillRoundedRect(-width / 2, 0, width, innerH, PANEL_RADIUS);
    panel.lineStyle(1, 0xffffff, 0.1);
    panel.strokeRoundedRect(-width / 2, 0, width, innerH, PANEL_RADIUS);

    this.root = scene.add.container(centerX, topY, [panel, ...children]);
    this.root.setDepth(opts.depth).setScrollFactor(0);
  }

  get height(): number {
    return this.panelHeight;
  }

  get bottom(): number {
    return this.root.y + this.panelHeight;
  }

  setScale(scale: number): void {
    this.root.setScale(scale);
  }

  destroy(): void {
    this.root.destroy();
  }
}
