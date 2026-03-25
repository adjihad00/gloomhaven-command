# Asset Population Guide

Game assets are NOT committed to git. Populate them locally from your downloads.

## Directory Mapping

### assets/ghs/
Source: GHS client release zip (from GitHub releases)
Extract the zip, then copy:
- `assets/images/` → `assets/ghs/images/`
- `assets/data/` → `assets/ghs/data/`

These provide condition icons, element icons, character/monster artwork,
and game data JSONs (character stats, monster stats, scenario data).

### assets/worldhaven/
Source: Worldhaven repository
Copy the full repo contents here. Provides licensed high-quality
Gloomhaven/Frosthaven artwork and card images.

### assets/creator-pack/
Source: Gloomhaven Creator Pack (from Cephalofair)
Copy the full pack contents here. Provides official templates,
icons, and design assets for Gloomhaven content creation.

### assets/nerdhaven/
Source: Nerdhaven custom assets
Copy the full contents here. Provides custom community assets
for edge cases not covered by official sources.

## Usage in Code
The server serves `assets/` as a static directory at `/assets/`.
Client code references images via `/assets/ghs/images/condition/poison.svg` etc.

## Quick Setup (PowerShell)
```powershell
# From repo root, assuming .staging/ contains your downloads:
Copy-Item -Recurse .staging\ghs-client\assets\images assets\ghs\images
Copy-Item -Recurse .staging\ghs-client\assets\data assets\ghs\data
Copy-Item -Recurse .staging\worldhaven\* assets\worldhaven\
Copy-Item -Recurse .staging\creator-pack\* assets\creator-pack\
Copy-Item -Recurse .staging\nerdhaven\* assets\nerdhaven\
```
