# Pool spray capture — step by step

## Before you start

1. **Delete bad captures** if you copied these earlier (they can break mobile gameplay):
   - `public/assets/effects/pool_spray_baked.png`
   - `public/assets/effects/pool_spray_baked.json`
2. Use a **normal game URL** for playing (no `?bakePoolSpray=1`):
   - `http://127.0.0.1:5173/`

---

## Capture the spray PNG (desktop)

1. Start dev server:
   ```bash
   npm run dev
   ```
2. Note the port Vite prints (e.g. `5173` or `5174`).
3. Open **only this URL** in Chrome or Safari (desktop, not phone):
   ```
   http://127.0.0.1:5173/?bakePoolSpray=1
   ```
4. Wait for the loading bar to finish (~30–60s first time).
5. You should see:
   - Dark background
   - **Green rectangle** = capture area
   - White foam particles inside it (after ~1.5s warmup)
   - Status text: `Capturing… 1/12` … `12/12`
6. Two files download automatically:
   - `pool_spray_baked.png`
   - `pool_spray_baked.json`
7. Open `pool_spray_baked.png` — you should see **white/blue foam on transparent or dark**, not a solid black rectangle.
8. Copy both files into:
   ```
   public/assets/effects/
   ```
9. **Play the game normally** (no bake flag):
   ```
   http://127.0.0.1:5173/
   ```
10. Hard refresh, tap Play — gameplay should work; on mobile the falls foot uses this loop.

---

## If the PNG is still black or empty

- Reload `?bakePoolSpray=1` once and wait the full warmup.
- Use **desktop** browser (capture does not work well on phone).
- Check the green box has visible particles before capture starts.
- If still empty, say so — use manual art (below).

---

## Manual art (Aseprite) instead of capture

1. Screenshot the falls foot from normal gameplay.
2. In Aseprite: **224×48** per frame, **12 frames**, horizontal strip.
3. Export PNG + JSON (Phaser atlas).
4. Or export `frame_00.png` … `frame_11.png` and run:
   ```bash
   node scripts/stitch-pool-spray-frames.mjs ./path/to/frames
   ```
5. Copy outputs to `public/assets/effects/`.

---

## After install

| URL | Purpose |
|-----|---------|
| `/?bakePoolSpray=1` | Capture only (dev) |
| `/` | Normal game |

Mobile uses the baked loop automatically when both files exist in `public/assets/effects/`.
