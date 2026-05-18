import fs from 'node:fs';
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SUN_PATHS = [
  path.join(root, 'public/assets/environment/sun.png'),
  path.join(root, 'public/assets/backgrounds/sun.png'),
];

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

async function softenSunAlpha(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;
  let cx = w / 2;
  let cy = h / 2;
  let weightSum = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const a = data[i + 3];
      if (a > 8) {
        cx += x * a;
        cy += y * a;
        weightSum += a;
      }
    }
  }
  if (weightSum > 0) {
    cx /= weightSum;
    cy /= weightSum;
  }

  const edgeMargin = Math.round(Math.min(w, h) * 0.16);
  const radialOuter = Math.min(w, h) * 0.5;
  const radialFade = Math.min(w, h) * 0.1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const alpha = data[i + 3];
      if (alpha === 0) continue;

      const edgeDist = Math.min(x, y, w - 1 - x, h - 1 - y);
      const edgeMul = smoothstep(0, edgeMargin, edgeDist);

      const dist = Math.hypot(x - cx, y - cy);
      const radialMul =
        dist <= radialOuter ? 1 : 1 - smoothstep(radialOuter, radialOuter + radialFade, dist);

      const softened = Math.round(alpha * edgeMul * radialMul);
      data[i + 3] = softened;
    }
  }

  await sharp(data, { raw: { width: w, height: h, channels } })
    .png()
    .toFile(filePath);

  console.log(`Softened alpha vignette: ${filePath}`);
}

for (const sunPath of SUN_PATHS) {
  if (!fs.existsSync(sunPath)) continue;
  await softenSunAlpha(sunPath);
}
