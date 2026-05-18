#!/usr/bin/env node
/**
 * Generates water_channel_mask.png (780×1699) from environmentGeometry.json.
 * White = flow visible. Replace with hand-painted mask for curved cliff edges.
 * Run: node scripts/generate-water-mask.mjs
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const geometryPath = join(root, 'src/config/environmentGeometry.json');
const outPath = join(root, 'public/assets/backgrounds/water_channel_mask.png');

const W = 780;
const H = 1699;

const geometry = JSON.parse(await readFile(geometryPath, 'utf8'));
const { lipLeft, lipRight } = geometry;

const overshootLeft = 32;
const overshootRight = 32;
const bottomY = 1445;
const centerX = 390;
const bottomHalfWidth = 242;
const bottomOvershoot = 14;

const maskLeft = { x: lipLeft.x - overshootLeft, y: lipLeft.y };
const maskRight = { x: lipRight.x + overshootRight, y: lipRight.y };

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#000"/>
  <polygon fill="#fff" points="
    ${maskLeft.x},${maskLeft.y}
    ${maskRight.x},${maskRight.y}
    ${centerX + bottomHalfWidth + bottomOvershoot},${bottomY}
    ${centerX - bottomHalfWidth - bottomOvershoot},${bottomY}
  "/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log('Wrote', outPath);
console.log('Lip:', lipLeft, '→', lipRight);
