import Phaser from 'phaser';
import { POOL_SPRAY_BAKED } from '../config/poolSprayBake';
import { shouldUseBakedPoolSprayFx } from '../config/performanceProfile';
import { registerPoolSprayBakedAnimation } from '../effects/PoolSprayBakedPlayback';

let loadAttempted = false;
let filesPresent: boolean | null = null;

export function resetPoolSprayBakedLoadState(): void {
  loadAttempted = false;
  filesPresent = null;
}

/**
 * Optional baked pool spray — never queued during main preload.
 * Missing files 404 as HTML and crash Phaser's JSON parser (black screen).
 */
export function queuePoolSprayBakedIfNeeded(_loader: Phaser.Loader.LoaderPlugin): void {
  /* no-op: use tryLoadPoolSprayBakedWhenPresent() after files exist in public/assets/effects/ */
}

/** HEAD-check both files, then load the atlas without blocking boot. */
export async function tryLoadPoolSprayBakedWhenPresent(scene: Phaser.Scene): Promise<boolean> {
  if (!shouldUseBakedPoolSprayFx()) return false;
  if (scene.textures.exists(POOL_SPRAY_BAKED.textureKey)) {
    registerPoolSprayBakedAnimation(scene);
    return true;
  }
  if (loadAttempted) return false;

  const present = await probePoolSprayBakedFiles();
  if (!present) return false;

  loadAttempted = true;
  const completeKey = `filecomplete-atlas-${POOL_SPRAY_BAKED.textureKey}`;

  return new Promise((resolve) => {
    const loader = scene.load;
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      loader.off(completeKey, onOk);
      loader.off('filecomplete', onFileComplete);
      loader.off('loaderror', onErr);
      loader.off('complete', onLoaderComplete);
      if (!ok) loadAttempted = false;
      resolve(ok);
    };

    const onOk = () => {
      registerPoolSprayBakedAnimation(scene);
      finish(true);
    };

    const onFileComplete = (key: string) => {
      if (key === POOL_SPRAY_BAKED.textureKey) {
        registerPoolSprayBakedAnimation(scene);
        finish(true);
      }
    };

    const onLoaderComplete = () => {
      if (scene.textures.exists(POOL_SPRAY_BAKED.textureKey)) {
        registerPoolSprayBakedAnimation(scene);
        finish(true);
      }
    };

    const onErr = (file: Phaser.Loader.File) => {
      if (file.key === POOL_SPRAY_BAKED.textureKey) {
        console.warn('Pool spray baked atlas failed to load:', file.url);
        finish(false);
      }
    };

    const timeoutId = window.setTimeout(() => {
      if (!settled) finish(false);
    }, 8000);

    loader.once(completeKey, onOk);
    loader.once('filecomplete', onFileComplete);
    loader.once('loaderror', onErr);
    loader.once('complete', onLoaderComplete);
    loader.atlas(
      POOL_SPRAY_BAKED.textureKey,
      POOL_SPRAY_BAKED.png,
      POOL_SPRAY_BAKED.atlas,
    );

    if (!loader.isLoading()) {
      loader.start();
    }
  });
}

async function probePoolSprayBakedFiles(): Promise<boolean> {
  if (filesPresent !== null) return filesPresent;
  if (typeof fetch === 'undefined') {
    filesPresent = false;
    return filesPresent;
  }

  try {
    const [png, json] = await Promise.all([
      fetch(POOL_SPRAY_BAKED.png, { method: 'HEAD' }),
      fetch(POOL_SPRAY_BAKED.atlas, { method: 'HEAD' }),
    ]);
    filesPresent = png.ok && json.ok;
  } catch {
    filesPresent = false;
  }

  return filesPresent;
}
