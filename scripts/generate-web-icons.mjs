import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const assetsDir = path.join(publicDir, 'assets', 'ui');

const titleLogo = path.join(assetsDir, 'title-logo.png');
const homeWaterfall = path.join(assetsDir, 'home-waterfall.png');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

async function writeFavicon() {
  await sharp(titleLogo)
    .resize(32, 32, { fit: 'contain', background: '#1a1a2e' })
    .toFile(path.join(publicDir, 'favicon.ico'));
}

async function writeAppleTouchIcon() {
  await sharp(titleLogo)
    .resize(180, 180, { fit: 'contain', background: '#1a1a2e' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
}

async function writeOgImage() {
  const bg = await sharp(homeWaterfall)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  const logoMeta = await sharp(titleLogo).metadata();
  const logoWidth = Math.min(560, Math.round(OG_WIDTH * 0.55));
  const logoHeight = Math.round((logoWidth / (logoMeta.width ?? 1)) * (logoMeta.height ?? 1));

  const logo = await sharp(titleLogo)
    .resize(logoWidth, logoHeight, { fit: 'inside' })
    .png()
    .toBuffer();

  const logoMetaResized = await sharp(logo).metadata();
  const left = Math.round((OG_WIDTH - (logoMetaResized.width ?? logoWidth)) / 2);
  const top = Math.round(OG_HEIGHT * 0.12);

  await sharp(bg)
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(path.join(publicDir, 'og-image.png'));
}

await mkdir(publicDir, { recursive: true });
await writeFavicon();
await writeAppleTouchIcon();
await writeOgImage();
console.log('Wrote public/favicon.ico, apple-touch-icon.png, og-image.png');
