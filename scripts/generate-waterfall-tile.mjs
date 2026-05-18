#!/usr/bin/env node
/**
 * Placeholder waterfall_flow_tile.png — vertical seamless strip for TileSprite scroll.
 * Replace with your own art (64×256 or 128×512 recommended).
 * Run: node scripts/generate-waterfall-tile.mjs
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const outPath = join(root, 'public/assets/backgrounds/waterfall_flow_tile.png');

const w = 64;
const h = 256;

const streaks = Array.from({ length: 12 }, () => {
  const x = 4 + Math.floor(Math.random() * (w - 14));
  const sw = 2 + Math.floor(Math.random() * 5);
  const op = 0.15 + Math.random() * 0.35;
  return `<rect x="${x}" y="0" width="${sw}" height="${h}" fill="white" opacity="${op.toFixed(2)}"/>`;
}).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6ec5e8" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#6ec5e8" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#fade)"/>
  ${streaks}
</svg>`;

await mkdir(dirname(outPath), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log('Wrote', outPath, `(${w}×${h})`);
