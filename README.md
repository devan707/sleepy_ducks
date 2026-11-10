# Sleepy Ducks

Mobile-first arcade game: tap sleeping ducks before they fall into the waterfall. Built with **Phaser 3**, **TypeScript**, **Vite**, and **Capacitor**. Made by Mountain Maker Studio.

## Play online

**https://sleepyducks.app**

Friends & family beta — local high scores only, no accounts. First load may take a minute on mobile.

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for Cloudflare Pages setup and GitHub Actions secrets.

## Play locally

```bash
npm install
npm run dev
```

Open the URL shown (default `http://localhost:5173`). Use Chrome device toolbar for portrait testing.

## Build

```bash
npm run build
npm run preview
```

Regenerate link-preview icons after UI art changes:

```bash
npm run assets:web-icons
```

## Capacitor (iOS / Android)

After the web build works:

```bash
npm run build
npx cap add ios      # once
npx cap add android  # once
npm run cap:sync
npm run cap:open:ios
# or
npm run cap:open:android
```

Native projects are generated under `ios/` and `android/` (gitignored until you choose to commit them).

## Game features

- Portrait layout, tap/click input
- Score, lives (3 misses = game over), combo multiplier
- Increasing spawn rate and fall speed over time
- Golden ducks (bonus points), heavy sleepers (2 taps)
- Run stats: saved, missed, longest combo, survival time
- Local high score and personal bests (`localStorage`)
- PNG asset pipeline with canvas fallbacks if files are missing
- MP3 music and duck wake sounds; UI feedback via Web Audio

## Assets

Place art under `public/assets/` (see [`public/assets/README.md`](public/assets/README.md)). Regenerate SVG-based placeholders:

```bash
npm run assets:placeholders
```

`PreloadScene` loads every file in [`src/config/assets.ts`](src/config/assets.ts). Missing files get runtime fallback textures via [`src/assets/FallbackTextures.ts`](src/assets/FallbackTextures.ts) (Phaser Graphics only at bootstrap).

## Project structure

```
src/
  config/       Game constants + asset manifest
  assets/       AssetManager, FallbackTextures
  effects/      Mist + splash particles
  core/         Events, types, future service hooks
  models/       RunStats
  storage/      High score persistence
  audio/        SoundManager, MusicManager
  objects/      Duck, HUD, WaterfallStage
  systems/      Difficulty, spawning
  scenes/       Boot, Preload, Menu, Game, GameOver
public/assets/  PNG sprites and audio
docs/           Deployment guide
```

Future systems (progression, rewards, social, global leaderboard) can register via `GameServices` without changing core gameplay.

## Contributing

Bug reports, ideas and pull requests are welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

Code: MIT. See [`LICENSE`](./LICENSE).

Art, music and sound in `public/assets/` are not open source. All rights reserved.

Music made with [Suno](https://suno.com).
