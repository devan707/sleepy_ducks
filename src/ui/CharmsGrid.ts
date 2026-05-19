import Phaser from 'phaser';
import {
  CHARM_BOX_SLOT_LAYOUT,
  CHARMS,
  CHARMS_BARE_ROW_LAYOUT,
  type CharmId,
} from '../config/charmConfig';
import { getCharmCount, loadCharms } from '../storage/charms';

export type CharmsGridOptions = {
  /** Local origin X of the charm box art (center). */
  centerX: number;
  /** Local origin Y of the charm box art (center). */
  centerY: number;
  scale?: number;
  /** Highlight a slot index (e.g. during collection reveal). */
  highlightSlot?: number;
  showLocked?: boolean;
  /** Horizontal row without charm box art (settings drawer). */
  bareRow?: boolean;
};

export class CharmsGrid extends Phaser.GameObjects.Container {
  private slotIcons: (Phaser.GameObjects.Image | null)[] = [];
  private slotCountLabels: (Phaser.GameObjects.Text | null)[] = [];
  private slotRings: Phaser.GameObjects.Graphics[] = [];
  private readonly layoutScale: number;
  private readonly slotLayout: typeof CHARM_BOX_SLOT_LAYOUT | typeof CHARMS_BARE_ROW_LAYOUT;

  constructor(scene: Phaser.Scene, opts: CharmsGridOptions) {
    super(scene, opts.centerX, opts.centerY);
    const scale = opts.scale ?? 1;
    this.layoutScale = scale;
    this.slotLayout = opts.bareRow ? CHARMS_BARE_ROW_LAYOUT : CHARM_BOX_SLOT_LAYOUT;
    const state = loadCharms();
    const { boxWidth, boxHeight, slots } = this.slotLayout;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const lx = (slot.x - 0.5) * boxWidth * scale;
      const ly = (slot.y - 0.5) * boxHeight * scale;

      const ring = scene.add.graphics();
      const r = 22 * scale;
      const slotCharm = state.slots[i];
      const moonflowerCount = i === 0 ? getCharmCount('moonflower') : 0;
      const showMoonflower = i === 0 && moonflowerCount > 0;
      const highlight = opts.highlightSlot === i;
      ring.lineStyle(highlight ? 3 : 2, highlight ? 0xa8e8ff : 0xffffff, highlight ? 0.9 : 0.28);
      ring.strokeCircle(lx, ly, r);
      if (!slotCharm && !showMoonflower && opts.showLocked !== false && i > 0) {
        ring.fillStyle(0x061018, 0.35);
        ring.fillCircle(lx, ly, r - 2);
      }
      this.add(ring);
      this.slotRings.push(ring);

      let icon: Phaser.GameObjects.Image | null = null;
      let countLabel: Phaser.GameObjects.Text | null = null;
      const charmId = showMoonflower ? 'moonflower' : slotCharm;
      if (charmId) {
        const def = CHARMS[charmId];
        if (scene.textures.exists(def.iconAtlasKey)) {
          icon = scene.add.image(lx, ly, def.iconAtlasKey, def.iconFrame);
          const target = 36 * scale;
          const frame = icon.frame;
          const fit = target / Math.max(frame.height, frame.width);
          icon.setDisplaySize(frame.width * fit, frame.height * fit);
          this.add(icon);
        }
        if (showMoonflower && moonflowerCount > 0) {
          countLabel = scene.add
            .text(lx + r * 0.55, ly + r * 0.45, `×${moonflowerCount}`, {
              fontFamily: 'system-ui, sans-serif',
              fontSize: `${Math.round(11 * scale)}px`,
              color: '#ecf8ff',
              fontStyle: 'bold',
            })
            .setOrigin(0.5);
          this.add(countLabel);
        }
      }
      this.slotIcons.push(icon);
      this.slotCountLabels.push(countLabel);
    }
  }

  getSlotWorldPosition(slotIndex: number): { x: number; y: number } {
    const { boxWidth, boxHeight, slots } = this.slotLayout;
    const slot = slots[slotIndex];
    if (!slot) return { x: this.x, y: this.y };
    const matrix = this.getWorldTransformMatrix();
    const lx = (slot.x - 0.5) * boxWidth * this.layoutScale;
    const ly = (slot.y - 0.5) * boxHeight * this.layoutScale;
    return { x: matrix.tx + lx, y: matrix.ty + ly };
  }

  setSlotIcon(slotIndex: number, id: CharmId): Phaser.GameObjects.Image | null {
    const existing = this.slotIcons[slotIndex];
    existing?.destroy();

    const { boxWidth, boxHeight, slots } = this.slotLayout;
    const slot = slots[slotIndex];
    if (!slot) return null;

    const lx = (slot.x - 0.5) * boxWidth * this.layoutScale;
    const ly = (slot.y - 0.5) * boxHeight * this.layoutScale;
    const def = CHARMS[id];
    const iconScale = this.layoutScale;
    if (!this.scene.textures.exists(def.iconAtlasKey)) return null;

    const icon = this.scene.add.image(lx, ly, def.iconAtlasKey, def.iconFrame);
    const target = 36 * iconScale;
    const frame = icon.frame;
    const fit = target / Math.max(frame.height, frame.width);
    icon.setDisplaySize(frame.width * fit, frame.height * fit);
    this.add(icon);
    this.slotIcons[slotIndex] = icon;
    return icon;
  }
}
