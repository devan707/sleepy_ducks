import { chromium } from 'playwright';

const port = process.argv[2] || '5175';
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const canvas = document.querySelector('#game-container canvas');
    return {
      canvas: !!canvas,
      w: canvas?.width ?? 0,
      h: canvas?.height ?? 0,
      cssW: canvas?.getBoundingClientRect().width ?? 0,
    };
  });
  if (state.canvas && state.w > 0 && state.cssW > 0) break;
}

const final = await page.evaluate(() => {
  const canvas = document.querySelector('#game-container canvas');
  const g = globalThis.__phaserGame;
  const active = g?.scene?.getScenes?.(true)?.map((s) => s.scene.key) ?? [];
  return {
    canvas: !!canvas,
    backing: canvas ? { w: canvas.width, h: canvas.height } : null,
    css: canvas
      ? {
          w: Math.round(canvas.getBoundingClientRect().width),
          h: Math.round(canvas.getBoundingClientRect().height),
        }
      : null,
    activeScenes: active,
    hasGame: !!g,
  };
});

console.log(JSON.stringify({ url, errors, final }, null, 2));
await browser.close();
