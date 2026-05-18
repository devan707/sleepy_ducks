import { ASSET_KEYS, GAME_MANIFEST, type AssetKey } from '../config/assets';
import { ENV_KEYS } from '../config/environmentAssets';
import { FallbackTextures } from './FallbackTextures';

/** Keys that must load from disk before gameplay uses real art. */
const CRITICAL_KEYS: AssetKey[] = [
  ENV_KEYS.bgCliffs,
  ENV_KEYS.foregroundRocks,
  ASSET_KEYS.atlasDuckSleep,
  ASSET_KEYS.atlasDuckWake,
  ASSET_KEYS.atlasDuckFly,
];

export class AssetManager {
  private static readonly missing = new Set<AssetKey>();
  private static readonly loadedFromFile = new Set<AssetKey>();
  private static bootstrapped = false;
  private static gameAssetsReady = false;

  static reset(): void {
    this.missing.clear();
    this.loadedFromFile.clear();
    this.bootstrapped = false;
    this.gameAssetsReady = false;
    FallbackTextures.clearFallbackTags();
  }

  static markMissing(key: AssetKey): void {
    this.missing.add(key);
    this.loadedFromFile.delete(key);
  }

  static markLoadedFromFile(key: AssetKey): void {
    this.loadedFromFile.add(key);
    this.missing.delete(key);
  }

  static markBootstrapped(): void {
    this.bootstrapped = true;
  }

  static markGameAssetsReady(): void {
    this.gameAssetsReady = true;
  }

  static isBootstrapped(): boolean {
    return this.bootstrapped;
  }

  static isGameAssetsReady(): boolean {
    return this.gameAssetsReady;
  }

  static hasRealGameplayArt(): boolean {
    return CRITICAL_KEYS.every((key) => this.loadedFromFile.has(key));
  }

  static wasLoadedFromFile(key: AssetKey): boolean {
    return this.loadedFromFile.has(key);
  }

  static usedFallback(key: AssetKey): boolean {
    return this.missing.has(key);
  }

  static getMissing(): AssetKey[] {
    return [...this.missing];
  }

  /** Drop cached gameplay textures (e.g. HMR leftovers or placeholder art). */
  static clearGameplayTextures(scene: Phaser.Scene): void {
    for (const entry of GAME_MANIFEST) {
      if (scene.textures.exists(entry.key)) {
        scene.textures.remove(entry.key);
      }
    }
    for (const key of CRITICAL_KEYS) {
      this.loadedFromFile.delete(key);
      this.missing.delete(key);
    }
    this.gameAssetsReady = false;
  }
}
