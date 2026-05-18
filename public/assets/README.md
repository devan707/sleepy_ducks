# Game assets

## Environment (`environment/` or `backgrounds/`)

| File | Role |
|------|------|
| `bg_cliffs.png` | Static background (depth 0) |
| `waterfall_flow_1` | Main animated water column (~98% width, loop) |
| `waterfall_flow_2` | Overlay @ 50% opacity, slower |
| `waterfall_flow_3` | Overlay @ 35% opacity, faster, offset |
| `foreground_rocks.png` | Static frame masking water edges (depth 50) |

Animations: `waterfall_flow_1`, `waterfall_flow_2`, `waterfall_flow_3`

## Duck atlases (`sprites/`)

- `duck_sleep`, `duck_wake`, `duck_fly` — PNG + JSON hash atlases

## Effects & UI

- `effects/mist.png`, `effects/splash.png`
- `ui/heart.png`

Missing files get canvas fallbacks at preload.
