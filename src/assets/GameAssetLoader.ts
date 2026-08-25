import Phaser from 'phaser';
import { AssetManager } from './AssetManager';
import { registerBalloonAnimations } from './BalloonAnimations';
import { registerDreamweedAnimations } from './DreamweedAnimations';
import { registerRockAnimations } from './RockAnimations';
import { registerMoonflowerAnimations } from './MoonflowerAnimations';
import { registerUiButtonAnimations } from './UiButtonAnimations';
import { registerDuckAnimations } from './DuckAnimations';
import { registerEnvironmentAnimations } from './EnvironmentAnimations';
import { FallbackTextures } from './FallbackTextures';
import {
  GAME_MANIFEST,
  type AssetKey,
  type AssetManifestEntry,
} from '../config/assets';
import { resetPoolSprayBakedLoadState } from './poolSprayBakedLoader';
type ProgressCallback = (progress: number) => void;

const LOAD_TIMEOUT_MS = 180_000;
const progressListeners = new Set<ProgressCallback>();

let loadPromise: Promise<void> | null = null;

/** Drop the load handle after a successful run so the next session can retry. */
export function resetGameAssetLoadState(): void {
  if (!AssetManager.hasRealGameplayArt()) return;
  loadPromise = null;
  resetPoolSprayBakedLoadState();
}

export function queueGameAssets(loader: Phaser.Loader.LoaderPlugin): void {
  for (const entry of GAME_MANIFEST) {
    queueEntry(loader, entry);
  }
}

function queueEntry(loader: Phaser.Loader.LoaderPlugin, entry: AssetManifestEntry): void {
  const scene = loader.scene;
  if (!scene) return;

  if (AssetManager.wasLoadedFromFile(entry.key)) return;

  if (scene.textures.exists(entry.key)) {
    scene.textures.remove(entry.key);
  }

  if (entry.type === 'atlas' && entry.atlasPath) {
    loader.atlas(entry.key, entry.path, entry.atlasPath);
  } else if (entry.type === 'audio') {
    loader.audio(entry.key, entry.path);
  } else {
    loader.image(entry.key, entry.path);
  }
}

function isValidLoadedTexture(
  scene: Phaser.Scene,
  entry: AssetManifestEntry,
): boolean {
  if (!scene.textures.exists(entry.key)) return false;
  if (FallbackTextures.isFallback(entry.key)) return false;

  if (entry.type === 'atlas') {
    const frames = scene.textures
      .get(entry.key)
      .getFrameNames()
      .filter((name) => name.startsWith('frame_'));
    return frames.length > 1;
  }

  const source = scene.textures.get(entry.key).getSourceImage();
  return source instanceof HTMLImageElement && source.width > 8;
}

export function finalizeGameAssets(scene: Phaser.Scene): void {
  const missing: AssetKey[] = [];

  for (const entry of GAME_MANIFEST) {
    if (entry.type === 'audio') {
      if (scene.cache.audio.exists(entry.key)) {
        AssetManager.markLoadedFromFile(entry.key);
      }
      continue;
    }

    if (isValidLoadedTexture(scene, entry)) {
      AssetManager.markLoadedFromFile(entry.key);
      continue;
    }

    missing.push(entry.key);
    AssetManager.markMissing(entry.key);
    if (scene.textures.exists(entry.key)) {
      scene.textures.remove(entry.key);
    }
  }

  if (missing.length > 0) {
    console.warn('Using placeholder art for:', missing.join(', '));
    FallbackTextures.generateAll(scene, missing);
  }

  registerEnvironmentAnimations(scene);
  registerRockAnimations(scene);
  registerDuckAnimations(scene);
  registerBalloonAnimations(scene);
  registerMoonflowerAnimations(scene);
  registerDreamweedAnimations(scene);
  registerUiButtonAnimations(scene);
  AssetManager.markGameAssetsReady();
}

function emitProgress(progress: number): void {
  for (const listener of progressListeners) {
    listener(progress);
  }
}

export function onGameLoadProgress(callback: ProgressCallback): () => void {
  progressListeners.add(callback);
  if (AssetManager.isGameAssetsReady()) {
    callback(1);
  }
  return () => progressListeners.delete(callback);
}

function finalizeWithTimeout(scene: Phaser.Scene): void {
  if (AssetManager.isGameAssetsReady()) return;
  console.warn('Game asset load timed out — using placeholders where needed');
  try {
    finalizeGameAssets(scene);
  } catch (err) {
    console.error('Game asset finalize failed:', err);
    AssetManager.markGameAssetsReady();
  }
  emitProgress(1);
}

function beginLoad(scene: Phaser.Scene, onProgress?: ProgressCallback): Promise<void> {
  return new Promise((resolve) => {
    const loader = scene.load;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      loadPromise = null;
      onProgress?.(1);
      emitProgress(1);
      resolve();
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      loader.removeAllListeners();
      finalizeWithTimeout(scene);
      finish();
    }, LOAD_TIMEOUT_MS);

    const onLoadError = (file: Phaser.Loader.File) => {
      console.warn('Game asset failed:', file.key, file.url);
      AssetManager.markMissing(file.key as AssetKey);
    };

    const onLoadProgress = (progress: number) => {
      onProgress?.(progress);
      emitProgress(progress);
    };

    const onComplete = () => {
      loader.off('loaderror', onLoadError);
      loader.off('progress', onLoadProgress);
      loader.off('complete', onComplete);
      try {
        finalizeGameAssets(scene);
      } catch (err) {
        console.error('Game asset finalize failed:', err);
        AssetManager.markGameAssetsReady();
      }
      finish();
    };

    loader.reset();
    loader.on('loaderror', onLoadError);
    loader.on('progress', onLoadProgress);
    loader.once('complete', onComplete);

    for (const entry of GAME_MANIFEST) {
      queueEntry(loader, entry);
    }

    // totalToLoad is 0 until start() — use the pending list, or start() no-ops empty.
    if (loader.list.size === 0) {
      onComplete();
      return;
    }

    loader.start();
  });
}

/**
 * Loads gameplay atlases after the menu is visible (avoids 25MB+ blocking preload).
 */
export function loadGameAssets(
  scene: Phaser.Scene,
  onProgress?: ProgressCallback,
): Promise<void> {
  if (AssetManager.hasRealGameplayArt()) {
    if (!AssetManager.isGameAssetsReady()) {
      registerEnvironmentAnimations(scene);
      registerRockAnimations(scene);
      registerDuckAnimations(scene);
      registerBalloonAnimations(scene);
      registerMoonflowerAnimations(scene);
      registerDreamweedAnimations(scene);
      registerUiButtonAnimations(scene);
      AssetManager.markGameAssetsReady();
    }
    onProgress?.(1);
    emitProgress(1);
    return Promise.resolve();
  }

  if (loadPromise) {
    if (onProgress) {
      const unsub = onGameLoadProgress(onProgress);
      return loadPromise.finally(() => unsub());
    }
    return loadPromise;
  }

  AssetManager.clearGameplayTextures(scene);

  loadPromise = beginLoad(scene, onProgress);
  return loadPromise;
}
