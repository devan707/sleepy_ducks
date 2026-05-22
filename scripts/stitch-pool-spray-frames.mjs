#!/usr/bin/env node
/**
 * Stitch numbered PNG frames into pool_spray_baked.png + .json for Phaser.
 * Usage: node scripts/stitch-pool-spray-frames.mjs ./path/to/frames
 * Expects: frame_00.png, frame_01.png, ... (12 frames, 224×48 each)
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const frameW = 224;
const frameH = 48;
const frameCount = 12;

const inputDir = process.argv[2];
if (!inputDir) {
  console.error('Usage: node scripts/stitch-pool-spray-frames.mjs <frames-directory>');
  process.exit(1);
}

const files = (await readdir(inputDir))
  .filter((f) => /^frame_\d+\.png$/i.test(f))
  .sort();

if (files.length < 1) {
  console.error('No frame_XX.png files found in', inputDir);
  process.exit(1);
}

const count = Math.min(frameCount, files.length);
const composites = [];

for (let i = 0; i < count; i++) {
  const buf = await readFile(join(inputDir, files[i]));
  const resized = await sharp(buf)
    .resize(frameW, frameH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  composites.push({ input: resized, left: i * frameW, top: 0 });
}

const outDir = join(root, 'public/assets/effects');
await mkdir(outDir, { recursive: true });

const pngPath = join(outDir, 'pool_spray_baked.png');
await sharp({
  create: {
    width: frameW * count,
    height: frameH,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png()
  .toFile(pngPath);

const frames = {};
for (let i = 0; i < count; i++) {
  const name = `frame_${String(i).padStart(2, '0')}`;
  frames[name] = {
    frame: { x: i * frameW, y: 0, w: frameW, h: frameH },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: frameW, h: frameH },
    sourceSize: { w: frameW, h: frameH },
  };
}

const jsonPath = join(outDir, 'pool_spray_baked.json');
await writeFile(
  jsonPath,
  JSON.stringify(
    {
      frames,
      meta: {
        app: 'stitch-pool-spray-frames',
        version: '1.0',
        image: 'pool_spray_baked.png',
        format: 'RGBA8888',
        size: { w: frameW * count, h: frameH },
        scale: '1',
      },
    },
    null,
    2,
  ),
);

console.log('Wrote', pngPath);
console.log('Wrote', jsonPath);
