import Phaser from 'phaser';
import { BALLOON_ANIM_KEYS } from '../assets/BalloonAnimations';
import { ASSET_KEYS } from '../config/assets';
import { BALLOON, GAME_HEIGHT, GAME_WIDTH, STAGE } from '../config/gameConfig';

export type HeartBalloonTapResult = 'none' | 'popped';

export class HeartBalloon extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private velocityX = 0;
  private velocityY = 0;
  private balloonState: 'floating' | 'popping' | 'done' = 'floating';

  constructor(scene: Phaser.Scene) {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft
      ? -BALLOON.entryOffScreenX
      : GAME_WIDTH + BALLOON.entryOffScreenX;
    const y = Phaser.Math.Between(BALLOON.entryYMin, BALLOON.entryYMax);
    super(scene, x, y);

    this.sprite = scene.add.sprite(0, 0, ASSET_KEYS.atlasBalloon);
    this.sprite.setOrigin(0.5, 0.5);
    this.fitDisplay();
    this.add(this.sprite);

    const targetX = Phaser.Math.Between(GAME_WIDTH * 0.22, GAME_WIDTH * 0.78);
    const targetY = Phaser.Math.Between(GAME_HEIGHT * 0.12, GAME_HEIGHT * 0.42);
    const dx = targetX - x;
    const dy = targetY - y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = Phaser.Math.Between(BALLOON.floatSpeedMin, BALLOON.floatSpeedMax);
    this.velocityX = (dx / len) * speed;
    this.velocityY = (dy / len) * speed;

    if (scene.anims.exists(BALLOON_ANIM_KEYS.float)) {
      this.sprite.play(BALLOON_ANIM_KEYS.float);
    }

    this.setDepth(STAGE.balloonDepth);
    this.setScrollFactor(0);
    scene.add.existing(this);
  }

  updateBalloon(delta: number): void {
    if (this.balloonState === 'done') return;

    const dt = delta / 1000;
    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;

    if (this.balloonState === 'popping') return;

    if (
      this.y < -120 ||
      this.x < -120 ||
      this.x > GAME_WIDTH + 120 ||
      this.y > GAME_HEIGHT + 80
    ) {
      this.balloonState = 'done';
      this.destroy();
    }
  }

  containsWorldPoint(worldX: number, worldY: number): boolean {
    if (this.balloonState !== 'floating') return false;
    const b = this.sprite.getBounds();
    const pad = 14;
    return (
      worldX >= b.left - pad &&
      worldX <= b.right + pad &&
      worldY >= b.top - pad &&
      worldY <= b.bottom + pad
    );
  }

  tap(): HeartBalloonTapResult {
    if (this.balloonState !== 'floating') return 'none';
    this.balloonState = 'popping';

    if (this.scene.anims.exists(BALLOON_ANIM_KEYS.pop)) {
      this.sprite.play(BALLOON_ANIM_KEYS.pop);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.balloonState = 'done';
        this.destroy();
      });
    } else {
      this.balloonState = 'done';
      this.destroy();
    }

    return 'popped';
  }

  private fitDisplay(): void {
    const frame = this.sprite.frame;
    const fit = BALLOON.displayHeight / frame.height;
    this.sprite.setDisplaySize(frame.width * fit, BALLOON.displayHeight);
  }
}
