import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const assetsDir = path.join(publicDir, 'assets', 'ui');
const spritesDir = path.join(publicDir, 'assets', 'sprites');

const titleLogo = path.join(assetsDir, 'title-logo.png');
const homeWaterfall = path.join(assetsDir, 'home-waterfall.png');
const duckSleepSheet = path.join(spritesDir, 'duck_sleep.png');

/** Menu scene background — matches home screen behind the title logo. */
const ICON_BG = '#1a3a4a';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/** First frame of the in-game sleeping duck atlas (`duck_sleep`, frame_000). */
const SLEEPING_DUCK_FRAME = { left: 0, top: 0, width: 472, height: 512 };

async function loadSleepingDuckIcon() {
  return sharp(duckSleepSheet).extract(SLEEPING_DUCK_FRAME).png().toBuffer();
}

async function writeSquareIcon(input, size, outPath, format = 'png') {
  let pipeline = sharp(input).resize(size, size, {
    fit: 'contain',
    background: ICON_BG,
  });

  if (format === 'ico') {
    await pipeline.toFile(outPath);
    return;
  }

  await pipeline.png().toFile(outPath);
}

async function writeFavicon(duckIcon) {
  await writeSquareIcon(duckIcon, 32, path.join(publicDir, 'favicon.ico'), 'ico');
}

async function writeAppleTouchIcon(duckIcon) {
  await writeSquareIcon(duckIcon, 180, path.join(publicDir, 'apple-touch-icon.png'));
}

async function writeManifestIcons(duckIcon) {
  await writeSquareIcon(duckIcon, 192, path.join(publicDir, 'icon-192.png'));
  await writeSquareIcon(duckIcon, 512, path.join(publicDir, 'icon-512.png'));
}

async function writeOgImage() {
  const bg = await sharp(homeWaterfall)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const logoMeta = await sharp(titleLogo).metadata();
  const logoWidth = Math.min(720, Math.round(OG_WIDTH * 0.72));
  const logoHeight = Math.round((logoWidth / (logoMeta.width ?? 1)) * (logoMeta.height ?? 1));

  const logo = await sharp(titleLogo)
    .resize(logoWidth, logoHeight, { fit: 'inside' })
    .png()
    .toBuffer();

  const logoMetaResized = await sharp(logo).metadata();
  const left = Math.round((OG_WIDTH - (logoMetaResized.width ?? logoWidth)) / 2);
  const top = Math.round(OG_HEIGHT * 0.1);

  await sharp(bg)
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(path.join(publicDir, 'og-image.png'));
}

await mkdir(publicDir, { recursive: true });
const duckIcon = await loadSleepingDuckIcon();
await writeFavicon(duckIcon);
await writeAppleTouchIcon(duckIcon);
await writeManifestIcons(duckIcon);
await writeOgImage();
console.log(
  'Wrote public/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, og-image.png',
);
