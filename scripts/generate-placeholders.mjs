#!/usr/bin/env node
/**
 * Generates simple placeholder PNGs for all manifest paths.
 * Run: npm run assets:placeholders
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const publicDir = join(root, 'public');

const assets = [
  {
    path: 'assets/backgrounds/waterfall-level.png',
    width: 390,
    height: 844,
    svg: waterfallLevelSvg(),
  },
  {
    path: 'assets/backgrounds/waterfall-foreground.png',
    width: 390,
    height: 844,
    svg: waterfallForegroundSvg(),
  },
  {
    path: 'assets/sprites/duck-sleeping.png',
    width: 64,
    height: 64,
    svg: duckSvg(false),
  },
  {
    path: 'assets/sprites/duck-awake.png',
    width: 64,
    height: 64,
    svg: duckSvg(true),
  },
  {
    path: 'assets/sprites/duck-flyaway-sheet.png',
    width: 256,
    height: 64,
    svg: flyawaySheetSvg(),
  },
  {
    path: 'assets/effects/mist.png',
    width: 48,
    height: 48,
    svg: circleFxSvg('#d8eef5'),
  },
  {
    path: 'assets/effects/splash.png',
    width: 40,
    height: 40,
    svg: circleFxSvg('#6ec5e8'),
  },
  {
    path: 'assets/ui/heart.png',
    width: 28,
    height: 28,
    svg: heartSvg(),
  },
];

function waterfallLevelSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#87ceeb"/>
        <stop offset="100%" stop-color="#b8dce8"/>
      </linearGradient>
    </defs>
    <rect width="390" height="844" fill="url(#sky)"/>
    <rect y="140" width="390" height="28" fill="#3e3428"/>
    <polygon points="195,168 278,720 112,720" fill="#1a5f7a" opacity="0.75"/>
    <polygon points="195,168 248,720 142,720" fill="#2e8aaa" opacity="0.55"/>
    <rect y="160" width="390" height="8" fill="#c8eef8" opacity="0.9"/>
  </svg>`;
}

function waterfallForegroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844">
    <rect width="390" height="844" fill="none"/>
    <rect x="0" y="220" width="88" height="420" rx="12" fill="#4a3f35" opacity="0.85"/>
    <rect x="302" y="220" width="88" height="420" rx="12" fill="#4a3f35" opacity="0.85"/>
    <ellipse cx="44" cy="300" rx="28" ry="14" fill="#3d7a4a" opacity="0.8"/>
    <ellipse cx="346" cy="380" rx="32" ry="16" fill="#5a9e62" opacity="0.8"/>
    <rect y="718" width="390" height="126" fill="#d8eef5" opacity="0.4"/>
    <ellipse cx="80" cy="760" rx="40" ry="18" fill="#fff" opacity="0.15"/>
    <ellipse cx="280" cy="790" rx="50" ry="20" fill="#fff" opacity="0.12"/>
  </svg>`;
}

function duckSvg(awake) {
  const eyes = awake
    ? `<circle cx="26" cy="26" r="4" fill="#2c3e50"/><circle cx="38" cy="26" r="4" fill="#2c3e50"/>
       <rect x="16" y="34" width="12" height="8" fill="#fff" opacity="0.85"/>
       <rect x="36" y="34" width="12" height="8" fill="#fff" opacity="0.85"/>`
  : `<line x1="24" y1="26" x2="30" y2="26" stroke="#2c3e50" stroke-width="2"/>
     <line x1="34" y1="26" x2="40" y2="26" stroke="#2c3e50" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
    <ellipse cx="32" cy="36" rx="26" ry="22" fill="#f1c40f"/>
    <polygon points="38,32 52,28 52,36" fill="#e67e22"/>
    ${eyes}
  </svg>`;
}

function flyawaySheetSvg() {
  const frames = [0, 1, 2, 3].map((f) => {
    const ox = f * 64;
    const wing = f % 2 === 0 ? -8 : 8;
    return `
      <ellipse cx="${ox + 32}" cy="36" rx="24" ry="20" fill="#f1c40f"/>
      <ellipse cx="${ox + 14}" cy="${32 + wing}" rx="10" ry="6" fill="#fff" opacity="0.9"/>
      <ellipse cx="${ox + 50}" cy="${32 - wing}" rx="10" ry="6" fill="#fff" opacity="0.9"/>
      <circle cx="${ox + 26}" cy="26" r="3" fill="#2c3e50"/>
      <circle cx="${ox + 38}" cy="26" r="3" fill="#2c3e50"/>
    `;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="64">${frames.join('')}</svg>`;
}

function circleFxSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">
    <circle cx="24" cy="24" r="20" fill="${color}" opacity="0.55"/>
    <circle cx="18" cy="18" r="8" fill="#fff" opacity="0.35"/>
  </svg>`;
}

function heartSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
    <path d="M14 24 C14 24 3 16 3 10 C3 6 6 4 9 4 C11 4 13 5 14 7 C15 5 17 4 19 4 C22 4 25 6 25 10 C25 16 14 24 14 24Z" fill="#e74c3c"/>
  </svg>`;
}

async function main() {
  for (const asset of assets) {
    const out = join(publicDir, asset.path);
    await mkdir(dirname(out), { recursive: true });
    const png = await sharp(Buffer.from(asset.svg)).png().toBuffer();
    await writeFile(out, png);
    console.log('wrote', asset.path);
  }
  console.log('Done — placeholder PNGs in public/assets/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
