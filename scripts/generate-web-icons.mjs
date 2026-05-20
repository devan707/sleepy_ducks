import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const assetsDir = path.join(publicDir, 'assets', 'ui');

const appLogo = path.join(assetsDir, 'logo.png');
const titleLogo = path.join(assetsDir, 'title-logo.png');
const homeWaterfall = path.join(assetsDir, 'home-waterfall.png');

/** Menu scene background — matches home screen behind the title logo. */
const ICON_BG = '#1a3a4a';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

async function writeSquareIcon(input, size, outPath, format = 'png') {
  const trimmed = await sharp(input).trim().toBuffer();
  let pipeline = sharp(trimmed)
    .resize(size, size, {
      fit: 'cover',
      position: 'centre',
    })
    .flatten({ background: ICON_BG });

  if (format === 'ico') {
    await pipeline.toFile(outPath);
    return;
  }

  await pipeline.png().toFile(outPath);
}

async function writeFavicon(logo) {
  await writeSquareIcon(logo, 32, path.join(publicDir, 'favicon.ico'), 'ico');
}

async function writeAppleTouchIcon(logo) {
  await writeSquareIcon(logo, 180, path.join(publicDir, 'apple-touch-icon.png'));
}

async function writeManifestIcons(logo) {
  await writeSquareIcon(logo, 192, path.join(publicDir, 'icon-192.png'));
  await writeSquareIcon(logo, 512, path.join(publicDir, 'icon-512.png'));
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
await writeFavicon(appLogo);
await writeAppleTouchIcon(appLogo);
await writeManifestIcons(appLogo);
await writeOgImage();
console.log(
  'Wrote public/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png from assets/ui/logo.png; og-image.png from title-logo.png',
);
