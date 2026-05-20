import Phaser from 'phaser';
import { MOONFLOWER_ATLAS_KEYS, MOONFLOWER_ANIM_KEYS } from '../config/moonflowerAssets';
import { MOONFLOWER, STAGE } from '../config/gameConfig';

export type MoonflowerPhase = 'sprout' | 'bloom' | 'sway';

/** Prevents gameplay taps from passing through moonflower collection. */
export class MoonflowerTapSuppress {
  private static active = false;

  static arm(): void {
    MoonflowerTapSuppress.active = true;
  }

  static consume(): boolean {
    if (!MoonflowerTapSuppress.active) return false;
    MoonflowerTapSuppress.active = false;
    return true;
  }

  static reset(): void {
    MoonflowerTapSuppress.active = false;
  }
}

export class Moonflower extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Graphics;
  private phase: MoonflowerPhase = 'sprout';
  private glowPulse: Phaser.Tweens.Tween | null = null;
  private hitW = 0;
  private hitH = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.glow = scene.add.graphics();
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.drawGlow(MOONFLOWER.glowAlpha);

    this.sprite = scene.add.sprite(0, 0, MOONFLOWER_ATLAS_KEYS.sprout);
    this.fitSprite();
    this.sprite.setAlpha(0);

    this.add([this.glow, this.sprite]);
    this.setDepth(STAGE.depthMoonflower);
    this.setSize(this.hitW, this.hitH);

    scene.add.existing(this);
    this.startSequence();
  }

  getPhase(): MoonflowerPhase {
    return this.phase;
  }

  containsWorldPoint(worldX: number, worldY: number): boolean {
    if (this.phase !== 'sway' || !this.active) return false;
    const left = this.x - this.hitW * 0.5;
    const top = this.y - this.hitH * 0.5;
    return (
      worldX >= left &&
      worldX <= left + this.hitW &&
      worldY >= top &&
      worldY <= top + this.hitH
    );
  }

  tap(): boolean {
    if (this.phase !== 'sway' || !this.active) return false;
    MoonflowerTapSuppress.arm();
    this.disableInteractive();
    return true;
  }

  private fitSprite(): void {
    const frame = this.sprite.frame;
    const targetH = MOONFLOWER.displayHeight;
    const fit = targetH / frame.height;
    const w = frame.width * fit;
    const h = targetH;
    this.sprite.setDisplaySize(w, h);
    this.hitW = w * MOONFLOWER.hitPad;
    this.hitH = h * MOONFLOWER.hitPad;
    this.setSize(this.hitW, this.hitH);
  }

  private drawGlow(alpha: number): void {
    this.glow.clear();
    const c = MOONFLOWER.glowColor;
    const layers = [
      { r: 36, a: alpha * 0.06 },
      { r: 26, a: alpha * 0.1 },
      { r: 16, a: alpha * 0.18 },
      { r: 8, a: alpha * 0.12 },
    ];
    for (const layer of layers) {
      this.glow.fillStyle(c, layer.a);
      this.glow.fillCircle(0, 2, layer.r);
    }
  }

  private startGlowPulse(): void {
    this.glowPulse?.stop();
    this.glowPulse = this.scene.tweens.add({
      targets: { a: MOONFLOWER.glowAlpha },
      a: MOONFLOWER.glowPulseAlpha,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: (_t, target) => {
        this.drawGlow((target as { a: number }).a);
      },
    });
  }

  private startSequence(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 1,
      duration: MOONFLOWER.fadeInMs,
      ease: 'Sine.easeOut',
      onComplete: () => this.startGlowPulse(),
    });
    this.playSprout();
  }

  private playSprout(): void {
    this.phase = 'sprout';
    if (this.scene.anims.exists(MOONFLOWER_ANIM_KEYS.sprout)) {
      this.sprite.play(MOONFLOWER_ANIM_KEYS.sprout);
      this.sprite.once(`animationcomplete-${MOONFLOWER_ANIM_KEYS.sprout}`, () =>
        this.playBloom(),
      );
    } else {
      this.scene.time.delayedCall(400, () => this.playBloom());
    }
  }

  private playBloom(): void {
    this.phase = 'bloom';
    this.sprite.setTexture(MOONFLOWER_ATLAS_KEYS.bloom);
    this.fitSprite();
    if (this.scene.anims.exists(MOONFLOWER_ANIM_KEYS.bloom)) {
      this.sprite.play(MOONFLOWER_ANIM_KEYS.bloom);
      this.sprite.once(`animationcomplete-${MOONFLOWER_ANIM_KEYS.bloom}`, () =>
        this.playSway(),
      );
    } else {
      this.scene.time.delayedCall(400, () => this.playSway());
    }
  }

  private playSway(): void {
    this.phase = 'sway';
    this.sprite.setTexture(MOONFLOWER_ATLAS_KEYS.sway);
    this.fitSprite();
    if (this.scene.anims.exists(MOONFLOWER_ANIM_KEYS.sway)) {
      this.sprite.play(MOONFLOWER_ANIM_KEYS.sway);
    }
    this.setInteractive(
      new Phaser.Geom.Rectangle(-this.hitW / 2, -this.hitH / 2, this.hitW, this.hitH),
      Phaser.Geom.Rectangle.Contains,
    );
  }

  override destroy(fromScene?: boolean): void {
    this.glowPulse?.stop();
    super.destroy(fromScene);
  }
}
