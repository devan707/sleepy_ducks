# Mobile rendering and performance testing

## Sharpness (Phase A)

After deploying, open the hosted PWA on your phone. In a dev build (`npm run dev`), check the browser console for `[canvas] diagnostics`:

- **Before fix:** `canvasBackingW` ≈ 390, `canvasBackingH` ≈ 844
- **After fix:** backing store ≈ `390 × dpr` and `844 × dpr` (dpr capped at 2)

## Waterfall FX A/B (Phase B)

Compare the same device with and without live waterfall particles:

- **Full FX:** `https://sleepyducks.app/`
- **FX off:** `https://sleepyducks.app/?waterfallFx=0`

If motion is smooth with `waterfallFx=0` but choppy without it, pool spray baking is helping; lip/rock streaks always use particles (fewer on mobile).

**Note:** Lip and rock streaks use real particle emitters on mobile. Pool-base foam uses a **baked spritesheet** when `public/assets/effects/pool_spray_baked.png` exists — see [docs/POOL_SPRAY_ART_PASS.md](docs/POOL_SPRAY_ART_PASS.md).

## Local dev URLs

- `http://127.0.0.1:5173/?waterfallFx=0`
- `http://127.0.0.1:5173/?waterfallFx=off`
