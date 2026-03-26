# Asset Path Reference

Assets populated from `.staging/ghs-client/src/assets/images/` into `assets/ghs/images/`.
Server serves `assets/` at `/assets/`.

## Image URLs

| Category | URL Pattern | Example |
|----------|-------------|---------|
| Condition icons | `/assets/ghs/images/condition/{name}.svg` | `/assets/ghs/images/condition/stun.svg` |
| Element icons | `/assets/ghs/images/element/{name}.svg` | `/assets/ghs/images/element/fire.svg` |
| Character thumbnails | `/assets/ghs/images/character/thumbnail/{edition}-{name}.png` | `/assets/ghs/images/character/thumbnail/gh-brute.png` |
| Monster thumbnails | `/assets/ghs/images/monster/thumbnail/{edition}-{name}.png` | `/assets/ghs/images/monster/thumbnail/gh-bandit-guard.png` |

## Data URLs

| Category | URL Pattern |
|----------|-------------|
| Edition data | `/api/data/{edition}/characters` etc. (served by API, not static files) |
