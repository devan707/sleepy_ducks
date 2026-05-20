import Phaser from 'phaser';
import { ROCK_OBSTACLES, type RockObstacleId } from '../config/gameConfig';
import { rockAnimKeyForId, rockAtlasKeyForId } from '../config/rockAssets';

export interface RockObstacleBounds {
  id: RockObstacleId;
  x: number;
  /** Foot anchor — bottom of rock sprite. */
  y: number;
  displayHeight: number;
  /** World Y of the collidable rock crown (where falls first meet the rock). */
  hitTopY: number;
  /** World Y of the bottom of the collidable rock body. */
  hitBottomY: number;
  hitRadiusX: number;
}

function resolveRockObstacle(
  placement: (typeof ROCK_OBSTACLES.placements)[number],
): RockObstacleBounds {
  const displayHeight =
    'displayHeight' in placement ? placement.displayHeight : ROCK_OBSTACLES.displayHeight;
  const hitTopFrac =
    'hitTopFrac' in placement ? placement.hitTopFrac : ROCK_OBSTACLES.hitTopFrac;
  const hitBottomFrac =
    'hitBottomFrac' in placement ? placement.hitBottomFrac : ROCK_OBSTACLES.hitBottomFrac;

  return {
    id: placement.id,
    x: placement.x,
    y: placement.y,
    displayHeight,
    hitTopY: placement.y - displayHeight * hitTopFrac,
    hitBottomY: placement.y - displayHeight * hitBottomFrac,
    hitRadiusX: placement.hitRadiusX,
  };
}

/**
 * Animated cascade rocks — collision volumes + splash sprites.
 */
export class WaterfallRocks {
  readonly obstacles: readonly RockObstacleBounds[];
  private sprites: Phaser.GameObjects.Sprite[] = [];

  constructor(scene: Phaser.Scene) {
    this.obstacles = ROCK_OBSTACLES.placements.map(resolveRockObstacle);

    for (const placement of ROCK_OBSTACLES.placements) {
      const atlasKey = rockAtlasKeyForId(placement.id);
      const animKey = rockAnimKeyForId(placement.id);
      if (!scene.textures.exists(atlasKey)) continue;

      const sprite = scene.add.sprite(placement.x, placement.y, atlasKey, 'frame_000');
      sprite.setOrigin(0.5, 1);
      this.fitRock(
        sprite,
        'displayHeight' in placement ? placement.displayHeight : undefined,
      );
      sprite.setAlpha(ROCK_OBSTACLES.alpha);
      sprite.setDepth(ROCK_OBSTACLES.depth);
      sprite.setScrollFactor(0);

      if (scene.anims.exists(animKey)) {
        sprite.play(animKey);
      }

      this.sprites.push(sprite);
    }
  }

  /** Swept band test for falling objects — catches fast movers that tunnel through. */
  hitTestSegment(
    worldX: number,
    yStart: number,
    yEnd: number,
    lead = 10,
  ): RockObstacleBounds | null {
    const lo = Math.min(yStart, yEnd);
    const hi = Math.max(yStart, yEnd) + lead;

    for (const rock of this.obstacles) {
      if (Math.abs(worldX - rock.x) > rock.hitRadiusX) continue;
      const bandTop = Math.min(rock.hitTopY, rock.hitBottomY);
      const bandBottom = Math.max(rock.hitTopY, rock.hitBottomY);
      if (hi < bandTop || lo > bandBottom) continue;
      return rock;
    }

    return null;
  }

  /** Point-in-band test. */
  hitTest(worldX: number, worldY: number): RockObstacleBounds | null {
    return this.hitTestSegment(worldX, worldY, worldY, 0);
  }

  destroy(): void {
    for (const sprite of this.sprites) {
      sprite.destroy();
    }
    this.sprites = [];
  }

  private fitRock(sprite: Phaser.GameObjects.Sprite, displayHeight?: number): void {
    const frame = sprite.frame;
    const targetH = displayHeight ?? ROCK_OBSTACLES.displayHeight;
    const fit = targetH / frame.height;
    sprite.setDisplaySize(frame.width * fit, targetH);
  }
}
